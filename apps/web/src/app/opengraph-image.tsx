import { ImageResponse } from "next/og"

import { SITE } from "@/lib/site"

export const alt = `${SITE.name}: ${SITE.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Social preview card: a score halo like the one on the map pins, with the promise next to it.
export default function OpengraphImage() {
  const ring = "#d9852b"
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 90px",
          background: "#f6f4ef",
          color: "#1d1b18",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 40 }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, color: "#6b665d" }}>ATRIUM GRADER</div>
          <div style={{ display: "flex", fontSize: 74, lineHeight: 1.08, marginTop: 28, fontWeight: 700 }}>
            How does your restaurant stack up?
          </div>
          <div style={{ display: "flex", fontSize: 32, lineHeight: 1.35, marginTop: 28, color: "#6b665d" }}>
            Google reputation and social media, compared with the businesses around you. Free, in about 40 seconds.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 330, height: 330, borderRadius: 9999, background: "rgba(217,133,43,0.16)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 250, height: 250, borderRadius: 9999, background: "rgba(217,133,43,0.3)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 176,
                height: 176,
                borderRadius: 9999,
                background: "#1d1b18",
                border: `6px solid ${ring}`,
                color: "#fff",
                fontSize: 88,
                fontWeight: 700,
              }}
            >
              72
            </div>
          </div>
        </div>
      </div>
    ),
    size
  )
}
