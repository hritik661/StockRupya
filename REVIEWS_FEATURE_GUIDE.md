# Reviews Feature - Deployment Guide

## Overview
A complete user review system has been added to your StockAI platform with:
- **Review submission form** for authenticated users
- **Star rating system** (1-5 stars)
- **Database storage** using PostgreSQL (Neon)
- **Review display** showing recent reviews on the login/about page

---

## Files Created

### 1. **Database & API Files**

#### `scripts/migrate-add-reviews-table.js`
- Creates the `reviews` table in PostgreSQL
- Adds indexes for performance optimization
- Run once before starting the feature

#### `app/api/reviews/route.ts`
- **GET** `/api/reviews` - Fetches reviews with pagination
  - Query params: `limit` (default 10), `offset` (default 0)
  - Returns: array of reviews with total count
- **POST** `/api/reviews` - Creates a new review
  - Body: `{ userId, email, title, content, rating }`
  - Validates all fields and rating range (1-5)

### 2. **Frontend Components**

#### `components/reviews-section.tsx`
- Complete UI component with:
  - Submit review form (title, content, rating)
  - Star rating selector
  - Character limit for content (1000 chars)
  - Reviews list display
  - Loading states and error handling
  - Only shows submit form to logged-in users

### 3. **Page Integration**

#### `app/about/page.tsx` (Modified)
- Added `ReviewsSection` component
- Positioned before CTA section
- Renders on login/about page for all visitors

---

## Deployment Steps

### Step 1: Create Database Table

Run this command **once** in your project root:

```bash
node scripts/migrate-add-reviews-table.js
```

Expected output:
```
🔄 Creating reviews table...
✅ Reviews table created successfully!
✅ Index created on user_id
✅ Index created on created_at
🎉 Migration completed successfully!
```

### Step 2: Deploy to Vercel

```bash
# Commit changes
git add .
git commit -m "Add user reviews feature"
git push origin main

# Or deploy manually
npx vercel --prod
```

Vercel will:
1. Run `npm run build` (builds Next.js)
2. Deploy to production
3. Automatically use `DATABASE_URL` environment variable

### Step 3: Verify Deployment

1. Visit your production URL
2. Go to the **About/Reviews page** (or wherever you linked it)
3. If logged in: Click "Write a Review" button
4. Try submitting a review
5. Refresh and confirm it appears in the list

---

## API Endpoints

### GET `/api/reviews`
Fetch reviews with pagination.

**Request:**
```bash
GET /api/reviews?limit=5&offset=0
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "title": "Great platform!",
      "content": "Easy to use and very helpful...",
      "rating": 5,
      "created_at": "2024-03-03T10:30:00Z"
    }
  ],
  "pagination": {
    "limit": 5,
    "offset": 0,
    "total": 42,
    "count": 5
  }
}
```

### POST `/api/reviews`
Create a new review.

**Request:**
```bash
POST /api/reviews
Content-Type: application/json

{
  "userId": "user-123",
  "email": "user@example.com",
  "title": "Amazing trading platform",
  "content": "I love the interface and the real-time data updates...",
  "rating": 5
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Review created successfully!",
  "data": {
    "id": 42,
    "user_id": "user-123",
    "email": "user@example.com",
    "title": "Amazing trading platform",
    "content": "I love the interface...",
    "rating": 5,
    "created_at": "2024-03-03T10:35:00Z"
  }
}
```

---

## Database Schema

```sql
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
```

---

## Features

### ✅ For Users
- View all user reviews with ratings
- Submit their own review (if logged in)
- See submission date for each review
- Visual star ratings

### ✅ For Admin/Monitoring
- Reviews stored in PostgreSQL with timestamps
- Track all user submissions
- Easy to add moderation later

### ✅ Performance
- Indexed queries (user_id, created_at)
- Pagination support
- Optimized for fast load times

---

## Customization Options

### Show More Reviews
Edit `components/reviews-section.tsx` line where it fetches:
```typescript
const res = await fetch("/api/reviews?limit=5&offset=0")  // Change limit=5 to limit=10
```

### Change Review Display Count
In the Reviews List section, adjust the limit in the fetch call.

### Add Moderation
Add status column to reviews table:
```sql
ALTER TABLE reviews ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
```

### Add Admin Dashboard
Create new page `app/admin/reviews/page.tsx` to show all reviews with approval buttons.

---

## Troubleshooting

### "Failed to fetch reviews"
- Check if `DATABASE_URL` is set in `.env.local` (local) and Vercel dashboard (production)
- Verify migration script ran successfully
- Check browser console for specific error

### "Missing required fields" error (400)
- Ensure submission includes: `email`, `title`, `content`, `rating`
- Rating must be 1-5

### "Failed to create review" error (500)
- Check database connection
- Verify table exists: `SELECT * FROM reviews LIMIT 1;`
- Review server logs in Vercel dashboard

---

## Next Steps

1. **Run migration**: `node scripts/migrate-add-reviews-table.js`
2. **Test locally**: `npm run dev`
3. **Deploy**: `git push origin main` (or `npx vercel --prod`)
4. **(Optional) Add moderation** system for reviews
5. **(Optional) Create admin panel** to manage reviews

---

**Created**: March 3, 2026  
**Component**: ReviewsSection  
**Database**: PostgreSQL (Neon)  
**Status**: Ready for Production
