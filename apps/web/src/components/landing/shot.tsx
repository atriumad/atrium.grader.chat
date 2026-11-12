import Image from "next/image"

// Literal screenshots of the product (captured from the real report with fictional sample data, at
// 2x). Desktop and phone each have their own capture, so the phone shows the real stacked layout.
//  - bleed:  the hero treatment. The capture sits in a padded corner and is larger than the column,
//            so it runs off to the right and down, fading out on both sides.
//  - framed: a padded frame around the whole capture.
type Img = { src: string; w: number; h: number }

export const SHOTS = {
  dashboard: { desktop: { src: "/landing/shot-dashboard.jpg", w: 2000, h: 1402 }, mobile: { src: "/landing/shot-dashboard-mobile.jpg", w: 1170, h: 3015 } },
  plan: { desktop: { src: "/landing/shot-plan.jpg", w: 2000, h: 893 }, mobile: { src: "/landing/shot-plan-mobile.jpg", w: 1170, h: 2330 } },
} satisfies Record<string, { desktop: Img; mobile: Img }>

const FADE_Y = "linear-gradient(to bottom, #000 56%, transparent 100%)"
const FADE_XY = `${FADE_Y}, linear-gradient(to right, #000 56%, transparent 90%)`

export function Shot({ shot, alt, variant = "framed", crop, priority = false }: { shot: keyof typeof SHOTS; alt: string; variant?: "bleed" | "framed"; crop?: number; priority?: boolean }) {
  const { desktop, mobile } = SHOTS[shot]
  const bleed = variant === "bleed"
  return (
    <figure className="mx-auto w-full max-w-[1000px]">
      {/* desktop */}
      {bleed ? (
        <div
          className="hidden w-[132%] overflow-hidden rounded-tl-[var(--radius-card)] border-t border-l bg-off-white pt-7 pl-7 sm:block lg:pt-9 lg:pl-9"
          style={{ maxHeight: crop ?? 600, maskImage: FADE_XY, WebkitMaskImage: FADE_XY, maskComposite: "intersect", WebkitMaskComposite: "source-in" } as React.CSSProperties}
        >
          <div className="rounded-tl-[var(--radius-card-sm)] border-t border-l bg-card shadow-[var(--shadow-rest)]">
            <Image src={desktop.src} width={desktop.w} height={desktop.h} alt={alt} priority={priority} sizes="(min-width: 1000px) 1320px, 132vw" className="block h-auto w-full" />
          </div>
        </div>
      ) : (
        <div className="hidden rounded-[var(--radius-card)] border bg-off-white p-6 sm:block lg:p-9">
          <div className="overflow-hidden rounded-[var(--radius-card-sm)] border bg-card shadow-[var(--shadow-rest)]">
            <Image src={desktop.src} width={desktop.w} height={desktop.h} alt={alt} sizes="(min-width: 1000px) 920px, 92vw" className="block h-auto w-full" />
          </div>
        </div>
      )}

      {/* phone */}
      <div className="rounded-[var(--radius-card)] border bg-off-white p-3 sm:hidden">
        <div
          className="relative max-h-[460px] overflow-hidden rounded-[var(--radius-card-sm)] border bg-card shadow-[var(--shadow-rest)]"
          style={bleed ? { maskImage: FADE_Y, WebkitMaskImage: FADE_Y } : undefined}
        >
          <Image src={mobile.src} width={mobile.w} height={mobile.h} alt={alt} priority={priority} sizes="100vw" className="block h-auto w-full" />
        </div>
      </div>
    </figure>
  )
}
