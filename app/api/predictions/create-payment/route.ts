import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { neon } from "@neondatabase/serverless"

export async function POST(req: Request) {

  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    // Dev fallback: allow passing session token in body/header/query if no cookie
    let devSessionToken: string | null = null
    if (!sessionToken && process.env.NODE_ENV !== 'production') {
      try {
        const body = await req.json()
        devSessionToken = body?.session_token || null
      } catch {}
      devSessionToken = devSessionToken || req.headers.get('x-session-token') || null
      try {
        const url = new URL(req.url)
        devSessionToken = devSessionToken || url.searchParams.get('session_token') || null
      } catch {}
      const auth = req.headers.get('authorization') || req.headers.get('Authorization')
      if (!devSessionToken && auth?.startsWith('Bearer ')) devSessionToken = auth.slice(7)
    }

    const token = sessionToken || devSessionToken
    if (!token) return NextResponse.json({ error: "Unauthorized - No session token" }, { status: 401 })

    const databaseUrl = process.env.DATABASE_URL
    const useDatabase = databaseUrl && !databaseUrl.includes('dummy')
    const sql = useDatabase ? neon(databaseUrl!) : null
    // Test mode flag (re-used in verify-payment as well)
    const testMode = !!(
      process.env.TEST_MODE === '1' ||
      !databaseUrl ||
      databaseUrl.includes('dummy') ||
      process.env.NODE_ENV !== 'production'
    )
    let user: any

    const isLocalToken = token.startsWith('local')
    if (useDatabase && sql && !isLocalToken) {
      const userRows = await sql`
        SELECT u.id, u.email, u.name, u.is_prediction_paid, u.is_top_gainer_paid
        FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.session_token = ${token}
        LIMIT 1
      `
      if (!userRows?.length) return NextResponse.json({ error: "Unauthorized - User not found" }, { status: 401 })
      user = userRows[0]
    } else {
      const parts = token.split(':')
      if (parts.length >= 2 && parts[0] === 'local') {
        const userEmail = parts[1]
        // Format user ID the same way login route does: email.replace(/[^a-zA-Z0-9]/g, "_")
        const formattedId = userEmail.replace(/[^a-zA-Z0-9]/g, "_")
        user = { id: formattedId, email: userEmail, name: userEmail.split('@')[0], is_prediction_paid: false, is_top_gainer_paid: false }
      } else {
        return NextResponse.json({ error: "Unauthorized - Invalid session" }, { status: 401 })
      }
    }

    // If user already has access, just return success instead of error.
    // In testMode we skip this check so testers can purchase repeatedly.
    if (useDatabase && user.is_prediction_paid && !testMode) {
      console.log('✅ [CREATE-PAYMENT] User already has prediction access:', user.id, '(skipping because paid)')
      return NextResponse.json({ 
        message: "You already have access to predictions", 
        alreadyPaid: true,
        redirect: '/predictions'
      }, { status: 200 })
    }

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    const configuredAmount = Number(process.env.RAZORPAY_UNLOCK_AMOUNT_PAISE || 100)
    const amountPaise = Number.isFinite(configuredAmount) && configuredAmount > 0 ? Math.floor(configuredAmount) : 100
    const isProduction = process.env.NODE_ENV === 'production'
    const isLiveKey = !!(keyId && keyId.startsWith('rzp_live_'))
    const isTestKey = !!(keyId && keyId.startsWith('rzp_test_'))
    const explicitTestMode = String(process.env.TEST_MODE || '').trim() === '1'
    const allowTestPaymentsInProd = String(process.env.ALLOW_TEST_PAYMENTS_IN_PROD || '').trim() === '1'
    const allowNonLiveInProd = allowTestPaymentsInProd || explicitTestMode || isTestKey

    if (isProduction && !isLiveKey && !allowNonLiveInProd) {
      return NextResponse.json(
        {
          error: 'Live Razorpay is not configured. For test mode set TEST_MODE=1 or ALLOW_TEST_PAYMENTS_IN_PROD=1.',
          code: 'LIVE_RAZORPAY_NOT_CONFIGURED'
        },
        { status: 503 }
      )
    }

    // Prefer configured Razorpay Payment Form URL when provided.
    // This keeps checkout on your fixed hosted payment form (rzp.io/...) instead of creating dynamic links.
    const configuredPaymentFormUrl =
      process.env.RAZORPAY_PROD ||
      process.env.NEXT_PUBLIC_RAZORPAY_PROD ||
      process.env.RAZORPAY_PROD_LINK ||
      process.env.NEXT_PUBLIC_RAZORPAY_PROD_LINK ||
      null

    if (configuredPaymentFormUrl) {
      const paymentFormOrderId = `aplink_page_${Date.now()}_${Math.random().toString(36).slice(2)}`
      if (useDatabase && sql) {
        try {
          await sql`
            INSERT INTO payment_orders (order_id, user_id, amount, currency, status, payment_gateway, product_type, created_at)
            VALUES (${paymentFormOrderId}, ${user.id}, ${amountPaise/100}, 'INR', 'created', 'razorpay', 'predictions', NOW())
            ON CONFLICT (order_id) DO NOTHING
          `
        } catch (err) {
          console.warn('[CREATE-PAYMENT] DB persist error for configured payment form URL:', err)
        }
      }
      return NextResponse.json({ orderId: paymentFormOrderId, paymentLink: configuredPaymentFormUrl }, { status: 200 })
    }

    // Prefer creating a unique Razorpay Payment Link for each purchase.
    // This gives us a real Razorpay link id to verify reliably across desktop and mobile.
    if (keyId && keySecret) {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
      const appOrigin = (process.env.NEXT_PUBLIC_APP_ORIGIN || "https://stockrupya.vercel.app").replace(/\/+$/, "")
      const callbackUrl = `${appOrigin}/predictions?from=payment&product=predictions`
      const referenceId = `pred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const payload = {
        amount: amountPaise,
        currency: "INR",
        accept_partial: false,
        description: "Unlock Predictions - StockAI",
        reference_id: referenceId,
        customer: { name: user.name || user.email, email: user.email },
        notify: { sms: false, email: true },
        reminder_enable: false,
        callback_url: callbackUrl,
        callback_method: "get",
        notes: {
          product: "predictions",
          internal_user_id: user.id,
          internal_reference_id: referenceId
        }
      }

      try {
        const resp = await fetch("https://api.razorpay.com/v1/payment_links", {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        if (resp.ok) {
          const data = await resp.json() as any
          const linkId = data.id || data.link_id || data.payment_link_id || `rzp_${Date.now()}`
          const shortUrl = data.short_url || data.short_link || data.url
          // Also create a Razorpay Order so the frontend can optionally
          // open the Checkout modal (in-page) which provides a close button
          // on mobile devices. Creating an Order is safe and lightweight.
          let razorpayOrderId: string | null = null
          try {
            const orderResp = await fetch("https://api.razorpay.com/v1/orders", {
              method: "POST",
              headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: amountPaise,
                currency: 'INR',
                receipt: linkId,
                payment_capture: 1
              })
            })
            if (orderResp.ok) {
              const orderData = await orderResp.json() as any
              razorpayOrderId = orderData.id
            } else {
              console.warn('[CREATE-PAYMENT] Razorpay order creation failed', await orderResp.text())
            }
          } catch (e) {
            console.warn('[CREATE-PAYMENT] Razorpay order creation error', e)
          }
          if (useDatabase && sql) {
            try {
              await sql`
                INSERT INTO payment_orders (order_id, user_id, amount, currency, status, payment_gateway, product_type, created_at)
                VALUES (${linkId}, ${user.id}, ${amountPaise/100}, 'INR', 'created', 'razorpay', 'predictions', NOW())
                ON CONFLICT (order_id) DO NOTHING
              `
            } catch (e) {
              console.warn('[CREATE-PAYMENT] DB persist error:', e)
            }
          }
          // Return both the payment link and (when available) the Checkout order
          return NextResponse.json({ orderId: linkId, paymentLink: shortUrl || data.long_url, razorpayOrderId, keyId, amount: amountPaise })
        }
      } catch (err) {
        console.warn('[CREATE-PAYMENT] Razorpay API error:', err)
        // fall through to test link
      }

    }
    const fallbackLink = isLiveKey
      ? (
          process.env.RAZORPAY_PROD ||
          process.env.NEXT_PUBLIC_RAZORPAY_PROD ||
          process.env.RAZORPAY_PROD_LINK ||
          process.env.NEXT_PUBLIC_RAZORPAY_PROD_LINK ||
          null
        )
      : (process.env.RAZORPAY_TEST_LINK || process.env.NEXT_PUBLIC_RAZORPAY_TEST_LINK || 'https://rzp.io/rzp/9NJNueG')

    if (!fallbackLink) {
      return NextResponse.json(
        { error: 'No Razorpay payment link configured for current mode.', code: 'PAYMENT_LINK_NOT_CONFIGURED' },
        { status: 503 }
      )
    }

    const fallbackOrderId = `${isLiveKey ? 'aplink_live' : 'aplink_test'}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    console.log(`[CREATE-PAYMENT] FALLBACK LINK MODE: ${isLiveKey ? 'live' : 'test'}`)
    
    if (useDatabase && sql) {
      try {
        // Insert payment order with CREATED status (NOT paid yet)
        await sql`
          INSERT INTO payment_orders (order_id, user_id, amount, currency, status, payment_gateway, product_type, created_at)
          VALUES (${fallbackOrderId}, ${user.id}, ${amountPaise/100}, 'INR', 'created', 'razorpay', 'predictions', NOW())
          ON CONFLICT (order_id) DO NOTHING
        `
        console.log('[CREATE-PAYMENT] Fallback payment order created:', fallbackOrderId, 'for user:', user.id)
      } catch (err) {
        console.warn('[CREATE-PAYMENT] DB error:', err)
      }
    }
    
    console.log('[CREATE-PAYMENT] Returning fallback payment link for user:', user.id, 'Order ID:', fallbackOrderId)
    return NextResponse.json({ orderId: fallbackOrderId, paymentLink: fallbackLink })

  } catch (error) {
    console.error('[CREATE-PAYMENT] Error:', error)
    return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
