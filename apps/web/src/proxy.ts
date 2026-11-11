import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { isAdminEmail } from "@/lib/supabase/allowlist"

// Keeps the admin session cookie fresh. Only runs on admin and auth paths.
export async function proxy(request: NextRequest) {
  // Safety net: if Supabase falls back to the Site URL (the callback is not in its Redirect
  // URLs list), the magic link lands on "/?code=...". Forward it to the real callback.
  if (request.nextUrl.pathname === "/") {
    const code = request.nextUrl.searchParams.get("code")
    if (!code) return NextResponse.next()
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
    const to = new URL(`/auth/callback?code=${encodeURIComponent(code)}`, host ? `${request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}` : request.url)
    return NextResponse.redirect(to)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) request.cookies.set(c.name, c.value)
        response = NextResponse.next({ request })
        for (const c of list) response.cookies.set(c.name, c.value, c.options)
      },
    },
  })
  const { data } = await supabase.auth.getUser()

  // Everything under the admin area, except the sign-in flow, needs an allowlisted admin.
  const path = request.nextUrl.pathname
  const inAdmin = path.startsWith("/admin") || path.startsWith("/api/admin")
  const open = path === "/admin/login" || path === "/api/admin/login" || path === "/api/admin/logout"
  if (inAdmin && !open && !isAdminEmail(data.user?.email)) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    return NextResponse.redirect(new URL("/admin/login", request.url))
  }
  return response
}

export const config = { matcher: ["/", "/admin/:path*", "/api/admin/:path*", "/auth/:path*"] }
