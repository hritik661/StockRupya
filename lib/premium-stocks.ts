export interface StockPrediction {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  predictedGrowth: number
  confidence: number
  timeframe: string
  signal: string
  sector: string
}

interface QuoteLike {
  symbol?: string
  shortName?: string
  longName?: string
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
}

export function dedupePredictionsBySymbol(items: StockPrediction[]) {
  const unique = new Map<string, StockPrediction>()

  items.forEach((item) => {
    const key = (item.symbol || "")
      .trim()
      .toUpperCase()
      .replace(/(\.NS|\.BO)$/i, "")

    if (!key) return

    const existing = unique.get(key)
    if (!existing || (item.changePercent || 0) > (existing.changePercent || 0)) {
      unique.set(key, item)
    }
  })

  return Array.from(unique.values())
}

export function buildPredictionStocksFromQuotes(quotes: QuoteLike[], limit = 100): StockPrediction[] {
  const mappedPredictions = quotes.map((stock) => ({
    symbol: stock.symbol || "UNKNOWN",
    name: stock.shortName || stock.longName || stock.symbol || "Stock",
    price: Number.isFinite(stock.regularMarketPrice) ? stock.regularMarketPrice : 0,
    change: Number.isFinite(stock.regularMarketChange) ? stock.regularMarketChange : 0,
    changePercent: Number.isFinite(stock.regularMarketChangePercent) ? stock.regularMarketChangePercent : 0,
    predictedGrowth: 8 + Math.random() * 7,
    confidence: 90 + Math.random() * 5,
    timeframe: "48h",
    signal: "Strong Buy",
    sector: "Various",
  }))

  return dedupePredictionsBySymbol(
    mappedPredictions
      .filter((stock) => stock.changePercent >= 5)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, limit)
  )
}
