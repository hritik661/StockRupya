"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useBalance } from "@/hooks/use-balance"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/market-utils"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { CandlestickChart } from "@/components/candlestick-chart"
import { StockChart } from "@/components/stock-chart"
import { BarChart3, Activity } from "lucide-react"
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
} from "recharts"

import { TradePanel } from "@/components/trade-panel"
import { LogoImage } from "@/components/logo-image"
import { Zap } from "lucide-react"
import { getCachedAllIndianQuotes, loadAllIndianQuotes } from "@/lib/cache-utils"
import {
  buyEquityHolding,
  loadEquityHoldings,
  saveEquityHoldings,
  sellEquityHolding,
} from "@/lib/trade-state"

interface StockPrediction {
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

const PREDICTIONS_SESSION_CACHE_KEY = "stockrupya_predictions_cache_v1"

function dedupePredictionsBySymbol(items: StockPrediction[]) {
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

function buildPredictionsFromQuotes(quotes: any[]): StockPrediction[] {
  const derivedPredictions = quotes.map((stock: any) => ({
    symbol: stock.symbol || "UNKNOWN",
    name: stock.shortName || stock.longName || stock.symbol || "Stock",
    price: isNaN(stock.regularMarketPrice) ? 0 : stock.regularMarketPrice || 0,
    change: isNaN(stock.regularMarketChange) ? 0 : stock.regularMarketChange || 0,
    changePercent: isNaN(stock.regularMarketChangePercent) ? 0 : stock.regularMarketChangePercent || 0,
    predictedGrowth: 8 + Math.random() * 7,
    confidence: 90 + Math.random() * 5,
    timeframe: "48h",
    signal: "Strong Buy",
    sector: "Various",
  }))

  return dedupePredictionsBySymbol(
    derivedPredictions.filter((stock) => stock.changePercent >= 5).slice(0, 100)
  ).sort((a, b) => b.changePercent - a.changePercent)
}

function readPredictionsFromSessionCache() {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = window.sessionStorage.getItem(PREDICTIONS_SESSION_CACHE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writePredictionsToSessionCache(predictions: StockPrediction[]) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.sessionStorage.setItem(PREDICTIONS_SESSION_CACHE_KEY, JSON.stringify(predictions))
  } catch {
    // Ignore cache write failures
  }
}

// Company logo mappings
const STOCK_LOGO_MAP: Record<string, string> = {
  'TCS': 'tcs.com',
  'INFY': 'infosys.com',
  'WIPRO': 'wipro.com',
  'HCLTECH': 'hcltech.com',
  'TECHM': 'techmahindra.com',
  'LTIM': 'ltimindtree.com',
  'HDFCBANK': 'hdfcbank.com',
  'ICICIBANK': 'icicibank.com',
  'SBIN': 'sbin.in',
  'KOTAKBANK': 'kotak.com',
  'AXISBANK': 'axisbank.com',
  'INDUSINDBK': 'indusindbank.com',
  'MARUTI': 'maruti.co.in',
  'M&M': 'mahindra.com',
  'RELIANCE': 'ril.com',
  'BHARTIARTL': 'airtel.in',
  'ITC': 'itcportal.com',
  'NESTLEIND': 'nestle.in',
  'LT': 'larsentoubro.com',
  'ASIANPAINT': 'asianpaints.com',
  'SUNPHARMA': 'sunpharma.com',
  'BAJAJ-AUTO': 'bajajauto.com',
  'HEROMOTOCO': 'heromotocorp.com',
  'EICHERMOT': 'eichermotors.com',
  'TATAMOTORS': 'tatamotors.com',
  'PNB': 'pnbindia.in',
  'BANKBARODA': 'bankofbaroda.in',
  'IDFCFIRSTB': 'idfcfirstbank.com',
  'BANDHANBNK': 'bandhanbank.com',
}

const getCompanyLogoUrl = (symbol: string) => {
  const cleanSymbol = symbol.replace(".NS", "").replace(".BO", "").replace("^", "")
  const domain = STOCK_LOGO_MAP[cleanSymbol]
  
  if (!domain) {
    return `https://logo.duckduckgo.com/?domain=${cleanSymbol.toLowerCase()}.com&size=large`
  }
  
  return `https://logo.duckduckgo.com/?domain=${domain}&size=large`
}

function generateStockChartData(basePrice: number, range: string) {
  const dataPoints = range === "1D" ? 78 : range === "1W" ? 84 : range === "1M" ? 30 : 90
  const volatility = range === "1D" ? 0.005 : range === "1W" ? 0.01 : 0.015
  const data = []
  let price = basePrice * (1 - volatility * 5)

  const now = Date.now()
  const interval = range === "1D" ? 5 * 60 * 1000 : range === "1W" ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000

  for (let i = 0; i < dataPoints; i++) {
    const change = (Math.random() - 0.45) * basePrice * volatility
    price = Math.max(price + change, basePrice * 0.85)
    const timestamp = Math.floor((now - (dataPoints - i) * interval) / 1000)

    const open = price
    const close = price + (Math.random() - 0.5) * basePrice * volatility * 0.5
    const high = Math.max(open, close) + Math.random() * basePrice * volatility * 0.3
    const low = Math.min(open, close) - Math.random() * basePrice * volatility * 0.3

    data.push({ timestamp, open, high, low, close, volume: Math.floor(Math.random() * 1000000) + 100000 })
  }
  return data
}

export function PredictionsList() {
  const { user, markPredictionsAsPaid, updateBalance } = useAuth()
  const { deductBalance, addBalance } = useBalance()
  const { toast } = useToast()
  const unlockAmountPaise = Number(process.env.NEXT_PUBLIC_RAZORPAY_UNLOCK_AMOUNT_PAISE || 50000)
  const unlockAmountRupees = Math.max(
    500,
    Math.floor((Number.isFinite(unlockAmountPaise) && unlockAmountPaise > 0 ? unlockAmountPaise : 50000) / 100)
  )

  // Guard: If no user at all, return nothing
  // Otherwise show predictions (page is the gatekeeper for isPredictionPaid)
  if (!user) {
    console.warn('🔒 PredictionsList blocked - no user logged in')
    return null
  }
  
  const [predictions, setPredictions] = useState<StockPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(50) // Show 50 initially for faster load

  const [selectedStock, setSelectedStock] = useState<StockPrediction | null>(null)
  const [chartRange, setChartRange] = useState("1M")
  const [chartType, setChartType] = useState<"line" | "candlestick">("candlestick")
  const [showTradeFullscreen, setShowTradeFullscreen] = useState(false)
  const [tradeInitialTab, setTradeInitialTab] = useState<'buy' | 'sell' | null>(null)
  const [tradePopup, setTradePopup] = useState<{ visible: boolean; message?: string }>({ visible: false })
  const [quantityDialog, setQuantityDialog] = useState<{ visible: boolean; stock: StockPrediction | null; type: 'buy' | 'sell' | null; quantity: string }>({ visible: false, stock: null, type: null, quantity: '1' })
  const router = useRouter()
  

  useEffect(() => {
    if (!user) {
      return
    }

    let mounted = true

    const hydratePredictionsFromCache = () => {
      const sessionPredictions = readPredictionsFromSessionCache()
      if (sessionPredictions.length > 0) {
        setPredictions(sessionPredictions)
        setLoading(false)
      }

      const cachedQuotes = getCachedAllIndianQuotes()
      if (cachedQuotes) {
        const cachedPredictions = buildPredictionsFromQuotes(cachedQuotes)
        setPredictions(cachedPredictions)
        setLoading(false)
        writePredictionsToSessionCache(cachedPredictions)
      }
    }

    const fetchPredictions = async () => {
      try {
        const quotes = await loadAllIndianQuotes()
        const nextPredictions = buildPredictionsFromQuotes(quotes)

        if (!mounted) {
          return
        }

        setPredictions(nextPredictions)
        writePredictionsToSessionCache(nextPredictions)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching predictions:", error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    hydratePredictionsFromCache()
    void fetchPredictions()

    const interval = setInterval(fetchPredictions, 180000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [user])

  // Poll quotes periodically to keep 'current price' up-to-date
  useEffect(() => {
    if (!user || predictions.length === 0) return

    let mounted = true

    const fetchLatestPrices = async () => {
      try {
        const symbols = predictions.map((p) => p.symbol).join(",")
        const res = await fetch(`/api/stock/quotes?symbols=${encodeURIComponent(symbols)}`)
        const data = await res.json()
        const quotesArray = Array.isArray(data) ? data : Object.values(data)

        if (!mounted) return

        setPredictions((prev) =>
          dedupePredictionsBySymbol(prev.map((p) => {
            const q: any = quotesArray.find((s: any) => s.symbol === p.symbol || s.symbol === p.symbol.replace('.NS', ''))
            if (!q) return p
            const updated = {
              ...p,
              price: isNaN(q.regularMarketPrice) ? p.price : q.regularMarketPrice ?? p.price,
              change: isNaN(q.regularMarketChange) ? p.change : q.regularMarketChange ?? p.change,
              changePercent: isNaN(q.regularMarketChangePercent) ? p.changePercent : q.regularMarketChangePercent ?? p.changePercent,
            }
            return updated
            }).filter((p) => p.changePercent >= 5)) // Remove stocks that fell below 5%
        )

        // update selected stock price if visible
        setSelectedStock((prev) => {
          if (!prev) return prev
          const q: any = quotesArray.find((s: any) => s.symbol === prev.symbol || s.symbol === prev.symbol.replace('.NS', ''))
          if (!q) return prev
          return {
            ...prev,
            price: q.regularMarketPrice ?? prev.price,
            change: q.regularMarketChange ?? prev.change,
            changePercent: q.regularMarketChangePercent ?? prev.changePercent,
          }
        })
      } catch (err) {
        console.error('Error polling latest prices', err)
      }
    }

    // fetch immediately, then poll
    fetchLatestPrices()
    const id = setInterval(fetchLatestPrices, 15000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [user, predictions.length, setPredictions, setSelectedStock])

  // show a transient popup when a trade completes (buy/sell)
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const d = e?.detail
        if (!d) return
        const sym = d.symbol ? d.symbol.replace('.NS', '') : ''
        const msg = d.type === 'buy' ? `Bought ${d.quantity} ${sym}` : `Sold ${d.quantity} ${sym}`
        setTradePopup({ visible: true, message: msg })
        setTimeout(() => setTradePopup({ visible: false }), 3000)
      } catch (err) {
        // ignore
      }
    }
    window.addEventListener('tradeCompleted', handler)
    return () => window.removeEventListener('tradeCompleted', handler)
  }, [])

  

  const chartData = useMemo(() => {
    if (!selectedStock) return []
    return generateStockChartData(selectedStock.price, chartRange)
  }, [selectedStock, chartRange])

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    if (chartRange === "1D") {
      return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    }
    if (chartRange === "1W" || chartRange === "1M") {
      return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    }
    return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
  }


  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3 lg:gap-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="h-[178px] rounded-xl border border-border/70 bg-card/60 p-3 shadow-[0_10px_24px_rgba(2,6,23,0.18)] animate-pulse"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-20 rounded bg-secondary/70" />
                  <div className="h-3 w-28 rounded bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-16 rounded bg-secondary/70" />
                  <div className="h-3 w-12 rounded bg-secondary/50" />
                </div>
              </div>
              <div className="mb-3 h-10 rounded-lg bg-secondary/45" />
              <div className="mb-3 h-6 rounded-full bg-secondary/45" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 rounded-lg bg-secondary/55" />
                <div className="h-8 rounded-lg bg-secondary/40" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">Loading predictions...</p>
      </div>
    )
  }

  // CRITICAL: Predictions list requires prediction access only
  if (!user || (user as any).isPredictionPaid !== true) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">🔒</div>
          <h2 className="text-3xl font-bold">Premium Access Required</h2>
          <p className="text-lg text-muted-foreground">
            All 1000+ stock predictions are locked behind a payment wall.
          </p>
          <div className="space-y-2 border-t border-primary/20 pt-4">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">🔥 LIMITED NUMBER OFFER</p>
            <p className="text-3xl font-black text-foreground">₹1000 <span className="line-through text-muted-foreground text-sm ml-2">₹2000</span></p>
            <p className="text-sm text-accent font-bold">50% OFF</p>
            <p className="text-xs text-muted-foreground font-semibold">Lifetime access</p>
          </div>
        </div>
      </div>
    )
  }

  // Quick buy/sell helpers (used when clicking Buy/Sell on prediction cards)

  const quickBuy = async (stock: StockPrediction, qty = 1) => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please sign in to place trades', variant: 'destructive' })
      return
    }
    if (qty < 1) {
      toast({ title: 'Enter Quantity', description: 'Please enter a valid quantity to buy', variant: 'destructive' })
      return
    }
    const totalCost = qty * (isNaN(stock.price) ? 0 : stock.price || 0)
    if (totalCost > user.balance) {
      // insufficient balance — show toast and dispatch event for UI
      toast({ title: 'Insufficient Balance', description: `You need ${ (totalCost - user.balance).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) } more to buy.`, variant: 'destructive' })
      try {
        window.dispatchEvent(new CustomEvent("tradeCompleted", { detail: { symbol: stock.symbol, type: "buy", quantity: 0 } }))
      } catch {}
      return
    }

    try {
      // Deduct balance using API
      const balanceResult = await deductBalance(totalCost, "BUY", stock.symbol, qty, stock.price)
      if (!balanceResult.success) {
        toast({ title: 'Transaction Failed', description: balanceResult.error, variant: 'destructive' })
        return
      }

      const nextHoldings = buyEquityHolding(loadEquityHoldings(user.email), {
        symbol: stock.symbol,
        name: stock.name,
        quantity: qty,
        price: stock.price,
      })
      saveEquityHoldings(user.email, nextHoldings)
      await fetch("/api/holdings/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, holdings: nextHoldings }),
      }).catch((err) => console.warn("Failed to save holdings to database:", err))
      
      // notify UI
      try {
        window.dispatchEvent(new CustomEvent("tradeCompleted", { detail: { symbol: stock.symbol, type: "buy", quantity: qty } }))
      } catch {}
      toast({ title: 'Bought', description: `Bought ${qty} ${stock.symbol.split('.')[0]} for ${formatCurrency(totalCost)}` })
    } catch (e) {
      console.error("quickBuy error", e)
    }
  }

  const quickSell = async (stock: StockPrediction, qty = 1) => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please sign in to sell holdings', variant: 'destructive' })
      return
    }
    if (qty < 1) {
      toast({ title: 'Enter Quantity', description: 'Please enter a valid quantity to sell', variant: 'destructive' })
      return
    }
    try {
      const holdings = loadEquityHoldings(user.email)
      const idx = holdings.findIndex((h) => h.symbol === stock.symbol)
      const current = idx >= 0 ? holdings[idx] : null
      if (!current || current.quantity < qty) {
        // can't sell
        toast({ title: 'Insufficient Shares', description: `You only have ${current?.quantity || 0} shares to sell.`, variant: 'destructive' })
        try {
          window.dispatchEvent(new CustomEvent("tradeCompleted", { detail: { symbol: stock.symbol, type: "sell", quantity: 0 } }))
        } catch {}
        return
      }
      const totalValue = qty * (isNaN(stock.price) ? 0 : stock.price || 0)
      
      // Add balance using API
      const balanceResult = await addBalance(totalValue, "SELL", stock.symbol, qty, stock.price)
      if (!balanceResult.success) {
        toast({ title: 'Transaction Failed', description: balanceResult.error, variant: 'destructive' })
        return
      }

      const nextHoldings = sellEquityHolding(holdings, {
        symbol: stock.symbol,
        quantity: qty,
      })
      saveEquityHoldings(user.email, nextHoldings)
      await fetch("/api/holdings/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, holdings: nextHoldings }),
      }).catch((err) => console.warn("Failed to save holdings to database:", err))
      
      try {
        window.dispatchEvent(new CustomEvent("tradeCompleted", { detail: { symbol: stock.symbol, type: "sell", quantity: qty } }))
      } catch {}
      toast({ title: 'Sold', description: `Sold ${qty} ${stock.symbol.split('.')[0]} for ${formatCurrency(totalValue)}` })
    } catch (e) {
      console.error("quickSell error", e)
    }
  }

  // Use shared CandlestickChart used by the stock page for consistent visuals

  return (
    <div className="space-y-6">
      {tradePopup.visible && (
        <div className="fixed top-20 right-6 z-50">
          <div className="bg-card border border-border px-4 py-3 rounded-lg shadow-lg">
            <div className="font-medium">{tradePopup.message}</div>
          </div>
        </div>
      )}

      {/* Quantity Dialog */}
      {quantityDialog.visible && quantityDialog.stock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in animation-duration-300">
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/95 p-6 shadow-2xl dialog-animated">
            <h3 className="mb-4 text-lg font-semibold text-foreground animate-slide-in-up">
              {quantityDialog.type === 'buy' ? '💰 Buy' : '💸 Sell'} {quantityDialog.stock.symbol.split('.')[0]}
            </h3>
            
            <div className="space-y-4">
              <div className="animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
                <label className="block text-sm font-medium mb-2">Quantity</label>
                <input
                  type="text"
                  value={quantityDialog.quantity}
                  onChange={(e) => setQuantityDialog(prev => ({ ...prev, quantity: e.target.value.replace(/\D/g, '') }))}
                  className="h-10 w-full rounded-lg border border-border/70 bg-background/80 px-3 py-2 md:h-9 focus:border-primary focus:outline-none transition-colors duration-300"
                />

              </div>

              <div className="space-y-1.5 rounded-lg border border-border/60 bg-secondary/20 p-3 text-sm animate-slide-in-up transition-all duration-300" style={{ animationDelay: '0.2s' }}>
                <div className="flex justify-between hover:text-primary transition-colors">
                  <span className="text-muted-foreground">Price per share</span>
                  <span className="font-mono font-bold">{formatCurrency(quantityDialog.stock.price)}</span>
                </div>
                <div className="flex justify-between hover:text-primary transition-colors">
                  <span className="text-muted-foreground">Total {quantityDialog.type === 'buy' ? 'Cost' : 'Value'}</span>
                  <span className="font-mono font-bold text-primary">{formatCurrency(quantityDialog.stock.price * (parseInt(quantityDialog.quantity || '0') || 0))}</span>
                </div>
              </div>

              <div className="flex gap-2 animate-slide-in-up" style={{ animationDelay: '0.3s' }}>
                <Button 
                  onClick={() => {
                    if (quantityDialog.type === 'buy') {
                      quickBuy(quantityDialog.stock!, parseInt(quantityDialog.quantity || '0') || 0)
                    } else {
                      quickSell(quantityDialog.stock!, parseInt(quantityDialog.quantity || '0') || 0)
                    }
                    setQuantityDialog({ visible: false, stock: null, type: null, quantity: '1' })
                  }}
                  className="h-10 flex-1 rounded-lg text-xs font-semibold md:h-9 btn-buy transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  {quantityDialog.type === 'buy' ? 'Buy' : 'Sell'} {parseInt(quantityDialog.quantity || '0') || 0} Shares
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setQuantityDialog({ visible: false, stock: null, type: null, quantity: 1 })}
                  className="h-10 flex-1 rounded-lg text-xs font-semibold md:h-9 transition-all duration-300 hover:border-primary/50 hover:shadow-lg"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2 md:gap-3 lg:gap-4 items-stretch">
        {predictions.map((stock, idx) => {
          const miniChart = generateStockChartData(stock.price, "1W").map((d) => ({
            time: d.timestamp,
            close: d.close,
          }))

          return (
            <div
              key={stock.symbol}
              className="relative cursor-pointer overflow-hidden rounded-xl border border-border/70 bg-card/70 p-3 shadow-[0_10px_28px_rgba(2,6,23,0.28)] transition-all duration-500 ease-out hover:border-primary/50 hover:shadow-lg hover:shadow-primary/40 hover:-translate-y-2 md:p-4 lg:p-4 group animate-fade-in-up"
              style={{
                animationDelay: `${idx * 50}ms`,
              }}
              onClick={() => {
                    setSelectedStock(stock)
                    setChartRange("1M")
                    try { window.dispatchEvent(new CustomEvent('predictionSelected', { detail: { selected: true } })) } catch {}
                  }}
            >
            <div className="flex justify-between items-start mb-2 group-hover:translate-x-1 transition-transform duration-300">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="font-bold text-base md:text-lg lg:text-lg text-foreground group-hover:text-primary transition-colors duration-300">{stock.symbol.split(".")[0]}</h3>
                  <p className="text-sm md:text-sm text-muted-foreground group-hover:text-accent transition-colors duration-300">{stock.name}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-lg md:text-xl lg:text-2xl group-hover:scale-110 transition-transform duration-300 origin-right">₹{stock.price ? stock.price.toLocaleString("en-IN") : "0"}</div>
                <div className={`text-sm md:text-sm lg:text-sm font-bold transition-all duration-300 ${stock.change >= 0 ? "text-green-600 md:text-green-700 group-hover:text-green-400" : "text-red-700 md:text-red-800 group-hover:text-red-500"}`}>
                  {stock.change >= 0 ? "+" : ""}
                  {(stock.changePercent || 0).toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="mt-1">
              <div className="w-full h-10 md:h-12 lg:h-12 group-hover:opacity-100 opacity-80 transition-opacity duration-300">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={miniChart}>
                      <XAxis dataKey="time" hide />
                      <YAxis hide domain={["dataMin", "dataMax"]} />
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.06} />
                      <Area type="monotone" dataKey="close" stroke="#06b6d4" strokeWidth={1.5} fill="#06b6d4" fillOpacity={0.08} dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

              <div className="pt-2 md:pt-3 border-t border-border/50 border-t-primary/20 group-hover:border-t-primary/50 transition-colors duration-300 flex items-center justify-between">
              <div className="px-2 py-1 md:px-3 md:py-1 rounded-full bg-emerald-900/10 group-hover:bg-emerald-900/30 text-emerald-800 group-hover:text-emerald-400 text-xs md:text-xs lg:text-sm font-black uppercase tracking-wider transition-all duration-300">
                Target: +{stock.predictedGrowth.toFixed(1)}%
              </div>
              <div className="text-xs md:text-sm font-bold text-muted-foreground group-hover:text-primary/80 uppercase tracking-widest transition-colors duration-300">
                Signal: {stock.signal}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                className="flex-1 text-sm md:text-sm md:h-9 btn-buy group/btn transition-all duration-300 hover:scale-105 active:scale-95"
                onClick={(e) => {
                  e.stopPropagation()
                  setQuantityDialog({ visible: true, stock, type: 'buy', quantity: 1 })
                }}
              >
                Buy
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 text-sm md:text-sm md:h-9 btn-sell group/btn transition-all duration-300 hover:scale-105 active:scale-95"
                onClick={(e) => {
                  e.stopPropagation()
                  setQuantityDialog({ visible: true, stock, type: 'sell', quantity: 1 })
                }}
              >
                Sell
              </Button>
            </div>
          </div>
          )
        })}
      </div>

      {/* Fullscreen chart modal for selected stock */}
      {selectedStock && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm backdrop-animated animate-in fade-in animation-duration-300">
          <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-border/70 bg-card/95 p-5 shadow-2xl md:p-6 modal-selected">
            <div className="flex items-start justify-between mb-4 gap-4 animate-slide-in-up">
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedStock.symbol.split(".")[0]} — {selectedStock.name}</h2>
                <p className="text-sm text-muted-foreground">Predicted: +{selectedStock.predictedGrowth.toFixed(1)}% • Confidence: {selectedStock.confidence.toFixed(0)}%</p>
              </div>
              <div className="flex items-center gap-2 animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => { 
                    setSelectedStock(null)
                    try { window.dispatchEvent(new CustomEvent('predictionSelected', { detail: { selected: false } })) } catch {} 
                  }}
                  className="hover:bg-destructive/20 hover:text-destructive transition-colors duration-300"
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 chart-animated">
                <CardContent className="p-4 md:p-5">
                  <Tabs value={chartType} onValueChange={(value) => setChartType(value as "line" | "candlestick")} className="w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <TabsList className="h-10 rounded-lg border border-border/60 bg-secondary/35 p-1">
                        <TabsTrigger
                          value="line"
                          className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          <Activity className="h-4 w-4" />
                          Line
                        </TabsTrigger>
                        <TabsTrigger
                          value="candlestick"
                          className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          <BarChart3 className="h-4 w-4" />
                          Candlestick
                        </TabsTrigger>
                      </TabsList>

                      <div className="flex gap-1 flex-wrap">
                        {["1D", "1W", "1M", "5Y"].map((range) => (
                          <Button
                            key={range}
                            variant="ghost"
                            size="sm"
                            onClick={() => setChartRange(range)}
                            className={cn(
                              "rounded-full px-3 text-xs font-medium transition-all",
                              chartRange === range
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "bg-secondary/30 hover:bg-secondary/60",
                            )}
                          >
                            {range}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <TabsContent value="line" className="mt-0">
                      <StockChart
                        data={chartData}
                        onRangeChange={() => {}}
                        currentRange={chartRange}
                        isPositive={selectedStock ? selectedStock.change >= 0 : true}
                        hideControls
                      />
                    </TabsContent>

                    <TabsContent value="candlestick" className="mt-0">
                      <CandlestickChart data={chartData} currentRange={chartRange} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <div className="w-full">
                <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 transition-all duration-300 hover:border-primary/40 hover:bg-secondary/30">
                  <div className="flex items-center justify-between gap-4">
                    <div className="animate-slide-in-up">
                      <div className="text-sm text-muted-foreground">Latest price</div>
                      <div className="text-lg font-mono font-bold text-primary">₹{selectedStock.price.toLocaleString("en-IN")}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Change: <span className={selectedStock.change >= 0 ? "text-green-800 font-bold" : "text-red-600 font-bold"}>
                          {selectedStock.change >= 0 ? "+" : ""}₹{selectedStock.change.toFixed(2)} ({selectedStock.changePercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
                      <Button
                        size="sm"
                        onClick={() => {
                            setQuantityDialog({ visible: true, stock: selectedStock, type: 'buy', quantity: 1 })
                            setSelectedStock(null)
                            try { window.dispatchEvent(new CustomEvent('predictionSelected', { detail: { selected: false } })) } catch {}
                          }}
                        className="h-8 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 text-xs font-semibold text-white transition-all duration-300 hover:shadow-lg hover:shadow-emerald-600/50 active:scale-95"
                      >
                        Buy
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setQuantityDialog({ visible: true, stock: selectedStock, type: 'sell', quantity: 1 })
                          setSelectedStock(null)
                          try { window.dispatchEvent(new CustomEvent('predictionSelected', { detail: { selected: false } })) } catch {}
                        }}
                        className="h-8 rounded-md px-3 text-xs font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-red-600/50 active:scale-95"
                      >
                        Sell
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen trade panel */}
      {showTradeFullscreen && selectedStock && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border/70 bg-card/95 p-5 shadow-2xl md:p-6">
            <div className="absolute top-4 right-4">
              <Button variant="ghost" size="icon" onClick={() => setShowTradeFullscreen(false)}>✕</Button>
            </div>
            <TradePanel
              stock={{ symbol: selectedStock.symbol, regularMarketPrice: selectedStock.price, shortName: selectedStock.name } as any}
              initialTab={tradeInitialTab || 'buy'}
              allowOptions={false}
            />
          </div>
        </div>
      )}

      {/* Prediction cards are view-only — dialog removed */}

      {/* Full-screen Trade removed for predictions; use Options/Stock pages for trading */}
    </div>
  )
}

// no helpers needed

// NOTE: these helper functions are hoisted below the component to keep the
// component body readable — they will be bound during module evaluation in dev.
