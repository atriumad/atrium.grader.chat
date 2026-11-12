"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"

// Takes the visitor back to the search box and puts the cursor in it.
export function focusSearch() {
  const box = document.getElementById("search")
  box?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })
  window.setTimeout(() => box?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }), 350)
}

export function FocusSearchButton({ children, className, size = "lg" }: { children: React.ReactNode; className?: string; size?: "sm" | "lg" }) {
  return (
    <Button type="button" size={size} className={className} onClick={focusSearch}>
      {children}
    </Button>
  )
}
