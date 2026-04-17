// created earlier but missing; re-add
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatPercentage } from "@/lib/market-utils"
import { INDIAN_STOCKS } from "@/lib/stocks-data"
import { fetchMultipleQuotes, type StockQuote } from "@/lib/yahoo-finance"
import { TrendingUp, TrendingDown, Volume2 } from "lucide-react"

export function MostTradedStocks() {
  const [stocks, setStocks] = useState<(StockQuote & { volume?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    const fetchTopTraded = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch top 30 stocks to ensure we get 20 with volume data
        let topStocks = INDIAN_STOCKS.slice(0, 30)
        // remove any duplicate symbols which cause repeated entries
        const seen = new Set<string>()
        topStocks = topStocks.filter(s => {
          if (seen.has(s.symbol)) return false
          seen.add(s.symbol)
          return true
        })
        const symbols = topStocks.map((s) => s.symbol)

        let data: StockQuote[] = []
        try {
          data = await fetchMultipleQuotes(symbols)
        } catch (apiErr) {
          console.error("API fetch error:", apiErr)
        }

        // Fallback to local data if API fails
        if (!data || data.length === 0) {
          data = topStocks.map(s => ({
            symbol: s.symbol,
            shortName: s.name,
            longName: s.name,
            regularMarketPrice: 0,
            regularMarketChange: 0,
            regularMarketChangePercent: 0,
            regularMarketPreviousClose: 0,
            regularMarketOpen: 0,
            regularMarketDayHigh: 0,
            regularMarketDayLow: 0,
            regularMarketVolume: 0,
            marketCap: 0,
            fiftyTwoWeekHigh: 0,
            fiftyTwoWeekLow: 0,
            averageVolume: 0,
            currency: "INR"
          }))
          setError("Live volume data unavailable.")
        }

        // Sort by volume (descending) and take top 20
        const tradedStocks = data
          .sort((a, b) => (b.regularMarketVolume || 0) - (a.regularMarketVolume || 0))
          .slice(0, 20)

        setStocks(tradedStocks)
        setLastUpdated(new Date())
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch data"
        setError(message)
        console.error("[Most Traded] Error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchTopTraded()
    const interval = setInterval(fetchTopTraded, 300000) // Refresh every 5 minutes
    return () => clearInterval(interval)
  }, [])

  if (loading && stocks.length === 0) {
    return (
      <Card className="border-orange-500/20 bg-gradient-to-br from-orange-950/10 to-orange-900/5">
        <CardHeader>
          <CardTitle className="text-sm md:text-xl flex items-center gap-1">
            <Volume2 className="w-4 h-4 text-orange-500" />
            Most Traded Stocks (Top 20)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-orange-500/30 bg-gradient-to-br from-orange-950/10 via-background to-orange-900/5 shadow-lg hover:shadow-xl transition-shadow p-1 md:p-2">
      <CardHeader className="border-b border-orange-500/20 pb-1 md:pb-2 sticky top-0 bg-card z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <CardTitle className="text-sm md:text-xl flex items-center gap-1 md:gap-2">
            <Volume2 className="w-5 h-5 text-orange-500" />
            Most Traded Stocks (Top 20)
          </CardTitle>
          {lastUpdated && (
            <span className="text-[9px] sm:text-[10px] text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-border/20 max-h-[20rem] overflow-y-auto">
          {stocks.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No data available</div>
          ) : (
            stocks.map((stock, index) => (
              <Link
                key={stock.symbol}
                href={`/stock/${encodeURIComponent(stock.symbol)}`}
              >
                <div className="p-1 md:p-2 hover:bg-orange-500/5 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    {/* Left: Rank & Symbol */}
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="text-xs font-bold text-orange-600 flex-shrink-0">
                        #{index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm">
                          {stock.symbol.replace(".NS", "")}
                        </div>
                        <div className="text-[8px] sm:text-[9px] text-muted-foreground truncate">
                          {stock.shortName || stock.longName}
                        </div>
                      </div>
                    </div>

                    {/* Right: Price & Change */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="font-semibold text-sm">
                        {formatCurrency(stock.regularMarketPrice || 0)}
                      </div>
                      <div
                        className={`text-xs sm:text-sm font-medium flex items-center gap-0.5 ${
                          (stock.regularMarketChangePercent || 0) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {(stock.regularMarketChangePercent || 0) >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {formatPercentage(stock.regularMarketChangePercent || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Volume bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[8px] sm:text-[9px] text-muted-foreground flex-shrink-0">
                      Vol:
                    </span>
                    <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full"
                        style={{
                          width: `${
                            stock.regularMarketVolume &&
                            stocks[0].regularMarketVolume
                              ? Math.min(
                                  100,
                                  (stock.regularMarketVolume /
                                    stocks[0].regularMarketVolume) *
                                    100
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-[8px] sm:text-[9px] text-muted-foreground flex-shrink-0">
                      {stock.regularMarketVolume
                        ? (stock.regularMarketVolume / 1000000).toFixed(1)
                        : "0"}
                      M
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>

      {error && (
        <div className="px-4 py-2 border-t border-orange-500/20 bg-orange-500/10 text-orange-700 text-xs">
          {error}
        </div>
      )}
    </Card>
  )
}
