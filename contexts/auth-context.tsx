"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  email: string
  name?: string
  balance: number
  isPredictionPaid?: boolean
  isTopGainerPaid?: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginWithOTP: (email: string, otp: string) => Promise<{ success: boolean; error?: string; isNewUser?: boolean }>
  signup: (email: string, name: string | undefined, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateBalance: (amount: number) => void
  markPredictionsAsPaid: () => void
  setUserFromData: (user: User) => void
  refreshBalanceFromDatabase: () => Promise<void>
  // Note: auth is local-only and stored in localStorage. Not secure for production.
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const SESSION_TOKEN_STORAGE_KEY = "stockrupya_session_token"

  const getStoredSessionToken = () => {
    if (typeof window === "undefined") return null
    try {
      return localStorage.getItem(SESSION_TOKEN_STORAGE_KEY)
    } catch {
      return null
    }
  }

  const setStoredSessionToken = (token: string | null) => {
    if (typeof window === "undefined") return
    try {
      if (token) localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token)
      else localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // Initialize by asking the server who the current session belongs to.
    const initializeAuth = async () => {
      try {
        console.log('[AUTH] 🔍 Initializing auth - checking for existing session')
        console.log('[AUTH] 📍 Current URL:', typeof window !== 'undefined' ? window.location.href : 'N/A')

        const storedToken = getStoredSessionToken()
        if (storedToken) {
          console.log('[AUTH] 🔑 Using stored session token from localStorage')
        }

        const headers: Record<string, string> = {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        }
        if (storedToken) {
          headers['x-session-token'] = storedToken
        }

        const res = await fetch('/api/auth/me', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include', // Include cookies where available
          headers,
        })

        console.log('[AUTH] 📡 /api/auth/me response status:', res.status)
        console.log('[AUTH] 📡 Response headers:', {
          'content-type': res.headers.get('content-type'),
          'set-cookie': res.headers.get('set-cookie') || '(none)',
        })

        if (res.ok) {
          const data = await res.json()
          console.log('[AUTH] 📊 Response data:', { success: data.success, user: data.user?.email })
          if (data?.user) {
            console.log('[AUTH] ✅ Session found, user logged in:', data.user.email)
            setUser(data.user)
          } else {
            console.log('[AUTH] ⚠️ No user data in response, proceeding as guest')
            setUser(null)
          }
        } else {
          console.log('[AUTH] ℹ️ No session found (status:', res.status + '), user is guest')
          const errData = await res.json().catch(() => ({}))
          console.log('[AUTH] Error from auth/me:', errData)
          setUser(null)
        }
      } catch (err) {
        console.error('[AUTH] ❌ Error initializing auth:', err)
        setUser(null)
      } finally {
        console.log('[AUTH] ✅ Auth initialization complete, isLoading = false')
        setIsLoading(false)
      }
    }
    initializeAuth()

    // No cleanup required
    return () => {}
  }, [])

  const syncUserFromServer = async () => {
    try {
      const meRes = await fetch("/api/auth/me?t=" + Date.now(), {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })

      if (!meRes.ok) return

      const meData = await meRes.json()
      if (meData?.user) {
        setUser(meData.user)
      }
    } catch {
      // ignore sync errors and keep current state
    }
  }

  // Server-backed signup/login flows. No localStorage session tokens.
  const signup = async (email: string, name: string | undefined, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!email || !password) return { success: false, error: "Email and password are required" }
      const res = await fetch("/api/auth/signup-password", {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase(), name, password }),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data?.error || "Signup failed" }
      if (data.user) setUser(data.user)
      if (data.sessionToken) setStoredSessionToken(data.sessionToken)
      await syncUserFromServer()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Signup failed" }
    }
  }

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!email || !password) return { success: false, error: "Email and password are required" }
      const res = await fetch("/api/auth/login-password", {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data?.error || "Login failed" }
      if (data.user) setUser(data.user)
      if (data.sessionToken) setStoredSessionToken(data.sessionToken)
      await syncUserFromServer()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Login failed" }
    }
  }

  

  const logout = () => {
    console.log('🔐 [LOGOUT] Starting logout flow...')
    
    // IMMEDIATE: Clear local state (updates UI instantly)
    console.log('🔐 [LOGOUT] Clearing user state from React context')
    setUser(null)
    
    // Clear stored session token
    setStoredSessionToken(null)

    // IMMEDIATE: Clear all storage
    try {
      if (typeof window !== "undefined") {
        console.log('🔐 [LOGOUT] Clearing localStorage, sessionStorage, and cookies')
        localStorage.clear()
        sessionStorage.clear()
        
        // Clear all cookies
        document.cookie.split(";").forEach((c) => {
          const eqPos = c.indexOf("=")
          const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim()
          if (name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;`
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;domain=${window.location.hostname};path=/;`
          }
        })
        console.log('✅ [LOGOUT] All storage and cookies cleared')
      }
    } catch (err) {
      console.error('❌ [LOGOUT] Storage clear failed:', err)
    }
    
    // IMMEDIATE: Use router.push (Next.js client-side navigation)
    // This is more reliable than window.location.href for Next.js apps
    console.log('🔄 [LOGOUT] Navigating to home page via Next.js router')
    router.push('/')
    
    // BACKGROUND: Call logout API to clear server-side session
    ;(async () => {
      try {
        console.log('🔐 [LOGOUT] Calling logout API to clear server session')
        const res = await fetch("/api/auth/logout", { method: "POST", credentials: 'include' })
        if (res.ok) {
          console.log('✅ [LOGOUT] Server session cleared successfully')
        } else {
          console.warn('⚠️ [LOGOUT] Server logout returned:', res.status)
        }
      } catch (err) {
        console.error('❌ [LOGOUT] Server logout failed:', err)
      }
    })()
  }

  const updateBalance = async (amount: number) => {
    if (user) {
      const newBalance = user.balance + amount
      const updatedUser = { ...user, balance: newBalance }
      setUser(updatedUser)

      // Update balance in database
      try {
        await fetch("/api/balance/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, balance: newBalance }),
        })
      } catch (error) {
        console.error("Failed to update balance in database:", error)
      }
    }
  }

  const markPredictionsAsPaid = () => {
    // Refresh user from server - payment handlers should update DB, so re-fetch the session user
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me", { method: "GET", credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data?.user) setUser(data.user)
        }
      } catch {
        // ignore
      }
    })()
  }

  const loginWithOTP = async (email: string, otp: string): Promise<{ success: boolean; error?: string; isNewUser?: boolean }> => {
    try {
      const emailNormalized = email.toLowerCase().trim()
      const otpNormalized = otp.toString().trim()
      
      if (!emailNormalized || !otpNormalized) return { success: false, error: "Email and OTP are required" }
      
      console.log("[AUTH] 🔐 Logging in with OTP - email:", emailNormalized, "otp length:", otpNormalized.length)
      
      // Verify OTP
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNormalized, otp: otpNormalized }),
      })

      console.log("[AUTH] 📡 OTP verify response status:", response.status)
      console.log("[AUTH] 📡 Response cookies:", response.headers.get('set-cookie') || '(none)')

      const data = await response.json()

      if (!response.ok || !data.success) {
        return { success: false, error: data.error || "OTP verification failed" }
      }

      // Set user from response data (use database balance - source of truth)
      const userData = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || data.user.email.split("@")[0],
        balance: isNaN(data.user.balance) ? 1000000 : Number(data.user.balance) || 1000000,
        isPredictionPaid: Boolean(data.user.isPredictionPaid),
        isTopGainerPaid: Boolean(data.user.isTopGainerPaid),
      }

      // Server sets HttpOnly cookie. Just set user state from response.
      setUser(userData)
      if (data.sessionToken) setStoredSessionToken(data.sessionToken)
      await syncUserFromServer()
      console.log("[AUTH] ✅ Login successful for:", emailNormalized)
      console.log("[AUTH] 🍪 Check browser cookies - session_token should be set")

      return { success: true, isNewUser: data.isNewUser }
    } catch (err) {
      console.error("[AUTH] ❌ OTP login error:", err)
      return { success: false, error: err instanceof Error ? err.message : "OTP login failed" }
    }
  }

  // Refresh balance from database (source of truth)
  const refreshBalanceFromDatabase = async () => {
    if (!user) return
    try {
      const response = await fetch("/api/balance/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      })
      const data = await response.json()
      if (data.balance !== undefined) {
        const dbBalance = Number(data.balance) || 1000000
        if (dbBalance !== user.balance) {
          const updatedUser = { ...user, balance: dbBalance }
          setUser(updatedUser)
        }
      }
    } catch (error) {
      console.error("Failed to refresh balance:", error)
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, loginWithOTP, signup, logout, updateBalance, markPredictionsAsPaid, setUserFromData: setUser, refreshBalanceFromDatabase }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
