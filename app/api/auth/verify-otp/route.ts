import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { verifyAndDeleteOTP } from "@/lib/otp-store"

type VerifyOtpUserRow = {
  id: string
  balance: number | string | null
  name: string | null
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
    const otp = String(body?.otp || "").trim()

    if (!email || !otp) {
      return NextResponse.json({ success: false, error: "Email and OTP are required" }, { status: 400 })
    }

    if (process.env.NODE_ENV !== "production") {
      if (process.env.ALLOW_ANY_OTP === "true") {
        console.warn("[OTP-VERIFY] Development override: ALLOW_ANY_OTP is enabled")
      } else if (process.env.MASTER_OTP && otp === process.env.MASTER_OTP) {
        console.warn("[OTP-VERIFY] Development override: MASTER_OTP matched")
      } else {
        const verification = await verifyAndDeleteOTP(email, otp)
        if (!verification.valid) {
          return NextResponse.json({ success: false, error: verification.reason }, { status: 400 })
        }
      }
    } else {
      const verification = await verifyAndDeleteOTP(email, otp)
      if (!verification.valid) {
        return NextResponse.json({ success: false, error: verification.reason }, { status: 400 })
      }
    }

    const emailLower = email.toLowerCase()
    let userId: string
    let userBalance = 1000000
    let userName = emailLower.split("@")[0]
    let isPredictionPaid = false
    let isTopGainerPaid = false
    let isNewUser = false

    const useDatabase = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("dummy")

    if (useDatabase) {
      try {
        const sql = neon(process.env.DATABASE_URL!)
        let hasTopGainerColumn = true
        let existingUser: VerifyOtpUserRow[] = []

        try {
          existingUser = (await sql`
            SELECT id, balance, name, is_prediction_paid, is_top_gainer_paid
            FROM users
            WHERE email = ${emailLower}
            LIMIT 1
          `) as VerifyOtpUserRow[]
        } catch (queryError) {
          if (isMissingColumnError(queryError, "is_top_gainer_paid")) {
            hasTopGainerColumn = false
            existingUser = (await sql`
              SELECT id, balance, name, is_prediction_paid
              FROM users
              WHERE email = ${emailLower}
              LIMIT 1
            `) as VerifyOtpUserRow[]
          } else {
            throw queryError
          }
        }

        if (existingUser.length === 0) {
          let newUserRows: VerifyOtpUserRow[] = []

          if (hasTopGainerColumn) {
            newUserRows = (await sql`
              INSERT INTO users (email, name, balance, is_prediction_paid, is_top_gainer_paid, created_at)
              VALUES (${emailLower}, ${userName}, 1000000, false, false, NOW())
              RETURNING id, balance, name, is_prediction_paid, is_top_gainer_paid
            `) as VerifyOtpUserRow[]
          } else {
            newUserRows = (await sql`
              INSERT INTO users (email, name, balance, is_prediction_paid, created_at)
              VALUES (${emailLower}, ${userName}, 1000000, false, NOW())
              RETURNING id, balance, name, is_prediction_paid
            `) as VerifyOtpUserRow[]
          }

          const created = newUserRows[0]
          userId = created.id
          userBalance = Number(created.balance || 1000000)
          userName = created.name || userName
          isPredictionPaid = !!created.is_prediction_paid
          isTopGainerPaid = hasTopGainerColumn ? !!created.is_top_gainer_paid : false
          isNewUser = true
        } else {
          const existing = existingUser[0]
          userId = existing.id
          userBalance = Number(existing.balance || 1000000)
          userName = existing.name || userName
          isPredictionPaid = !!existing.is_prediction_paid
          isTopGainerPaid = hasTopGainerColumn ? !!existing.is_top_gainer_paid : false
        }
      } catch (dbError) {
        console.warn("[OTP-VERIFY] Database error, using local fallback:", dbError)
        userId = emailLower
        isNewUser = true
      }
    } else {
      userId = emailLower
      isNewUser = true
    }

    const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36)

    if (useDatabase) {
      try {
        const sql = neon(process.env.DATABASE_URL!)
        await sql`
          INSERT INTO user_sessions (user_id, session_token, created_at, last_active)
          VALUES (${userId}, ${sessionToken}, NOW(), NOW())
        `
      } catch (dbError) {
        console.warn("[OTP-VERIFY] Failed to create session:", dbError)
      }
    }

    const response = NextResponse.json({
      success: true,
      message: "Authentication successful",
      user: {
        email: emailLower,
        id: userId,
        name: userName,
        balance: userBalance,
        isPredictionPaid,
        isTopGainerPaid,
      },
      sessionToken,
      isNewUser,
    })

    response.cookies.set("session_token", sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === "production",
      domain: process.env.COOKIE_DOMAIN || undefined,
    })

    if (!useDatabase) {
      try {
        const sessUser = JSON.stringify({
          id: userId,
          email: emailLower,
          name: userName,
          balance: userBalance,
          isPredictionPaid,
          isTopGainerPaid,
        })
        response.cookies.set("session_user", sessUser, {
          httpOnly: false,
          path: "/",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30,
          secure: process.env.NODE_ENV === "production",
        })
      } catch (err) {
        console.warn("[OTP-VERIFY] Failed to set session_user cookie fallback:", err)
      }
    }

    return response
  } catch (error) {
    console.error("[OTP-VERIFY] Error in verify-otp:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to verify OTP",
      },
      { status: 500 },
    )
  }
}
