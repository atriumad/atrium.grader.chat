"use client"

import * as React from "react"
import "leaflet/dist/leaflet.css"

import { TIER_LABEL, TIER_VAR, fmt, type Tier } from "@/lib/metrics"

export type MapPoint = {
  key: string
  rank: number
  isYou: boolean
  name: string
  lat: number
  lng: number
  score: number | null
  tier: Tier
  rating: number | null
  reviews: number | null
  followers: number | null
  engagement: number | null
}

// OpenStreetMap standard tiles (no API key). Fine for light/personal use; the OSM
// tile policy does not allow heavy or commercial traffic, so switch to a keyed
// provider (MapTiler, Stadia, etc.) before serving this to customers.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

// Pin diameter grows with Instagram audience (log scale), so reach reads at a glance.
function pinSize(p: MapPoint): number {
  if (p.isYou) return 40
  if (!p.followers || p.followers <= 0) return 26
  const t = Math.max(0, Math.min(1, (Math.log10(p.followers) - 3) / 2))
  return Math.round(26 + t * 10)
}

function popupHtml(p: MapPoint, distanceM: number | null): string {
  const color = TIER_VAR[p.tier]
  const lines = [
    p.rating ? `★ ${fmt.rating(p.rating)}${p.reviews ? ` (${p.reviews.toLocaleString("es")} reseñas)` : ""}` : null,
    p.followers ? `${fmt.followers(p.followers)} seguidores` : null,
    p.engagement !== null ? `${fmt.engagement(p.engagement)} de engagement` : null,
    distanceM !== null ? `A ${distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1000).toFixed(1)} km`} de tu negocio` : null,
  ].filter(Boolean)
  return `<div style="min-width:170px">
    <strong style="font-size:14px">${esc(p.name)}</strong>${p.isYou ? ' <span style="opacity:.6">(tú)</span>' : ""}
    <div style="display:flex;align-items:center;gap:6px;margin:6px 0 4px">
      <span style="width:10px;height:10px;border-radius:9999px;background:${color}"></span>
      <span style="font-weight:600">${p.score === null ? "Sin puntaje" : `Puntaje ${p.score}`}</span>
      <span style="opacity:.65">· ${TIER_LABEL[p.tier]}</span>
    </div>
    ${lines.map((l) => `<div style="opacity:.8">${esc(l as string)}</div>`).join("")}
  </div>`
}

export function CompetitorMap({
  points,
  radiusMeters,
  activeKey,
  onActive,
}: {
  points: MapPoint[]
  radiusMeters: number
  activeKey: string | null
  onActive: (key: string | null) => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const markers = React.useRef(new Map<string, HTMLElement>())
  const activeRef = React.useRef<string | null>(activeKey)
  const onActiveRef = React.useRef(onActive)

  React.useEffect(() => {
    onActiveRef.current = onActive
  }, [onActive])

  const applyActive = React.useCallback(() => {
    markers.current.forEach((el, key) => el.classList.toggle("is-active", key === activeRef.current))
  }, [])

  React.useEffect(() => {
    activeRef.current = activeKey
    applyActive()
  }, [activeKey, applyActive])

  React.useEffect(() => {
    const el = ref.current
    if (!el || points.length === 0) return
    let disposed = false
    let cleanup: (() => void) | undefined
    const store = markers.current

    ;(async () => {
      const L = (await import("leaflet")).default
      if (disposed || !el) return

      const you = points.find((p) => p.isYou) ?? points[0]
      const youLL = L.latLng(you.lat, you.lng)
      const map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true })
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map)

      // One faint ring marks the search radius around the business.
      L.circle(youLL, {
        radius: radiusMeters,
        color: "oklch(0.52 0.155 40)",
        weight: 1,
        opacity: 0.4,
        fill: false,
        dashArray: "3 6",
        interactive: false,
      }).addTo(map)

      points.forEach((p, i) => {
        const s = pinSize(p)
        const html = `<span class="pin-wrap" style="--s:${s}px;--tier:${TIER_VAR[p.tier]};--d:${i * 90}ms">
          <span class="pin-halo"></span><span class="pin-ring"></span>
          <span class="map-pin${p.isYou ? " map-pin--you" : ""}">${p.isYou ? "Tú" : p.rank}</span>
        </span>`
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: "", html, iconSize: [s, s], iconAnchor: [s / 2, s / 2], popupAnchor: [0, -s / 2 - 4] }),
          zIndexOffset: p.isYou ? 1000 : (p.score ?? 0),
          keyboard: false,
          title: p.name,
        }).addTo(map)
        const distance = p.isYou ? null : youLL.distanceTo([p.lat, p.lng])
        marker.bindPopup(popupHtml(p, distance), { closeButton: false, offset: [0, 0] })
        marker.bindTooltip(`<strong>${esc(p.name)}</strong>${p.score !== null ? ` · ${p.score}` : ""}`, {
          direction: "top",
          offset: [0, -s / 2 - 6],
          className: "map-tip",
        })
        marker.on("mouseover", () => onActiveRef.current(p.key))
        marker.on("mouseout", () => onActiveRef.current(null))
        const wrap = marker.getElement()?.querySelector<HTMLElement>(".pin-wrap")
        if (wrap) store.set(p.key, wrap)
      })
      applyActive()

      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])).pad(0.3)
      const fit = () => map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16, animate: false })
      fit()
      requestAnimationFrame(() => {
        map.invalidateSize()
        fit()
      })
      const ro = new ResizeObserver(() => {
        map.invalidateSize()
        fit()
      })
      ro.observe(el)

      cleanup = () => {
        ro.disconnect()
        store.clear()
        map.remove()
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [points, radiusMeters, applyActive])

  return (
    <div className="relative isolate z-0">
      <div
        ref={ref}
        role="img"
        aria-label={`Mapa con ${points.length} negocios: el tuyo y ${points.length - 1} competidores cercanos, con su puntaje`}
        className="h-80 w-full bg-muted sm:h-[26rem]"
      />
      <ul
        aria-label="Leyenda del puntaje"
        className="absolute bottom-6 left-3 z-[500] flex items-center gap-2.5 rounded-full border bg-card/95 px-2.5 py-1 text-[0.6875rem] shadow-sm"
      >
        {(["good", "medium", "low", "none"] as Tier[]).map((t) => (
          <li key={t} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: TIER_VAR[t] }} aria-hidden="true" />
            <span>{t === "none" ? "Sin datos" : TIER_LABEL[t]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
