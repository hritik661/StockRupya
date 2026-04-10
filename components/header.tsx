"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, User, LogOut, Wallet, Sparkles, BarChart3, Briefcase, Info } from "lucide-react"
import { formatCurrency } from "@/lib/market-utils"
import { searchStocks } from "@/lib/yahoo-finance"
import { INDIAN_STOCKS } from "@/lib/stocks-data"
import { cn } from "@/lib/utils"

export function Header({ isLandingPage = false, hideBalance = false }: { isLandingPage?: boolean, hideBalance?: boolean }) {
  const { user, logout, updateBalance } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isStockPage = pathname?.startsWith('/stock') ?? false
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string; exchange: string }>>([])
  const [showResults, setShowResults] = useState(false)
  const [searching, setSearching] = useState(false)

  const warmPredictionsExperience = useCallback(() => {
    if (!user) {
      return
    }

    void router.prefetch("/predictions")

    import("@/lib/cache-utils")
      .then(({ preloadCommonStocks, warmAllIndianQuotes }) => {
        preloadCommonStocks()
        void warmAllIndianQuotes()
      })
      .catch(() => {})
  }, [router, user])

  useEffect(() => {
    if (!user) {
      return
    }

    warmPredictionsExperience()
  }, [user, warmPredictionsExperience])

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setSearching(true)

    const localResults = INDIAN_STOCKS.filter(
      (s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.symbol.toLowerCase().includes(query.toLowerCase()),
    )
      .slice(0, 5)
      .map((s) => ({ symbol: s.symbol, name: s.name, exchange: s.exchange }))

    setSearchResults(localResults)
    setShowResults(true)

    const apiResults = await searchStocks(query)
    if (apiResults.length > 0) {
      const combined = [
        ...localResults,
        ...apiResults.filter((r) => !localResults.find((l) => l.symbol === r.symbol)),
      ].slice(0, 10)
      setSearchResults(combined)
    }
    setSearching(false)
  }

  const handleSelectStock = (symbol: string) => {
    router.push(`/stock/${encodeURIComponent(symbol)}`)
    setShowResults(false)
    setSearchQuery("")
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <header className={cn(
      "sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-xl shadow-[0_8px_28px_rgba(2,6,23,0.45)]",
      isLandingPage && "border-b border-border/50",
    )}>
      <div className="mx-auto w-full max-w-[1480px] px-2 py-1 sm:px-3 md:px-5 md:py-2">
        <div className="flex flex-col gap-1 md:gap-2">
          {/* Top Row - Logo, Search, Balance Badge, User Menu */}
          <div className="flex items-center gap-2 md:gap-3 w-full md:justify-between">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-1 hover:opacity-90 transition-opacity flex-shrink-0">
              <div className="relative flex-shrink-0" style={{ display: 'inline-block' }}>
                <div style={{ position: 'absolute', inset: '-8px', borderRadius: 12, background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.14), rgba(34,197,94,0.04) 30%, transparent 60%)', filter: 'blur(12px)', zIndex: 0, pointerEvents: 'none' }} />
                <img src="/rupya.png" alt="StockRupya" className="h-7 sm:h-8 md:h-10 w-auto relative z-10 flex-shrink-0 sparkle-anim" />
              </div>
            </Link>

            {/* Search Bar - responsive width */}
            {!isLandingPage && user && (
              <div className="flex-1 min-w-0">
                <div className="group relative">
                  <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_left,rgba(6,182,212,0.16),transparent_38%),radial-gradient(circle_at_right,rgba(16,185,129,0.14),transparent_28%)] opacity-70 blur-xl transition-opacity duration-300 group-focus-within:opacity-100" />
                  <div className="relative flex-1 rounded-2xl border border-slate-700/70 bg-[linear-gradient(135deg,rgba(7,12,24,0.94),rgba(5,10,20,0.82))] p-1 shadow-[0_12px_30px_rgba(2,6,23,0.38)] backdrop-blur-xl transition-all duration-300 group-hover:border-cyan-500/35 group-focus-within:border-cyan-400/55 group-focus-within:shadow-[0_16px_40px_rgba(6,182,212,0.16)]">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-400/80 transition-colors duration-300 group-focus-within:text-cyan-300 flex-shrink-0 sm:left-3 sm:h-4 sm:w-4" />
                    <Input
                      placeholder="Search for any Stock..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                      onBlur={() => setTimeout(() => setShowResults(false), 200)}
                      className="h-9 rounded-xl border-0 bg-transparent pl-8 pr-3 text-[13px] font-medium text-slate-100 shadow-none ring-0 placeholder:text-slate-300/85 focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-11 sm:pl-9 sm:pr-20 sm:text-sm sm:placeholder:text-slate-500"
                    />
                    <div className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 sm:flex">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]" />
                      Live Search
                    </div>
                    {showResults && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/95 shadow-[0_16px_48px_rgba(0,0,0,0.72)] backdrop-blur-xl">
                        <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-950/95">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">Market Search</p>
                            <p className="text-xs text-slate-400">Find stocks by symbol or company name</p>
                          </div>
                          <span className="rounded-lg border border-slate-700/70 bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                            NSE / BSE
                          </span>
                        </div>
                        {searching && (
                          <div className="flex items-center gap-3 px-4 py-4 text-sm text-slate-300">
                            <div className="h-4 w-4 rounded-full border-2 border-slate-500/80 border-t-transparent animate-spin" />
                            Scanning live market matches...
                          </div>
                        )}
                        {!searching && searchResults.length === 0 && (
                          <div className="px-4 py-5 text-sm text-muted-foreground">
                            No matching stocks found. Try a company name like `Reliance` or a symbol like `TCS`.
                          </div>
                        )}
                        {!searching && searchResults.map((result) => (
                          <button
                            key={`${result.symbol}-${result.exchange}`}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              handleSelectStock(result.symbol)
                            }}
                            onClick={() => handleSelectStock(result.symbol)}
                            className="w-full border-b border-primary/10 px-4 py-3.5 text-left transition-all duration-150 hover:bg-primary/8 last:border-b-0 cursor-pointer group"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold tracking-[0.01em] text-foreground group-hover:text-primary transition-colors">
                                  {result.symbol}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">{result.name}</p>
                              </div>
                              <span className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                                {result.exchange}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Laptop/Desktop top navigation */}
            {user && !isLandingPage && (
              <nav className="hidden lg:flex items-center gap-1 xl:gap-2 flex-shrink-0">
                {!isStockPage && (
                  <Link href="/options" className="flex items-center gap-2 px-2 xl:px-3 py-2 rounded-lg text-xs xl:text-sm font-medium hover:bg-secondary/50 transition-colors group">
                    <BarChart3 className="h-3.5 w-3.5 text-cyan-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                    <span>Options</span>
                  </Link>
                )}
                <Link
                  href="/predictions"
                  onMouseEnter={warmPredictionsExperience}
                  onFocus={warmPredictionsExperience}
                  onTouchStart={warmPredictionsExperience}
                  className="group predictions-button-premium rounded-md px-2 py-2 text-xs font-semibold text-violet-100 xl:px-3 relative"
                >
                  <span className="relative z-10 flex items-center gap-1">
                    <div className="relative flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-violet-300 transition-all duration-300 group-hover:text-violet-100 group-hover:animate-spin predictions-star-icon" />
                    </div>
                    <span className="tracking-wide">Predictions</span>
                  </span>
                </Link>
                <Link href="/portfolio" className="flex items-center gap-2 px-2 xl:px-3 py-2 rounded-lg text-xs xl:text-sm font-medium hover:bg-secondary/50 transition-colors group">
                  <Briefcase className="h-3.5 w-3.5 text-blue-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                  <span>Portfolio</span>
                </Link>
                <Link href="/about" className="flex items-center gap-2 px-2 xl:px-3 py-2 rounded-lg text-xs xl:text-sm font-medium hover:bg-secondary/50 transition-colors group">
                  <Info className="h-3.5 w-3.5 text-green-500 group-hover:text-green-400 transition-colors flex-shrink-0" />
                  <span>About</span>
                </Link>
              </nav>
            )}

            {/* Mobile balance - shows only on small screens */}
            {user && !hideBalance && (
              <div className="sm:hidden flex items-center px-2 py-1 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 border-2 border-primary/40 shadow-lg shadow-primary/10 flex-shrink-0">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold font-mono text-primary ml-1">{formatCurrency(user.balance)}</span>
              </div>
            )}

            {/* User Menu - mobile only */}
            {user && (
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-9 sm:w-9 bg-secondary/50 flex-shrink-0">
                      <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                        <Wallet className="h-3 w-3 text-primary" />
                        <span className="text-xs font-semibold font-mono">{formatCurrency(user.balance)}</span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {user.email === "admin@hrtik.com" && (
                      <DropdownMenuItem asChild className="cursor-pointer text-primary">
                        <Link href="/admin">Admin Dashboard</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/">Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        try {
                          if (!user) return
                          if (!confirm('Reset your balance to ₹1,000,000?')) return
                          const delta = 1000000 - (user.balance || 0)
                          if (delta !== 0) updateBalance(delta)
                          alert('Your balance has been reset to ₹1,000,000')
                        } catch (e) { console.error(e) }
                      }}
                      className="cursor-pointer"
                    >
                      <Wallet className="mr-2 h-4 w-4" />
                      Reset Balance
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer relative overflow-hidden group sm:hidden">
                      <Link
                        href="/predictions"
                        onMouseEnter={warmPredictionsExperience}
                        onFocus={warmPredictionsExperience}
                        onTouchStart={warmPredictionsExperience}
                        className="flex items-center gap-2"
                      >
                        <div className="relative flex items-center justify-center">
                          <Sparkles className="h-3 w-3 text-purple-500 transition-all duration-300 star-orbit" />
                        </div>
                        <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-semibold">
                          Predictions
                        </span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer sm:hidden">
                      <Link href="/about">About</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Tablet/Laptop controls */}
            {!isLandingPage && user && !hideBalance && (
              <div className="hidden sm:flex items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 flex-shrink-0">
                <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                <span className="text-[11px] sm:text-sm font-semibold font-mono text-primary ml-1.5">
                  {formatCurrency(user.balance)}
                </span>
              </div>
            )}

            {!isLandingPage && user && (
              <div className="hidden sm:flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 sm:h-10 sm:w-10 bg-secondary/50 flex-shrink-0">
                      <User className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                        <Wallet className="h-3 w-3 text-primary" />
                        <span className="text-xs font-semibold font-mono">{formatCurrency(user.balance)}</span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {user.email === "admin@hrtik.com" && (
                      <DropdownMenuItem asChild className="cursor-pointer text-primary">
                        <Link href="/admin">Admin Dashboard</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/">Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        try {
                          if (!user) return
                          if (!confirm('Reset your balance to â‚¹1,000,000?')) return
                          const delta = 1000000 - (user.balance || 0)
                          if (delta !== 0) updateBalance(delta)
                          alert('Your balance has been reset to â‚¹1,000,000')
                        } catch (e) { console.error(e) }
                      }}
                      className="cursor-pointer"
                    >
                      <Wallet className="mr-2 h-4 w-4" />
                      Reset Balance
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Bottom Row - Mobile Nav Buttons  (visible on small screens only) */}
          {!isLandingPage && user && (
            <div className="flex items-center gap-0.5 sm:hidden w-full justify-between">
                {!isStockPage && (
                <Link href="/options" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full h-8 text-[10px] font-semibold border border-cyan-400/50 bg-cyan-500/10 text-white hover:bg-cyan-500/20 px-0.5 flex items-center justify-center gap-0.5">
                    <BarChart3 className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                    <span className="truncate">Options</span>
                  </Button>
                </Link>
                )}
              <Link
                href="/predictions"
                onMouseEnter={warmPredictionsExperience}
                onFocus={warmPredictionsExperience}
                onTouchStart={warmPredictionsExperience}
                className="flex-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full predictions-button-premium rounded-md px-0.5 text-[10px] text-violet-100 group"
                >
                  <span className="relative z-10 flex items-center gap-0.5 truncate w-full justify-center">
                    <div className="relative flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-violet-300 flex-shrink-0 transition-all duration-300 group-hover:text-violet-100 predictions-star-icon" />
                    </div>
                    <span className="truncate text-[10px] font-semibold">Predictions</span>
                  </span>
                </Button>
              </Link>
              <Link href="/portfolio" className="flex-1">
                <Button variant="outline" size="sm" className="w-full h-8 text-[10px] font-semibold border border-blue-400/50 bg-blue-500/10 text-white hover:bg-blue-500/20 px-0.5 flex items-center justify-center gap-0.5">
                  <Briefcase className="h-3 w-3 text-blue-400 flex-shrink-0" />
                  <span className="truncate">Portfolio</span>
                </Button>
              </Link>
              <Link href="/about" className="flex-1">
                <Button variant="outline" size="sm" className="w-full h-8 text-[10px] font-semibold border border-green-400/50 bg-green-500/10 text-white hover:bg-green-500/20 px-0.5 flex items-center justify-center gap-0.5 rounded-md">
                  <Info className="h-3 w-3 text-green-400 flex-shrink-0" />
                  <span className="truncate">About</span>
                </Button>
              </Link>
            </div>
          )}

          {/* Tablet navigation row (hidden on laptop/desktop) */}
          {user && !isLandingPage && (
            <nav className="hidden sm:flex lg:hidden items-center gap-1 md:gap-2 w-full overflow-x-auto scrollbar-hide">
              {!isStockPage && (
              <Link href="/options" className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-secondary/50 transition-colors group">
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                <span>Options</span>
              </Link>
              )}
              <Link
                href="/predictions"
                onMouseEnter={warmPredictionsExperience}
                onFocus={warmPredictionsExperience}
                onTouchStart={warmPredictionsExperience}
                className="group rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-2 text-xs font-semibold text-violet-100 transition-all hover:bg-violet-500/20"
              >
                <span className="relative z-10 flex items-center gap-1">
                  <div className="relative flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-violet-300 transition-colors group-hover:text-violet-200 flex-shrink-0 star-glow-orbit" />
                  </div>
                  <span>Predictions</span>
                </span>
              </Link>
              <Link href="/portfolio" className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-secondary/50 transition-colors group">
                <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                <span>Portfolio</span>
              </Link>
              <Link href="/about" className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-secondary/50 transition-colors group">
                <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 group-hover:text-green-400 transition-colors flex-shrink-0" />
                <span>About</span>
              </Link>
              
              {/* Wallet Section - Tablet/Desktop View */}
              {user && !hideBalance && (
                <div className="hidden">
                  <Wallet className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-semibold font-mono text-primary">{formatCurrency(user.balance)}</span>
                </div>
              )}
              {/* Desktop user menu - placed at right on md+ (laptop) */}
              {user && (
                <div className="hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-secondary/50 flex-shrink-0">
                        <User className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl">
                      <div className="px-3 py-2">
                        <p className="text-sm font-semibold">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                          <Wallet className="h-3 w-3 text-primary" />
                          <span className="text-xs font-semibold font-mono">{formatCurrency(user.balance)}</span>
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                      {user.email === "admin@hrtik.com" && (
                        <DropdownMenuItem asChild className="cursor-pointer text-primary">
                          <Link href="/admin">Admin Dashboard</Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/">Dashboard</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          try {
                            if (!user) return
                            if (!confirm('Reset your balance to ₹1,000,000?')) return
                            const delta = 1000000 - (user.balance || 0)
                            if (delta !== 0) updateBalance(delta)
                            alert('Your balance has been reset to ₹1,000,000')
                          } catch (e) { console.error(e) }
                        }}
                        className="cursor-pointer"
                      >
                        <Wallet className="mr-2 h-4 w-4" />
                        Reset Balance
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  )
}
