"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star, X } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export function ReviewPromptModal() {
  const { user } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    rating: 5,
  })
  const [submitting, setSubmitting] = useState(false)

  // Check if user has already reviewed and show modal after 1 minute
  useEffect(() => {
    if (!user?.id) return

    // If user already reviewed, never show modal
    const reviewKey = `review_submitted_${user.id}`
    if (localStorage.getItem(reviewKey)) {
      setHasReviewed(true)
      return
    }

    // Also don't ask again once prompt has been displayed/skipped
    const promptKey = `review_prompt_shown_${user.id}`
    if (localStorage.getItem(promptKey)) {
      return
    }

    // Show modal after 1 minute (60000ms)
    const timer = setTimeout(() => {
      setShowModal(true)
      // mark that we've shown it so it won't trigger on future logins
      localStorage.setItem(promptKey, "true")
    }, 60000)

    return () => clearTimeout(timer)
  }, [user?.id])

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
        // Mark as reviewed in localStorage and mark prompt shown as well
        const reviewKey = `review_submitted_${user?.id}`
        localStorage.setItem(reviewKey, "true")
        if (user?.id) {
          localStorage.setItem(`review_prompt_shown_${user.id}`, "true")
        }
        setHasReviewed(true)
        setShowModal(false)
        setFormData({ title: "", content: "", rating: 5 })
      } else {
        alert("Failed to submit review: " + data.error)
      }
    } catch (error) {
      console.error("Error submitting review:", error)
      alert("Failed to submit review")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismiss = () => {
    // mark prompt as shown so we don't ask again
    if (user?.id) {
      localStorage.setItem(`review_prompt_shown_${user.id}`, "true")
    }
    setShowModal(false)
  }

  if (!showModal || hasReviewed) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-auto">
      <Card className="w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-auto border-2 border-primary/30 bg-card shadow-2xl">
        <CardHeader className="pb-3 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Love Our Platform?
            </CardTitle>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-secondary rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-2">
            Share your experience and help others make better trading decisions
          </p>
        </CardHeader>

        <CardContent className="space-y-4 max-h-[80vh] overflow-y-auto">
          <form onSubmit={handleSubmitReview} className="space-y-3">
            {/* Rating */}
            <div>
              <label className="block text-sm font-medium mb-2">
                How would you rate StockAI?
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
              <label className="block text-sm font-medium mb-1">
                Review Title
              </label>
              <input
                type="text"
                placeholder="e.g., Great platform for traders"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                maxLength={100}
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Your Review
              </label>
              <textarea
                placeholder="Tell us what you love about StockAI..."
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-sm"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.content.length}/500 characters
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 text-sm"
              >
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDismiss}
                className="flex-1 text-sm"
              >
                Skip for Now
              </Button>
            </div>
          </form>

          <p className="text-[10px] text-muted-foreground text-center">
            You'll only see this once. Thank you for your feedback!
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
