"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Star } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Review {
  id: number
  email: string
  title: string
  content: string
  rating: number
  created_at: string
}

const PAGE_SIZE = 50

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const averageRating = useMemo(() => {
    if (!reviews.length) return "5.0"
    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0)
    return (total / reviews.length).toFixed(1)
  }, [reviews])

  const fetchAllReviews = async () => {
    try {
      setLoading(true)
      setError(null)

      const allReviews: Review[] = []
      let offset = 0
      let total = 0

      while (true) {
        const response = await fetch(
          `/api/reviews?limit=${PAGE_SIZE}&offset=${offset}`,
          { cache: "no-store" }
        )

        if (!response.ok) {
          throw new Error("Failed to fetch reviews")
        }

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || "Failed to fetch reviews")
        }

        const batch: Review[] = result.data || []
        total = Number(result.pagination?.total || 0)

        allReviews.push(...batch)
        offset += batch.length

        if (batch.length === 0 || offset >= total) {
          break
        }
      }

      setReviews(allReviews)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch reviews"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllReviews()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-3 py-4 md:px-4 md:py-6">
        <div className="mb-4 md:mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Trader Reviews</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Transparent feedback from real StockRupya users.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 md:mb-6">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Average Rating</p>
              <p className="text-2xl font-extrabold mt-1">{averageRating}/5</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Reviews</p>
              <p className="text-2xl font-extrabold mt-1">{reviews.length}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Community Trust</p>
              <p className="text-2xl font-extrabold mt-1">Strong</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              User Reviews ({reviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <>
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </>
            ) : error ? (
              <div className="text-center py-6">
                <p className="text-sm text-red-600 mb-3">{error}</p>
                <Button variant="outline" onClick={fetchAllReviews}>
                  Retry
                </Button>
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                No reviews available yet.
              </p>
            ) : (
              reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-4 border border-border/40 rounded-lg bg-card/40"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating
                              ? "fill-yellow-500 text-yellow-500"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h2 className="font-semibold text-base mb-1">{review.title}</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">
                    {review.content}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    by {review.email.split("@")[0]}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
