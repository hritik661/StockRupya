"use client"

import Link from "next/link"
import { Header } from "@/components/header"
import { IndicesTicker } from "@/components/indices-ticker"
import { NewsSection } from "@/components/news-section"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { useCallback, useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Sparkles, TrendingUp } from "lucide-react"

export default function TopGainersPage() {
  const PENDING_TOP_GAINER_ORDER_KEY = 'stockrupya_pending_top_gainer_order_id'
  const { user, isLoading, setUserFromData } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const unlockAmountPaise = Number(process.env.NEXT_PUBLIC_RAZORPAY_UNLOCK_AMOUNT_PAISE || 100000)
  const unlockAmountRupees = Math.max(
    500,
    Math.floor((Number.isFinite(unlockAmountPaise) && unlockAmountPaise > 0 ? unlockAmountPaise : 100000) / 100)
  )
  const [authReady, setAuthReady] = useState(false)
  const [verifiedPaymentStatus, setVerifiedPaymentStatus] = useState<boolean | null>(null)
  const [showPaymentSuccessModal, setShowPaymentSuccessModal] = useState(false)
  const handledPaymentRedirectRef = useRef(false)
  const shownPaymentModalRef = useRef(false)
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false)
  const [topGainers, setTopGainers] = useState<any[]>([])
  const [loadingGainers, setLoadingGainers] = useState(false)
  // In-page payment flow states
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)
  const [showPaymentIframe, setShowPaymentIframe] = useState(false)
  const [paymentIdInput, setPaymentIdInput] = useState('')
  const [paymentIdAutoDetected, setPaymentIdAutoDetected] = useState(false)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [paymentVerifyError, setPaymentVerifyError] = useState<string | null>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const autoVerifyInFlightRef = useRef(false)
  const hasPremiumAccess = (u: any) => !!u?.isTopGainerPaid
  const isTopGainerPaid = !!user?.isTopGainerPaid
  const applyTopGainerVerifiedState = useCallback(async (detectedPaymentId?: string) => {
    if (detectedPaymentId) {
      setPaymentIdInput(detectedPaymentId)
      setPaymentIdAutoDetected(true)
    }
    setPaymentVerifyError(null)
    setVerifiedPaymentStatus(true)
    setShowPaymentIframe(false)
    setPaymentUrl(null)
    setPaymentOrderId(null)
    try { localStorage.removeItem(PENDING_TOP_GAINER_ORDER_KEY) } catch {}
    try {
      const me = await fetch('/api/auth/me?t=' + Date.now(), { cache: 'no-store', credentials: 'include' })
      if (me.ok) {
        const meData = await me.json()
        if (meData?.user && setUserFromData) setUserFromData(meData.user)
        if (meData?.user?.isTopGainerPaid) setVerifiedPaymentStatus(true)
      }
    } catch {}
  }, [setUserFromData, PENDING_TOP_GAINER_ORDER_KEY])

  const tryAutoVerifyTopGainerOrder = useCallback(async (orderId: string) => {
    if (!orderId || autoVerifyInFlightRef.current) return false
    autoVerifyInFlightRef.current = true
    try {
      const q = new URLSearchParams()
      q.set('order_id', orderId)
      q.set('api', '1')
      const r = await fetch(`/api/top-gainers/verify-payment?${q.toString()}`, { cache: 'no-store', credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      const detectedPaymentId = [
        typeof j?.paymentId === 'string' ? j.paymentId : '',
        typeof j?.payment_id === 'string' ? j.payment_id : '',
        typeof j?.id === 'string' ? j.id : '',
        typeof j?.razorpay_payment_id === 'string' ? j.razorpay_payment_id : ''
      ].find((candidate) => candidate && candidate.startsWith('pay_')) || ''

      if (j?.verified) {
        await applyTopGainerVerifiedState(detectedPaymentId || undefined)
        return true
      }

      if (detectedPaymentId) {
        setPaymentIdInput(detectedPaymentId)
        setPaymentIdAutoDetected(true)
        setPaymentVerifyError(null)

        const verifyRes = await fetch('/api/top-gainers/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ payment_id: detectedPaymentId })
        })
        const verifyJson = await verifyRes.json().catch(() => ({}))
        if (verifyRes.ok && verifyJson?.verified) {
          await applyTopGainerVerifiedState(detectedPaymentId)
          return true
        }
      }

      // Fallback: if webhook or another flow already unlocked access, reflect it immediately.
      try {
        const me = await fetch('/api/auth/me?t=' + Date.now(), { cache: 'no-store', credentials: 'include' })
        if (me.ok) {
          const meData = await me.json()
          if (meData?.user?.isTopGainerPaid) {
            await applyTopGainerVerifiedState(detectedPaymentId || undefined)
            return true
          }
        }
      } catch {}

      return false
    } catch {
      return false
    } finally {
      autoVerifyInFlightRef.current = false
    }
  }, [applyTopGainerVerifiedState])

  // Verify a payment by its Razorpay payment id (used by Checkout handler and manual input)
  const verifyPaymentById = async (paymentId: string) => {
    if (!paymentId) return false
    setPaymentVerifyError(null)
    setVerifyingPayment(true)
    try {
      const res = await fetch('/api/top-gainers/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ payment_id: paymentId })
      })
      const txt = await res.text().catch(() => '')
      let j: any = {}
      try { j = txt ? JSON.parse(txt) : {} } catch (e) { j = { raw: txt } }

      console.log('[TOP-GAINERS][VERIFY BY ID] parsed JSON response', res.status, j)
      if (res.ok && j?.verified) {
        try {
          const me = await fetch('/api/auth/me?t=' + Date.now(), { cache: 'no-store', credentials: 'include' })
          if (me.ok) {
            const meData = await me.json()
            if (meData?.user && setUserFromData) setUserFromData(meData.user)
            if (hasPremiumAccess(meData?.user)) setVerifiedPaymentStatus(true)
          }
        } catch (e) { console.warn('Failed to refresh auth after Checkout verify:', e) }
        setShowPaymentIframe(false)
        setPaymentUrl(null)
        setPaymentOrderId(null)
        setPaymentIdInput('')
        setPaymentIdAutoDetected(false)
        return true
      }

      const display = j?.error ? `${j.error}${j?.reason ? ' (' + j.reason + ')' : ''}` : `Verification failed (status ${res.status}).`
      setPaymentVerifyError(`${display} ${JSON.stringify(j)}`)
      return false
    } catch (err) {
      setPaymentVerifyError(err instanceof Error ? err.message : 'Verification error')
      return false
    } finally {
      setVerifyingPayment(false)
    }
  }

  const fetchTopGainers = async () => {
    setLoadingGainers(true)
    try {
      // Try server endpoint first
      try {
        const res = await fetch('/api/top-gainers?api=1', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          const items = data?.gainers || data || []
          setTopGainers(items)
          console.log('✅ Loaded', items.length, 'gainers from API')
          return
        }
      } catch (e) {
        console.warn('API fetch failed, falling back to mock gainers', e)
      }

      // Fallback mock gainers
      const fallbackSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'LT', 'SBIN', 'AXISBANK', 'KOTAKBANK', 'BHARTIARTL']
      const fallbackGainers = fallbackSymbols.map((sym, idx) => {
        const basePrice = 100 + Math.random() * 2000
        return {
          symbol: sym,
          shortName: sym,
          regularMarketPrice: basePrice,
          regularMarketChange: +(Math.random() * 50).toFixed(2),
          regularMarketChangePercent: +(Math.random() * 10).toFixed(2),
          regularMarketVolume: Math.floor(Math.random() * 10000000),
          marketCap: 0,
          fiftyTwoWeekHigh: +(basePrice * 1.3).toFixed(2),
          fiftyTwoWeekLow: +(basePrice * 0.7).toFixed(2),
          currency: 'INR'
        }
      })

      // Sort by gain percentage (highest first)
      const sorted = fallbackGainers.sort((a, b) => (b.regularMarketChangePercent || 0) - (a.regularMarketChangePercent || 0))
      setTopGainers(sorted)
      console.log('✅ Loaded', sorted.length, 'gainers from fallback')
    } catch (err) {
      console.error('❌ Error fetching top gainers:', err)
      setTopGainers([])
    } finally {
      setLoadingGainers(false)
    }
  }

  // Verify payment on mount
  useEffect(() => {
    const verifyPaymentStatus = async () => {
      if (isLoading) return

      if (!user) {
        setVerifiedPaymentStatus(null)
        setAuthReady(true)
        return
      }

      try {
        // If auth context already says paid, skip server check and show modal once
        if (user && hasPremiumAccess(user)) {
          console.log('🔍 Auth context indicates top gainer access - skipping server verify')
          setVerifiedPaymentStatus(true)
          if (
            !shownPaymentModalRef.current &&
            (searchParams.get('from') === 'payment' ||
              searchParams.get('success') === 'paid' ||
              searchParams.get('success') === 'true')
          ) {
            shownPaymentModalRef.current = true
            setShowPaymentSuccessModal(true)
          }
          setAuthReady(true)
          return
        }

        // If redirected from payment flow, attempt server-side verify once.
        const successParam = searchParams.get('success')
        const fromPayment = searchParams.get('from') === 'payment' || successParam === 'paid' || successParam === 'true'
        const callbackOrderId =
          searchParams.get('order_id') ||
          searchParams.get('razorpay_payment_link_id') ||
          searchParams.get('payment_link_id') ||
          searchParams.get('payment_request_id')
        const callbackPaymentId =
          searchParams.get('payment_id') ||
          searchParams.get('razorpay_payment_id')
        const hasCallbackSignal = fromPayment || !!callbackOrderId || !!callbackPaymentId

        if (hasCallbackSignal && !handledPaymentRedirectRef.current) {
          handledPaymentRedirectRef.current = true
          console.log('🔍 Handling payment redirect/callback for top gainers')
          try {
            if (callbackPaymentId) {
              const verifyRes = await fetch('/api/top-gainers/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ payment_id: callbackPaymentId })
              })
              const v = await verifyRes.json().catch(() => ({}))
              if (verifyRes.ok && v?.verified) {
                await applyTopGainerVerifiedState(callbackPaymentId)
                if (fromPayment && !shownPaymentModalRef.current) {
                  shownPaymentModalRef.current = true
                  setShowPaymentSuccessModal(true)
                }
                setAuthReady(true)
                return
              }
            }

            if (callbackOrderId) {
              const q = new URLSearchParams()
              q.set('order_id', callbackOrderId)
              q.set('api', '1')
              if (callbackPaymentId) q.set('payment_id', callbackPaymentId)
              const verifyRes = await fetch(`/api/top-gainers/verify-payment?${q.toString()}`, {
                cache: 'no-store',
                credentials: 'include'
              })
              const v = await verifyRes.json().catch(() => ({}))
              const detectedPaymentId = [
                typeof v?.paymentId === 'string' ? v.paymentId : '',
                typeof v?.payment_id === 'string' ? v.payment_id : '',
                callbackPaymentId || ''
              ].find((candidate) => candidate && candidate.startsWith('pay_')) || undefined
              if (verifyRes.ok && v?.verified) {
                await applyTopGainerVerifiedState(detectedPaymentId)
                if (fromPayment && !shownPaymentModalRef.current) {
                  shownPaymentModalRef.current = true
                  setShowPaymentSuccessModal(true)
                }
                setAuthReady(true)
                return
              }
            }
          } catch (e) {
            console.warn('Error calling verify endpoint during redirect handling:', e)
          }
          // fallback to normal auth/me check below if verification didn't confirm
        }

        console.log('🔍 Verifying payment status from server...')
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)

        const res = await fetch('/api/auth/me?t=' + Date.now(), {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        clearTimeout(timeout)

        if (res.ok) {
          const data = await res.json()
          const paid = hasPremiumAccess(data?.user)
          console.log('✅ Payment verified from server:', paid)
          setVerifiedPaymentStatus(paid)
        } else {
          console.error('⚠️ Auth check failed')
          setVerifiedPaymentStatus(false)
        }
      } catch (err) {
        console.error('❌ Payment verification error:', err)
        setVerifiedPaymentStatus(false)
      } finally {
        setAuthReady(true)
      }
    }

    verifyPaymentStatus()
  }, [user, isLoading, searchParams, applyTopGainerVerifiedState])

  // Fetch gainers when user is verified as paid
  useEffect(() => {
    console.log('🔄 UseEffect: verifiedPaymentStatus changed to:', verifiedPaymentStatus)
    if (verifiedPaymentStatus === true) {
      console.log('📊 Verified payment status is true, fetching top gainers...')
      fetchTopGainers()
    }
  }, [verifiedPaymentStatus])

  useEffect(() => {
    if (!showPaymentIframe || !paymentOrderId) return

    const verifyNow = () => {
      if (document.visibilityState === 'hidden') return
      void tryAutoVerifyTopGainerOrder(paymentOrderId)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') verifyNow()
    }

    window.addEventListener('focus', verifyNow)
    window.addEventListener('pageshow', verifyNow)
    document.addEventListener('visibilitychange', handleVisibility)
    const intervalId = window.setInterval(verifyNow, 2500)
    verifyNow()

    return () => {
      window.removeEventListener('focus', verifyNow)
      window.removeEventListener('pageshow', verifyNow)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(intervalId)
    }
  }, [showPaymentIframe, paymentOrderId, tryAutoVerifyTopGainerOrder])

  // Mobile-safe fallback: recover pending order after browser/app switch and auto-verify.
  useEffect(() => {
    if (isLoading || !user || isTopGainerPaid) return

    let active = true
    let pendingOrderId: string | null = null
    try {
      pendingOrderId = localStorage.getItem(PENDING_TOP_GAINER_ORDER_KEY)
    } catch {
      pendingOrderId = null
    }
    if (!pendingOrderId) return

    let attempts = 0
    let intervalId: number | null = null

    const verifyPending = async () => {
      if (!active || !pendingOrderId) return
      attempts += 1
      const verified = await tryAutoVerifyTopGainerOrder(pendingOrderId)
      if (verified) {
        try { localStorage.removeItem(PENDING_TOP_GAINER_ORDER_KEY) } catch {}
        if (intervalId) window.clearInterval(intervalId)
      } else if (attempts >= 240 && intervalId) {
        window.clearInterval(intervalId)
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void verifyPending()
    }

    window.addEventListener('focus', verifyPending)
    window.addEventListener('pageshow', verifyPending)
    document.addEventListener('visibilitychange', handleVisibility)
    intervalId = window.setInterval(() => { void verifyPending() }, 3000)
    void verifyPending()

    return () => {
      active = false
      window.removeEventListener('focus', verifyPending)
      window.removeEventListener('pageshow', verifyPending)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [isLoading, user, isTopGainerPaid, tryAutoVerifyTopGainerOrder, PENDING_TOP_GAINER_ORDER_KEY])

  // Manual verify handler removed — verification is handled via checkout + server verify endpoints

  // Loading state
  if (isLoading || !authReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Verifying payment status...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 text-center">
          <div className="max-w-xl mx-auto">
            <TrendingUp className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Top Gainer Stocks</h1>
            <p className="text-muted-foreground mb-6">Please sign in to view top gainer stocks.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <Button asChild className="rounded-xl">
                <Link href="/login?callbackUrl=/top-gainers">Sign In</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl bg-transparent">
                <Link href="/">Back Home</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Paid user - show top gainers
  if (verifiedPaymentStatus === true) {
    return (
      <div className="min-h-screen bg-background">
        <Header hideBalance={true} />
        <div className="hidden md:block">
          <IndicesTicker />
        </div>

        {showPaymentSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-xl mx-4 bg-white dark:bg-card rounded-2xl p-8 shadow-2xl text-center">
              <h2 className="text-2xl md:text-3xl font-extrabold mb-4">🎉 Welcome to Top Gainer Stock Module!</h2>
              <p className="text-base text-muted-foreground mb-3">Your payment was successful.</p>
              <p className="text-base font-semibold mb-6">Enjoy exclusive access to top gainer stocks for lifetime. Thank you for choosing Stocks AI 🙏</p>
              <p className="text-sm text-muted-foreground mb-6">📈 Happy Investing!</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => {
                    console.log('✅ Closing modal, ready to display gainers')
                    setShowPaymentSuccessModal(false)
                    // Just hide modal - don't reload page
                  }}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-primary to-accent text-white font-bold"
                >
                  View Gainers
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="max-w-full md:max-w-7xl lg:max-w-7xl mx-auto px-3 py-4 md:px-6 md:py-8">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div>
                <h1 className="text-sm md:text-base font-bold mb-2 flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                  Top Gainer Stocks
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground">Real-time stocks showing highest gains today</p>
              </div>
            </div>
          </div>

          {loadingGainers ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div key={verifiedPaymentStatus} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3 lg:gap-4">
              {topGainers.length > 0 ? (
                topGainers.map((stock: any, idx: number) => (
                  <div
                    key={idx}
                    className="border border-primary/20 bg-card/50 rounded-lg p-3 md:p-4 hover:border-primary/40 transition-all hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm md:text-base font-bold text-foreground truncate">{stock.symbol}</h3>
                        <p className="text-xs text-muted-foreground truncate">{stock.shortName || stock.symbol}</p>
                      </div>
                      <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-500 flex-shrink-0 ml-1" />
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Price</p>
                        <p className="text-lg md:text-xl font-bold text-foreground">₹{stock.regularMarketPrice?.toFixed(2) || 'N/A'}</p>
                      </div>
                      
                      <div className="flex gap-2 text-xs md:text-sm">
                        <div className="flex-1">
                          <p className="text-muted-foreground">Change</p>
                          <p className="font-bold text-green-500">+₹{stock.regularMarketChange?.toFixed(2) || '0'}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-muted-foreground">%</p>
                          <p className="font-bold text-green-500">+{stock.regularMarketChangePercent?.toFixed(2) || '0'}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No gainers available at the moment</p>
              )}
            </div>
          )}
        </main>
      </div>
    )
  }

  // Unpaid user - show payment gate
  return (
    <div className="min-h-screen bg-background">
      <Header hideBalance={true} />
      <div className="hidden md:block">
        <IndicesTicker />
      </div>

      <main className="max-w-full md:max-w-7xl lg:max-w-7xl mx-auto px-3 py-4 md:px-6 md:py-4">
        <div className="min-h-0 flex items-start justify-center py-1 md:py-2 lg:py-3">
          <div className="w-full max-w-md md:max-w-4xl lg:max-w-5xl px-2 md:px-4">
            {/* Unlock Button at TOP */}
            <div className="mb-3 flex justify-center">
              <button
                onClick={async () => {
                  setIsProcessingPayment(true)
                  try {
                    const token = typeof window !== 'undefined' ? localStorage.getItem('stockrupya_session_token') : null
                  const headers: Record<string, string> = {}
                  if (token) headers['x-session-token'] = token
                  const res = await fetch('/api/top-gainers/create-payment', { 
                      method: 'POST',
                      credentials: 'include',
                      headers,
                    })
                    const data = await res.json()
                    const paymentLink = data?.paymentLink || data?.payment_link || data?.payment_link_url
                    if (data.alreadyPaid) {
                      alert('You already have access to top gainers!')
                      window.location.href = '/top-gainers'
                      return
                    }
                    if (!res.ok) {
                      alert(`Payment error: ${data.error || 'Unknown error'}`)
                      return
                    }
                    if (paymentLink) {
                      const orderId = data.orderId || data.order_id || data.order || null
                      // Open the hosted payment in an in-page modal (iframe)
                      setPaymentIdInput('')
                      setPaymentIdAutoDetected(false)
                      setPaymentVerifyError(null)
                      setPaymentUrl(paymentLink)
                      setPaymentOrderId(orderId)
                      if (orderId) {
                        try { localStorage.setItem(PENDING_TOP_GAINER_ORDER_KEY, orderId) } catch {}
                      }
                      setShowPaymentIframe(true)
                      // If an orderId exists, start polling server verify (useful for hosted payment links)
                      if (orderId) {
                        (async function pollOrder() {
                          const maxAttempts = 300
                          let attempts = 0
                          while (attempts < maxAttempts) {
                            try {
                              const verified = await tryAutoVerifyTopGainerOrder(orderId)
                              if (verified) return
                            } catch (e) {}
                            attempts++
                            await new Promise((res) => setTimeout(res, 1200))
                          }
                          setPaymentVerifyError('Auto-verify is taking longer. Click Verify once or paste payment ID.')
                        })()
                      }
                    }

                    if (!paymentLink && !data?.url) {
                      alert('Unable to start payment. No payment link returned. Please try again.')
                      return
                    }
                  } catch (err) {
                    alert('Payment failed. Please try again.')
                  } finally {
                    setIsProcessingPayment(false)
                  }
                }}
                disabled={isProcessingPayment}
                className="unlock-button-surface professional-unlock relative w-full max-w-[660px] flex items-center justify-center px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold md:font-extrabold text-white overflow-hidden border border-white/10 focus:outline-none focus:ring-2 focus:ring-orange-400/35"
              >
                <span className="relative z-10 flex items-center gap-2 md:gap-3">
                  <span className="text-xs md:text-sm lg:text-base flex flex-col sm:flex-row items-center gap-2">
                    {isProcessingPayment ? 'Processing...' : <>
                      <span>🔓 Unlock ₹1000</span>
                      <span className="hidden sm:inline text-primary font-bold">50% OFF ₹2000</span>
                    </>}
                  </span>
                </span>
              </button>
            </div>

            {/* Payment Header */}
            <div className="text-center mb-3 sm:mb-4 space-y-2 sm:space-y-3 animate-fade-in-up px-2">
           
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
                Instantly discover the day’s highest momentum stocks with advanced gain filters, volume signals, and real-time performance tracking.
              </p>
            </div>

            {/* Main Payment Box */}
            <div className="bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 lg:p-8 mb-4 animate-bounce-slow mx-2 sm:mx-0">
              {/* Price Section */}
              <div className="text-center mb-3">
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mb-2 font-medium tracking-widest uppercase">🔥 TOP GAINERS PASSPORT</p>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-widest">🔥 LIMITED NUMBER OFFER</p>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                    ₹1000 <span className="line-through text-muted-foreground text-xs sm:text-sm md:text-base ml-2">₹2000</span>
                  </h2>
                  <p className="text-xs text-accent font-bold">50% OFF - LIMITED SLOTS</p>
                </div>
                <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm md:text-base text-foreground font-semibold max-w-md mx-auto">
                  <li className="flex items-center justify-center gap-2 sm:gap-3">
                    <span className="text-lg sm:text-2xl flex-shrink-0">✓</span>
                    <span>Daily updated list of momentum winners</span>
                  </li>
                  <li className="flex items-center justify-center gap-2 sm:gap-3">
                    <span className="text-lg sm:text-2xl flex-shrink-0">✓</span>
                    <span>Volume & momentum filters for quick decisions</span>
                  </li>
                  <li className="flex items-center justify-center gap-2 sm:gap-3">
                    <span className="text-lg sm:text-2xl flex-shrink-0">✓</span>
                    <span>Detailed gain metrics and trend signals</span>
                  </li>
                  <li className="flex items-center justify-center gap-2 sm:gap-3">
                    <span className="text-lg sm:text-2xl flex-shrink-0">✓</span>
                    <span>Easy export of watchlist and alerts</span>
                  </li>
                  <li className="flex items-center justify-center gap-2 sm:gap-3">
                    <span className="text-lg sm:text-2xl flex-shrink-0">✓</span>
                    <span>Education Point - Learn trading strategies & analysis</span>
                  </li>
                  <li className="flex items-center justify-center gap-2 sm:gap-3">
                    <span className="text-lg sm:text-2xl flex-shrink-0">✓</span>
                    <span>Practice Point - Test strategies without real money</span>
                  </li>
                </ul>
              </div>

              {/* Features Section */}
              <div className="border-t border-primary/30 pt-2 sm:pt-3 mb-4">
                <h3 className="text-xs sm:text-sm md:text-lg font-bold mb-2 text-center">📈 What You Get</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-2 lg:gap-3">
                  <div className="bg-background/50 rounded-lg p-2 lg:p-3 space-y-0.5 sm:space-y-1">
                    <p className="font-bold text-xs sm:text-sm md:text-base">✅ Real-Time Gainers</p>
                    <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Live tracking of top performing stocks updated every minute</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2 lg:p-3 space-y-0.5 sm:space-y-1">
                    <p className="font-bold text-xs sm:text-sm md:text-base">✅ AI Analysis</p>
                    <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Machine learning insights into why stocks are gaining</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2 lg:p-3 space-y-0.5 sm:space-y-1">
                    <p className="font-bold text-xs sm:text-sm md:text-base">✅ Growth Predictions</p>
                    <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Expected targets and confidence scores for each stock</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2 lg:p-3 space-y-0.5 sm:space-y-1">
                    <p className="font-bold text-xs sm:text-sm md:text-base">✅ Market Alerts</p>
                    <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Notifications when new gainers emerge</p>
                  </div>
                </div>
              </div>

              {/* Growth Highlight */}
              <div className="bg-gradient-to-r from-blue-700/30 to-indigo-600/25 border-2 border-blue-500/50 rounded-xl p-3 text-center mb-3">
                <p className="text-2xl mb-1">📈</p>
                <p className="text-sm md:text-base font-bold text-blue-300 mb-1">Spot Gainers Before the Crowd</p>
                <p className="text-xs md:text-sm text-muted-foreground">Use momentum indicators and volume signals to identify stocks that are rising fast.</p>
              </div>

              {/* Trust & Security Section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-3 sm:p-4 text-center hover:border-green-500/60 transition">
                  <div className="text-2xl sm:text-3xl mb-2">🛡️</div>
                  <p className="text-xs sm:text-sm font-bold text-foreground">100% Secure</p>
                  <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">Bank-grade encryption & verified payments</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-3 sm:p-4 text-center hover:border-blue-500/60 transition">
                  <div className="text-2xl sm:text-3xl mb-2">⚡</div>
                  <p className="text-xs sm:text-sm font-bold text-foreground">Instant Access</p>
                  <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">Start viewing top gainers in seconds</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-3 sm:p-4 text-center hover:border-purple-500/60 transition">
                  <div className="text-2xl sm:text-3xl mb-2">⏱️</div>
                  <p className="text-xs sm:text-sm font-bold text-foreground">Lifetime Deal</p>
                  <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">Never expire, pay only once forever</p>
                </div>
              </div>

              {/* Limited Slots Warning */}
              <div className="bg-gradient-to-r from-orange-500/20 via-red-500/20 to-orange-500/20 border-2 border-orange-500/50 rounded-xl p-3 sm:p-4 mb-4 animate-pulse">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg sm:text-2xl">⏰</span>
                  <div className="text-center">
                    <p className="text-xs sm:text-sm font-bold text-orange-400">LIMITED SLOTS REMAINING</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Only 50 slots available at this special price • Offer valid today</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-2 sm:mx-0 mb-4 rounded-xl border border-primary/35 bg-gradient-to-r from-primary/10 via-background to-accent/10 p-4">
              <p className="text-[11px] sm:text-xs uppercase tracking-[0.2em] text-primary/80 font-semibold mb-1">Community Reviews</p>
              <h3 className="text-sm sm:text-base md:text-lg font-bold mb-1">Trusted by Momentum Traders</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                See how users are finding top gainers faster with live tracking and AI insights.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button asChild className="rounded-lg font-semibold">
                  <Link href="/reviews">See All Reviews</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-lg border-primary/40">
                  <Link href="/about">Explore Features</Link>
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 justify-center animate-fade-in">
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 rounded-md border-2 border-muted-foreground hover:border-foreground hover:bg-muted/50 transition font-semibold text-sm md:text-base text-foreground"
              >
                ✕ Cancel
              </button>
            </div>

            {/* Manual verify input removed per request — verification is handled via checkout and server verify endpoints */}
          </div>
        </div>
      </main>
      {/* In-page payment iframe + manual payment-id verification */}
      {showPaymentIframe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-1 sm:p-3 md:p-4 lg:p-6">
          <div className="relative w-full h-[88vh] sm:h-[92vh] md:h-[97vh] max-h-[88vh] sm:max-h-[92vh] md:max-h-[97vh] max-w-7xl lg:max-w-[99vw] xl:max-w-[1900px] 2xl:max-w-[2050px] rounded-lg sm:rounded-xl md:rounded-2xl bg-gradient-to-br from-gray-900/95 to-black/95 overflow-hidden flex flex-col ring-1 ring-white/10">
            {/* Close button */}
            <button
              onClick={() => setShowPaymentIframe(false)}
              aria-label="Close payment"
              className="absolute top-2 right-2 sm:top-3 sm:right-3 z-50 w-8 sm:w-10 h-8 sm:h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white shadow-lg text-lg sm:text-xl md:hidden"
            >
              ✕
            </button>

            {/* Header - compact on mobile */}
            <div className="flex items-center justify-between px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 border-b border-white/10 bg-black/40 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xs sm:text-base md:text-lg font-bold text-white">Complete Payment</div>
                <div className="hidden sm:inline-block px-2 py-0.5 text-xs rounded-md bg-white/10 text-white/80 font-medium">Secure</div>
              </div>
              <button
                onClick={() => setShowPaymentIframe(false)}
                className="hidden sm:inline-block px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-xs text-white font-medium transition-colors"
              >
                Close
              </button>
            </div>

            {/* Main Grid */}
            <div className="flex-1 grid grid-cols-1 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_230px] lg:grid-cols-[minmax(0,1fr)_320px] md:grid-rows-1 gap-0 overflow-hidden min-h-0">
              {/* Iframe Section - 1 col mobile, 2 cols tablet, 3 cols desktop */}
              <div className="md:border-r border-white/10 min-h-0 h-full bg-white">
                <iframe
                  src={paymentUrl || ''}
                  title="Payment"
                  className="w-full h-full border-0"
                  allowFullScreen
                  loading="lazy"
                />
              </div>

              {/* Right Sidebar */}
              <div className="border-t md:border-t-0 border-white/10 p-2 sm:p-3 md:p-4 lg:p-6 bg-gradient-to-b from-black/60 to-black/40 min-h-0 max-h-[30vh] md:max-h-none overflow-y-auto">
                <div className="space-y-2 sm:space-y-3 md:space-y-4">
                  <div className="text-[10px] sm:text-xs md:text-sm lg:text-base text-white/80 leading-tight">Payment ID auto-detects after successful payment. If needed, paste manually and verify.</div>

                  <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 min-w-0">
                    <input
                      value={paymentIdInput}
                      onChange={(e) => { setPaymentIdInput(e.target.value); setPaymentIdAutoDetected(false); setPaymentVerifyError(null) }}
                      placeholder="pay_XXX"
                      className="flex-1 min-w-0 px-1.5 sm:px-2.5 md:px-3 lg:px-4 py-1 sm:py-1.5 md:py-2.5 lg:py-3 text-[10px] sm:text-xs md:text-sm lg:text-base bg-white/8 hover:bg-white/12 placeholder-white/50 rounded text-white outline-none transition-colors focus:bg-white/15 focus:ring-1 focus:ring-emerald-400"
                    />
                    <button
                      onClick={async () => {
                        setPaymentVerifyError(null)
                        if (!paymentIdInput && !paymentOrderId) {
                          setPaymentVerifyError('Please enter the payment id or use the current order verification.')
                          return
                        }
                        if (!paymentIdInput && paymentOrderId) {
                          setVerifyingPayment(true)
                          try {
                            const q = new URLSearchParams()
                            q.set('order_id', paymentOrderId)
                            q.set('api', '1')
                            const res = await fetch(`/api/top-gainers/verify-payment?${q.toString()}`, { cache: 'no-store' })
                            const j = await res.json().catch(() => ({}))
                            if (res.ok && j?.verified) {
                              setVerifiedPaymentStatus(true)
                              setShowPaymentIframe(false)
                              setPaymentUrl(null)
                              setPaymentOrderId(null)
                              setPaymentVerifyError(null)
                              fetchTopGainers()
                              try {
                                const me = await fetch('/api/auth/me?t=' + Date.now(), { cache: 'no-store', credentials: 'include' })
                                if (me.ok) {
                                  const meData = await me.json()
                                  if (meData?.user && setUserFromData) setUserFromData(meData.user)
                                }
                              } catch {}
                              return
                            }
                            setPaymentVerifyError(j?.hint || j?.error || 'Payment not verified yet. Please wait a few seconds and try again.')
                            return
                          } catch (e) {
                            setPaymentVerifyError(e instanceof Error ? e.message : 'Verification failed')
                            return
                          } finally {
                            setVerifyingPayment(false)
                          }
                        }
                        setVerifyingPayment(true)
                        const ok = await verifyPaymentById(paymentIdInput)
                        setVerifyingPayment(false)
                        if (ok) {
                          fetchTopGainers()
                        }
                      }}
                      disabled={verifyingPayment}
                      className="flex-shrink-0 px-2 sm:px-2.5 md:px-4 lg:px-5 py-1 sm:py-1.5 md:py-2.5 lg:py-3 rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-[10px] sm:text-xs md:text-sm lg:text-base font-bold transition-all transform hover:scale-105 active:scale-95"
                    >
                      {verifyingPayment ? '⏳' : 'Verify'}
                    </button>
                  </div>
                  {paymentIdAutoDetected && <p className="text-[9px] sm:text-xs md:text-sm text-emerald-400">Payment ID detected automatically. Click Verify.</p>}
                  {paymentVerifyError && <p className="text-[9px] sm:text-xs md:text-sm text-red-400">{paymentVerifyError}</p>}

                  <div className="pt-2 sm:pt-2.5 md:pt-3 border-t border-white/10">
                    <div className="font-semibold mb-1.5 md:mb-2 text-emerald-300 text-[10px] sm:text-xs md:text-sm lg:text-base">✨ Benefits</div>
                    <ul className="space-y-0.5 sm:space-y-1 md:space-y-1.5 text-[9px] sm:text-xs md:text-sm text-white/70">
                      <li className="flex items-start gap-1"><span className="text-emerald-400 flex-shrink-0">✓</span><span>Top gainers NSE & BSE</span></li>
                      <li className="flex items-start gap-1"><span className="text-emerald-400 flex-shrink-0">✓</span><span>Lifetime access</span></li>
                      <li className="flex items-start gap-1"><span className="text-emerald-400 flex-shrink-0">✓</span><span>Live AI updates</span></li>
                      <li className="flex items-start gap-1"><span className="text-emerald-400 flex-shrink-0">✓</span><span>Secure payment</span></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
