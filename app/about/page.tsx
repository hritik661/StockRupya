"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Header } from "@/components/header"
import { CommunityTicker } from "@/components/community-ticker"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Target, Zap, Users, Award, ArrowRight, CheckCircle2, Globe, Lock, BarChart3, ShoppingCart, Smartphone, Sparkles, Brain, TrendingUp, BarChart2, CreditCard } from "lucide-react"
import ChatSupport from "@/components/chat-support"
import { CTASection } from "@/components/cta-section"
import { SupportSection } from "@/components/support-section"
import { ReviewsSection } from "@/components/reviews-section"

type AboutPageProps = {
  afterHomeButton?: ReactNode
  showHomeButton?: boolean
}

export default function AboutPage({ afterHomeButton, showHomeButton = true }: AboutPageProps) {
  const { user } = useAuth()
  const communityTicker = afterHomeButton ?? (user ? <CommunityTicker /> : null)
  const unlockAmountPaise = Number(process.env.NEXT_PUBLIC_RAZORPAY_UNLOCK_AMOUNT_PAISE || 100000)
  const unlockAmountRupees = Math.max(
    500,
    Math.floor((Number.isFinite(unlockAmountPaise) && unlockAmountPaise > 0 ? unlockAmountPaise : 100000) / 100)
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.3); }
          50% { box-shadow: 0 0 40px rgba(34, 197, 94, 0.6); }
        }
        @keyframes float-up {
          0% { transform: translateY(10px); opacity: 0.8; }
          50% { transform: translateY(-10px); opacity: 1; }
          100% { transform: translateY(10px); opacity: 0.8; }
        }
        @keyframes logo-bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        /* Soft glow behind logo (static, no motion) */
        .logo-wrap { position: relative; display: inline-block; border-radius: 12px; }
        .logo-wrap::before {
          content: '';
          position: absolute;
          inset: -12px;
          background: radial-gradient(ellipse at center, rgba(34,197,94,0.16), rgba(34,197,94,0.06) 30%, transparent 60%);
          filter: blur(16px);
          z-index: -1;
          pointer-events: none;
        }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% center; }
          50% { background-position: 100% center; }
        }
        @keyframes shine {
          0% { left: -100%; }
          50% { left: 100%; }
          100% { left: 100%; }
        }
        @keyframes border-glow {
          0%, 100% { 
            box-shadow: 0 0 30px rgba(34, 197, 94, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.1);
            border-color: rgba(34, 197, 94, 0.5);
          }
          50% { 
            box-shadow: 0 0 60px rgba(34, 197, 94, 0.6), inset 0 0 30px rgba(34, 197, 94, 0.2);
            border-color: rgba(34, 197, 94, 0.8);
          }
        }
        .logo-animate { /* kept for compatibility but we will avoid applying it where not wanted */ }
        .hero-title { animation: fade-in-up 0.8s ease-out; }
        .hero-subtitle { animation: fade-in-up 0.8s ease-out 0.2s both; }
        .hero-buttons { animation: fade-in-up 0.8s ease-out 0.4s both; }
        .feature-card { animation: fade-in-up 0.6s ease-out backwards; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .feature-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(34, 197, 94, 0.2); }
        /* stat animations disabled for stable layout */
        .stat-card { /* no continuous animation */ }
        .stat-number { /* no continuous animation */ }
        .premium-card {
          position: relative;
          background: linear-gradient(-45deg, rgba(34, 197, 94, 0.1), rgba(139, 92, 246, 0.1), rgba(34, 197, 94, 0.1));
          background-size: 400% 400%;
          overflow: hidden;
        }
        .premium-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          z-index: 1;
          pointer-events: none;
        }
        .premium-card > * {
          position: relative;
          z-index: 2;
        }
      `}</style>

      <Header isLandingPage={true} />

      <main className="container mx-auto px-3 sm:px-4 md:px-4 py-4 md:py-12">
        {/* Centered StockRupya Logo + Welcome Banner (visible on all screen sizes) */}
        <div className="flex justify-center mb-3 md:mb-4">
          <div className="logo-wrap">
            <img
              src="/rupya.png"
              alt="StockRupya Logo"
              className="h-20 sm:h-28 md:h-48 w-auto sparkle-anim"
              style={{ filter: 'brightness(1.15) saturate(1.2) drop-shadow(0 12px 24px rgba(0,0,0,0.6))' }}
            />
          </div>
        </div>
        <div className="flex justify-center mb-6 md:mb-12">
          <div className="px-3 md:px-6 py-1.5 md:py-3 rounded-full border border-primary/50 bg-primary/10 backdrop-blur-sm max-w-full">
            <p className="text-xs md:text-base font-bold text-center text-primary uppercase tracking-tight md:tracking-widest whitespace-normal break-words">
              ⚡ Welcome to StockRupya — a virtual stock trading simulator for the Indian market
            </p>
          </div>
        </div>

        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center text-center mb-6 md:mb-12">
          <style>{`
            @keyframes subtle-black-glow {
              0%, 100% { background-color: rgba(0, 0, 0, 0.05); box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.08); }
              50% { background-color: rgba(0, 0, 0, 0.1); box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.12); }
            }
            .highlight-effect {
              animation: subtle-black-glow 4s ease-in-out infinite;
              padding: 2px 6px;
              border-radius: 6px;
              display: inline-block;
            }
          `}</style>
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="hero-title">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black mb-4 leading-tight lg:whitespace-nowrap">
                Practice stock trading with AI-backed insights
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
                Access real-time market data and analytics while practicing with virtual funds in a risk-free environment.
              </p>
            </div>

         

            <div className="hero-buttons flex flex-row gap-2 sm:gap-6 justify-center w-full">
              {!user && (
                <Button size="md" className="h-9 sm:h-auto min-w-[140px] sm:min-w-0 rounded-lg text-xs sm:text-base px-3 sm:px-12 py-1.5 sm:py-4 bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/60 cursor-pointer" onClick={() => window.dispatchEvent(new Event('open-login'))}>
                  Start Trading Free
                </Button>
              )}
              <Button asChild size="md" variant="outline" className="h-9 sm:h-auto min-w-[140px] sm:min-w-0 rounded-lg text-xs sm:text-base px-3 sm:px-8 py-1.5 sm:py-4 border-2">
                <Link href="#features">Explore Features</Link>
              </Button>
            </div>
           
          </div>
        </section>

        {/* Stats Section */}
        <div className="mx-auto w-full lg:max-w-5xl grid grid-cols-3 gap-3 md:gap-6 lg:gap-4 mb-12 md:mb-16">
          {[
            { number: "10K+", label: "Active Traders", icon: Users },
            { number: "1000+", label: "All Stocks", icon: BarChart2 },
            { number: "85%", label: "Accuracy Rate", icon: TrendingUp },
          ].map((stat, idx) => {
            const Icon = stat.icon
            return (
              <div
                key={idx}
                className="stat-card bg-card/50 backdrop-blur border border-primary/20 rounded-xl p-2 md:p-4 lg:p-3 text-center"
                style={{ animationDelay: `${idx * 0.15}s` }}
              >
                <div className="flex justify-center mb-2">
                  <Icon className="h-4 w-4 md:h-6 md:w-6 lg:h-4 lg:w-4 text-primary" />
                </div>
                <div className="stat-number text-base md:text-2xl lg:text-base font-black text-primary mb-1">{stat.number}</div>
                <p className="text-xs md:text-sm lg:text-[13px] text-muted-foreground font-medium">{stat.label}</p>
              </div>
            )
          })}
        </div>

        {/* Features Grid */}
        <section id="features" className="mb-16 md:mb-24 scroll-mt-20">
          <div className="max-w-5xl mx-auto mb-12">
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-center mb-4 md:mb-6">Powerful Features Built for <span className="text-primary">You</span></h2>
            <p className="text-center text-muted-foreground text-sm md:text-base lg:text-lg max-w-2xl mx-auto">Everything you need to master stock trading, options, and index investing with AI-powered insights.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
            {[
              { icon: Brain, title: "AI Predictions", desc: "Machine learning models tracking 1000+ All stocks with growth predictions and confidence scores" },
              { icon: ShoppingCart, title: "Trade Stocks & Options", desc: "Place simulated BUY/SELL orders for shares and option lots; view P&L, close/partially close positions" },
              { icon: Globe, title: "News & Alerts", desc: "Curated market news and alerts alongside quotes so you never miss important events" },
              { icon: Lock, title: "Secure Trading", desc: "Bank-grade security with OAuth authentication and encrypted transactions" },
              { icon: Award, title: "Market Trust & Credibility", desc: "Trusted by thousands of Indian investors with reliable data and transparent analytics" },
              { icon: Smartphone, title: "Mobile Trading App", desc: "Trade on-the-go with fully responsive design and instant push notifications for live alerts" },
            ].map((feature, idx) => {
              const Icon = feature.icon
              return (
                <div
                  key={idx}
                  className={`feature-card group cursor-pointer bg-gradient-to-br from-card/80 to-card/40 border border-primary/20 rounded-lg p-4 md:p-5 lg:p-6 backdrop-blur-sm hover:border-primary/50 min-h-[92px] md:min-h-[110px] ${
                    feature.title === "Trader Community" ? "hidden lg:block" : ""
                  }`}
                  style={{ animationDelay: `${idx * 0.08}s` }}
                >
                  <div className="h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 rounded-full border-2 border-primary bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center mb-2 md:mb-3 lg:mb-4 group-hover:from-primary/30 group-hover:to-accent/20 transition-all relative">
                    <Icon className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 text-primary" />
                    <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse"></div>
                  </div>
                  <h3 className="text-sm md:text-base lg:text-lg font-bold mb-1 md:mb-1 lg:mb-2 text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground text-xs md:text-sm lg:text-sm leading-relaxed">{feature.desc}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* About Premium */}
        <section className="mb-16 md:mb-24">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-3 gap-3 md:gap-6 lg:gap-8">
              <div className="stat-card text-center p-2 md:p-4 lg:p-5 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/30">
                <div className="text-xl md:text-3xl font-black text-primary mb-1 md:mb-3">₹10 LAKHS </div>
                <p className="text-muted-foreground font-medium text-xs md:text-base">Starting Capital</p>
                <p className="text-xs text-primary font-semibold mt-1 md:mt-2">Risk-free virtual trading</p>
              </div>
              <div className="stat-card text-center p-2 md:p-4 lg:p-5 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/30">
                <div className="text-xl md:text-3xl font-black text-primary mb-1 md:mb-3">Real-Time</div>
                <p className="text-muted-foreground font-medium text-xs md:text-base">Live Updates</p>
                <p className="text-xs text-primary font-semibold mt-1 md:mt-2">Market data & prices</p>
              </div>
              <div className="stat-card text-center p-2 md:p-4 lg:p-5 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/30">
                <div className="text-xl md:text-3xl font-black text-primary mb-1 md:mb-3">24/7</div>
                <p className="text-muted-foreground font-medium text-xs md:text-base">Support</p>
                <p className="text-xs text-primary font-semibold mt-1 md:mt-2">Always available for you</p>
              </div>
            </div>
          </div>
        </section>

        {/* Premium Service Section */}
        <section className="max-w-5xl mx-auto mb-24 md:mb-32">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black mb-4">Premium Services</h2>
            <p className="text-muted-foreground text-lg">Get exclusive AI-powered insights and real-time market analysis.</p>
          </div>
          
          <div className="space-y-6 md:space-y-8">
            {/* Predictions Service - First */}
            <Card className="border-primary/40 bg-gradient-to-br from-primary/8 via-accent/4 to-primary/6 backdrop-blur transition-all shadow-2xl overflow-hidden">
              <CardContent className="p-6 md:p-8 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-primary" />
                    <h3 className="text-2xl font-bold">AI Stock Predictions</h3>
                  </div>
                  <span className="bg-gradient-to-r from-primary to-accent text-white px-4 py-1.5 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider shadow-lg">MOST POPULAR</span>
                </div>
                <p className="text-muted-foreground mb-4">Get access to our AI-powered daily predictions of 1000+ stocks with 20%+ growth targets. All stocks coverage (not limited to Nifty). For educational learning and paper-trading practice only.</p>
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Backtested prediction models (learning framework)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Real-time market analysis for study</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Technical indicators & chart patterns</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Practice risk scoring framework</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Daily exercise trade ideas for paper trading</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Model-based setups with confidence levels</li>
                </ul>
                <Link href="/predictions">
                  <div className="space-y-2">
                    <div className="text-center mb-3">
                      <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">🔥 LIMITED NUMBER OFFER</p>
                      <p className="text-2xl font-black text-foreground">₹1000 <span className="text-sm line-through text-muted-foreground ml-2">₹2000</span></p>
                      <p className="text-xs text-accent font-bold">50% OFF</p>
                    </div>
                    <Button size="md" className="bg-gradient-to-r from-primary to-accent hover:shadow-xl hover:shadow-primary/50 cursor-pointer w-full font-bold transition-all py-3 text-sm">
                      Unlock Now - ₹1000
                    </Button>
                  </div>
                </Link>
              </CardContent>
            </Card>

            {/* Top Gainers Service - Second */}
            <Card className="border-primary/40 bg-gradient-to-br from-primary/8 via-accent/4 to-primary/6 backdrop-blur transition-all shadow-2xl overflow-hidden">
              <CardContent className="p-6 md:p-8 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-6 w-6 text-primary" />
                    <h3 className="text-2xl font-bold">Top Gainers (20%+ Growth) - Popular</h3>
                  </div>
                </div>
                <p className="text-muted-foreground mb-4">Unlock access to our curated list of popular top gainers from 1000+ stocks (all-stock coverage, not just Nifty). For educational research and paper-trading learning only.</p>
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 5+ trending gainers daily (market scan for study)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Real-time price updates (data for analysis practice)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 52-week performance tracking (learn momentum patterns)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Momentum score & volume filters (research-grade model output)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Daily watchlist with alerts (practice your strategy workflow)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Support/resistance levels (technical analysis learning tool)</li>
                </ul>
                <Link href="/top-gainers">
                  <div className="space-y-2">
                    <div className="text-center mb-3">
                      <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">🔥 LIMITED NUMBER OFFER</p>
                      <p className="text-2xl font-black text-foreground">₹1000 <span className="text-sm line-through text-muted-foreground ml-2">₹2000</span></p>
                      <p className="text-xs text-accent font-bold">50% OFF</p>
                    </div>
                    <Button size="sm" className="bg-gradient-to-r from-primary to-accent hover:shadow-xl hover:shadow-primary/50 cursor-pointer w-full font-semibold transition-all py-2 text-sm">
                      Unlock Now - ₹1000
                    </Button>
                  </div>
                </Link>
              </CardContent>
            </Card>
            <div className="mt-6">
              <div className="bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/40 rounded-2xl p-6 md:p-8 mb-4 animate-bounce-slow shadow-xl max-w-4xl mx-auto">
                <div className="flex flex-col gap-3">
                  <h2 className="flex items-center gap-3 text-2xl md:text-3xl lg:text-4xl font-extrabold">
                    <CreditCard className="h-6 w-6 text-primary" />
                    How Payments Work
                  </h2>
                  <p className="text-sm md:text-base text-muted-foreground">After completing the payment, the system will automatically verify your transaction through Razorpay. You do not need to manually enter or verify the Payment ID anymore.</p>
                  <p className="text-sm md:text-base text-muted-foreground">Once the payment is successfully verified, the selected module will be automatically unlocked in your account.</p>
                  <p className="text-sm md:text-base text-muted-foreground">Please note that Predictions and Top Gainers have separate unlocks, so access will be granted based on the module you purchase.</p>
                </div>
              </div>
            </div>
            {/* Advanced Analytics Service */}
            
          </div>
        </section>

        {/* How It Works */}
        <section className="max-w-4xl mx-auto mb-24 md:mb-32">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-center mb-12">How To Get Started</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { step: 1, title: "Sign Up Free", desc: "Create your account with email and get ₹10,00,000 virtual capital instantly." },
              { step: 2, title: "Explore the Market", desc: "Browse 1000+ All stocks with real-time data, charts, and our AI predictions." },
              { step: 3, title: "Place Your First Trade", desc: "Buy or sell stocks and options with zero risk. Your portfolio and P&L persist across sessions." },
              { step: 4, title: "Learn & Improve", desc: "Track your performance, learn from the data, and refine your trading strategy." },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-row gap-4 p-4 md:p-6 rounded-xl border border-primary/20 bg-card/50 hover:border-primary/50 transition-all cursor-pointer">
                <div className="flex-shrink-0 hidden md:flex">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/20 text-primary font-bold text-lg">
                    {item.step}
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg md:text-xl font-bold mb-2">
                    <span className="md:hidden">{item.step}. </span>
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm md:text-base">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-4xl mx-auto mb-24 md:mb-32">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-center mb-12">Frequently Asked Questions</h2>

          <div className="space-y-4">
            {[
              {
                q: "How accurate are your AI predictions?",
                a: "Our ML models achieve 85%+ confidence on predictions for stocks with 7% or more expected growth within 48 hours.",
              },
              {
                q: "Can I trade in real markets?",
                a: "Currently, Stock AI offers virtual trading with ₹10,00,000 starting balance. Real market trading may be supported in a future release.",
              },
              {
                q: "How can I restore my balance?",
                a: "Use the Reset Balance option in your user menu to reset your virtual balance to ₹10,00,000.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept UPI, debit cards, credit cards, net banking, and all major payment apps via secure gateway.",
              },
            ].map((item, idx) => (
              <div key={idx} className="p-4 md:p-6 rounded-xl border border-primary/20 bg-card/50 hover:border-primary/50 transition-all">
                <h4 className="font-bold text-base md:text-lg mb-2">{item.q}</h4>
                <p className="text-muted-foreground text-sm md:text-base">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Support Section */}
        <section className="max-w-5xl mx-auto mb-12 md:mb-16">
          <SupportSection />
        </section>

        {/* Reviews Section */}
        <section className="max-w-5xl mx-auto mb-12 md:mb-16">
          <ReviewsSection />
        </section>

        {/* CTA Section */}
        <section className="text-center py-6 md:py-8 border-t border-border/50">
          {showHomeButton ? (
            <div className="mx-auto flex w-full max-w-[280px] justify-center">
              <Button asChild size="sm" variant="outline" className="w-full h-9 sm:h-10 rounded-lg text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 border-2">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          ) : null}
          {communityTicker ? (
            <div className={`mx-auto w-full ${showHomeButton ? "mt-4 max-w-5xl" : "max-w-none"}`}>
              {communityTicker}
            </div>
          ) : null}
        </section>
      </main>

      <CTASection />
    </div>
  )
}
