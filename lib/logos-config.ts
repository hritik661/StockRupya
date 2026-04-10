/**
 * Centralized Logo Configuration
 * All app logos reference this file for consistency
 */

export const LOGOS = {
  // Main StockRupya Application Logo
  main: "/rupya.png",
  
  // Fallback logos (in priority order)
  fallback: [
    "/rupya.png",
  ],
  
  // Favicon configurations
  favicon: {
    light: "/rupya.png",
    dark: "/rupya.png",
    svg: "/rupya.png",
    apple: "/rupya.png",
    icon32: "/rupya.png",
  },
  
  // Social/Metadata logos
  social: {
    og: "/rupya.png",
    twitter: "/rupya.png",
  },
  
  // Placeholder logos
  placeholder: {
    stock: "/placeholder-logo.svg",
    user: "/placeholder-user.jpg",
  },
}

/**
 * Get primary logo with fallback
 */
export function getPrimaryLogo(): string {
  return LOGOS.main
}

/**
 * Get logo with fallback chain
 */
export function getLogoWithFallback(fallbackIndex: number = 0): string {
  return fallbackIndex === 0 ? LOGOS.main : LOGOS.fallback[fallbackIndex - 1] || LOGOS.main
}

/**
 * All logo sources for error handling
 */
export function getAllLogoSources(): string[] {
  return [LOGOS.main, ...LOGOS.fallback]
}
