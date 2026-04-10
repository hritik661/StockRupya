import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { neon } from "@neondatabase/serverless"

export async function POST(req: Request) {

  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    // Dev fallback: allow passing session token in body/header/query if no cookie
    let devSessionToken: string | null = null
    let bodyData: any = {}
    
    try {
      bodyData = await req.json()
    } catch {}
    
    if (!sessionToken) {
      devSessionToken = bodyData?.session_token || null
      devSessionToken = devSessionToken || req.headers.get('x-session-token') || null
      try {
        const url = new URL(req.url)
        devSessionToken = devSessionToken || url.searchParams.get('session_token') || null
      } catch {}
      const auth = req.headers.get('authorization') || req.headers.get('Authorization')
      if (!devSessionToken && auth?.startsWith('Bearer ')) devSessionToken = auth.slice(7)
    }

    const token = sessionToken || devSessionToken
    if (!token) {
      console.warn('[CREATE-PAYMENT] No session token provided, attempting fallback')
      // Fallback: create a temporary test user for payment
      const tempUserId = `temp_${Date.now()}`
      const tempEmail = `temp_${Date.now()}@test.local`
      return NextResponse.json({ 
        error: "No session, but proceeding with test payment",
        userId: tempUserId,
        email: tempEmail
      }, { status: 400 })
    }

    const databaseUrl = process.env.DATABASE_URL
    const useDatabase = databaseUrl && !databaseUrl.includes('dummy')
    let sql: any
    let user: any

    try {
      if (useDatabase) {
        sql = neon(databaseUrl!)
      }
    } catch (err) {
      console.warn('[CREATE-PAYMENT] Failed to initialize database:', err)
      sql = null
    }

    const isLocalToken = token.startsWith('local')
    if (useDatabase && sql && !isLocalToken) {
      try {
        const userRows = await sql`
          SELECT u.id, u.email, u.name, u.is_top_gainer_paid, u.is_prediction_paid
          FROM user_sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.session_token = ${token}
          LIMIT 1
        `
        if (!userRows?.length) return NextResponse.json({ error: "Unauthorized - User not found" }, { status: 401 })
        user = userRows[0]
      } catch (err) {
        console.warn('[CREATE-PAYMENT] Database query error, using fallback:', err)
        // Fallback to local token parsing if database fails
        const parts = token.split(':')
        if (parts.length >= 2 && parts[0] === 'local') {
          const userEmail = parts[1]
          const formattedId = userEmail.replace(/[^a-zA-Z0-9]/g, "_")
          user = { id: formattedId, email: userEmail, name: userEmail.split('@')[0], is_top_gainer_paid: false, is_prediction_paid: false }
          console.log('[CREATE-PAYMENT] Using fallback user from local token:', userEmail)
        } else {
          // Even if token doesn't match expected format, create a test user
          user = { id: `user_${Date.now()}`, email: 'test@stockai.local', name: 'Test User', is_top_gainer_paid: false, is_prediction_paid: false }
          console.log('[CREATE-PAYMENT] Using temp test user due to db failure')
        }
      }
    } else {
      const parts = token.split(':')
      if (parts.length >= 2 && parts[0] === 'local') {
        const userEmail = parts[1]
        // Format user ID the same way login route does: email.replace(/[^a-zA-Z0-9]/g, "_")
        const formattedId = userEmail.replace(/[^a-zA-Z0-9]/g, "_")
        user = { id: formattedId, email: userEmail, name: userEmail.split('@')[0], is_top_gainer_paid: false, is_prediction_paid: false }
      } else {
        return NextResponse.json({ error: "Unauthorized - Invalid session" }, { status: 401 })
      }
    }

    // If user already has access, just return success instead of error
    if (user.is_top_gainer_paid) {
      console.log('✅ [CREATE-PAYMENT] User already has top gainer access:', user.id)
      return NextResponse.json({ 
        message: "You already have access to top gainers", 
        alreadyPaid: true,
        redirect: '/top-gainers'
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
            VALUES (${paymentFormOrderId}, ${user.id}, ${amountPaise/100}, 'INR', 'created', 'razorpay', 'top_gainers', NOW())
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
      const callbackUrl = `${appOrigin}/top-gainers?from=payment&product=top_gainers`
      const referenceId = `gainer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const payload = {
        amount: amountPaise,
        currency: "INR",
        accept_partial: false,
        description: "Unlock Top Gainer Stocks - StockAI",
        reference_id: referenceId,
        customer: { name: user.name || user.email, email: user.email },
        notify: { sms: false, email: true },
        reminder_enable: false,
        callback_url: callbackUrl,
        callback_method: "get",
        notes: {
          product: "top_gainers",
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
          try {
            const data = await resp.json() as any
            const linkId = data.id || data.link_id || data.payment_link_id || `rzp_${Date.now()}`
            const shortUrl = data.short_url || data.short_link || data.url
            let razorpayOrderId: string | null = null
            try {
              const orderResp = await fetch("https://api.razorpay.com/v1/orders", {
                method: "POST",
                headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  amount: amountPaise,
                  currency: "INR",
                  receipt: linkId,
                  payment_capture: 1
                })
              })
              if (orderResp.ok) {
                const orderData = await orderResp.json() as any
                razorpayOrderId = orderData?.id || null
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
                  VALUES (${linkId}, ${user.id}, ${amountPaise/100}, 'INR', 'created', 'razorpay', 'top_gainers', NOW())
                  ON CONFLICT (order_id) DO NOTHING
                `
              } catch (e) {
                console.warn('[CREATE-PAYMENT] DB persist error:', e)
              }
            }
            // Only return if we have a valid URL
            if (shortUrl || data.long_url) {
              return NextResponse.json({
                orderId: linkId,
                paymentLink: shortUrl || data.long_url,
                razorpayOrderId,
                keyId,
                amount: amountPaise
              }, { status: 200 })
            }
            // If no URL, fall through to test link
          } catch (parseErr) {
            console.warn('[CREATE-PAYMENT] Response parsing error:', parseErr)
            // fall through to test link
          }
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
          VALUES (${fallbackOrderId}, ${user.id}, ${amountPaise/100}, 'INR', 'created', 'razorpay', 'top_gainers', NOW())
          ON CONFLICT (order_id) DO NOTHING
        `
        console.log('[CREATE-PAYMENT] Fallback payment order created:', fallbackOrderId, 'for user:', user.id)
      } catch (err) {
        console.warn('[CREATE-PAYMENT] DB error (continuing anyway):', err)
      }
    }
    
    console.log('[CREATE-PAYMENT] Returning payment link for user:', user.id, 'Order ID:', fallbackOrderId)
    return NextResponse.json({
      orderId: fallbackOrderId,
      paymentLink: fallbackLink
    }, { status: 200 })

  } catch (error) {
    console.error('[CREATE-PAYMENT] Error:', error)
    return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
