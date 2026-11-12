"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { focusSearch } from "./focus-search"

// Header button that appears once the hero has scrolled away, so the next step is always one tap
// from anywhere on the page.
export function ScrollCta() {
  const [show, setShow] = React.useState(false)
  React.useEffect(() => {
    const hero = document.getElementById("search")
    if (!hero || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { threshold: 0 })
    io.observe(hero)
    return () => io.disconnect()
  }, [])
  return (
    <Button
      type="button"
      size="sm"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      onClick={focusSearch}
      className={`transition-[opacity,transform] duration-200 ${show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}
    >
      Get my free score
    </Button>
  )
}
