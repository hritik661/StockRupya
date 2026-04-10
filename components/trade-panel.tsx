"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useBalance } from "@/hooks/use-balance"
import type { StockQuote } from "@/lib/yahoo-finance"
import { formatCurrency } from "@/lib/market-utils"
import { storeLastTradingPrice } from "@/lib/pnl-calculator"
import {
  buyEquityHolding,
  buyOptionPosition,
  loadEquityHoldings,
  loadOptionPositions,
  saveEquityHoldings,
  saveOptionPositions,
  sellEquityHolding,
} from "@/lib/trade-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { TrendingUp, TrendingDown, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface TradePanelProps {
  stock: StockQuote
  preselectedOption?: { action: "BUY" | "SELL"; type: "CE" | "PE"; strike: number; price: number } | null
  initialTab?: "buy" | "sell"
  allowOptions?: boolean
}

interface Holding {
  symbol: string
  name: string
  quantity: number
  avgPrice: number
}

interface Transaction {
  id: string
  symbol: string
  name: string
  type: "buy" | "sell"
  quantity: number
  price: number
  total: number
  timestamp: number
}

export function TradePanel({ stock, preselectedOption, initialTab, allowOptions = true }: TradePanelProps) {
  const { user } = useAuth()
  const { deductBalance, addBalance } = useBalance()
  const { toast } = useToast()
  // Allow empty input while typing by using string state; convert to number when performing actions
  const [quantity, setQuantity] = useState<string>('1')
  const [tradeType, setTradeType] = useState<"equity" | "options">("equity")
  const [optionType, setOptionType] = useState<"CE" | "PE">("CE")
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"buy" | "sell">(initialTab || "buy")

  const numQuantity = Math.max(0, parseInt(quantity || '0') || 0)
  const totalCost = numQuantity * stock.regularMarketPrice

  // Ensure unique email based key for data persistence
  const transactionsKey = user ? `transactions_${user.email}` : "transactions_guest"
  const holdings: Holding[] = loadEquityHoldings(user?.email)
  const transactions: Transaction[] = JSON.parse(localStorage.getItem(transactionsKey) || "[]")
  const currentHolding = holdings.find((h: Holding) => h.symbol === stock.symbol)

  const handleBuy = async () => {
    if (!user) return
    const qty = Math.max(0, parseInt(quantity || '0') || 0)
    if (qty < 1) {
      toast({ title: 'Enter Quantity', description: 'Please enter a valid quantity to buy', variant: 'destructive' })
      return
    }
    const localTotal = qty * stock.regularMarketPrice
    if (localTotal > user.balance) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${formatCurrency(localTotal - user.balance)} more to complete this purchase.`,
        variant: "destructive",
      })
      return
    }

    // Deduct balance using API
    const balanceResult = await deductBalance(localTotal, "BUY", stock.symbol, qty, stock.regularMarketPrice)
    if (!balanceResult.success) {
      toast({
        title: "Transaction Failed",
        description: balanceResult.error,
        variant: "destructive",
      })
      return
    }

    const nextHoldings = buyEquityHolding(holdings, {
      symbol: stock.symbol,
      name: stock.shortName,
      quantity: qty,
      price: stock.regularMarketPrice,
    })

    saveEquityHoldings(user.email, nextHoldings)

    // Save holdings to database
    try {
      await fetch("/api/holdings/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, holdings: nextHoldings }),
      })
    } catch (error) {
      console.warn("Failed to save holdings to database:", error)
    }

    // Record transaction
    const transaction: Transaction = {
      id: Date.now().toString(),
      symbol: stock.symbol,
      name: stock.shortName,
      type: "buy",
      quantity: qty,
      price: stock.regularMarketPrice,
      total: localTotal,
      timestamp: Date.now(),
    }
    transactions.push(transaction)
    localStorage.setItem(transactionsKey, JSON.stringify(transactions))

    // Store the last trading price for persistent P&L after market closes
    try {
      storeLastTradingPrice(user.email, stock.symbol, stock.regularMarketPrice)
    } catch (error) {
      console.warn("Failed to store last trading price:", error)
    }

    toast({
      title: "Order Placed Successfully",
      description: `Bought ${qty} shares of ${stock.symbol.replace(".NS", "")} at ${formatCurrency(stock.regularMarketPrice)}`,
    })

    setQuantity('1')

    // notify other UI listeners that a trade completed (used by Predictions popup)
    try {
      window.dispatchEvent(
        new CustomEvent("tradeCompleted", { detail: { symbol: stock.symbol, type: "buy", quantity: qty } }),
      )
    } catch (e) {}
  }

  const handleSell = async () => {
    if (!user) return
    const qty = Math.max(0, parseInt(quantity || '0') || 0)
    if (qty < 1) {
      toast({ title: 'Enter Quantity', description: 'Please enter a valid quantity to sell', variant: 'destructive' })
      return
    }

    if (!currentHolding || currentHolding.quantity < qty) {
      toast({
        title: "Insufficient Shares",
        description: `You only have ${currentHolding?.quantity || 0} shares to sell.`,
        variant: "destructive",
      })
      return
    }

    // Add balance using API
    const balanceResult = await addBalance(totalCost, "SELL", stock.symbol, qty, stock.regularMarketPrice)
    if (!balanceResult.success) {
      toast({
        title: "Transaction Failed",
        description: balanceResult.error,
        variant: "destructive",
      })
      return
    }

    const nextHoldings = sellEquityHolding(holdings, {
      symbol: stock.symbol,
      quantity: qty,
    })

    saveEquityHoldings(user.email, nextHoldings)

    // Save holdings to database
    try {
      await fetch("/api/holdings/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, holdings: nextHoldings }),
      })
    } catch (error) {
      console.warn("Failed to save holdings to database:", error)
    }

    // Record transaction
    const transaction: Transaction = {
      id: Date.now().toString(),
      symbol: stock.symbol,
      name: stock.shortName,
      type: "sell",
      quantity: qty,
      price: stock.regularMarketPrice,
      total: totalCost,
      timestamp: Date.now(),
    }
    transactions.push(transaction)
    localStorage.setItem(transactionsKey, JSON.stringify(transactions))

    // Store the last trading price for persistent P&L after market closes
    try {
      storeLastTradingPrice(user.email, stock.symbol, stock.regularMarketPrice)
    } catch (error) {
      console.warn("Failed to store last trading price:", error)
    }

    toast({
      title: "Order Placed Successfully",
      description: `Sold ${qty} shares of ${stock.symbol.replace(".NS", "")} at ${formatCurrency(stock.regularMarketPrice)}`,
    })

    setQuantity('1')

    // notify other UI listeners that a trade completed (used by Predictions popup)
    try {
      window.dispatchEvent(
        new CustomEvent("tradeCompleted", { detail: { symbol: stock.symbol, type: "sell", quantity: qty } }),
      )
    } catch (e) {}
  }

  const isLoggedIn = !!user

  // React to externally preselected option (from OptionChain)
  // Set trade view to options and preselect strike/type when it changes
  useEffect(() => {
    if (!preselectedOption) return
    setTradeType("options")
    setOptionType(preselectedOption.type)
    setSelectedStrike(preselectedOption.strike)
    setActiveTab(preselectedOption.action === "BUY" ? "buy" : "sell")
    toast({
      title: "Option Selected",
      description: `${preselectedOption.action} ${preselectedOption.type} ${stock.symbol.replace(".NS", "")} @ ${preselectedOption.strike}`,
    })
  }, [preselectedOption, stock.symbol, toast])

  // Respect `initialTab` when it changes (e.g., opened from Predictions)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

  // Determine whether to show the Equity/Options toggle.
  // Hide the toggle when parent explicitly disables options (e.g., Predictions fullscreen)
  const showOptionsToggle = !!preselectedOption || allowOptions

  if (!isLoggedIn) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Trade {stock.symbol.replace(".NS", "")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Please login to buy or sell stocks.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => window.dispatchEvent(new Event('open-login'))}>Login</Button>
            <Button asChild variant="outline" className="flex-1 bg-transparent">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card id="trade-panel" className="rounded-2xl border border-border/70 bg-card/70 shadow-[0_18px_60px_rgba(2,6,23,0.45)] backdrop-blur-md lg:max-w-xs xl:max-w-md">
      <CardHeader className="pb-1 lg:pb-1.5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold md:text-base lg:text-sm">Trade {stock.symbol.replace(".NS", "")}</CardTitle>
          {showOptionsToggle ? (
            <div className="flex gap-1 rounded-lg border border-border/60 bg-secondary/40 p-1">
              <Button
                variant={tradeType === "equity" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-[11px] md:h-8 md:text-xs"
                onClick={() => setTradeType("equity")}
              >
                Equity
              </Button>
              <Button
                variant={tradeType === "options" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-[11px] md:h-8 md:text-xs"
                onClick={() => setTradeType("options")}
              >
                Options
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 lg:space-y-1.5">
        {tradeType === "options" ? (
          <div className="space-y-2 lg:space-y-1.5">
            <div className="grid grid-cols-2 gap-2 lg:gap-1.5">
              <Button
                variant={optionType === "CE" ? "default" : "outline"}
                className={cn("h-10 gap-2 text-xs md:h-9 lg:h-8 lg:text-[11px]", optionType === "CE" && "bg-primary text-primary-foreground")}
                onClick={() => setOptionType("CE")}
              >
                <TrendingUp className="h-4 w-4 lg:h-3 lg:w-3" />
                Call (CE)
              </Button>
              <Button
                variant={optionType === "PE" ? "default" : "outline"}
                className={cn("h-10 gap-2 text-xs md:h-9 lg:h-8 lg:text-[11px]", optionType === "PE" && "bg-destructive text-destructive-foreground")}
                onClick={() => setOptionType("PE")}
              >
                <TrendingDown className="h-4 w-4 lg:h-3 lg:w-3" />
                Put (PE)
              </Button>
            </div>

            <div className="space-y-1 lg:space-y-0.5">
              <Label className="text-xs lg:text-[11px]">Strike Price</Label>
              <div className="grid grid-cols-3 gap-2 lg:gap-1">
                {[-1, 0, 1].map((offset) => {
                  const strike = Math.round(stock.regularMarketPrice / 50) * 50 + offset * 50
                  const isSelected = selectedStrike === strike
                  return (
                    <Button
                      key={offset}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={cn("font-mono text-xs lg:h-7 lg:text-[11px]", isSelected ? "" : "bg-transparent")}
                      onClick={() => setSelectedStrike(strike)}
                    >
                      {strike}
                    </Button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1 lg:space-y-0.5">
              <Label className="text-xs lg:text-[11px]">Lot Size</Label>
              <Input type="number" defaultValue={50} disabled className="h-10 bg-secondary/50 font-mono md:h-9 lg:h-8 lg:text-xs" />
            </div>

            <Button
              className="h-10 w-full gap-2 rounded-lg bg-gradient-to-r from-primary to-accent text-xs md:h-9 lg:h-7 lg:text-[11px]"
              onClick={async () => {
                try {
                  const strike = selectedStrike ?? Math.round(stock.regularMarketPrice / 50) * 50
                  const lotSize = 50 // fixed lot size used in UI

                  // determine premium: prefer preselectedOption.price if provided
                  const premium = preselectedOption?.price ?? Math.max(1, +(stock.regularMarketPrice * 0.02).toFixed(2))
                  const totalCost = premium * lotSize

                  if (totalCost > (user?.balance || 0)) {
                    toast({
                      title: "Insufficient Balance",
                      description: `You need ${formatCurrency(totalCost - (user?.balance || 0))} more to buy this option lot.`,
                      variant: "destructive",
                    })
                    return
                  }

                  // Use API-backed deduction for consistency
                  try {
                    const res = await deductBalance(totalCost, "BUY", stock.symbol, 1, premium)
                    if (!res.success) {
                      toast({ title: "Transaction Failed", description: res.error, variant: "destructive" })
                      return
                    }
                  } catch (err) {
                    console.error("option order balance error", err)
                  }

                  const nextPositions = buyOptionPosition(loadOptionPositions(user.email), {
                    type: optionType,
                    action: "BUY",
                    index: stock.symbol,
                    strike,
                    symbol: `${stock.symbol}-${strike}-${optionType}`,
                    price: premium,
                    quantity: 1,
                    lotSize,
                  })

                  saveOptionPositions(user.email, nextPositions)
                  await fetch("/api/options/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: user.email,
                      options: nextPositions,
                    }),
                  }).catch((err) => console.warn("Failed to save options to database:", err))

                  toast({
                    title: "Option Order Placed",
                    description: `${optionType} Option for ${stock.symbol.replace(".NS", "")} @ ${strike} — ${lotSize} qty at ${formatCurrency(premium)} premium`,
                  })
                } catch (err) {
                  console.error("place option order error", err)
                  toast({ title: "Error", description: "Unable to place option order" })
                }
              }}
            >
              <Zap className="h-4 w-4 lg:h-3 lg:w-3" />
              Place Option Order
            </Button>
          </div>
        ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "buy" | "sell")} className="w-full">
            <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg border border-border/60 bg-secondary/40 p-1 md:h-9 lg:h-8">
              <TabsTrigger
                value="buy"
                className="text-xs font-semibold lg:text-[11px] data-[state=active]:bg-emerald-500 data-[state=active]:text-white"
              >
                Buy
              </TabsTrigger>
              <TabsTrigger
                value="sell"
                className="text-xs font-semibold lg:text-[11px] data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground"
              >
                Sell
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="mt-2 space-y-2 lg:mt-1.5 lg:space-y-1">
              <div className="space-y-1 lg:space-y-0.5">
                <Input
                  id="buy-quantity"
                  type="text"
                  placeholder="Enter quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
                  className="h-10 rounded-lg border-border/70 bg-background/60 md:h-9 lg:h-8 lg:text-xs"
                />
              </div>

              <div className="space-y-1 rounded-lg border border-border/60 bg-secondary/20 p-2 text-xs md:text-sm lg:p-1.5 lg:text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price per share</span>
                  <span className="font-mono">{formatCurrency(stock.regularMarketPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="font-mono font-bold">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available Balance</span>
                  <span className="font-mono">{formatCurrency(user.balance)}</span>
                </div>
              </div>

              <Button className="btn-buy h-10 w-full gap-1.5 rounded-lg md:h-9 lg:h-7 lg:text-xs" onClick={handleBuy} disabled={numQuantity < 1 || totalCost > user.balance}>
                <TrendingUp className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
                <span className="text-xs font-semibold lg:text-[11px]">Buy {numQuantity} {numQuantity === 1 ? "Share" : "Shares"}</span>
              </Button>
            </TabsContent>

            <TabsContent value="sell" className="mt-2 space-y-2 lg:mt-1.5 lg:space-y-1">
              <div className="space-y-1 lg:space-y-0.5">
                <Input
                  id="sell-quantity"
                  type="text"
                  placeholder="Enter quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
                  className="h-10 rounded-lg border-border/70 bg-background/60 md:h-9 lg:h-8 lg:text-xs"
                />

              </div>

              <div className="space-y-1 rounded-lg border border-border/60 bg-secondary/20 p-2 text-xs md:text-sm lg:p-1.5 lg:text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your Holdings</span>
                  <span className="font-mono">{currentHolding?.quantity || 0} shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price per share</span>
                  <span className="font-mono">{formatCurrency(stock.regularMarketPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Value</span>
                  <span className="font-mono font-bold">{formatCurrency(totalCost)}</span>
                </div>
              </div>

              <Button
                className="btn-sell h-10 w-full gap-1.5 rounded-lg md:h-9 lg:h-7 lg:text-xs"
                onClick={handleSell}
                disabled={!currentHolding || currentHolding.quantity < numQuantity || numQuantity < 1}
              >
                <TrendingDown className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
                <span className="text-xs font-semibold lg:text-[11px]">Sell {numQuantity} {numQuantity === 1 ? "Share" : "Shares"}</span>
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
