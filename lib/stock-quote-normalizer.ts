type ChartResult = {
  meta?: Record<string, any>
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>
      high?: Array<number | null>
      low?: Array<number | null>
      volume?: Array<number | null>
      open?: Array<number | null>
    }>
  }
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function lastValid(values: Array<number | null | undefined> = []): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const value = toFiniteNumber(values[i])
    if (value !== null) return value
  }
  return null
}

function firstValid(values: Array<number | null | undefined> = []): number | null {
  for (const entry of values) {
    const value = toFiniteNumber(entry)
    if (value !== null) return value
  }
  return null
}

function maxValid(values: Array<number | null | undefined> = []): number {
  const filtered = values.map(toFiniteNumber).filter((value): value is number => value !== null)
  return filtered.length ? Math.max(...filtered) : 0
}

function minValid(values: Array<number | null | undefined> = []): number {
  const filtered = values.map(toFiniteNumber).filter((value): value is number => value !== null && value > 0)
  return filtered.length ? Math.min(...filtered) : 0
}

export function normalizeQuoteFromChartResult(result: ChartResult) {
  const meta = result?.meta || {}
  const quote = result?.indicators?.quote?.[0] || {}

  const closes = quote.close || []
  const highs = quote.high || []
  const lows = quote.low || []
  const opens = quote.open || []
  const volumes = quote.volume || []

  const latestClose = lastValid(closes)
  const firstClose = firstValid(closes)
  const currentPrice =
    toFiniteNumber(meta.regularMarketPrice) ??
    latestClose ??
    toFiniteNumber(meta.previousClose) ??
    toFiniteNumber(meta.chartPreviousClose) ??
    0

  const previousClose =
    toFiniteNumber(meta.previousClose) ??
    toFiniteNumber(meta.chartPreviousClose) ??
    firstClose ??
    currentPrice

  const regularMarketChange =
    toFiniteNumber(meta.regularMarketChange) ??
    (currentPrice - previousClose)

  const regularMarketChangePercent =
    toFiniteNumber(meta.regularMarketChangePercent) ??
    (previousClose > 0 ? (regularMarketChange / previousClose) * 100 : 0)

  const regularMarketOpen =
    toFiniteNumber(meta.regularMarketOpen) ??
    firstValid(opens) ??
    previousClose

  const regularMarketDayHigh =
    toFiniteNumber(meta.regularMarketDayHigh) ??
    maxValid(highs) ??
    currentPrice

  const regularMarketDayLow =
    toFiniteNumber(meta.regularMarketDayLow) ??
    minValid(lows) ??
    currentPrice

  const regularMarketVolume =
    toFiniteNumber(meta.regularMarketVolume) ??
    volumes.reduce((total, value) => total + (toFiniteNumber(value) ?? 0), 0)

  const fiftyTwoWeekHigh =
    toFiniteNumber(meta.fiftyTwoWeekHigh) ??
    maxValid(highs)

  const fiftyTwoWeekLow =
    toFiniteNumber(meta.fiftyTwoWeekLow) ??
    minValid(lows)

  return {
    symbol: meta.symbol,
    shortName: meta.shortName || meta.symbol,
    longName: meta.longName || meta.shortName || meta.symbol,
    regularMarketPrice: currentPrice,
    regularMarketChange,
    regularMarketChangePercent,
    regularMarketPreviousClose: previousClose,
    regularMarketOpen,
    regularMarketDayHigh,
    regularMarketDayLow,
    regularMarketVolume,
    marketCap: toFiniteNumber(meta.marketCap) ?? undefined,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    averageVolume: toFiniteNumber(meta.averageDailyVolume10Day) ?? undefined,
    currency: meta.currency || (String(meta.symbol || "").endsWith(".NS") || String(meta.symbol || "").endsWith(".BO") ? "INR" : "USD"),
  }
}
