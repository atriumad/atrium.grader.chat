"use client"

import * as React from "react"

import { useInView } from "./use-in-view"

// Fade + rise when the block scrolls into view. Server HTML is fully visible; the hidden starting
// state is only applied after hydration to blocks that are below the fold, so nothing is lost
// without JavaScript and nothing flashes for blocks already on screen.
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: { children: React.ReactNode; className?: string; delay?: number; as?: "div" | "li" | "section" }) {
  const [ref, seen] = useInView<HTMLElement>(0.12)
  const [armed, setArmed] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.92) setArmed(true)
  }, [ref])
  const cls = armed ? `reveal-on-scroll ${seen ? "is-in" : ""}` : ""
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`${cls} ${className}`} style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      {children}
    </Tag>
  )
}
