'use client';

import { useAuth } from "@/contexts/auth-context"
import { useCallback } from "react"

export function useBalance() {
  const { user, setUserFromData } = useAuth()

  const deductBalance = useCallback(
    async (amount: number, type: string = "BUY", symbol?: string, quantity?: number, price?: number) => {
      if (!user?.email) {
        return { success: false, error: "User not logged in" }
      }

      if (user.balance < amount) {
        return { success: false, error: `Insufficient balance. Available: ₹${user.balance}` }
      }

      try {
        // Call API to deduct balance from database
        const response = await fetch("/api/balance/deduct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            amount,
            type,
            symbol,
            quantity,
            price,
          }),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          return { success: false, error: data.error || "Failed to deduct balance" }
        }

        if (typeof data.newBalance === "number" && user) {
          setUserFromData({ ...user, balance: data.newBalance })
        }

        return { success: true, newBalance: data.newBalance }
      } catch (error) {
        console.error("[v0] Error deducting balance:", error)
        return { success: false, error: "Failed to process transaction" }
      }
    },
    [setUserFromData, user]
  )

  const addBalance = useCallback(
    async (amount: number, type: string = "SELL", symbol?: string, quantity?: number, price?: number) => {
      if (!user?.email) {
        return { success: false, error: "User not logged in" }
      }

      try {
        // Call API to add balance to database
        const response = await fetch("/api/balance/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            amount,
            type,
            symbol,
            quantity,
            price,
          }),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          return { success: false, error: data.error || "Failed to add balance" }
        }

        if (typeof data.newBalance === "number" && user) {
          setUserFromData({ ...user, balance: data.newBalance })
        }

        return { success: true, newBalance: data.newBalance }
      } catch (error) {
        console.error("[v0] Error adding balance:", error)
        return { success: false, error: "Failed to process transaction" }
      }
    },
    [setUserFromData, user]
  )

  return {
    currentBalance: user?.balance || 0,
    deductBalance,
    addBalance,
  }
}
