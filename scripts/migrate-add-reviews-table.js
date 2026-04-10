const { neon } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  console.error("Please set DATABASE_URL in your .env.local file");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrateReviewsTable() {
  try {
    console.log("🔄 Creating reviews table...");

    // Create reviews table (without foreign key constraint to avoid issues)
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

    console.log("✅ Reviews table created successfully!");

    // Create index on user_id for faster queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
    `;

    console.log("✅ Index created on user_id");

    // Create index on created_at for sorting
    await sql`
      CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
    `;

    console.log("✅ Index created on created_at");

    // Create index on email
    await sql`
      CREATE INDEX IF NOT EXISTS idx_reviews_email ON reviews(email);
    `;

    console.log("✅ Index created on email");

    console.log("🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

migrateReviewsTable();
