import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const COMMON_SURNAME_SUFFIXES = [
  "chakraborty",
  "mukherjee",
  "banerjee",
  "malhotra",
  "tripathi",
  "mahindra",
  "aggarwal",
  "agarwal",
  "chauhan",
  "sharma",
  "parmar",
  "patel",
  "verma",
  "gupta",
  "singh",
  "kumar",
  "yadav",
  "mehta",
  "jain",
  "reddy",
  "naidu",
  "nair",
  "nadar",
  "iyyer",
  "iyer",
  "pawar",
  "shinde",
  "joshi",
  "saxena",
  "pandey",
  "tiwari",
  "thakur",
  "kapoor",
  "arora",
  "bansal",
  "mittal",
  "goyal",
  "modi",
  "bhatt",
  "soni",
  "sheth",
  "desai",
  "sheikh",
  "shaikh",
  "khan",
  "das",
  "devi",
  "rao",
]

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function splitMergedName(token: string) {
  const normalizedToken = token.toLowerCase()

  for (const suffix of COMMON_SURNAME_SUFFIXES) {
    if (normalizedToken.endsWith(suffix) && normalizedToken.length > suffix.length + 1) {
      return [normalizedToken.slice(0, -suffix.length), suffix]
    }
  }

  return [normalizedToken]
}

function formatDisplayName(name: string | null | undefined, email: string | null | undefined) {
  const baseValue = String(name || email || "").trim()
  if (!baseValue) {
    return null
  }

  let normalized = baseValue.includes("@") ? baseValue.split("@")[0] : baseValue
  normalized = normalized
    .replace(/\+/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) {
    return null
  }

  const parts = normalized.split(" ").filter(Boolean)
  const resolvedParts = parts.length === 1 ? splitMergedName(parts[0]) : parts
  const formatted = toTitleCase(resolvedParts.join(" "))

  return formatted || null
}

function getDisplayNameKey(displayName: string) {
  return displayName
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ")
}

export async function GET() {
  try {
    const databaseUrl = process.env.DATABASE_URL
    const useDatabase = databaseUrl && !databaseUrl.includes("dummy")
    if (!useDatabase) {
      return NextResponse.json({ success: true, displayNames: [] })
    }

    const sql = neon(databaseUrl!)

    // Provide all registered users for the public home-page ticker.
    const emailsResults = await sql`
      SELECT email, preferred_name
      FROM (
        SELECT
          LOWER(TRIM(email)) AS email,
          MAX(NULLIF(TRIM(name), '')) AS preferred_name,
          MIN(created_at) AS first_registered
        FROM users
        WHERE email IS NOT NULL AND TRIM(email) <> ''
        GROUP BY LOWER(TRIM(email))
        ORDER BY MIN(created_at) ASC
      ) as u
    `

    const displayNames: string[] = []
    const seenDisplayNames = new Set<string>()

    if (Array.isArray(emailsResults)) {
      for (const row of emailsResults as any[]) {
        const displayName = formatDisplayName(row.preferred_name, row.email)
        if (!displayName) {
          continue
        }

        const dedupeKey = getDisplayNameKey(displayName)
        if (seenDisplayNames.has(dedupeKey)) {
          continue
        }

        seenDisplayNames.add(dedupeKey)
        displayNames.push(displayName)
      }
    }

    return NextResponse.json({ success: true, displayNames })
  } catch (error) {
    console.error("/api/analytics/user-emails error:", error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
