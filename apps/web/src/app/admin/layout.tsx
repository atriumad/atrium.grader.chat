import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Atrium · Panel",
  robots: { index: false, follow: false },
}

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-background">{children}</div>
}
