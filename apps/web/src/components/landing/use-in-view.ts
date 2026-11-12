"use client"

import * as React from "react"

// True once the element has scrolled into view (and stays true). Without IntersectionObserver the
// element counts as visible, so content is never hidden for good.
export function useInView<T extends Element>(threshold = 0.15): [React.RefObject<T | null>, boolean] {
  const ref = React.useRef<T | null>(null)
  const [seen, setSeen] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold, rootMargin: "0px 0px -7% 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, seen]
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
