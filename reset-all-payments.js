#!/usr/bin/env node

/**
 * Bulk reset payment access so users must pay again for:
 * - Predictions
 * - Top Gainers
 *
 * Default scope: Gmail users only.
 *
 * Usage:
 *   node reset-all-payments.js
 *   node reset-all-payments.js --all
 *   node reset-all-payments.js --email=user@gmail.com
 */

const fs = require("fs")
const path = require("path")

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const raw = fs.readFileSync(filePath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = trimmed.slice(eqIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"))
  loadEnvFile(path.join(process.cwd(), ".env"))

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Add it to .env.local or the shell environment.")
    process.exit(1)
  }

  const { neon } = require("@neondatabase/serverless")
  const sql = neon(databaseUrl)

  const args = process.argv.slice(2)
  const resetAllUsers = args.includes("--all")
  const emailArg = args.find((arg) => arg.startsWith("--email="))
  const emailFilter = emailArg ? emailArg.slice("--email=".length).trim().toLowerCase() : ""

  let targetUsers = []

  if (emailFilter) {
    targetUsers = await sql`
      SELECT id, email
      FROM users
      WHERE LOWER(email) = ${emailFilter}
    `
  } else if (resetAllUsers) {
    targetUsers = await sql`
      SELECT id, email
      FROM users
    `
  } else {
    targetUsers = await sql`
      SELECT id, email
      FROM users
      WHERE LOWER(email) LIKE '%@gmail.com'
    `
  }

  if (!targetUsers.length) {
    console.log("No matching users found. Nothing changed.")
    return
  }

  const userIds = targetUsers.map((user) => user.id)
  const scopeLabel = emailFilter
    ? `email ${emailFilter}`
    : resetAllUsers
      ? "all users"
      : "all Gmail users"

  console.log(`Resetting payment access for ${targetUsers.length} user(s) in scope: ${scopeLabel}`)

  const updatedUsers = await sql`
    UPDATE users
    SET is_prediction_paid = false,
        is_top_gainer_paid = false
    WHERE id = ANY(${userIds})
    RETURNING id, email
  `

  let revertedOrders = []
  try {
    revertedOrders = await sql`
      UPDATE payment_orders
      SET status = 'reverted'
      WHERE user_id = ANY(${userIds})
        AND product_type IN ('predictions', 'top_gainers')
      RETURNING order_id
    `
  } catch (error) {
    console.warn("payment_orders update skipped:", error instanceof Error ? error.message : String(error))
  }

  console.log(`Users reset: ${updatedUsers.length}`)
  console.log(`Payment orders marked reverted: ${revertedOrders.length}`)
}

main().catch((error) => {
  console.error("Failed to reset payments:", error)
  process.exit(1)
})
