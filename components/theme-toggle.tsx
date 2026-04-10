"use client"

import { useSyncExternalStore } from "react"
import { Moon, SunMedium } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const isDark = resolvedTheme !== "light"

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative h-9 w-9 overflow-hidden rounded-full border-border/80 bg-card/80 text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl hover:bg-accent/10 dark:shadow-[0_10px_28px_rgba(2,6,23,0.34)]",
        className,
      )}
    >
      <SunMedium
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          mounted && isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100 text-amber-500",
        )}
      />
      <Moon
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          mounted && isDark ? "rotate-0 scale-100 opacity-100 text-violet-400" : "-rotate-90 scale-0 opacity-0",
        )}
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
