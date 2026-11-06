// Same palette as the web app (paper, ink, terracotta, score tiers).
// The web tokens are oklch; these are sRGB approximations, so tweak by eye on device.

export const colors = {
  background: "#FBF6EC",
  card: "#FDFBF6",
  foreground: "#2B2420",
  muted: "#F0E9DC",
  mutedForeground: "#6B6259",
  border: "#E3DBCD",
  brand: "#B4492B",
  positive: "#2F7550",
  destructive: "#B3261E",
  tier: {
    good: "#3EA05F",
    medium: "#E8A23A",
    low: "#D9483B",
    none: "#B9B5AC",
  },
} as const

export const fonts = {
  display: "Fraunces_600SemiBold",
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
} as const

export const radius = { md: 12, lg: 16, pill: 999 } as const

// Soft depth for cards: an offset and a blur, not a hard edge.
export const shadow = {
  shadowColor: "#2B2420",
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 2,
} as const

// Numbers line up in columns and do not wobble while they animate.
export const tabular = { fontVariant: ["tabular-nums"] as ["tabular-nums"] }
