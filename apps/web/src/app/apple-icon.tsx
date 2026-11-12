import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f4ef" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 124, height: 124, borderRadius: 9999, background: "#1d1b18", border: "6px solid #d9852b", color: "#fff", fontSize: 72, fontWeight: 700 }}>
          A
        </div>
      </div>
    ),
    size
  )
}
