"use client"

import { useMemo } from "react"
import { Area, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ChartData } from "@/lib/yahoo-finance"
import { formatCurrency } from "@/lib/market-utils"

interface StockChartProps {
  data: ChartData[]
  onRangeChange: (range: string) => void
  currentRange: string
  isPositive: boolean
  hideControls?: boolean
}

const TIME_RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y", "MAX"]

export function StockChart({ data, onRangeChange, currentRange, isPositive, hideControls }: StockChartProps) {
  const color = isPositive ? "#22c55e" : "#ef4444"
  const gradientId = `stock-line-${isPositive ? "up" : "down"}`

  const [xMin, xMax] = useMemo(() => {
    if (!data?.length) return [0, 1]
    const first = data[0].timestamp
    const last = data[data.length - 1].timestamp
    if (first === last) return [first - 1, last + 1]
    return [first, last]
  }, [data])

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    if (currentRange === "1D") {
      return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    }
    if (currentRange === "1W" || currentRange === "1M") {
      return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    }
    return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
  }

  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartData }> }) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    const date = new Date(item.timestamp * 1000)
    return (
      <div className="min-w-[180px] rounded-xl border border-border/70 bg-card/95 p-3 shadow-xl backdrop-blur-md">
        <p className="mb-2 text-xs text-muted-foreground">
          {date.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </p>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Price</span>
            <span className="font-mono font-semibold">{formatCurrency(item.close)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Volume</span>
            <span className="font-mono">{(item.volume / 1_000_000).toFixed(2)}M</span>
          </div>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center text-muted-foreground">
        <Activity className="mb-4 h-10 w-10 opacity-40" />
        <p className="text-sm">Chart data not available</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!hideControls && (
        <div className="flex flex-wrap items-center gap-1">
          {TIME_RANGES.map((range) => (
            <Button
              key={range}
              variant={currentRange === range ? "default" : "ghost"}
              size="sm"
              onClick={() => onRangeChange(range)}
              className="rounded-full px-3 text-xs"
            >
              {range}
            </Button>
          ))}
        </div>
      )}

      <div className="h-[250px] w-full overflow-hidden rounded-xl border border-border/60 bg-card/40 sm:h-[320px] lg:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 10, left: 6, bottom: 18 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.03} />
              </linearGradient>
              <filter id="stockGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <CartesianGrid stroke="#334155" strokeDasharray="2 4" strokeOpacity={0.45} vertical={false} />

            <XAxis
              dataKey="timestamp"
              type="number"
              domain={[xMin, xMax]}
              tickFormatter={formatXAxis}
              tickLine={false}
              axisLine={false}
              minTickGap={18}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />

            <YAxis
              orientation="right"
              domain={["auto", "auto"]}
              tickFormatter={(value) => formatCurrency(Number(value)).replace(".00", "")}
              tickLine={false}
              axisLine={false}
              width={68}
              tickMargin={8}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />

            <Tooltip content={renderTooltip} />

            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={2.25}
              fill={`url(#${gradientId})`}
              filter="url(#stockGlow)"
              dot={false}
              activeDot={{
                r: 3.5,
                stroke: "#ffffff",
                strokeWidth: 1.5,
                fill: color,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
