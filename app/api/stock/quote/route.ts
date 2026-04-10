import { type NextRequest, NextResponse } from "next/server"
import { normalizeQuoteFromChartResult } from "@/lib/stock-quote-normalizer"

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 })
  }

  try {
    // Use v8 chart API with 1 day range to get current quote data
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&includePrePost=false`
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      next: { revalidate: 30 },
    })

    if (!response.ok) {
      throw new Error("Yahoo Finance API error")
    }

    const data = await response.json()
    const result = data?.chart?.result?.[0]
    const meta = result?.meta

    if (!meta) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 })
    }

    return NextResponse.json(normalizeQuoteFromChartResult(result))
  } catch (error) {
    console.error("Quote fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch stock data" }, { status: 500 })
  }
}
