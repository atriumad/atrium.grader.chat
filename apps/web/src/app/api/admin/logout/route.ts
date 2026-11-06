import { createAuthClient } from "@/lib/supabase/auth"
import { authConfigured } from "@/lib/supabase/server"

export async function POST() {
  if (authConfigured()) await (await createAuthClient()).auth.signOut()
  return Response.json({ ok: true })
}
