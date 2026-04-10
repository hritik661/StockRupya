import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import verifyPaymentByIdInternal from "@/app/lib/paymentsVerify"

async function verifyRazorpayLinkPaid(orderId: string) {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return { paid: false as const, paymentId: null as string | null }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")

  try {
    const linkResp = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(orderId)}`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    })
    if (!linkResp.ok) return { paid: false as const, paymentId: null as string | null }

    const linkData: any = await linkResp.json().catch(() => ({}))
    const linkStatus = String(linkData?.status || "").toLowerCase()
    if (linkStatus !== "paid") return { paid: false as const, paymentId: null as string | null }

    let paymentId: string | null =
      linkData?.payment_id ||
      linkData?.payments?.[0]?.id ||
      linkData?.payments?.[0]?.payment_id ||
      null

    if (!paymentId) {
      const paymentsResp = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(orderId)}/payments`, {
        method: "GET",
        headers: { Authorization: `Basic ${auth}` },
        cache: "no-store",
      })
      if (paymentsResp.ok) {
        const paymentsData: any = await paymentsResp.json().catch(() => ({}))
        const items = Array.isArray(paymentsData?.items) ? paymentsData.items : []
        const captured = items.find((p: any) => String(p?.status || "").toLowerCase() === "captured") || items[0]
        paymentId = captured?.id || captured?.payment_id || null
      }
    }

    return { paid: true as const, paymentId }
  } catch {
    return { paid: false as const, paymentId: null as string | null }
  }
}

async function verifyHostedPagePaymentByRecentCapture(params: {
  sql: any
  userId: string
  existingPaymentId: string | null
  orderCreatedAt: string | Date | null
}) {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return { paid: false as const, paymentId: null as string | null }

  try {
    const configuredAmount = Number(process.env.RAZORPAY_UNLOCK_AMOUNT_PAISE || 100)
    const requiredAmountPaise = Number.isFinite(configuredAmount) && configuredAmount > 0 ? Math.floor(configuredAmount) : 100

    const userRows = await params.sql`
      SELECT email
      FROM users
      WHERE id = ${params.userId}
      LIMIT 1
    `
    const userEmail = String(userRows?.[0]?.email || "").trim().toLowerCase()

    const usedPaymentRows = await params.sql`
      SELECT payment_id
      FROM payment_orders
      WHERE payment_id IS NOT NULL AND payment_id <> ''
    `
    const usedPaymentIds = new Set(
      (Array.isArray(usedPaymentRows) ? usedPaymentRows : [])
        .map((r: any) => String(r?.payment_id || "").trim())
        .filter(Boolean)
    )

    const nowEpoch = Math.floor(Date.now() / 1000)
    const orderCreatedMs = params.orderCreatedAt ? new Date(params.orderCreatedAt).getTime() : NaN
    const orderEpoch = Number.isFinite(orderCreatedMs) ? Math.floor(orderCreatedMs / 1000) : null
    const minCreatedAtEpoch = orderEpoch ? orderEpoch - 300 : nowEpoch - 2 * 60 * 60
    const maxCreatedAtEpoch = orderEpoch ? orderEpoch + 2 * 60 * 60 : nowEpoch + 2 * 60 * 60

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")
    const paymentsResp = await fetch("https://api.razorpay.com/v1/payments?count=100", {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    })
    if (!paymentsResp.ok) return { paid: false as const, paymentId: null as string | null }

    const paymentsData: any = await paymentsResp.json().catch(() => ({}))
    const items = Array.isArray(paymentsData?.items) ? paymentsData.items : []

    const capturedMatches = items
      .filter((p: any) => {
        const paymentId = String(p?.id || "").trim()
        if (!paymentId || !paymentId.startsWith("pay_")) return false

        const status = String(p?.status || "").toLowerCase()
        const amount = Number(p?.amount || 0)
        const createdAt = Number(p?.created_at || 0)
        const alreadyUsed =
          paymentId !== String(params.existingPaymentId || "") && usedPaymentIds.has(paymentId)

        if (status !== "captured") return false
        if (amount < requiredAmountPaise) return false
        if (createdAt && (createdAt < minCreatedAtEpoch || createdAt > maxCreatedAtEpoch)) return false
        if (alreadyUsed) return false
        return true
      })
      .sort((a: any, b: any) => {
        const aEmail = String(a?.email || a?.customer_email || a?.notes?.email || "").trim().toLowerCase()
        const bEmail = String(b?.email || b?.customer_email || b?.notes?.email || "").trim().toLowerCase()
        const aEmailScore = userEmail && aEmail === userEmail ? 1 : 0
        const bEmailScore = userEmail && bEmail === userEmail ? 1 : 0
        if (bEmailScore !== aEmailScore) return bEmailScore - aEmailScore
        return Number(b?.created_at || 0) - Number(a?.created_at || 0)
      })

    const best = capturedMatches[0]
    if (!best?.id) return { paid: false as const, paymentId: null as string | null }

    return { paid: true as const, paymentId: String(best.id) }
  } catch {
    return { paid: false as const, paymentId: null as string | null }
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId =
      searchParams.get("order_id") ||
      searchParams.get("razorpay_payment_link_id") ||
      searchParams.get("payment_link_id") ||
      searchParams.get("payment_request_id")
    const paymentIdFromQuery =
      searchParams.get("payment_id") ||
      searchParams.get("razorpay_payment_id")
    const apiMode =
      searchParams.get("api") === "1" || (request.headers.get && request.headers.get("accept")?.includes("application/json"))
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || "https://hritik.vercel.app"

    const databaseUrl = process.env.DATABASE_URL || ""
    const testMode = !!(
      process.env.TEST_MODE === "1" ||
      !databaseUrl ||
      databaseUrl.includes("dummy") ||
      process.env.NODE_ENV !== "production"
    )

    if (testMode) {
      if (apiMode) return NextResponse.json({ verified: true, message: "Test mode - no database" }, { status: 200 })
      return NextResponse.redirect(`${origin}/predictions?success=paid&t=${Date.now()}`)
    }

    if (!orderId) {
      if (paymentIdFromQuery) {
        const result = await verifyPaymentByIdInternal({ paymentId: paymentIdFromQuery, orderId: null, product: "predictions" })
        if (result?.verified) {
          if (apiMode) return NextResponse.json({ verified: true, ...result }, { status: 200 })
          return NextResponse.redirect(`${origin}/predictions?success=paid&t=${Date.now()}`)
        }
        if (apiMode) {
          return NextResponse.json(
            { verified: false, error: result?.error || "payment_not_verified", reason: result?.reason || "no_record" },
            { status: 200 }
          )
        }
        return NextResponse.redirect(`${origin}/predictions?error=payment_not_verified&t=${Date.now()}`)
      }
      if (apiMode) return NextResponse.json({ verified: false, error: "missing_order" }, { status: 400 })
      return NextResponse.redirect(`${origin}/predictions?error=missing_order&t=${Date.now()}`)
    }

    const sql = neon(databaseUrl)
    const orderRows = await sql`
      SELECT status, user_id, product_type, payment_id, created_at
      FROM payment_orders
      WHERE order_id = ${orderId}
      LIMIT 1
    `

    if (!orderRows.length) {
      // Callback can send Razorpay-native order/link ids that don't match internal payment_orders.order_id.
      // If payment_id is present, verify by payment id directly so auto-verify still works.
      if (paymentIdFromQuery) {
        const result = await verifyPaymentByIdInternal({ paymentId: paymentIdFromQuery, orderId: null, product: "predictions" })
        if (result?.verified) {
          if (apiMode) return NextResponse.json({ verified: true, ...result }, { status: 200 })
          return NextResponse.redirect(`${origin}/predictions?success=paid&t=${Date.now()}`)
        }
      }
      if (apiMode) return NextResponse.json({ verified: false, error: "order_not_found" }, { status: 404 })
      return NextResponse.redirect(`${origin}/predictions?error=order_not_found&t=${Date.now()}`)
    }

    const userId = orderRows[0].user_id
    const productType = orderRows[0].product_type
    const status = String(orderRows[0].status || "").toLowerCase()
    let paymentId: string | null = orderRows[0].payment_id || null
    const orderCreatedAt = orderRows[0].created_at || null

    if (status !== "paid" && paymentIdFromQuery) {
      const verifiedByPaymentId = await verifyPaymentByIdInternal({
        paymentId: paymentIdFromQuery,
        orderId,
        product: productType === "top_gainers" ? "top_gainers" : "predictions",
      })
      if (verifiedByPaymentId?.verified) {
        paymentId = paymentIdFromQuery
      }
    }

    if (status !== "paid") {
      let razorpay = await verifyRazorpayLinkPaid(orderId)
      if (!razorpay.paid && orderId.startsWith("aplink_")) {
        razorpay = await verifyHostedPagePaymentByRecentCapture({
          sql,
          userId,
          existingPaymentId: paymentId,
          orderCreatedAt,
        })
      }
      if (razorpay.paid) {
        paymentId = razorpay.paymentId || paymentId
        await sql`
          UPDATE payment_orders
          SET status = 'paid',
              payment_id = COALESCE(${paymentId}, payment_id)
          WHERE order_id = ${orderId}
        `
      }
    }

    const refreshedRows = await sql`
      SELECT status, payment_id
      FROM payment_orders
      WHERE order_id = ${orderId}
      LIMIT 1
    `
    const finalStatus = String(refreshedRows?.[0]?.status || status || "").toLowerCase()
    paymentId = refreshedRows?.[0]?.payment_id || paymentId

    if (finalStatus !== "paid") {
      if (apiMode) {
        const hint = orderId.startsWith("aplink_")
          ? "No captured payment found yet. Ensure Razorpay keys and payment page are in same mode/account (test or live)."
          : null
        return NextResponse.json({ verified: false, status: finalStatus, orderId, paymentId, hint }, { status: 200 })
      }
      const redirectUrl = productType === "top_gainers" ? "/top-gainers" : "/predictions"
      return NextResponse.redirect(`${origin}${redirectUrl}?error=payment_not_verified&t=${Date.now()}`)
    }

    // Product-specific access: unlock only the product type tied to this order.
    if (productType === "top_gainers") {
      await sql`
        UPDATE users
        SET is_top_gainer_paid = true
        WHERE id = ${userId}
      `
    } else {
      await sql`
        UPDATE users
        SET is_prediction_paid = true
        WHERE id = ${userId}
      `
    }

    const redirectUrl = productType === "top_gainers" ? "/top-gainers" : "/predictions"
    if (apiMode) return NextResponse.json({ verified: true, orderId, userId, paymentId }, { status: 200 })
    return NextResponse.redirect(`${origin}${redirectUrl}?success=paid&t=${Date.now()}`)
  } catch (error) {
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || "https://hritik.vercel.app"
    if (request.headers.get && request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json(
        { verified: false, error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      )
    }
    return NextResponse.redirect(`${origin}/predictions?error=verify_failed&t=${Date.now()}`)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const paymentId = body?.payment_id || body?.paymentId || body?.payment_id_input || null
    if (!paymentId) return NextResponse.json({ verified: false, error: "Missing payment_id" }, { status: 400 })

    const result = await verifyPaymentByIdInternal({ paymentId, orderId: null, product: "predictions" })
    if (result?.verified) return NextResponse.json({ verified: true, ...result }, { status: 200 })

    const status = result?.reason === "razorpay_mismatch" ? 402 : result?.reason === "no_record" ? 404 : 400
    return NextResponse.json(
      { verified: false, error: result?.error || "Payment not verified", debug: result },
      { status }
    )
  } catch (err) {
    return NextResponse.json(
      { verified: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
