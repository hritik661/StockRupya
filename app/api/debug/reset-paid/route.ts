import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"

// Development-only endpoint to clear paid flags for the current user.
// Accessible when TEST_MODE=1 or when DEBUG_RESET_SECRET matches header.
export async function POST(req: Request) {
  const databaseUrl = process.env.DATABASE_URL || ''
  const testMode = !!(
    process.env.TEST_MODE === '1' ||
    !databaseUrl ||
    databaseUrl.includes('dummy') ||
    process.env.NODE_ENV !== 'production'
  )
  const secret = process.env.DEBUG_RESET_SECRET || ''
  if (!testMode) {
    const header = req.headers.get('x-debug-secret') || ''
    if (!secret || header !== secret) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  let userId: string | null = null
  try {
    const cs = await cookies()
    const sessionToken = cs.get('session_token')?.value
    if (sessionToken) {
      if (sessionToken.startsWith('local:')) {
        const parts = sessionToken.split(':')
        if (parts.length >= 2) userId = parts[1].replace(/[^a-zA-Z0-9]/g, "_")
      } else if (databaseUrl && !databaseUrl.includes('dummy')) {
        const sql = neon(databaseUrl)
        const rows = await sql`
          SELECT u.id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.session_token = ${sessionToken} LIMIT 1
        `
        if (rows?.length) userId = rows[0].id
      }
    }
  } catch (e) {
    console.warn('[DEBUG][RESET] user lookup failed', e)
  }

  if (!userId) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
  }

  if (databaseUrl && !databaseUrl.includes('dummy')) {
    try {
      const sql = neon(databaseUrl)
      await sql`UPDATE users SET is_prediction_paid = false, is_top_gainer_paid = false WHERE id = ${userId}`
      // also clear any payment_orders for ease
      await sql`UPDATE payment_orders SET status = 'created' WHERE user_id = ${userId}`
    } catch (e) {
      console.error('[DEBUG][RESET] db error', e)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, userId })
}