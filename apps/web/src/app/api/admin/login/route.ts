import { createAuthClient, isAdminEmail } from "@/lib/supabase/auth"
import { authConfigured } from "@/lib/supabase/server"
import { allow, clientKey } from "@/lib/rate-limit"
import { originOf } from "@/lib/supabase/origin"

// Sends a magic link, but only to allowlisted admin emails. The reply is the same either
// way, so the allowlist cannot be probed.
export async function POST(req: Request) {
  if (!authConfigured()) return Response.json({ error: "El panel no está configurado todavía." }, { status: 503 })
  if (!allow(`admin-login:${clientKey(req)}`, 5, 10 * 60_000)) {
    return Response.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 })
  }
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : ""
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ error: "Correo no válido." }, { status: 400 })
  if (isAdminEmail(email)) {
    const origin = originOf(req)
    const supabase = await createAuthClient()
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } })
    if (error) console.error("[admin/login] signInWithOtp failed:", error.status, error.code, error.message)
    if (error) return Response.json({ error: "No se pudo enviar el enlace. Intenta de nuevo en unos minutos." }, { status: 502 })
  }
  return Response.json({ ok: true })
}
