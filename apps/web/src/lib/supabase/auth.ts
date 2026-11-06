import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { authConfigured } from "@/lib/supabase/server"

// Cookie-based session client (anon key) used for the admin login only.
export async function createAuthClient() {
  const store = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const c of list) store.set(c.name, c.value, c.options)
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  })
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().includes(email.trim().toLowerCase())
}

export type AdminUser = { email: string }

// The signed-in admin, or null. Verifies the token with Supabase (getUser), not just the cookie.
export async function getAdmin(): Promise<AdminUser | null> {
  if (!authConfigured()) return null
  const supabase = await createAuthClient()
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email
  return email && isAdminEmail(email) ? { email: email.toLowerCase() } : null
}

export async function requireAdmin(): Promise<{ admin: AdminUser } | { error: Response }> {
  const admin = await getAdmin()
  return admin ? { admin } : { error: Response.json({ error: "No autorizado." }, { status: 401 }) }
}
