"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Header } from "@/components/header"
import { MarketStatus } from "@/components/market-status"
import { IndicesTicker } from "@/components/indices-ticker"
import { ReviewPromptModal } from "@/components/review-prompt-modal"
import { CommunityTicker } from "@/components/community-ticker"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import AboutPage from "@/app/about/page"
import { MessageSquare, Sparkles } from "lucide-react"

// Ultra-fast loading: Suspense boundaries with minimal loading states
const StockList = dynamic(() => import("@/components/stock-list").then(mod => ({ default: mod.StockList })), {
  loading: () => <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2.5 p-4">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="h-16 md:h-18 bg-secondary/50 rounded-xl animate-pulse" />
    ))}
  </div>,
  ssr: true
})

const NewsSection = dynamic(() => import("@/components/news-section").then(mod => ({ default: mod.NewsSection })), {
  loading: () => null, // No visible loading for news (non-critical)
  ssr: false // Load in background
})

const GainersLosers = dynamic(() => import("@/components/gainers-losers").then(mod => ({ default: mod.GainersLosers })), {
  loading: () => <div className="h-24 bg-secondary/50 rounded-xl animate-pulse" />
})

const MostTradedStocks = dynamic(() => import("@/components/most-traded-stocks").then(mod => ({ default: mod.MostTradedStocks })), {
  loading: () => <div className="h-24 bg-secondary/50 rounded-xl animate-pulse" />
})

const FiftyTwoWeekView = dynamic(() => import("@/components/52-week-view").then(mod => ({ default: mod.FiftyTwoWeekView })), {
  loading: () => <div className="h-24 bg-secondary/50 rounded-xl animate-pulse" />
})

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Preload common stocks for instant access
    if (user) {
      import("@/lib/cache-utils").then(({ preloadCommonStocks, warmAllIndianQuotes }) => {
        preloadCommonStocks()
        void warmAllIndianQuotes()
      })

      // Prefetch other heavy components and routes so UI feels instant
      import("@/components/gainers-losers")
      import("@/components/most-traded-stocks")
      import("@/components/52-week-view")
      import("@/components/news-section")
      import("@/components/stock-card")

      // Prefetch commonly visited pages
      void router.prefetch("/top-gainers")
      void router.prefetch("/predictions")
      void router.prefetch("/stock/RELIANCE")
      void router.prefetch("/stock/TCS")
    }
  }, [user, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <AboutPage afterHomeButton={<CommunityTicker />} showHomeButton={false} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <IndicesTicker />

      <main className="mx-auto w-full max-w-[1480px] px-3 py-3 sm:px-4 md:px-5 md:py-5">
        <div className="mb-4 rounded-2xl border border-border/70 bg-card/70 px-4 py-4 shadow-[0_18px_48px_rgba(2,6,23,0.35)] backdrop-blur-md md:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Market Dashboard</h1>
            </div>
            <div className="inline-flex w-fit items-center rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-xs md:text-sm">
              <MarketStatus />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-card/60 p-2 shadow-[0_16px_40px_rgba(2,6,23,0.3)]">
              <StockList />
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/60 p-2 shadow-[0_16px_40px_rgba(2,6,23,0.3)]">
              <GainersLosers />
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/60 p-2 shadow-[0_16px_40px_rgba(2,6,23,0.3)]">
              <MostTradedStocks />
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/60 p-2 shadow-[0_16px_40px_rgba(2,6,23,0.3)]">
              <FiftyTwoWeekView type="near-high" title="52-Week" description="Stocks near their 52-week highs" limit={20} />
            </div>

            <div className="flex justify-center">
              <Button asChild className="h-10 rounded-lg px-5 text-xs md:text-sm">
                <Link href="/reviews" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>See All Reviews</span>
                  <Sparkles className="h-4 w-4 opacity-80" />
                </Link>
              </Button>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-card/70 shadow-[0_18px_52px_rgba(2,6,23,0.35)] backdrop-blur-md">
              <div className="border-b border-border/60 px-4 py-3">
                <h2 className="text-base font-semibold md:text-lg">Market News</h2>
              </div>
              <div className="p-4">
                <NewsSection limit={4} />
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Review Prompt Modal */}
      <ReviewPromptModal />
    </div>
  )
}
