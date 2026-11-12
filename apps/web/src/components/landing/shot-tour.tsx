"use client"

import * as React from "react"
import Image from "next/image"

import { prefersReducedMotion, useInView } from "./use-in-view"

// A guided look at a real screenshot of the product. A "camera" zooms into one important part of
// the report at a time while the rest fades back, then moves to the next. Pills underneath name each
// part; picking one stops the tour. Regions are fractions (0-1) of the captured image. Phones get a
// still, framed capture of the stacked layout; reduced motion gets the still image too.

type Region = { label: string; x: number; y: number; w: number; h: number }
type Tour = { src: string; w: number; h: number; mobile: { src: string; w: number; h: number }; viewAspect: number; steps: Region[] }

export const TOURS = {
  dashboard: {
    src: "/landing/shot-dashboard.jpg",
    w: 2000,
    h: 1402,
    mobile: { src: "/landing/shot-dashboard-mobile.jpg", w: 1170, h: 3015 },
    viewAspect: 1.6,
    steps: [
      { label: "Your score", x: 0.012, y: 0.077, w: 0.41, h: 0.216 },
      { label: "Who is ahead", x: 0.012, y: 0.31, w: 0.488, h: 0.238 },
      { label: "The map", x: 0.012, y: 0.572, w: 0.488, h: 0.404 },
      { label: "What drags you down", x: 0.508, y: 0.31, w: 0.488, h: 0.665 },
    ],
  },
  plan: {
    src: "/landing/shot-plan.jpg",
    w: 2000,
    h: 893,
    mobile: { src: "/landing/shot-plan-mobile.jpg", w: 1170, h: 2330 },
    viewAspect: 2,
    steps: [
      { label: "The diagnosis", x: 0.012, y: 0.04, w: 0.985, h: 0.34 },
      { label: "3 actions", x: 0.028, y: 0.425, w: 0.953, h: 0.27 },
      { label: "Next step", x: 0.012, y: 0.76, w: 0.985, h: 0.215 },
    ],
  },
} satisfies Record<string, Tour>

const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)"
const MS = 900
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// Where to place and scale the image (origin top-left) so that `r` fills the view.
function camera(t: Tour, r?: Region) {
  const imgRatio = t.w / t.h // image width / height
  const hc = 1 / t.viewAspect // view height as a fraction of its width
  const hi = 1 / imgRatio // image height as a fraction of its width
  const minS = Math.max(1, hc / hi)
  const cx = r ? r.x + r.w / 2 : 0.5
  const cy = r ? r.y + r.h / 2 : 0.46
  const s = r ? clamp(Math.min(0.9 / r.w, (0.86 * hc) / (r.h * hi)), minS, 1.6) : Math.max(minS, 1.1)
  const tx = clamp(0.5 - cx * s, 1 - s, 0) * 100
  const ty = clamp(hc / 2 / hi - cy * s, hc / hi - s, 0) * 100
  return { s, tx, ty }
}

export function ShotTour({ tour, alt, priority = false }: { tour: keyof typeof TOURS; alt: string; priority?: boolean }) {
  const t = TOURS[tour]
  const [ref, seen] = useInView<HTMLDivElement>(0.35)
  const [active, setActive] = React.useState(-1) // -1 = overview
  const [auto, setAuto] = React.useState(true)
  const [still, setStill] = React.useState(false)

  React.useEffect(() => setStill(prefersReducedMotion()), [])

  React.useEffect(() => {
    if (!seen || !auto || still) return
    let i = -1
    const first = window.setTimeout(() => {
      i = 0
      setActive(0)
    }, 700)
    const id = window.setInterval(() => {
      if (i < 0) return
      i = (i + 1) % t.steps.length
      setActive(i)
    }, 3800)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [seen, auto, still, t.steps.length])

  const r = active >= 0 && !still ? t.steps[active] : undefined
  const cam = camera(t, r)
  const pad = 0.006 // a little air around the highlighted part

  return (
    <div ref={ref} className="mx-auto w-full max-w-[1040px]">
      {/* desktop: framed, guided */}
      <div className="hidden rounded-[var(--radius-card)] border bg-off-white p-6 sm:block lg:p-8">
        <div className="relative overflow-hidden rounded-[var(--radius-card-sm)] border bg-card shadow-[var(--shadow-rest)]" style={{ aspectRatio: String(t.viewAspect) }}>
          <div
            className="absolute top-0 left-0 w-full origin-top-left"
            style={{ transform: still ? "none" : `translate(${cam.tx}%, ${cam.ty}%) scale(${cam.s})`, transition: `transform ${MS}ms ${EASE}` }}
          >
            <Image src={t.src} width={t.w} height={t.h} alt={alt} priority={priority} sizes="(min-width: 1040px) 1000px, 92vw" className="block h-auto w-full" />
            {still ? null : (
              <span
                aria-hidden="true"
                className="absolute rounded-[1.1%/1.6%] outline-2 outline-[var(--green-fill)]"
                style={{
                  left: `${((r ? r.x - pad : 0) * 100).toFixed(2)}%`,
                  top: `${((r ? r.y - pad * 1.4 : 0) * 100).toFixed(2)}%`,
                  width: `${((r ? r.w + pad * 2 : 1) * 100).toFixed(2)}%`,
                  height: `${((r ? r.h + pad * 2.8 : 1) * 100).toFixed(2)}%`,
                  boxShadow: r ? "0 0 0 100vmax color-mix(in srgb, var(--cream) 78%, transparent)" : "none",
                  outlineColor: r ? "var(--green-fill)" : "transparent",
                  transition: `left ${MS}ms ${EASE}, top ${MS}ms ${EASE}, width ${MS}ms ${EASE}, height ${MS}ms ${EASE}, box-shadow ${MS}ms ${EASE}, outline-color 400ms`,
                }}
              />
            )}
          </div>
        </div>
        {still ? null : (
          <div role="group" aria-label="Parts of the report" className="mt-5 flex flex-wrap justify-center gap-2">
            {t.steps.map((s, i) => (
              <button
                key={s.label}
                type="button"
                aria-pressed={i === active}
                onClick={() => {
                  setAuto(false)
                  setActive(i === active ? -1 : i)
                }}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors duration-200 ${i === active ? "border-ink bg-ink text-lime" : "bg-card text-body hover:bg-track-soft"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* phone: still, framed capture of the real stacked layout */}
      <div className="rounded-[var(--radius-card)] border bg-off-white p-3 sm:hidden">
        <div className="relative max-h-[460px] overflow-hidden rounded-[var(--radius-card-sm)] border bg-card shadow-[var(--shadow-rest)]" style={{ maskImage: "linear-gradient(to bottom, #000 70%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, #000 70%, transparent)" }}>
          <Image src={t.mobile.src} width={t.mobile.w} height={t.mobile.h} alt={alt} priority={priority} sizes="100vw" className="block h-auto w-full" />
        </div>
      </div>
    </div>
  )
}
