import { getTimeRangeParams } from "./market-utils"
import { quoteCache } from "./cache-utils"

export interface StockQuote {
  symbol: string
  shortName: string
  longName?: string
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  regularMarketPreviousClose: number
  regularMarketOpen: number
  regularMarketDayHigh: number
  regularMarketDayLow: number
  regularMarketVolume: number
  marketCap?: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  averageVolume?: number
  currency: string
}

export interface ChartData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

function normalizeSymbol(symbol: string) {
  const trimmed = symbol.trim().toUpperCase()
  if (!trimmed.endsWith(".NS") && !trimmed.endsWith(".BO") && /^[A-Z0-9]+$/.test(trimmed)) {
    return `${trimmed}.NS`
  }
  return trimmed
}

export async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const normalizedSymbol = normalizeSymbol(symbol)
    const primaryKey = `quote:${normalizedSymbol}`

    return await quoteCache.withDedup(primaryKey, async () => {
      const response = await fetch(`/api/stock/quote?symbol=${encodeURIComponent(normalizedSymbol)}`)
      if (!response.ok) {
        if (normalizedSymbol !== symbol) {
          const fallbackResponse = await fetch(`/api/stock/quote?symbol=${encodeURIComponent(symbol)}`)
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json()
            if (fallbackData?.symbol) {
              quoteCache.set(`quote:${fallbackData.symbol}`, fallbackData, 30000)
            }
            return fallbackData
          }
        }
        throw new Error("Failed to fetch")
      }
      const data = await response.json()
      if (data?.symbol) {
        quoteCache.set(`quote:${data.symbol}`, data, 30000)
      }
      return data
    }, 30000)
  } catch (err) {
    return null
  }
}

export async function fetchMultipleQuotes(symbols: string[]): Promise<StockQuote[]> {
  try {
    const normalized = [...symbols].map((symbol) => normalizeSymbol(symbol))
    const cacheKey = `quotes:${normalized.slice().sort().join(",")}`

    const cached = quoteCache.get(cacheKey)
    if (cached) {
      return cached as StockQuote[]
    }

    // Batch symbols into groups of up to 100 to avoid server-side limits
    const chunkSize = 100
    const chunks: string[][] = []
    for (let i = 0; i < normalized.length; i += chunkSize) {
      chunks.push(normalized.slice(i, i + chunkSize))
    }

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const chunkKey = `quotes:${chunk.slice().sort().join(",")}`
        return quoteCache.withDedup(chunkKey, async () => {
          const response = await fetch(`/api/stock/quotes?symbols=${encodeURIComponent(chunk.join(","))}`)
          if (!response.ok) return []
          const data = await response.json()
          return data as StockQuote[]
        }, 30000)
      })
    )

    const flattened = results.flat()
    quoteCache.set(cacheKey, flattened, 30000)
    flattened.forEach((quote) => {
      if (quote?.symbol) {
        quoteCache.set(`quote:${quote.symbol}`, quote, 30000)
      }
    })
    return flattened
  } catch {
    return []
  }
}

export async function fetchChartData(symbol: string, range = "1M"): Promise<ChartData[]> {
  try {
    const normalizedSymbol = normalizeSymbol(symbol)
    const cacheKey = `chart:${normalizedSymbol}:${range}`
    const { period1, period2, interval } = getTimeRangeParams(range)
    return await quoteCache.withDedup(cacheKey, async () => {
      const response = await fetch(
        `/api/stock/chart?symbol=${encodeURIComponent(normalizedSymbol)}&period1=${period1}&period2=${period2}&interval=${interval}`,
      )
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      return data
    }, 60000)
  } catch {
    return []
  }
}

export async function searchStocks(query: string): Promise<Array<{ symbol: string; name: string; exchange: string }>> {
  try {
    const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`)
    if (!response.ok) throw new Error("Failed to fetch")
    const data = await response.json()
    return data
  } catch {
    return []
  }
}

export async function fetchGainersLosers(type: "gainers" | "losers", count: number = 20): Promise<StockQuote[]> {
  try {
    const response = await fetch(`/api/stock/gainers-losers?type=${type}&count=${count}`)
    if (!response.ok) throw new Error("Failed to fetch")
    const data = await response.json()
    return data
  } catch {
    return []
  }
}

export async function fetchFiftyTwoWeekData(type: "all" | "near-high" | "near-low" | "volatile" = "all") {
  try {
    const response = await fetch(`/api/stock/52-week-data?type=${type}`)
    if (!response.ok) throw new Error("Failed to fetch 52-week data")
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching 52-week data:", error)
    return null
  }
}

export async function prefetchStockDetailData(symbol: string) {
  await Promise.allSettled([
    fetchStockQuote(symbol),
    fetchChartData(symbol, "1W"),
    fetchChartData(symbol, "1M"),
  ])
}
