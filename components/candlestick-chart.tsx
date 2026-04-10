"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BarChart3 } from "lucide-react"
import type { ChartData } from "@/lib/yahoo-finance"
import { formatCurrency } from "@/lib/market-utils"

interface CandlestickChartProps {
  data: ChartData[]
  currentRange: string
}

export function CandlestickChart({ data, currentRange }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(920)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
      setIsMobile(window.innerWidth < 768)
    }
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  const chartConfig = useMemo(() => {
    if (!data?.length) return null

    const width = Math.max(320, containerWidth)
    const height = isMobile ? 260 : 320
    const padding = isMobile ? { top: 14, right: 50, bottom: 26, left: 10 } : { top: 16, right: 70, bottom: 28, left: 14 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const prices = data.flatMap((d) => [d.high, d.low])
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = Math.max(1, max - min)
    const paddedMin = min - range * 0.04
    const paddedMax = max + range * 0.04
    const paddedRange = paddedMax - paddedMin

    const candleBodyWidth = Math.max(2, Math.min(isMobile ? 7 : 10, chartWidth / Math.max(12, data.length) * 0.72))

    const scaleY = (price: number) => padding.top + chartHeight - ((price - paddedMin) / paddedRange) * chartHeight
    const scaleX = (index: number) => {
      if (data.length <= 1) return padding.left + chartWidth / 2
      return padding.left + (index / (data.length - 1)) * chartWidth
    }

    return {
      width,
      height,
      padding,
      chartWidth,
      chartHeight,
      min: paddedMin,
      max: paddedMax,
      candleBodyWidth,
      scaleX,
      scaleY,
    }
  }, [data, containerWidth, isMobile])

  if (!chartConfig || !data.length) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
        <BarChart3 className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Chart data not available</p>
      </div>
    )
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    if (currentRange === "1D") return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    if (currentRange === "1W" || currentRange === "1M") return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
  }

  const ticks = Array.from({ length: 5 }, (_, i) => {
    const ratio = i / 4
    const y = chartConfig.padding.top + ratio * chartConfig.chartHeight
    const value = chartConfig.max - ratio * (chartConfig.max - chartConfig.min)
    return { y, value }
  })

  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const idx = Math.round((i / 4) * (data.length - 1))
    return { idx, x: chartConfig.scaleX(idx), timestamp: data[idx].timestamp }
  })

  return (
    <div ref={containerRef} className="w-full">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/30">
        <svg width="100%" height={chartConfig.height} viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}>
          <defs>
            <clipPath id="candleClip">
              <rect
                x={chartConfig.padding.left}
                y={chartConfig.padding.top}
                width={chartConfig.chartWidth}
                height={chartConfig.chartHeight}
              />
            </clipPath>
          </defs>

          {ticks.map((tick, i) => (
            <g key={i}>
              <line
                x1={chartConfig.padding.left}
                y1={tick.y}
                x2={chartConfig.padding.left + chartConfig.chartWidth}
                y2={tick.y}
                stroke="#334155"
                strokeDasharray="3 4"
                strokeOpacity="0.5"
              />
              <text x={chartConfig.padding.left + chartConfig.chartWidth + 8} y={tick.y + 4} fontSize={isMobile ? 10 : 11} fill="#94a3b8">
                {formatCurrency(tick.value).replace(".00", "")}
              </text>
            </g>
          ))}

          <g clipPath="url(#candleClip)">
            {data.map((candle, i) => {
              const x = chartConfig.scaleX(i)
              const isBullish = candle.close >= candle.open
              const top = chartConfig.scaleY(Math.max(candle.open, candle.close))
              const bottom = chartConfig.scaleY(Math.min(candle.open, candle.close))
              const bodyHeight = Math.max(1, bottom - top)
              const wickColor = isBullish ? "#22c55e" : "#ef4444"

              return (
                <g key={i}>
                  <line
                    x1={x}
                    y1={chartConfig.scaleY(candle.high)}
                    x2={x}
                    y2={chartConfig.scaleY(candle.low)}
                    stroke={wickColor}
                    strokeWidth={1}
                  />
                  <rect
                    x={x - chartConfig.candleBodyWidth / 2}
                    y={top}
                    width={chartConfig.candleBodyWidth}
                    height={bodyHeight}
                    fill={wickColor}
                    rx={1}
                  >
                    <title>
                      {`${formatDate(candle.timestamp)}
Open: ${formatCurrency(candle.open)}
High: ${formatCurrency(candle.high)}
Low: ${formatCurrency(candle.low)}
Close: ${formatCurrency(candle.close)}`}
                    </title>
                  </rect>
                </g>
              )
            })}
          </g>

          <line
            x1={chartConfig.padding.left}
            y1={chartConfig.padding.top + chartConfig.chartHeight}
            x2={chartConfig.padding.left + chartConfig.chartWidth}
            y2={chartConfig.padding.top + chartConfig.chartHeight}
            stroke="#334155"
            strokeOpacity="0.8"
          />

          {xTicks.map((tick, i) => (
            <text key={i} x={tick.x} y={chartConfig.height - 10} textAnchor="middle" fontSize={isMobile ? 10 : 11} fill="#94a3b8">
              {formatDate(tick.timestamp)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
