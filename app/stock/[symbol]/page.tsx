"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/header"
import { IndicesTicker } from "@/components/indices-ticker"
import { LogoImage } from "@/components/logo-image"
import { StockChart } from "@/components/stock-chart"
import { CandlestickChart } from "@/components/candlestick-chart"
import { MarketStatus } from "@/components/market-status"
import { fetchStockQuote, fetchChartData, prefetchStockDetailData, type StockQuote, type ChartData } from "@/lib/yahoo-finance"
import { formatCurrency, formatPercentage, formatNumber } from "@/lib/market-utils"
import { isETF } from "@/lib/etf-holdings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, TrendingDown, ArrowLeft, BarChart3, Activity, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const TradePanel = dynamic(() => import("@/components/trade-panel").then((mod) => ({ default: mod.TradePanel })), {
  loading: () => <Skeleton className="h-64 rounded-xl" />,
})

const OptionChain = dynamic(() => import("@/components/option-chain").then((mod) => ({ default: mod.OptionChain })), {
  loading: () => <Skeleton className="h-96 rounded-xl" />,
})

const NewsSection = dynamic(() => import("@/components/news-section").then((mod) => ({ default: mod.NewsSection })), {
  loading: () => <Skeleton className="h-48 rounded-xl" />,
})

const ETFHoldings = dynamic(() => import("@/components/etf-holdings").then((mod) => ({ default: mod.ETFHoldings })), {
  loading: () => <Skeleton className="h-64 rounded-xl" />,
})

const TIME_RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y", "MAX"]

const INDIAN_INDICES = [
  "NIFTY.NS",
  "BANKNIFTY.NS", 
  "SENSEX.BO"
]

export default function StockDetailPage() {
  const params = useParams()
  const router = useRouter()
  
  const symbol = decodeURIComponent(params.symbol as string)

  // Validate symbol
  if (!symbol || symbol.trim() === '') {
    console.error('Invalid symbol:', symbol)
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <IndicesTicker />
        <main className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-xl text-muted-foreground mb-4">Invalid stock symbol</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </main>
      </div>
    )
  }

  const [stock, setStock] = useState<StockQuote | null>(null)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [currentRange, setCurrentRange] = useState("1W")
  const [activeTab, setActiveTab] = useState("candlestick")
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isIndex = INDIAN_INDICES.includes(symbol)

  const [preselectedOption, setPreselectedOption] = useState<
    | { action: "BUY" | "SELL"; type: 'CE' | 'PE'; strike: number; price: number }
    | null
  >(null)
  const [showTradeFullscreen, setShowTradeFullscreen] = useState(false)
  const [tradeInitialTab, setTradeInitialTab] = useState<"buy" | "sell">("buy")

  const handleOptionTrade = (action: "BUY" | "SELL", type: "CE" | "PE", strike: number, price: number) => {
    // send selection to TradePanel so it opens Options and highlights strike
    setPreselectedOption({ action, type, strike, price })
    setShowTradeFullscreen(true)
    // scroll the trade panel into view on smaller screens
    try {
      const el = document.getElementById('trade-panel')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch (e) {
      // ignore on server or if DOM not available
    }
  }

  const handleStockTrade = (action: "BUY" | "SELL", price: number) => {
    // For stock trading, set the initial tab
    setTradeInitialTab(action.toLowerCase() as "buy" | "sell")
    setPreselectedOption(null) // Clear any option selection
    setShowTradeFullscreen(true)
  }

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [quoteData, chartDataResult] = await Promise.all([
          fetchStockQuote(symbol),
          fetchChartData(symbol, "1W"),
        ])

        if (!quoteData) {
          setError("Stock not found or not supported on Yahoo Finance. Please check the symbol and try again.")
        } else {
          setStock(quoteData)
          setChartData(chartDataResult)
          void Promise.allSettled([
            fetchChartData(symbol, "1M"),
            fetchChartData(symbol, "1D"),
          ])
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError("Failed to load stock data. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()

    void prefetchStockDetailData(symbol)

    const interval = setInterval(async () => {
      try {
        const quoteData = await fetchStockQuote(symbol)
        if (quoteData) setStock(quoteData)
      } catch (err) {
        console.error('Error updating quote:', err)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [symbol])

  useEffect(() => {
    if (!symbol) return

    let active = true

    const loadChart = async () => {
      setChartLoading(true)
      try {
        const data = await fetchChartData(symbol, currentRange)
        if (active) {
          setChartData(data)
        }
      } catch (err) {
        console.error('Error loading chart data:', err)
        if (active) {
          setError("Failed to load chart data. Please try again.")
        }
      } finally {
        if (active) {
          setChartLoading(false)
        }
      }
    }

    loadChart()

    return () => {
      active = false
    }
  }, [symbol, currentRange])

  const handleRangeChange = async (range: string) => {
    setCurrentRange(range)
    void Promise.allSettled([
      range !== "1D" ? fetchChartData(symbol, "1D") : Promise.resolve([]),
      range !== "1M" ? fetchChartData(symbol, "1M") : Promise.resolve([]),
    ])
  }

  const handleRefresh = async () => {
    setChartLoading(true)
    const [quoteData, chartDataResult] = await Promise.all([
      fetchStockQuote(symbol),
      fetchChartData(symbol, currentRange),
    ])
    if (quoteData) setStock(quoteData)
    setChartData(chartDataResult)
    setChartLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <IndicesTicker />
        <main className="container mx-auto px-4 py-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-[clamp(260px,45vh,560px)] rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !stock) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <IndicesTicker />
        <main className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-xl text-muted-foreground mb-4">{error || "Stock not found"}</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </main>
      </div>
    )
  }

  const isPositive = stock.regularMarketChange >= 0
  const hasValid52WeekRange = stock.fiftyTwoWeekHigh > stock.fiftyTwoWeekLow && stock.fiftyTwoWeekLow > 0
  const rangePosition = hasValid52WeekRange
    ? Math.max(
        0,
        Math.min(100, ((stock.regularMarketPrice - stock.fiftyTwoWeekLow) / (stock.fiftyTwoWeekHigh - stock.fiftyTwoWeekLow)) * 100),
      )
    : 0

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <IndicesTicker />

      <main className="mx-auto w-full max-w-[1480px] px-3 py-4 md:px-5 md:py-6">
        {/* Back Button & Stock Header */}
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/65 p-4 shadow-[0_18px_52px_rgba(2,6,23,0.35)] sm:flex-row sm:items-start sm:justify-between md:mb-6">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 rounded-md md:mb-3" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
              <LogoImage symbol={stock.symbol} name={stock.longName || stock.shortName} size={48} className="h-10 w-10 md:h-12 md:w-12 rounded-md flex-shrink-0 object-cover" />
              <h1 className="text-xl font-semibold tracking-tight md:text-3xl">{symbol.replace(".NS", "").replace(".BO", "")}</h1>
              <Badge variant="secondary" className="font-mono text-xs md:text-sm">
                {stock.currency}
              </Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md md:h-8 md:w-8" onClick={handleRefresh}>
                <RefreshCw className={cn("h-3 w-3 md:h-4 md:w-4", chartLoading && "animate-spin")} />
              </Button>
            </div>
            <p className="text-muted-foreground text-sm md:text-base">{stock.longName || stock.shortName}</p>
          </div>
          <div className="self-start sm:self-auto">
            <MarketStatus />
          </div>
        </div>

        {/* Price Info */}
        <div className="mb-4 flex flex-wrap items-baseline gap-3 rounded-2xl border border-border/70 bg-card/55 px-4 py-4 shadow-[0_16px_44px_rgba(2,6,23,0.3)] md:mb-8 md:gap-4">
          <span className="font-mono text-3xl font-bold tracking-tight md:text-5xl">
            {formatCurrency(stock.regularMarketPrice)}
          </span>
          <div className={`flex items-center gap-2 ${isPositive ? "text-primary" : "text-destructive"}`}>
            {isPositive ? <TrendingUp className="h-5 w-5 md:h-6 md:w-6" /> : <TrendingDown className="h-5 w-5 md:h-6 md:w-6" />}
            <span className="text-lg md:text-2xl font-semibold">
              {isPositive ? "+" : ""}
              {formatCurrency(stock.regularMarketChange).replace("₹", "")}
            </span>
            <span className="text-lg md:text-2xl font-semibold">({formatPercentage(stock.regularMarketChangePercent)})</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:gap-6">

          {/* Main Chart Area (second on mobile) */}
          <div className="space-y-4 md:space-y-6">
            {/* Chart */}
            <Card className="overflow-hidden rounded-2xl border border-border/70 bg-card/65 shadow-[0_18px_52px_rgba(2,6,23,0.35)]">
              <CardContent className="p-3 md:p-5">
                <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="candlestick" className="w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <TabsList className="h-10 rounded-lg border border-border/60 bg-secondary/35 p-1">
                      <TabsTrigger
                        value="line"
                        className="flex items-center gap-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground md:text-sm"
                      >
                        <Activity className="h-4 w-4" />
                        Line
                      </TabsTrigger>
                      <TabsTrigger
                        value="candlestick"
                        className="flex items-center gap-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground md:text-sm"
                      >
                        <BarChart3 className="h-4 w-4" />
                        Candlestick
                      </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-1 flex-wrap">
                      {TIME_RANGES.map((range) => (
                        <Button
                          key={range}
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCurrentRange(range)
                            if (activeTab !== "candlestick") setActiveTab("candlestick")
                            handleRangeChange(range)
                          }}
                          disabled={chartLoading}
                          className={cn(
                            "rounded-full px-3 text-xs font-medium transition-all",
                            currentRange === range
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-secondary/30 hover:bg-secondary/60",
                          )}
                        >
                          {range}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {chartLoading ? (
                    <div className="h-[clamp(220px,40vh,480px)] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground">Loading chart data...</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <TabsContent value="line" className="mt-0">
                        <StockChart
                          data={chartData}
                          onRangeChange={handleRangeChange}
                          currentRange={currentRange}
                          isPositive={isPositive}
                          hideControls
                        />
                      </TabsContent>
                      <TabsContent value="candlestick" className="mt-0">
                        <CandlestickChart data={chartData} currentRange={currentRange} />
                      </TabsContent>
                    </>
                  )}
                </Tabs>
              </CardContent>
            </Card>

            {/* Buy/Sell Panel (TradePanel) */}
            <div className="mt-4">
              {symbol !== "BTC-USD" && symbol !== "BTC-INR" && <TradePanel stock={stock} preselectedOption={preselectedOption} initialTab={tradeInitialTab} allowOptions={false} />}
            </div>


            {/* Stock Stats */}
            <Card className="rounded-2xl border border-border/70 bg-card/65 shadow-[0_16px_44px_rgba(2,6,23,0.3)]">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold md:text-lg">Key Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Open</p>
                    <p className="font-mono font-semibold text-sm md:text-lg">{formatCurrency(stock.regularMarketOpen)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Previous Close</p>
                    <p className="font-mono font-semibold text-sm md:text-lg">
                      {formatCurrency(stock.regularMarketPreviousClose)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Day High</p>
                    <p className="font-mono font-semibold text-sm md:text-lg text-primary">
                      {formatCurrency(stock.regularMarketDayHigh)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Day Low</p>
                    <p className="font-mono font-semibold text-sm md:text-lg text-destructive">
                      {formatCurrency(stock.regularMarketDayLow)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">52 Week High</p>
                    <p className="font-mono font-semibold text-sm md:text-lg text-primary">
                      {hasValid52WeekRange ? formatCurrency(stock.fiftyTwoWeekHigh) : "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">52 Week Low</p>
                    <p className="font-mono font-semibold text-sm md:text-lg text-destructive">
                      {hasValid52WeekRange ? formatCurrency(stock.fiftyTwoWeekLow) : "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Volume</p>
                    <p className="font-mono font-semibold text-sm md:text-lg">{formatNumber(stock.regularMarketVolume)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Market Cap</p>
                    <p className="font-mono font-semibold text-sm md:text-lg">
                      {stock.marketCap ? `₹${(stock.marketCap / 10000000).toFixed(2)} Cr` : "N/A"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-[0.18em]">52 Week Range</p>
                      <p className="text-sm font-semibold md:text-base">
                        {hasValid52WeekRange ? "Live market position" : "52-week market data unavailable"}
                      </p>
                    </div>
                    {hasValid52WeekRange && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Current</p>
                        <p className="font-mono text-sm font-semibold md:text-base">{formatCurrency(stock.regularMarketPrice)}</p>
                      </div>
                    )}
                  </div>

                  {hasValid52WeekRange ? (
                    <>
                      <div className="relative h-3 overflow-hidden rounded-full bg-secondary/60">
                        <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-red-500/70 via-amber-400/70 to-emerald-500/70" />
                        <div
                          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-[0_0_0_4px_rgba(34,197,94,0.15)]"
                          style={{ left: `${rangePosition}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(stock.fiftyTwoWeekLow)}</span>
                        <span>{rangePosition.toFixed(1)}% of range</span>
                        <span>{formatCurrency(stock.fiftyTwoWeekHigh)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      The market feed did not return valid 52-week high/low values for this stock yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ETF Holdings - if this is an ETF */}
            {isETF(symbol) && stock && (
              <ETFHoldings 
                symbol={symbol} 
                name={stock.longName || stock.shortName || symbol}
              />
            )}

            {isIndex && stock && !showTradeFullscreen && (
              <OptionChain
                stockPrice={stock.regularMarketPrice}
                symbol={symbol}
                onTrade={handleOptionTrade}
                onStockTrade={handleStockTrade}
              />
            )}

          </div>


        </div>
        {/* News Section */}
        <div className="mt-6 rounded-2xl border border-border/70 bg-card/65 p-3 shadow-[0_16px_44px_rgba(2,6,23,0.3)] md:p-4">
          <NewsSection stockSymbol={symbol} limit={4} />
        </div>
      </main>
    </div>
  )
}
