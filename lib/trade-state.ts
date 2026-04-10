"use client"

export interface EquityHoldingState {
  symbol: string
  name: string
  quantity: number
  avgPrice: number
}

export interface OptionPositionState {
  id: string
  type: "CE" | "PE"
  action: "BUY" | "SELL"
  index: string
  strike: number
  symbol: string
  price: number
  quantity: number
  lotSize: number
  totalValue: number
  timestamp: number
}

export function loadEquityHoldings(userEmail?: string | null): EquityHoldingState[] {
  const storageKey = userEmail ? `holdings_${userEmail}` : "holdings_guest"
  try {
    const raw = localStorage.getItem(storageKey) || "[]"
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveEquityHoldings(userEmail: string | null | undefined, holdings: EquityHoldingState[]) {
  const storageKey = userEmail ? `holdings_${userEmail}` : "holdings_guest"
  localStorage.setItem(storageKey, JSON.stringify(holdings))
}

export function buyEquityHolding(
  holdings: EquityHoldingState[],
  nextHolding: { symbol: string; name: string; quantity: number; price: number }
) {
  const cloned = [...holdings]
  const existingIndex = cloned.findIndex((holding) => holding.symbol === nextHolding.symbol)

  if (existingIndex >= 0) {
    const existing = cloned[existingIndex]
    const quantity = existing.quantity + nextHolding.quantity
    const avgPrice =
      (existing.avgPrice * existing.quantity + nextHolding.price * nextHolding.quantity) / quantity

    cloned[existingIndex] = {
      ...existing,
      quantity,
      avgPrice,
    }
  } else {
    cloned.push({
      symbol: nextHolding.symbol,
      name: nextHolding.name,
      quantity: nextHolding.quantity,
      avgPrice: nextHolding.price,
    })
  }

  return cloned
}

export function sellEquityHolding(
  holdings: EquityHoldingState[],
  sellInput: { symbol: string; quantity: number }
) {
  const cloned = [...holdings]
  const existingIndex = cloned.findIndex((holding) => holding.symbol === sellInput.symbol)
  if (existingIndex < 0) {
    throw new Error("Holding not found")
  }

  const existing = cloned[existingIndex]
  if (existing.quantity < sellInput.quantity) {
    throw new Error(`You only have ${existing.quantity} shares.`)
  }

  const remainingQuantity = existing.quantity - sellInput.quantity
  if (remainingQuantity <= 0) {
    cloned.splice(existingIndex, 1)
  } else {
    cloned[existingIndex] = {
      ...existing,
      quantity: remainingQuantity,
    }
  }

  return cloned
}

export function loadOptionPositions(userEmail?: string | null): OptionPositionState[] {
  const storageKey = userEmail ? `options_positions_${userEmail}` : "options_positions_guest"
  try {
    const raw = localStorage.getItem(storageKey) || "[]"
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveOptionPositions(userEmail: string | null | undefined, positions: OptionPositionState[]) {
  const storageKey = userEmail ? `options_positions_${userEmail}` : "options_positions_guest"
  localStorage.setItem(storageKey, JSON.stringify(positions))
}

export function buyOptionPosition(
  positions: OptionPositionState[],
  nextPosition: Omit<OptionPositionState, "id" | "timestamp" | "totalValue"> & { id?: string; timestamp?: number }
) {
  const normalized: OptionPositionState = {
    ...nextPosition,
    id: nextPosition.id || Math.random().toString(36).slice(2),
    timestamp: nextPosition.timestamp || Date.now(),
    totalValue: nextPosition.price * nextPosition.quantity * nextPosition.lotSize,
  }

  const existingIndex = positions.findIndex((position) =>
    position.action === normalized.action &&
    position.index === normalized.index &&
    position.strike === normalized.strike &&
    position.type === normalized.type
  )

  if (existingIndex < 0) {
    return [...positions, normalized]
  }

  const cloned = [...positions]
  const existing = cloned[existingIndex]
  const totalQuantity = existing.quantity + normalized.quantity
  const averagePrice =
    ((existing.price * existing.quantity) + (normalized.price * normalized.quantity)) / totalQuantity

  cloned[existingIndex] = {
    ...existing,
    quantity: totalQuantity,
    price: averagePrice,
    totalValue: averagePrice * totalQuantity * existing.lotSize,
    timestamp: normalized.timestamp,
  }

  return cloned
}

export function sellOptionPosition(
  positions: OptionPositionState[],
  sellInput: { id: string; quantity: number }
) {
  const cloned = [...positions]
  const existingIndex = cloned.findIndex((position) => position.id === sellInput.id)
  if (existingIndex < 0) {
    throw new Error("Option position not found")
  }

  const existing = cloned[existingIndex]
  if (existing.quantity < sellInput.quantity) {
    throw new Error(`You only have ${existing.quantity} lot(s).`)
  }

  const remainingQuantity = existing.quantity - sellInput.quantity
  if (remainingQuantity <= 0) {
    cloned.splice(existingIndex, 1)
  } else {
    cloned[existingIndex] = {
      ...existing,
      quantity: remainingQuantity,
      totalValue: existing.price * remainingQuantity * existing.lotSize,
    }
  }

  return cloned
}
