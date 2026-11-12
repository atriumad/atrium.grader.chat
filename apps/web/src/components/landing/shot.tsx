import Image from "next/image"

// A literal screenshot of the product (captured from the real report with sample data, at 2x), in a
// plain frame. Desktop and phone each get their own capture, so the phone one is the real stacked
// layout and stays legible. `fade` crops the bottom into the page, as if the report keeps going.
type Img = { src: string; w: number; h: number }

export const SHOTS = {
  dashboard: { desktop: { src: "/landing/shot-dashboard.jpg", w: 2000, h: 1402 }, mobile: { src: "/landing/shot-dashboard-mobile.jpg", w: 1170, h: 3015 } },
  plan: { desktop: { src: "/landing/shot-plan.jpg", w: 2000, h: 893 }, mobile: { src: "/landing/shot-plan-mobile.jpg", w: 1170, h: 2330 } },
} satisfies Record<string, { desktop: Img; mobile: Img }>

const FADE = "linear-gradient(to bottom, #000 62%, transparent 100%)"

export function Shot({ shot, alt, fade = false, priority = false }: { shot: keyof typeof SHOTS; alt: string; fade?: boolean; priority?: boolean }) {
  const { desktop, mobile } = SHOTS[shot]
  return (
    <figure className="mx-auto w-full max-w-[1000px]">
      <div
        className={`relative overflow-hidden rounded-[var(--radius-card-sm)] border bg-card shadow-[var(--shadow-rest)] ${fade ? "max-h-[440px] sm:max-h-[600px]" : ""}`}
        style={fade ? { maskImage: FADE, WebkitMaskImage: FADE } : undefined}
      >
        <Image src={desktop.src} width={desktop.w} height={desktop.h} alt={alt} priority={priority} sizes="(min-width: 1000px) 1000px, 100vw" className="hidden h-auto w-full sm:block" />
        <Image src={mobile.src} width={mobile.w} height={mobile.h} alt={alt} priority={priority} sizes="100vw" className="block h-auto w-full sm:hidden" />
      </div>
    </figure>
  )
}
