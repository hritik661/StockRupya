"use client"

import { Mail, Phone } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface SupportSectionProps {
  className?: string
}

export function SupportSection({ className = "" }: SupportSectionProps) {
  const supportEmail = "support.stockrupya@genfintechanalytics.com"

  return (
    <section className={`py-3 md:py-4 ${className}`}>
      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-subtle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        .support-card-email {
          animation: slideInUp 0.5s ease-out;
        }
        .support-card-email:hover {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
        .support-card-community {
          animation: slideInUp 0.7s ease-out;
        }
        .support-card-community:hover {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 lg:gap-2 max-w-2xl lg:max-w-xl mx-auto">
        {/* Email Support */}
        <Card className="support-card-email border-primary/20 hover:border-primary/50 transition-all hover:shadow-md">
          <CardHeader className="pb-2 pt-2 px-2 md:px-3 lg:px-2">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1 rounded-lg bg-primary/10">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm md:text-base lg:text-sm">Support</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-2 md:p-3 lg:p-2 space-y-2">
            <p className="text-sm md:text-base text-muted-foreground">
              For assistance, reach out to our support team at:
            </p>
            <a href={`mailto:${supportEmail}`}>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full text-sm md:text-base px-2 md:px-3 py-2 md:py-2.5 border-primary/40 hover:border-primary hover:bg-primary/10"
              >
                <Mail className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* Community Support */}
        <Card className="support-card-community border-purple-500/20 hover:border-purple-500/50 transition-all hover:shadow-md">
          <CardHeader className="pb-2 pt-2 px-2 md:px-3 lg:px-2">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1 rounded-lg bg-purple-500/10">
                <Phone className="h-4 w-4 text-purple-500" />
              </div>
              <CardTitle className="text-sm md:text-base lg:text-sm">Community</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-2 md:p-3 lg:p-2 space-y-2">
            <p className="text-sm md:text-base text-muted-foreground">
              Join our community to discuss strategies and stay updated.
            </p>
            <a href={`mailto:${supportEmail}`}>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full text-sm md:text-base px-2 md:px-3 py-2 md:py-2.5 border-purple-500/40 hover:border-purple-500 hover:bg-purple-500/10"
              >
                <Phone className="h-4 w-4 mr-2" />
                Join Community
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
