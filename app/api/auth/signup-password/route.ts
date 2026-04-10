import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import crypto from "crypto"

type SignupUserRow = {
  id: string
  email: string
  name: string | null
  balance: number | string | null
  is_prediction_paid?: boolean | null
  is_top_gainer_paid?: boolean | null
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
    const name = String(body?.name || "").trim()

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

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: "Account already exists" }, { status: 400 })
    }

    const passwordHash = crypto.createHash("sha256").update(password).digest("hex")
    const userName = name || email.split("@")[0]

    let hasTopGainerColumn = true
    let inserted: SignupUserRow[] = []
    try {
      inserted = (await sql`
        INSERT INTO users (email, name, balance, is_prediction_paid, is_top_gainer_paid, created_at, password_hash)
        VALUES (${email}, ${userName}, 1000000, false, false, NOW(), ${passwordHash})
        RETURNING id, email, name, balance, is_prediction_paid, is_top_gainer_paid
      `) as SignupUserRow[]
    } catch (insertError) {
      if (isMissingColumnError(insertError, "is_top_gainer_paid")) {
        hasTopGainerColumn = false
        inserted = (await sql`
          INSERT INTO users (email, name, balance, is_prediction_paid, created_at, password_hash)
          VALUES (${email}, ${userName}, 1000000, false, NOW(), ${passwordHash})
          RETURNING id, email, name, balance, is_prediction_paid
        `) as SignupUserRow[]
      } else {
        throw insertError
      }
    }

    const user = inserted[0]
    const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
    try {
      await sql`
        INSERT INTO user_sessions (user_id, session_token, created_at, last_active)
        VALUES (${user.id}, ${sessionToken}, NOW(), NOW())
      `
    } catch (sessionError) {
      console.warn("[SIGNUP-PASSWORD] Failed to create session:", sessionError)
    }

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        balance: Number(user.balance || 0),
        isPredictionPaid: !!user.is_prediction_paid,
        isTopGainerPaid: hasTopGainerColumn ? !!user.is_top_gainer_paid : false,
      },
    })

    res.cookies.set("session_token", sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === "production",
    })

    const secureSuffix = process.env.NODE_ENV === "production" ? "; Secure" : ""
    const cookieValue = `session_token=${sessionToken}; Path=/; SameSite=Lax; HttpOnly; Max-Age=${60 * 60 * 24 * 30}${secureSuffix}`
    res.headers.append("Set-Cookie", cookieValue)

    return res
  } catch (err) {
    console.error("/api/auth/signup-password error:", err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
