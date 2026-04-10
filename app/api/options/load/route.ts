import { NextResponse, type NextRequest } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getIndexLotSize, normalizeOptionIndexSymbol } from "@/lib/options-config"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })
    }

    // Check if database is configured
    const databaseUrl = process.env.DATABASE_URL
    const useDatabase = databaseUrl && !databaseUrl.includes('dummy')

    if (!useDatabase || !databaseUrl) {
      return NextResponse.json({
        success: true,
        options: []
      })
    }

    const sql = neon(databaseUrl)
    const normalizedEmail = email.toLowerCase().trim()

    try {
      // Get user by email (case-insensitive and trim)
      const userResult = await sql`
        SELECT id FROM users WHERE LOWER(TRIM(email)) = ${normalizedEmail}
      `

      if (!userResult || userResult.length === 0) {
        console.log(`No user found for email: ${normalizedEmail}`)
        return NextResponse.json({
          success: true,
          options: []
        })
      }

      const userId = userResult[0].id

      // Get user options transactions ordered by most recent first
      const optionsResult = await sql`
        SELECT id, symbol, option_type, action, index_name, strike_price, quantity, entry_price, created_at
        FROM options_transactions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `

      const options = optionsResult.map((o) => {
        const indexSymbol = String(o.index_name || o.symbol || "NIFTY")
        const normalizedIndex = normalizeOptionIndexSymbol(indexSymbol) || "NIFTY"
        const quantity = parseInt(o.quantity.toString())
        const entryPrice = parseFloat(o.entry_price.toString())
        const lotSize = getIndexLotSize(normalizedIndex, 50)

        return {
          id: o.id,
          symbol: o.symbol,
          type: o.option_type,
          action: o.action,
          index: normalizedIndex,
          strike: o.strike_price,
          quantity,
          price: entryPrice,
          lotSize,
          totalValue: entryPrice * quantity * lotSize,
          timestamp: new Date(o.created_at).getTime(),
        }
      })

      return NextResponse.json({
        success: true,
        options
      })
    } catch (dbError) {
      console.error("Database error:", dbError)
      return NextResponse.json({
        success: true,
        options: []
      })
    }
  } catch (error) {
    console.error("Error loading options:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load options" },
      { status: 500 }
    )
  }
}
