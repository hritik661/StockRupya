import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL!);

// Helper function to ensure reviews table exists
async function ensureReviewsTableExists() {
  try {
    // Check if table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'reviews'
      );
    `;

    if (!tableCheck[0]?.exists) {
      console.log("🔄 Reviews table not found. Creating...");

      // Create reviews table
      await sql`
        CREATE TABLE IF NOT EXISTS reviews (
          id SERIAL PRIMARY KEY,
          user_id TEXT,
          email TEXT NOT NULL,
          title VARCHAR(200) NOT NULL,
          content TEXT NOT NULL,
          rating INTEGER CHECK (rating >= 1 AND rating <= 5),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // Create indexes
      await sql`
        CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_reviews_email ON reviews(email);
      `;

      console.log("✅ Reviews table created successfully!");
    }
  } catch (error: any) {
    console.error("[Table Creation Error]:", error.message);
    // Don't throw - let the request continue
  }
}

// GET: Fetch all reviews with pagination
export async function GET(request: NextRequest) {
  try {
    await ensureReviewsTableExists();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Fetch recent reviews
    const reviews = await sql`
      SELECT 
        id,
        email,
        title,
        content,
        rating,
        created_at
      FROM reviews
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    // Get total count
    const countResult = await sql`SELECT COUNT(*) as total FROM reviews;`;
    const total = countResult[0]?.total || 0;

    // Determine if the requesting user has already submitted a review
    let hasReviewed = false
    const userIdParam = searchParams.get("userId")
    const emailParam = searchParams.get("email")

    if (userIdParam) {
      const exists = await sql`
        SELECT 1 FROM reviews WHERE user_id = ${userIdParam} LIMIT 1;
      `
      hasReviewed = (exists?.length || 0) > 0
    } else if (emailParam) {
      const exists = await sql`
        SELECT 1 FROM reviews WHERE email = ${emailParam} LIMIT 1;
      `
      hasReviewed = (exists?.length || 0) > 0
    }

    return NextResponse.json({
      success: true,
      data: reviews,
      hasReviewed,
      pagination: {
        limit,
        offset,
        total,
        count: reviews.length,
      },
    });
  } catch (error) {
    console.error("[Reviews API GET Error]:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

// POST: Create a new review
export async function POST(request: NextRequest) {
  try {
    // Ensure table exists (auto-create on first request)
    await ensureReviewsTableExists();

    const body = await request.json();
    const { userId, email, title, content, rating } = body;

    // Validation
    if (!email || !title || !content || !rating) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Trim inputs
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const trimmedEmail = email.trim();

    if (!trimmedTitle || !trimmedContent) {
      return NextResponse.json(
        { success: false, error: "Title and content cannot be empty" },
        { status: 400 }
      );
    }

    try {
      // prevent duplicate reviews from same user or email
      if (userId) {
        const existing = await sql`
          SELECT id FROM reviews WHERE user_id = ${userId} LIMIT 1;
        `;
        if (existing.length > 0) {
          return NextResponse.json(
            { success: false, error: "User has already submitted a review" },
            { status: 400 }
          );
        }
      } else {
        // if no userId provided, fallback to email check
        const existingByEmail = await sql`
          SELECT id FROM reviews WHERE email = ${trimmedEmail} LIMIT 1;
        `;
        if (existingByEmail.length > 0) {
          return NextResponse.json(
            { success: false, error: "Email has already been used to submit a review" },
            { status: 400 }
          );
        }
      }

      // Insert review with better error handling
      const result = await sql`
        INSERT INTO reviews (user_id, email, title, content, rating)
        VALUES (${userId || null}, ${trimmedEmail}, ${trimmedTitle}, ${trimmedContent}, ${rating})
        RETURNING id, user_id, email, title, content, rating, created_at;
      `;

      if (!result || result.length === 0) {
        throw new Error("No result returned from insert query");
      }

      return NextResponse.json(
        {
          success: true,
          message: "Review created successfully!",
          data: result[0],
        },
        { status: 201 }
      );
    } catch (dbError: any) {
      console.error("[Database Error]:", dbError.message);
      console.error("[Database Error Details]:", dbError);

      throw dbError;
    }
  } catch (error: any) {
    console.error("[Reviews API POST Error]:", error.message);
    console.error("[Error Stack]:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create review: " + (error.message || "Unknown error"),
      },
      { status: 500 }
    );
  }
}
