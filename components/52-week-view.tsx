"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatPercentage } from "@/lib/market-utils"
import type { FiftyTwoWeekData, FiftyTwoWeekStats } from "@/lib/52-week-data"
import { TrendingUp, TrendingDown, Activity } from "lucide-react"

interface FiftyTwoWeekViewProps {
  type?: "all" | "near-high" | "near-low" | "volatile"
  title?: string
  description?: string
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

export function FiftyTwoWeekView({
  type = "all",
  title: customTitle,
  description: customDescription,
  limit = 30,
  autoRefresh = true,
  refreshInterval = 3600000, // 1 hour
}: FiftyTwoWeekViewProps) {
  const [data, setData] = useState<FiftyTwoWeekStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedView, setSelectedView] = useState<"all" | "near-high" | "near-low" | "volatile">(type)
  const [showMore, setShowMore] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/stock/52-week-data?type=${selectedView}`,
        { cache: "no-store" }
      )

      if (!response.ok) {
        throw new Error("Failed to fetch 52-week data")
      }

      const result = await response.json()
      setData(result)
      setLastUpdated(new Date())
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch data"
      setError(message)
      console.error("[52W View] Error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    if (!autoRefresh) return

    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [selectedView, autoRefresh, refreshInterval])

  const getDisplayData = (): FiftyTwoWeekData[] => {
    if (!data) return []

    let displayData: FiftyTwoWeekData[] = data.stocks || []
    if (selectedView === "near-high") displayData = data.topNearHigh || []
    else if (selectedView === "near-low") displayData = data.topNearLow || []
    else if (selectedView === "volatile") displayData = data.mostVolatile || []

    const displayLimit = showMore ? limit : 3
    return displayData.slice(0, displayLimit)
  }

  const displayData = getDisplayData()
  const hasMoreData = (() => {
    if (!data) return false
    if (selectedView === "near-high") return (data.topNearHigh || []).length > 3
    if (selectedView === "near-low") return (data.topNearLow || []).length > 3
    if (selectedView === "volatile") return (data.mostVolatile || []).length > 3
    return (data.stocks || []).length > 3
  })()

  const getTitle = () => {
    if (customTitle) return customTitle
    if (selectedView === "near-high") return "52-Week Highs"
    if (selectedView === "near-low") return "52-Week Lows"
    if (selectedView === "volatile") return "Most Volatile"
    return "52-Week-Low"
  }

  const getDescription = () => {
    if (customDescription) return customDescription
    if (selectedView === "near-high") return "Stocks trading near their 52-week highs"
    if (selectedView === "near-low") return "Stocks trading near their 52-week lows"
    if (selectedView === "volatile") return "Stocks with the largest 52-week price range"
    return "Top Indian stocks 52-week performance analysis"
  }

  const renderStockRow = (stock: FiftyTwoWeekData, index: number) => {
    const isNearHigh = stock.distanceFromHigh < 10
    const isNearLow = stock.distanceFromLow < 10
    const changePercent = typeof stock.regularMarketChangePercent === "number" ? stock.regularMarketChangePercent : 0

    return (
      <Link
        key={stock.symbol}
        href={`/stock/${encodeURIComponent(stock.symbol)}`}
      >
        <div className="flex flex-col md:flex-row md:items-center p-3 md:p-4 border-b hover:bg-secondary/50 transition-colors last:border-b-0 cursor-pointer gap-3 md:gap-4">
          {/* Rank & Symbol */}
          <div className="flex items-center gap-2 md:gap-3 md:w-48 flex-shrink-0">
            <div className="text-xs md:text-sm font-bold text-muted-foreground w-4">{index + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm md:text-base">{stock.symbol.replace(".NS", "")}</div>
              <div className="text-xs text-muted-foreground truncate">{stock.name}</div>
            </div>
          </div>

          {/* Price & Change Info */}
          <div className="flex justify-between sm:justify-start sm:gap-4 md:gap-6 md:w-40 flex-shrink-0">
            <div>
              <div className="text-[9px] sm:text-[10px] text-muted-foreground">Price</div>
              <div className="font-semibold text-xs sm:text-sm md:text-base">{formatCurrency(stock.currentPrice)}</div>
            </div>
            <div className="text-right md:text-right md:w-24 flex flex-col items-end">
              <div className="text-[9px] sm:text-[10px] text-muted-foreground">Change</div>
              <div className={`font-semibold text-xs sm:text-sm md:text-base ${changePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatPercentage(changePercent)}
              </div>
            </div>
          </div>

          {/* 52W Range - Hidden on Mobile */}
          <div className="hidden sm:block md:block md:w-52 flex-shrink-0">
            <div className="text-[10px] text-muted-foreground">52W Range</div>
            <div className="font-medium text-sm">
              {formatCurrency(stock.fiftyTwoWeekLow)} - {formatCurrency(stock.fiftyTwoWeekHigh)}
            </div>
            <div className="text-[10px] text-muted-foreground">{formatPercentage(stock.rangePercent)}</div>
          </div>

          {/* Distance Metrics */}
          <div className="flex justify-between gap-4 md:gap-8 md:ml-auto">
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground">From High</div>
              <div className={`font-semibold text-sm ${stock.distanceFromHigh < 10 ? "text-amber-600" : ""}`}>
                {stock.distanceFromHigh.toFixed(1)}%
              </div>
              {isNearHigh && <Badge className="mt-1 text-xs px-2 py-0.5 h-auto">Near High</Badge>}
            </div>
            <div className="flex-1 text-right">
              <div className="text-[10px] text-muted-foreground">From Low</div>
              <div className={`font-semibold text-sm ${stock.distanceFromLow < 10 ? "text-green-600" : ""}`}>
                {stock.distanceFromLow.toFixed(1)}%
              </div>
              {isNearLow && <Badge variant="outline" className="mt-1 text-xs px-2 py-0.5 h-auto">Near Low</Badge>}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
<div className="w-full max-w-full space-y-3 sm:space-y-4 md:space-y-5">
      {/* Wrapped component with border, aligned left */}
      <div className="w-full max-w-full border border-yellow-700 rounded-lg p-2 sm:p-3 md:p-4 space-y-3 sm:space-y-4 md:space-y-5">
          <div className="w-full max-w-full space-y-3 sm:space-y-4 md:space-y-5">
            {/* Header + Controls (inline on md+) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
              <div className="flex flex-col">
                <h2 className="text-base sm:text-lg md:text-2xl lg:text-3xl font-extrabold tracking-tight mb-0">{getTitle()}</h2>
                <p className="text-[9px] sm:text-[10px] md:text-sm text-muted-foreground mt-1">{getDescription()}</p>
                {lastUpdated && (
                  <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground mt-1">
                    Last updated: {lastUpdated.toLocaleTimeString()} • Auto-refresh every {(refreshInterval / 60000).toFixed(0)} minutes
                  </p>
                )}
              </div>

              {/* View Toggle */}
              <div className="flex gap-1 md:gap-2 flex-wrap md:items-center">
        <Button
          variant={selectedView === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedView("all")}
          className="text-[11px] md:text-xs h-8 md:h-auto"
        >
          All Stocks
        </Button>
        <Button
          variant={selectedView === "near-high" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedView("near-high")}
          className="text-[11px] md:text-xs h-8 md:h-auto"
        >
          <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1" />
          Near High
        </Button>
        <Button
          variant={selectedView === "near-low" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedView("near-low")}
          className="text-[11px] md:text-xs h-8 md:h-auto"
        >
          <TrendingDown className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1" />
          Near Low
        </Button>
        <Button
          variant={selectedView === "volatile" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedView("volatile")}
          className="text-[11px] md:text-xs h-8 md:h-auto"
        >
          <Activity className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1" />
          Volatile
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
            className="text-[11px] md:text-xs h-8 md:h-auto ml-0 md:ml-2"
        >
          Refresh
        </Button>
        </div>
      </div>

      {/* Content Card already included above */}
            <Card className="border-border w-full">
        <CardHeader className="pb-2 md:pb-3 px-3 md:px-4 py-2 md:py-3">
          <CardTitle className="text-sm md:text-base lg:text-lg flex items-center justify-between">
            <span className="text-sm sm:text-base">{displayData.length} Stocks</span>
            {data && (
              <span className="text-[9px] sm:text-[10px] md:text-xs font-normal text-muted-foreground">
                Avg. {data.averageHighPercent.toFixed(1)}% from 52W high
              </span>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {loading && (
            <div className="space-y-1.5 md:space-y-2 p-2 md:p-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-10 md:h-12 w-full" />
              ))}
            </div>
          )}

          {error && (
            <div className="p-2 md:p-4 text-center text-xs md:text-sm text-red-600">
              {error}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                className="ml-2 text-[10px] md:text-xs h-7 md:h-auto"
              >
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && displayData.length === 0 && (
            <div className="p-2 md:p-4 text-center text-xs md:text-sm text-muted-foreground">
              No stocks found
            </div>
          )}

          {!loading && !error && displayData.length > 0 && (
            <div className="divide-y">
                    {displayData.map((stock, index) => renderStockRow(stock, index))}
                  </div>
          )}

          {!loading && !error && displayData.length > 0 && hasMoreData && !showMore && (
            <div className="p-2 md:p-3 border-t text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMore(true)}
                className="text-[11px] md:text-xs h-8 md:h-auto w-full md:w-auto"
              >
                Show More
              </Button>
            </div>
          )}

          {!loading && !error && displayData.length > 0 && hasMoreData && showMore && (
            <div className="p-2 md:p-3 border-t text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMore(false)}
                className="text-[11px] md:text-xs h-8 md:h-auto w-full md:w-auto"
              >
                Show Less
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
          </div>

      </div>
    </div>
  )
}

export default FiftyTwoWeekView
