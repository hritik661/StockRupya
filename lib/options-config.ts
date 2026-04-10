export type OptionIndexKey = "NIFTY" | "BANKNIFTY" | "SENSEX" | "FINNIFTY" | "MIDCPNIFTY"

export interface OptionIndexConfig {
  symbol: OptionIndexKey
  name: string
  lotSize: number
  strikeGap: number
}

const DEFAULT_OPTION_INDEX_CONFIG: Record<OptionIndexKey, Omit<OptionIndexConfig, "symbol">> = {
  NIFTY: { name: "NIFTY 50", lotSize: 65, strikeGap: 50 },
  BANKNIFTY: { name: "BANK NIFTY", lotSize: 35, strikeGap: 100 },
  SENSEX: { name: "BSE SENSEX", lotSize: 20, strikeGap: 100 },
  FINNIFTY: { name: "FIN NIFTY", lotSize: 65, strikeGap: 50 },
  MIDCPNIFTY: { name: "MIDCAP NIFTY", lotSize: 75, strikeGap: 25 },
}

const INDEX_ALIASES: Record<string, OptionIndexKey> = {
  NIFTY: "NIFTY",
  NIFTY50: "NIFTY",
  NIFTYNS: "NIFTY",
  "^NSEI": "NIFTY",

  BANKNIFTY: "BANKNIFTY",
  "^NSEBANK": "BANKNIFTY",

  SENSEX: "SENSEX",
  BSESENSEX: "SENSEX",
  SENSEXBO: "SENSEX",
  "^BSESN": "SENSEX",

  FINNIFTY: "FINNIFTY",
  NIFTYFINANCIALSERVICES: "FINNIFTY",

  MIDCPNIFTY: "MIDCPNIFTY",
  MIDCAPNIFTY: "MIDCPNIFTY",
  MIDCAP: "MIDCPNIFTY",
}

function cleanIndexSymbol(raw: string): string {
  return (raw || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[._-]/g, "")
}

export function normalizeOptionIndexSymbol(raw: string): OptionIndexKey | null {
  if (!raw) return null

  const exact = raw.toUpperCase().trim()
  if (INDEX_ALIASES[exact]) return INDEX_ALIASES[exact]

  const cleaned = cleanIndexSymbol(raw)
  if (INDEX_ALIASES[cleaned]) return INDEX_ALIASES[cleaned]

  return null
}

function readPositiveNumberEnv(keys: string[]): number | null {
  for (const key of keys) {
    const raw = process.env[key]
    const value = Number(raw)
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value)
    }
  }
  return null
}

function getConfiguredLotSize(key: OptionIndexKey): number {
  const fallback = DEFAULT_OPTION_INDEX_CONFIG[key].lotSize
  return (
    readPositiveNumberEnv([
      `NEXT_PUBLIC_OPTION_LOT_SIZE_${key}`,
      `OPTION_LOT_SIZE_${key}`,
      `NEXT_PUBLIC_LOT_SIZE_${key}`,
      `LOT_SIZE_${key}`,
    ]) ?? fallback
  )
}

function getConfiguredStrikeGap(key: OptionIndexKey): number {
  const fallback = DEFAULT_OPTION_INDEX_CONFIG[key].strikeGap
  return (
    readPositiveNumberEnv([
      `NEXT_PUBLIC_OPTION_STRIKE_GAP_${key}`,
      `OPTION_STRIKE_GAP_${key}`,
      `NEXT_PUBLIC_STRIKE_GAP_${key}`,
      `STRIKE_GAP_${key}`,
    ]) ?? fallback
  )
}

export function getIndexLotSize(indexSymbol: string, fallback = 50): number {
  const key = normalizeOptionIndexSymbol(indexSymbol)
  if (!key) return fallback
  return getConfiguredLotSize(key)
}

export function getIndexStrikeGap(indexSymbol: string, fallback = 50): number {
  const key = normalizeOptionIndexSymbol(indexSymbol)
  if (!key) return fallback
  return getConfiguredStrikeGap(key)
}

export function getOptionIndexConfig(indexSymbol: string): OptionIndexConfig | null {
  const key = normalizeOptionIndexSymbol(indexSymbol)
  if (!key) return null

  return {
    symbol: key,
    name: DEFAULT_OPTION_INDEX_CONFIG[key].name,
    lotSize: getConfiguredLotSize(key),
    strikeGap: getConfiguredStrikeGap(key),
  }
}

export function getDefaultOptionsIndices(): Array<OptionIndexConfig & { price: number; change: number; changePercent: number }> {
  const baseOrder: OptionIndexKey[] = ["NIFTY", "BANKNIFTY", "SENSEX"]

  return baseOrder.map((symbol) => {
    const defaults = DEFAULT_OPTION_INDEX_CONFIG[symbol]
    return {
      symbol,
      name: defaults.name,
      lotSize: getConfiguredLotSize(symbol),
      strikeGap: getConfiguredStrikeGap(symbol),
      price: 0,
      change: 0,
      changePercent: 0,
    }
  })
}
