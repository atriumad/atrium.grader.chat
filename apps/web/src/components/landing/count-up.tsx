"use client"

import * as React from "react"

import { prefersReducedMotion, useInView } from "./use-in-view"

// Counts from 0 to `value` once, when it is 60% visible (design system: 1300ms, ease-out cubic).
// The server HTML already holds the final number.
export function CountUp({ value, className, duration = 1300 }: { value: number; className?: string; duration?: number }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.6)
  const [n, setN] = React.useState(value)
  React.useEffect(() => {
    if (!seen || prefersReducedMotion()) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    setN(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seen, value, duration])
  return (
    <span ref={ref} className={`tnum ${className ?? ""}`}>
      {n}
    </span>
  )
}
