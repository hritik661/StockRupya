"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

type CommunityTickerProps = {
  title?: string
  subtitle?: string
}

export function CommunityTicker({
  title = "Members of the Stock Rupya Community",
  subtitle = "People using Stock Rupya services",
}: CommunityTickerProps) {
  const [communityNames, setCommunityNames] = useState<string[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const tickerViewportRef = useRef<HTMLDivElement | null>(null)
  const tickerDragStateRef = useRef({
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
  })

  useEffect(() => {
    let mounted = true

    const loadCommunityNames = async () => {
      try {
        const res = await fetch("/api/analytics/user-emails", {
          cache: "no-store",
          credentials: "include",
        })

        if (!res.ok) {
          return
        }

        const data = await res.json()
        if (mounted && data.success) {
          setCommunityNames(Array.isArray(data.displayNames) ? data.displayNames : [])
        }
      } catch {
        if (mounted) {
          setCommunityNames([])
        }
      }
    }

    void loadCommunityNames()

    return () => {
      mounted = false
    }
  }, [])

  const tickerNames = communityNames

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = tickerViewportRef.current
    if (!viewport) {
      return
    }

    tickerDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: viewport.scrollLeft,
    }
    viewport.setPointerCapture(event.pointerId)
    setIsDragging(true)
    setIsPaused(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging || tickerDragStateRef.current.pointerId !== event.pointerId) {
      return
    }

    const viewport = tickerViewportRef.current
    if (!viewport) {
      return
    }

    const deltaX = event.clientX - tickerDragStateRef.current.startX
    viewport.scrollLeft = tickerDragStateRef.current.scrollLeft - deltaX
  }

  const finishInteraction = (pointerId?: number, shouldResume = false) => {
    const viewport = tickerViewportRef.current

    if (viewport && pointerId !== undefined && pointerId >= 0 && viewport.hasPointerCapture(pointerId)) {
      viewport.releasePointerCapture(pointerId)
    }

    setIsDragging(false)
    if (shouldResume) {
      setIsPaused(false)
    }
  }

  if (tickerNames.length === 0) {
    return null
  }

  return (
    <section className="home-user-ticker-shell">
      <div className="home-user-ticker-header">
        <span className="home-user-ticker-title">{title}</span>
        <span className="home-user-ticker-subtitle">{subtitle}</span>
      </div>

      <div className="home-user-ticker-card">
        <div className="home-user-ticker">
          <div
            ref={tickerViewportRef}
            className={`home-user-ticker-viewport scrollbar-hide ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => finishInteraction(undefined, true)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(event) => finishInteraction(event.pointerId, event.pointerType !== "mouse")}
            onPointerCancel={(event) => finishInteraction(event.pointerId, true)}
          >
            <div className={`home-user-ticker-track ${isPaused ? "" : "home-user-ticker-track-auto"}`}>
              {tickerNames.map((name, idx) => (
                <span key={`${name}-${idx}`} className="home-user-ticker-item">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
