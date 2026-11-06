import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Keeps the admin session cookie fresh. Only runs on admin and auth paths.
export async function proxy(request: NextRequest) {
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
  await supabase.auth.getUser()
  return response
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*", "/auth/:path*"] }
