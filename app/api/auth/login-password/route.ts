import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import crypto from "crypto"

type LoginUserRow = {
  id: string
  email: string
  name: string | null
  balance: number | string | null
  is_prediction_paid?: boolean | null
  is_top_gainer_paid?: boolean | null
  password_hash?: string | null
}

function isMissingColumnError(err: unknown, column: string) {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes(column) || message.includes("does not exist")
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body?.email || "").toLowerCase().trim()
    const password = String(body?.password || "")

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 })
    }

    const useDatabase = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("dummy")
    if (!useDatabase) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    try {
      await sql.unsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)")
    } catch {}

    let hasTopGainerColumn = true
    let rows: LoginUserRow[] = []
    try {
      rows = (await sql`
        SELECT id, email, name, balance, is_prediction_paid, is_top_gainer_paid, password_hash
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `) as LoginUserRow[]
    } catch (queryError) {
      if (isMissingColumnError(queryError, "is_top_gainer_paid")) {
        hasTopGainerColumn = false
        rows = (await sql`
          SELECT id, email, name, balance, is_prediction_paid, password_hash
          FROM users
          WHERE email = ${email}
          LIMIT 1
        `) as LoginUserRow[]
      } else {
        throw queryError
      }
    }

    if (!rows.length) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 400 })
    }

    const userRow = rows[0]
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex")
    if (!userRow.password_hash || userRow.password_hash !== passwordHash) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 })
    }

    const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
    try {
      await sql`
        INSERT INTO user_sessions (user_id, session_token, created_at, last_active)
        VALUES (${userRow.id}, ${sessionToken}, NOW(), NOW())
      `
    } catch (sessionError) {
      console.warn("[LOGIN-PASSWORD] Failed to create session:", sessionError)
    }

    const res = NextResponse.json({
      success: true,
      user: {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        balance: Number(userRow.balance || 0),
        isPredictionPaid: !!userRow.is_prediction_paid,
        isTopGainerPaid: hasTopGainerColumn ? !!userRow.is_top_gainer_paid : false,
      },
      sessionToken,
    })

    res.cookies.set("session_token", sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === "production",
      domain: process.env.COOKIE_DOMAIN || undefined,
    })

    return res
  } catch (err) {
    console.error("/api/auth/login-password error:", err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
