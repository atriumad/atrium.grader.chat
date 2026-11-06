"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

const ITEMS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/scoring", label: "Puntaje" },
  { href: "/admin/agentes", label: "Agentes" },
  { href: "/admin/conocimiento", label: "Conocimiento" },
]

export function AdminNav({ email }: { email: string }) {
  const path = usePathname()
  const router = useRouter()
  return (
    <nav aria-label="Panel" className="flex shrink-0 flex-col gap-3 py-4 md:sticky md:top-0 md:h-svh md:w-48 md:py-6">
      <Link href="/admin" className="font-display text-lg leading-none">
        Atrium <span className="text-sm text-muted-foreground">panel</span>
      </Link>
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 md:flex-col md:overflow-visible">
        {ITEMS.map((i) => {
          const on = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href)
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={on ? "page" : undefined}
                className={`block rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors ${on ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
              >
                {i.label}
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto hidden flex-col gap-2 md:flex">
        <span className="truncate text-xs text-muted-foreground" title={email}>{email}</span>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" })
            router.push("/admin/login")
            router.refresh()
          }}
        >
          Salir
        </Button>
      </div>
    </nav>
  )
}
