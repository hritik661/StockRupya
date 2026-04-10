import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import StartupRedirect from "@/components/startup-redirect"
import LoginModal from "@/components/login-modal"
import Providers from "@/components/providers"
import "../styles/indices-ticker-mobile.css"
import { LOGOS } from "@/lib/logos-config"

export const metadata: Metadata = {
  title: "StockRupya - AI-Powered Indian Stock Trading Platform",
  description: "Trade Indian stocks with real-time data, advanced charts, AI predictions, and portfolio management powered by machine learning",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: LOGOS.favicon.light,
        media: "(prefers-color-scheme: light)",
      },
      {
        url: LOGOS.favicon.dark,
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: LOGOS.favicon.svg,
        type: "image/svg+xml",
      },
    ],
    apple: LOGOS.favicon.apple,
  },
}

export const viewport: Viewport = {
  themeColor: "#1a1625",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased flex min-h-screen flex-col">
            <Providers>
              <div className="flex-1">
                <StartupRedirect />
                {children}
              </div>
              <LoginModal />
              <Toaster />
            </Providers>
        <Analytics />
      </body>
    </html>
  )
}
