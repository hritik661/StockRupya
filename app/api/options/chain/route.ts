import { NextResponse, type NextRequest } from "next/server"

interface OptionChainData {
  index: string
  strikes: StrikeData[]
  spotPrice: number
  timestamp: number
  marketOpen: boolean
}

interface StrikeData {
  strike: number
  cePrice: number
  ceChange: number
  ceOI: number
  ceVolume: number
  ceIV: string
  pePrice: number
  peChange: number
  peOI: number
  peVolume: number
  peIV: string
  isATM: boolean
  isITM: boolean
}

function getIstDateParts(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon"
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0")

  return { weekday, hour, minute }
}

// Check if Indian market is open using actual IST time
function isMarketOpen(): boolean {
  const { weekday, hour, minute } = getIstDateParts(new Date())
  const currentMinutes = hour * 60 + minute
  const marketOpenMinutes = 9 * 60 + 15
  const marketCloseMinutes = 15 * 60 + 30

  if (weekday === "Sat" || weekday === "Sun") return false
  if (currentMinutes < marketOpenMinutes) return false
  if (currentMinutes >= marketCloseMinutes) return false

  return true
}

function seededValue(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return ((hash >>> 0) % 10000) / 10000
}

// Black-Scholes approximation for option pricing
function calculateOptionPrice(
  spotPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  volatility: number,
  isCall: boolean
): number {
  const S = spotPrice
  const K = strikePrice
  const T = timeToExpiry
  const sigma = volatility / 100

  // Intrinsic value
  const intrinsicValue = isCall ? Math.max(0, S - K) : Math.max(0, K - S)

  // Time value multiplier (simplified)
  // For ATM options, time value is significant
  // For OTM options, price approaches intrinsic value
  const daysToExpiry = Math.max(1, T * 365)
  const timeDecay = Math.sqrt(daysToExpiry / 365) * 0.5

  // Distance from strike in terms of standard deviations
  const distance = Math.abs(S - K) / S
  const moneyness = distance / (sigma * Math.sqrt(T))

  // Calculate option price using simplified BS
  let optionPrice = 0

  if (isCall) {
    if (S > K) {
      // ITM Call
      optionPrice = intrinsicValue + sigma * S * Math.sqrt(T) * 0.4 * Math.exp(-moneyness * 0.5)
    } else {
      // OTM Call
      optionPrice = sigma * S * Math.sqrt(T) * 0.4 * Math.exp(-moneyness * 0.5)
    }
  } else {
    if (S < K) {
      // ITM Put
      optionPrice = intrinsicValue + sigma * S * Math.sqrt(T) * 0.4 * Math.exp(-moneyness * 0.5)
    } else {
      // OTM Put
      optionPrice = sigma * S * Math.sqrt(T) * 0.4 * Math.exp(-moneyness * 0.5)
    }
  }

  // Add time value multiplier
  optionPrice *= (1 + timeDecay)

  // Minimum price
  return Math.max(0.05, Math.round(optionPrice * 100) / 100)
}

// Direct spot price data with fallback values
const FALLBACK_SPOT_PRICES: Record<string, number> = {
  "NIFTY": 25418.9,
  "BANKNIFTY": 59957.85,
  "SENSEX": 82566.37,
  "NIFTYIT": 19890.45,
  "NIFTYPHARMA": 17340.20,
  "NIFTYAUTO": 9876.55,
  "FINNIFTY": 21234.80,
  "MIDCAP": 12450.30,
}

// Fetch spot price for the index with improved timeout handling
async function getSpotPrice(indexSymbol: string): Promise<number> {
  try {
    // Use query1.finance.yahoo.com directly like the indices API does
    const INDICES_MAP: Record<string, string> = {
      "NIFTY": "^NSEI",
      "BANKNIFTY": "^NSEBANK",
      "SENSEX": "^BSESN",
      "NIFTYIT": "^CNXIT",
      "NIFTYPHARMA": "^CNXPHARMA",
      "NIFTYAUTO": "^CNXAUTO",
      "FINNIFTY": "^CNXINFRA",
      "MIDCAP": "^CNXM100",
    }

    const yFinanceSymbol = INDICES_MAP[indexSymbol]
    if (!yFinanceSymbol) {
      console.warn(`[OPTIONS_CHAIN] Unknown symbol ${indexSymbol}, using fallback`)
      return FALLBACK_SPOT_PRICES[indexSymbol] || 25418.9
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yFinanceSymbol
    )}?range=1d&interval=1m&includePrePost=false`
    
    console.log(`[OPTIONS_CHAIN] Fetching spot price for ${indexSymbol} from Yahoo Finance`)
    
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      signal: controller.signal,
    })
    
    clearTimeout(timeout)

    if (!response.ok) {
      console.warn(`[OPTIONS_CHAIN] Yahoo Finance API error for ${indexSymbol}: ${response.status}`)
      return FALLBACK_SPOT_PRICES[indexSymbol] || 25418.9
    }

    const data = await response.json()
    const meta = data?.chart?.result?.[0]?.meta
    
    if (!meta) {
      console.warn(`[OPTIONS_CHAIN] No meta data from Yahoo Finance for ${indexSymbol}, using fallback`)
      return FALLBACK_SPOT_PRICES[indexSymbol] || 25418.9
    }

    const price = meta.regularMarketPrice || 0
    if (price > 0) {
      console.log(`[OPTIONS_CHAIN] Got spot price for ${indexSymbol}: ${price}`)
      return price
    }
    
    return FALLBACK_SPOT_PRICES[indexSymbol] || 25418.9
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[OPTIONS_CHAIN] Timeout fetching spot price for ${indexSymbol} (exceeded 5s), using fallback`)
    } else {
      console.warn(`[OPTIONS_CHAIN] Error fetching spot price for ${indexSymbol}:`, error)
    }
    return FALLBACK_SPOT_PRICES[indexSymbol] || 25418.9
  }
}

function generateOptionChain(
  spotPrice: number,
  strikeGap: number,
  daysToExpiry: number = 7,
  marketOpen: boolean = true,
  symbol: string = "NIFTY"
): StrikeData[] {
  const strikes: StrikeData[] = []

  // Round spot price to nearest strike gap
  const atm = Math.round(spotPrice / strikeGap) * strikeGap

  // Generate 15 strikes (7 below ATM, ATM, 7 above ATM)
  for (let i = -7; i <= 7; i++) {
    const strike = atm + i * strikeGap
    const timeToExpiry = daysToExpiry / 365
    const seedBase = `${symbol}:${spotPrice}:${daysToExpiry}:${strike}`
    const volatilityNoise = marketOpen ? Math.random() : seededValue(`${seedBase}:vol`)
    const volatility = 18 + volatilityNoise * 8 // IV between 18-26

    // Calculate CE and PE prices
    const cePrice = calculateOptionPrice(spotPrice, strike, timeToExpiry, volatility, true)
    const pePrice = calculateOptionPrice(spotPrice, strike, timeToExpiry, volatility, false)

    // When market is closed, prices should NOT change (0% change)
    // When market is open, show small random changes
    const ceChange = marketOpen ? (Math.random() - 0.5) * 4 : 0
    const peChange = marketOpen ? (Math.random() - 0.5) * 4 : 0

    // Generate realistic OI and volume
    const distanceFromATM = Math.abs(strike - atm)
    const proximityFactor = Math.exp(-(distanceFromATM / (3 * strikeGap)))
    const baseOI = 50000
    const baseVolume = 5000
    const ceOiNoise = marketOpen ? Math.random() : seededValue(`${seedBase}:ceOI`)
    const peOiNoise = marketOpen ? Math.random() : seededValue(`${seedBase}:peOI`)
    const ceVolumeNoise = marketOpen ? Math.random() : seededValue(`${seedBase}:ceVolume`)
    const peVolumeNoise = marketOpen ? Math.random() : seededValue(`${seedBase}:peVolume`)
    const ceIvNoise = marketOpen ? Math.random() : seededValue(`${seedBase}:ceIV`)
    const peIvNoise = marketOpen ? Math.random() : seededValue(`${seedBase}:peIV`)

    const ceOI = Math.floor(baseOI * proximityFactor + ceOiNoise * baseOI * 0.5)
    const peOI = Math.floor(baseOI * proximityFactor + peOiNoise * baseOI * 0.5)
    const ceVolume = Math.floor(baseVolume * proximityFactor + ceVolumeNoise * baseVolume * 0.3)
    const peVolume = Math.floor(baseVolume * proximityFactor + peVolumeNoise * baseVolume * 0.3)

    const isATM = Math.abs(strike - spotPrice) < strikeGap / 2
    const isITM = strike < spotPrice // For CE, ITM = strike < spot

    strikes.push({
      strike,
      cePrice,
      ceChange,
      ceOI,
      ceVolume,
      ceIV: (volatility * 0.95 + ceIvNoise * 2).toFixed(2),
      pePrice,
      peChange,
      peOI,
      peVolume,
      peIV: (volatility * 1.05 + peIvNoise * 2).toFixed(2),
      isATM,
      isITM,
    })
  }

  return strikes
}

export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get("symbol")
    const strikeGapParam = request.nextUrl.searchParams.get("strikeGap")
    const daysParam = request.nextUrl.searchParams.get("daysToExpiry")

    if (!symbol) {
      return NextResponse.json(
        {
          success: false,
          error: "Symbol parameter is required (e.g., ?symbol=NIFTY)",
        },
        { status: 400 }
      )
    }

    // Parse parameters
    const strikeGap = parseInt(strikeGapParam || "50")
    const daysToExpiry = parseInt(daysParam || "7")

    // Check if market is open
    const marketOpen = isMarketOpen()

    // Fetch current spot price with improved timeout
    let spotPrice: number
    try {
      spotPrice = await Promise.race([
        getSpotPrice(symbol),
        new Promise<number>((resolve) => 
          setTimeout(() => {
            console.warn(`[OPTIONS_CHAIN] Spot price fetch timeout for ${symbol}, using fallback`)
            resolve(FALLBACK_SPOT_PRICES[symbol] || 25418.9)
          }, 6000)
        )
      ])
    } catch (err) {
      console.warn(`[OPTIONS_CHAIN] Error fetching spot price for ${symbol}:`, err)
      spotPrice = FALLBACK_SPOT_PRICES[symbol] || 25418.9
    }

    if (!spotPrice || spotPrice <= 0) {
      console.warn(`[OPTIONS_CHAIN] Invalid spot price for symbol: ${symbol}, using fallback`)
      spotPrice = FALLBACK_SPOT_PRICES[symbol] || 25418.9
    }

    // Generate option chain
    const strikes = generateOptionChain(spotPrice, strikeGap, daysToExpiry, marketOpen, symbol)

    const chainData: OptionChainData = {
      index: symbol,
      spotPrice,
      strikes,
      timestamp: Date.now(),
      marketOpen,
    }

    console.log(`[OPTIONS_CHAIN] Successfully generated chain for ${symbol} with ${strikes.length} strikes`)
    
    return NextResponse.json({
      success: true,
      ...chainData,
    })
  } catch (error) {
    console.error("[OPTIONS_CHAIN] Options chain API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate option chain",
      },
      { status: 500 }
    )
  }
}
