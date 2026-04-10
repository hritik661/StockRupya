"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star, MessageSquare, Send } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

interface Review {
  id: number
  email: string
  title: string
  content: string
  rating: number
  created_at: string
}

export function ReviewsSection() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    rating: 5,
  })

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
      : "5.0"

  // Fetch reviews on mount and check if user already submitted
  useEffect(() => {
    fetchReviews()

    if (user?.id) {
      const key = `review_submitted_${user.id}`
      if (localStorage.getItem(key)) {
        setHasReviewed(true)
      }
    }
  }, [user?.id])

  const fetchReviews = async () => {
    try {
      const params: string[] = ["limit=5", "offset=0"]
      if (user?.id) params.push(`userId=${encodeURIComponent(String(user.id))}`)
      else if (user?.email) params.push(`email=${encodeURIComponent(String(user.email))}`)

      const res = await fetch(`/api/reviews?${params.join("&")}`)
      const data = await res.json()
      if (data.success) {
        setReviews(data.data)
        if (data.hasReviewed) {
          setHasReviewed(true)
          try {
            if (user?.id) localStorage.setItem(`review_submitted_${user.id}`, "true")
          } catch {}
        }
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error)
    }
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim() || !formData.content.trim()) {
      alert("Please fill in all fields")
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id || null,
          email: user?.email || "anonymous@example.com",
          title: formData.title,
          content: formData.content,
          rating: formData.rating,
        }),
      })

      const data = await res.json()
      if (data.success) {
        alert("✅ Review submitted successfully!")
        // mark localstorage so user can't post again
        if (user?.id) {
          localStorage.setItem(`review_submitted_${user.id}`, "true")
        }
        setHasReviewed(true)
        setFormData({ title: "", content: "", rating: 5 })
        setShowForm(false)
        fetchReviews() // Refresh reviews list
      } else {
        // if server tells us a duplicate, hide form
        if (data.error && data.error.includes("already")) {
          setHasReviewed(true)
          setShowForm(false)
        }
        alert("❌ Failed to submit review: " + data.error)
      }
    } catch (error) {
      console.error("Error submitting review:", error)
      alert("Failed to submit review")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      <Card className="border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-accent/10 shadow-lg">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-primary/80 font-semibold mb-1">
                Trusted Community Feedback
              </p>
              <h3 className="text-lg md:text-2xl font-extrabold">User Reviews </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {reviews.length > 0
                  ? `${reviews.length}+ verified reviews with an average ${averageRating}/5 rating.`
                  : "See why traders choose StockRupya for insights, speed, and confidence."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {user && !hasReviewed && (
                <Button
                  onClick={() => setShowForm(true)}
                  className="rounded-xl font-semibold"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Write a Review
                </Button>
              )}
              <Button asChild variant="outline" className="rounded-xl border-primary/40 hover:border-primary/70">
                <Link href="/reviews">See All Reviews</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Review Section */}
      {user && !hasReviewed && (
        <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Share Your Experience
            </CardTitle>
          </CardHeader>
          {!showForm ? (
            <CardContent>
              <Button
                onClick={() => setShowForm(true)}
                className="w-full"
                variant="default"
              >
                <Send className="h-4 w-4 mr-2" />
                Write a Review
              </Button>
            </CardContent>
          ) : (
            <CardContent>
              <form onSubmit={handleSubmitReview} className="space-y-4">
                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rating (1-5 stars)
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, rating: star })
                        }
                        className={`transition-colors ${
                          star <= formData.rating
                            ? "text-yellow-400"
                            : "text-muted-foreground hover:text-yellow-300"
                        }`}
                      >
                        <Star
                          className="h-6 w-6 fill-current"
                          key={star}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Review Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Great platform, easy to use"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    maxLength={120}
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Your Review
                  </label>
                  <textarea
                    placeholder="Tell us what you think..."
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    rows={3}
                    maxLength={1000}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.content.length}/1000 characters
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? "Submitting..." : "Submit Review"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>
      )}

    </div>
  )
}
