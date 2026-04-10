"use client"

import Link from "next/link"
import { X } from "lucide-react"
import LoginForm from "@/components/login-form"
import { LegalFooter } from "@/components/legal-footer"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-background p-6 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20">
        <Link
          href="/"
          aria-label="Close login page"
          className="h-10 w-10 rounded-full bg-white/5 text-white hover:bg-white/10 transition-all duration-150 flex items-center justify-center border border-white/10 shadow-md"
        >
          <X className="h-5 w-5" />
        </Link>
      </div>

      {/* animated blobs behind the form */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="login-blob login-blob--one" aria-hidden />
        <div className="login-blob login-blob--two" aria-hidden />
      </div>

      <div className="w-full max-w-4xl px-4">
        <div className="login-card-entrance login-backdrop p-4 md:p-6">
          <LoginForm full />
        </div>
      </div>
      <LegalFooter />
    </div>
  )
}
