import { type NextRequest, NextResponse } from "next/server"
import { normalizeQuoteFromChartResult } from "@/lib/stock-quote-normalizer"

const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 45000 // 45 seconds for faster refresh

export async function GET(request: NextRequest) {
  const symbols = request.nextUrl.searchParams.get("symbols")

  if (!symbols) {
    return NextResponse.json({ error: "Symbols are required" }, { status: 400 })
  }

  const symbolList = symbols.split(",").slice(0, 100) // Allow up to 100 symbols
  const cacheKey = symbolList.sort().join(",")

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    // Return cached response with caching headers
    return NextResponse.json(cached.data, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=45',
        'CDN-Cache-Control': 'max-age=45',
      }
    })
  }

  try {
    const quotes = await Promise.all(
      symbolList.map(async (symbol, index) => {
        // Keep a light stagger to avoid bursting upstream requests while staying fast.
        await new Promise((resolve) => setTimeout(resolve, index * 10))

        try {
          const cleanSymbol = symbol.trim().toUpperCase()
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSymbol)}?range=1d&interval=1m&includePrePost=false&events=div%7Csplit`

          let response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0",
              Accept: "application/json",
            },
          })

          if (!response.ok) {
            const backupUrl = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(cleanSymbol)}&range=1d&interval=1m`
            response = await fetch(backupUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0",
                Accept: "application/json",
              },
            })

            if (!response.ok) return null

            const backupData = await response.json()
            const sparkResult = backupData?.spark?.result?.[0]?.response?.[0]
            if (!sparkResult?.meta) return null

            return normalizeQuoteFromChartResult(sparkResult)
          }
          const data = await response.json()
          const result = data?.chart?.result?.[0]
          const meta = result?.meta

          if (!meta) return null

          return normalizeQuoteFromChartResult(result)
        } catch (error) {
          console.error(`[v0] Error fetching ${symbol}:`, error)
          return null
        }
      }),
    )

    const validQuotes = quotes.filter((q) => q !== null)

    cache.set(cacheKey, { data: validQuotes, timestamp: Date.now() })

    return NextResponse.json(validQuotes, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=45',
        'CDN-Cache-Control': 'max-age=45',
      }
    })
  } catch (error) {
    console.error("[v0] Quotes fetch error:", error)
    return NextResponse.json([], { status: 500 })
  }
}
