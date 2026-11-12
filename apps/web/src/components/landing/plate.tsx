import Image from "next/image"

// The one brand image: a plate seen from above, wearing the score halo. Generated illustration in
// the design-system palette. Its edges fade out with a mask, so it melts into the page ground.
const MASK = "radial-gradient(closest-side, #000 76%, transparent 100%)"

export function Plate({ tone = "light", className = "", priority = false }: { tone?: "light" | "ink"; className?: string; priority?: boolean }) {
  return (
    <Image
      src={tone === "ink" ? "/landing/plate-ink.png" : "/landing/plate-light.png"}
      alt=""
      width={1024}
      height={1024}
      priority={priority}
      sizes="(min-width: 1024px) 340px, 260px"
      className={`pointer-events-none select-none ${className}`}
      style={{ maskImage: MASK, WebkitMaskImage: MASK }}
    />
  )
}
