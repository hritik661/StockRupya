"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ChartData } from "@/lib/yahoo-finance"
import { formatCurrency } from "@/lib/market-utils"

interface LineChartProps {
  data: ChartData[]
  currentRange: string
}

export function LineChart({ data, currentRange }: LineChartProps) {
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
    const padding = isMobile ? { top: 14, right: 44, bottom: 26, left: 12 } : { top: 16, right: 62, bottom: 28, left: 16 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const prices = data.map((d) => d.close)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = Math.max(1, max - min)
    const paddedMin = min - range * 0.04
    const paddedMax = max + range * 0.04
    const paddedRange = paddedMax - paddedMin

    const points = data.map((d, i) => {
      const x = padding.left + (i / Math.max(1, data.length - 1)) * chartWidth
      const y = padding.top + chartHeight - ((d.close - paddedMin) / paddedRange) * chartHeight
      return { x, y, timestamp: d.timestamp, price: d.close }
    })

    return {
      width,
      height,
      padding,
      chartWidth,
      chartHeight,
      points,
      min: paddedMin,
      max: paddedMax,
      currentPrice: data[data.length - 1].close,
      change: data[data.length - 1].close - data[0].close,
    }
  }, [data, containerWidth, isMobile])

  if (!chartConfig) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No chart data</div>
  }

  const isPositive = chartConfig.change >= 0
  const strokeColor = isPositive ? "#22c55e" : "#ef4444"

  const linePath = chartConfig.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
  const areaPath = `${linePath} L ${chartConfig.padding.left + chartConfig.chartWidth} ${chartConfig.padding.top + chartConfig.chartHeight} L ${chartConfig.padding.left} ${chartConfig.padding.top + chartConfig.chartHeight} Z`

  const ticks = Array.from({ length: 5 }, (_, i) => {
    const ratio = i / 4
    const y = chartConfig.padding.top + ratio * chartConfig.chartHeight
    const value = chartConfig.max - ratio * (chartConfig.max - chartConfig.min)
    return { y, value }
  })

  const dateLabel = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    if (currentRange === "1D") {
      return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    }
    if (currentRange === "1W" || currentRange === "1M") {
      return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    }
    return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
  }

  return (
    <div ref={containerRef} className="w-full">
      <div className="mb-4 rounded-xl border border-border/60 bg-card/40 p-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Current Price</p>
            <p className="font-mono text-xl font-semibold sm:text-2xl">{formatCurrency(chartConfig.currentPrice)}</p>
          </div>
          <div className={isPositive ? "text-emerald-400" : "text-red-400"}>
            <p className="text-xs text-muted-foreground">Change</p>
            <p className="text-sm font-semibold sm:text-base">
              {isPositive ? "+" : ""}
              {chartConfig.change.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Range</p>
            <p className="font-mono text-xs sm:text-sm">
              {formatCurrency(chartConfig.min)} - {formatCurrency(chartConfig.max)}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/30">
        <svg width="100%" height={chartConfig.height} viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}>
          <defs>
            <linearGradient id="lineAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.24" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
            </linearGradient>
            <clipPath id="lineClip">
              <rect
                x={chartConfig.padding.left}
                y={chartConfig.padding.top}
                width={chartConfig.chartWidth}
                height={chartConfig.chartHeight}
              />
            </clipPath>
          </defs>

          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={chartConfig.padding.left}
                y1={t.y}
                x2={chartConfig.padding.left + chartConfig.chartWidth}
                y2={t.y}
                stroke="#334155"
                strokeDasharray="3 4"
                strokeOpacity="0.5"
              />
              <text
                x={chartConfig.padding.left + chartConfig.chartWidth + 8}
                y={t.y + 4}
                fontSize={isMobile ? 10 : 11}
                fill="#94a3b8"
                textAnchor="start"
              >
                {formatCurrency(t.value).replace(".00", "")}
              </text>
            </g>
          ))}

          <path d={areaPath} fill="url(#lineAreaGradient)" clipPath="url(#lineClip)" />
          <path
            d={linePath}
            stroke={strokeColor}
            strokeWidth={isMobile ? 2 : 2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#lineClip)"
          />

          <line
            x1={chartConfig.padding.left}
            y1={chartConfig.padding.top + chartConfig.chartHeight}
            x2={chartConfig.padding.left + chartConfig.chartWidth}
            y2={chartConfig.padding.top + chartConfig.chartHeight}
            stroke="#334155"
            strokeOpacity="0.8"
          />
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>{dateLabel(chartConfig.points[0].timestamp)}</span>
        <span>{dateLabel(chartConfig.points[Math.floor(chartConfig.points.length / 2)].timestamp)}</span>
        <span>{dateLabel(chartConfig.points[chartConfig.points.length - 1].timestamp)}</span>
      </div>
    </div>
  )
}
