import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import crypto from 'crypto'
import verifyPaymentByIdInternal from "@/app/lib/paymentsVerify"

async function handleWebhook(request: Request) {
  try {
    const bodyText = await request.text()
    const url = new URL(request.url)
    const urlPayload: Record<string, any> = {}
    url.searchParams.forEach((value, key) => {
      urlPayload[key] = value
    })

    // Verify Razorpay signature if webhook secret exists
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (webhookSecret) {
      const signature = request.headers.get('x-razorpay-signature') || request.headers.get('X-Razorpay-Signature')
      // Callback URL posts from browser may not include signature header.
      // Verify only when header is present.
      if (signature) {
        const expected = crypto.createHmac('sha256', webhookSecret).update(bodyText).digest('hex')
        const match = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
        if (!match) return NextResponse.json({ status: 'error', message: 'Invalid signature' }, { status: 400 })
      }
    }

    let payload: any = {}
    if (bodyText) {
      try {
        payload = JSON.parse(bodyText)
      } catch {
        try {
          const params = new URLSearchParams(bodyText)
          params.forEach((value, key) => {
            payload[key] = value
          })
        } catch {
          payload = {}
        }
      }
    }
    payload = { ...payload, ...urlPayload }

    // Normalize fields
    const paymentId =
      payload.payment_id ||
      payload.razorpay_payment_id ||
      payload?.payload?.payment?.entity?.id ||
      null
    const orderIdReceived =
      payload.payment_request_id ||
      payload.payment_link_id ||
      payload.razorpay_payment_link_id ||
      payload.order_id ||
      payload?.payload?.payment?.entity?.order_id ||
      null
    const statusRaw =
      payload.status ||
      payload.razorpay_payment_link_status ||
      payload?.payload?.payment?.entity?.status ||
      ''
    const status = String(statusRaw || '').toLowerCase()
    if (!status.includes('paid') && status !== 'credit' && status !== 'captured') {
      return NextResponse.json({ status: 'ignored', message: 'Payment not completed.' })
    }

    // Update payment status in database
    const databaseUrl = process.env.DATABASE_URL!
    const sql = neon(databaseUrl)

    // Find user by order id
    const searchOrderId = orderIdReceived
    if (!searchOrderId) return NextResponse.json({ status: 'error', message: 'Order id missing in webhook' })
    const orderRows = await sql`
      SELECT p.user_id, p.product_type, p.status, u.email, u.name
      FROM payment_orders p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.order_id = ${searchOrderId}
      LIMIT 1
    `
    if (!orderRows.length) return NextResponse.json({ status: 'error', message: 'Order not found.' })
    const userId = orderRows[0].user_id
    const productType = orderRows[0].product_type

    // Prefer strong verification by payment id when available.
    if (paymentId) {
      const verified = await verifyPaymentByIdInternal({ paymentId, orderId: searchOrderId, product: 'top_gainers' })
      if (verified?.verified) {
        console.log('[TOP-GAINERS WEBHOOK] ✅ Verified through helper for order:', searchOrderId)
        return NextResponse.json({ status: 'success', message: 'Payment verified and access granted.' })
      }
    }

    // Product-specific access: unlock only the module that was paid for.
    if (productType === 'predictions') {
      await sql`UPDATE users SET is_prediction_paid = true WHERE id = ${userId}`
    } else {
      await sql`UPDATE users SET is_top_gainer_paid = true WHERE id = ${userId}`
    }
    
    await sql`UPDATE payment_orders SET status = 'paid', payment_id = ${paymentId} WHERE order_id = ${searchOrderId}`

    return NextResponse.json({ status: 'success', message: 'Payment processed and access granted.' })
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'Webhook error.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return handleWebhook(request)
}

export async function GET(request: Request) {
  return handleWebhook(request)
}
