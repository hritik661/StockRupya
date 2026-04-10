"use client"

import { useState, useMemo } from "react"
import { formatCurrency } from "@/lib/market-utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CandlestickChart } from "@/components/candlestick-chart"
import { LineChart } from "@/components/line-chart"
import { TrendingUp, TrendingDown, Activity, Volume2, BarChart3 } from "lucide-react"


interface OptionChainProps {
  stockPrice: number
  symbol: string
  onTrade: (action: "BUY" | "SELL", type: "CE" | "PE", strike: number, price: number) => void
  onStockTrade?: (action: "BUY" | "SELL", price: number) => void
}

export function OptionChain({ stockPrice, symbol, onTrade, onStockTrade }: OptionChainProps) {
  const [expiry, setExpiry] = useState("Current Week")

  const strikes = useMemo(() => {
    const spot = Math.round(stockPrice / 50) * 50
    const list = []
    for (let i = -8; i <= 8; i++) {
      const strike = spot + i * 50
      const dist = Math.abs(strike - stockPrice)
      const cePrice = Math.max(5, (stockPrice - strike) * 0.8 + 50 - dist * 0.2)
      const pePrice = Math.max(5, (strike - stockPrice) * 0.8 + 50 - dist * 0.2)

      list.push({
        strike,
        cePrice,
        pePrice,
        ceChange: (Math.random() - 0.4) * 20,
        peChange: (Math.random() - 0.4) * 20,
        ceOI: Math.floor(Math.random() * 50000) + 10000,
        peOI: Math.floor(Math.random() * 50000) + 10000,
        ceVolume: Math.floor(Math.random() * 10000) + 1000,
        peVolume: Math.floor(Math.random() * 10000) + 1000,
        ceIV: (15 + Math.random() * 30).toFixed(2),
        peIV: (15 + Math.random() * 30).toFixed(2),
        isATM: Math.abs(strike - stockPrice) < 25,
        isITM: i < 0,
      })
    }
    return list
  }, [stockPrice])

  const [chartOpen, setChartOpen] = useState<null | { type: "CE" | "PE"; strike: number; price: number }>(null)

  const generateOptionChart = (price: number, points = 40) => {
    const data: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] = []
    let last = price
    const now = Math.floor(Date.now() / 1000)
    for (let i = points - 1; i >= 0; i--) {
      const t = now - i * 3600 * 6
      const volatility = Math.max(0.01, price * 0.02)
      const change = (Math.random() - 0.5) * volatility
      const open = Math.max(0.1, last + change)
      const close = Math.max(0.1, open + (Math.random() - 0.5) * volatility)
      const high = Math.max(open, close) + Math.random() * volatility
      const low = Math.min(open, close) - Math.random() * volatility
      const volume = Math.floor(Math.random() * 10000) + 100
      data.push({ timestamp: t, open, high, low, close, volume })
      last = close
    }
    return data
  }

  return (
    <Card className="mt-6 rounded-2xl border border-border/70 bg-card/70 shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="mb-1 text-lg font-semibold md:text-xl">Option Chain - {symbol.replace(".NS", "")}</CardTitle>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Spot Price: <span className="font-mono font-semibold text-foreground">{formatCurrency(stockPrice)}</span>
            </p>
            {onStockTrade && (
              <div className="flex gap-1">
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 rounded-md bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-700"
                  onClick={() => onStockTrade("BUY", stockPrice)}
                >
                  BUY
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 rounded-md bg-red-600 px-3 text-[11px] font-semibold text-white hover:bg-red-700"
                  onClick={() => onStockTrade("SELL", stockPrice)}
                >
                  SELL
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {["Current Week", "Next Week", "Monthly"].map((e) => (
            <Badge
              key={e}
              variant={expiry === e ? "default" : "outline"}
              className="cursor-pointer rounded-full px-3 py-1 text-[11px]"
              onClick={() => setExpiry(e)}
            >
              {e}
            </Badge>
          ))}
        </div>
      </CardHeader>
      {/* Chart Dialog */}
      <Dialog open={!!chartOpen} onOpenChange={() => setChartOpen(null)}>
        <DialogContent className="max-h-[90vh] min-w-[320px] max-w-5xl overflow-y-auto rounded-2xl border border-border/70 bg-card/95 shadow-2xl">
          <DialogHeader>
            <DialogTitle>
              {chartOpen ? `${chartOpen.type} ${symbol.replace('.NS','')} ${chartOpen.strike} Analysis` : "Chart"}
            </DialogTitle>
          </DialogHeader>
          {chartOpen && (
            <Tabs defaultValue="candlestick" className="w-full">
              <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg border border-border/60 bg-secondary/40 p-1">
                <TabsTrigger value="candlestick">Candlestick</TabsTrigger>
                <TabsTrigger value="line">Line Chart</TabsTrigger>
              </TabsList>
              <TabsContent value="candlestick" className="mt-4">
                <div className="p-2">
                  <CandlestickChart data={generateOptionChart(chartOpen.price, 80) as any} currentRange={"1M"} />
                </div>
              </TabsContent>
              <TabsContent value="line" className="mt-4">
                <div className="p-2">
                  <LineChart data={generateOptionChart(chartOpen.price, 80) as any} currentRange={"1M"} />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-secondary/40 hover:bg-transparent">
                <TableHead
                  colSpan={5}
                  className="border-r border-border text-center text-sm font-semibold text-primary md:text-base"
                >
                  CALLS (CE)
                </TableHead>
                <TableHead className="border-r border-border text-center text-sm font-semibold md:text-base">
                  STRIKE
                </TableHead>
                <TableHead colSpan={5} className="text-center text-sm font-semibold text-destructive md:text-base">
                  PUTS (PE)
                </TableHead>
              </TableRow>
              <TableRow className="border-border bg-secondary/25 text-xs hover:bg-transparent">
                <TableHead className="text-center">OI</TableHead>
                <TableHead className="text-center">CHNG</TableHead>
                <TableHead className="text-center">VOL</TableHead>
                <TableHead className="text-center">IV</TableHead>
                <TableHead className="text-center border-r border-border">LTP</TableHead>
                <TableHead className="text-center bg-secondary/30 font-bold border-r border-border">PRICE</TableHead>
                <TableHead className="text-center">LTP</TableHead>
                <TableHead className="text-center">IV</TableHead>
                <TableHead className="text-center">VOL</TableHead>
                <TableHead className="text-center">CHNG</TableHead>
                <TableHead className="text-center">OI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {strikes.map((s) => (
                <TableRow
                  key={s.strike}
                  className={`border-border transition-colors ${
                    s.isATM ? "bg-accent/10 font-semibold" : s.isITM ? "bg-primary/5" : "hover:bg-secondary/20"
                  }`}
                >
                  {/* CE Data */}
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {(s.ceOI / 1000).toFixed(1)}k
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    <div
                      className={`inline-flex items-center gap-0.5 ${s.ceChange >= 0 ? "text-primary" : "text-destructive"}`}
                    >
                      {s.ceChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(s.ceChange).toFixed(1)}%
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {(s.ceVolume / 1000).toFixed(1)}k
                  </TableCell>
                  <TableCell className="text-center text-xs font-mono text-muted-foreground">{s.ceIV}%</TableCell>
                  <TableCell className="text-center border-r border-border">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 rounded-md bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                        onClick={() => onTrade("BUY", "CE", s.strike, s.cePrice)}
                      >
                        BUY
                      </Button>
                      <span className="flex flex-col items-center">
                        <span className="flex items-center gap-1">
                          <span className="text-sm font-mono font-bold text-foreground">
                            ₹{formatCurrency(s.cePrice).replace("₹", "")}
                          </span>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="ml-1.5 h-7 w-7 rounded-md border border-emerald-500/60 bg-emerald-600 p-0 text-[10px] font-bold text-white hover:bg-emerald-700"
                            title="Quick Buy"
                            onClick={() => onTrade("BUY", "CE", s.strike, s.cePrice)}
                          >
                            B
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="ml-1 h-7 w-7 rounded-md border border-red-500/60 bg-red-600 p-0 text-[10px] font-bold text-white hover:bg-red-700"
                            title="Quick Sell"
                            onClick={() => onTrade("SELL", "CE", s.strike, s.cePrice)}
                          >
                            S
                          </Button>
                        </span>
                        <span className="text-xs text-muted-foreground">LTP</span>
                      </span>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 rounded-md bg-red-600 px-2.5 text-[11px] font-semibold text-white hover:bg-red-700"
                        onClick={() => onTrade("SELL", "CE", s.strike, s.cePrice)}
                      >
                        SELL
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-1.5 h-7 w-7 rounded-md border border-border/70 hover:bg-secondary"
                        onClick={() => setChartOpen({ type: "CE", strike: s.strike, price: s.cePrice })}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>

                  {/* Strike Price */}
                  <TableCell
                    className={`text-center font-bold font-mono text-base border-r border-border ${
                      s.isATM ? "bg-accent/20 text-accent-foreground" : "bg-secondary/20"
                    }`}
                  >
                    {s.strike}
                    {s.isATM && (
                      <Badge variant="secondary" className="ml-2 text-[9px] px-1 py-0">
                        ATM
                      </Badge>
                    )}
                  </TableCell>

                  {/* PE Data */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mr-1.5 h-7 w-7 rounded-md border border-border/70 hover:bg-secondary"
                        onClick={() => setChartOpen({ type: "PE", strike: s.strike, price: s.pePrice })}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 rounded-md bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                        onClick={() => onTrade("BUY", "PE", s.strike, s.pePrice)}
                      >
                        BUY
                      </Button>
                      <span className="flex flex-col items-center">
                        <span className="flex items-center gap-1">
                          <span className="text-sm font-mono font-bold text-foreground">
                            ₹{formatCurrency(s.pePrice).replace("₹", "")}
                          </span>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="ml-1.5 h-7 w-7 rounded-md border border-emerald-500/60 bg-emerald-600 p-0 text-[10px] font-bold text-white hover:bg-emerald-700"
                            title="Quick Buy"
                            onClick={() => onTrade("BUY", "PE", s.strike, s.pePrice)}
                          >
                            B
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="ml-1 h-7 w-7 rounded-md border border-red-500/60 bg-red-600 p-0 text-[10px] font-bold text-white hover:bg-red-700"
                            title="Quick Sell"
                            onClick={() => onTrade("SELL", "PE", s.strike, s.pePrice)}
                          >
                            S
                          </Button>
                        </span>
                        <span className="text-xs text-muted-foreground">LTP</span>
                      </span>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 rounded-md bg-red-600 px-2.5 text-[11px] font-semibold text-white hover:bg-red-700"
                        onClick={() => onTrade("SELL", "PE", s.strike, s.pePrice)}
                      >
                        SELL
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-xs font-mono text-muted-foreground">{s.peIV}%</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {(s.peVolume / 1000).toFixed(1)}k
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    <div
                      className={`inline-flex items-center gap-0.5 ${s.peChange >= 0 ? "text-primary" : "text-destructive"}`}
                    >
                      {s.peChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(s.peChange).toFixed(1)}%
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {(s.peOI / 1000).toFixed(1)}k
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-border/70 bg-secondary/20 px-4 py-3 text-[11px] text-muted-foreground md:text-xs">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3" />
            <span>OI: Open Interest</span>
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className="h-3 w-3" />
            <span>VOL: Volume</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3" />
            <span>CHNG: % Change</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono">IV: Implied Volatility</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono">LTP: Last Traded Price</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

