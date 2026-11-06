import { NextResponse } from "next/server"

import { createAuthClient } from "@/lib/supabase/auth"
import { authConfigured } from "@/lib/supabase/server"

// Magic-link landing: swaps the code for a session cookie, then goes to the panel.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  if (code && authConfigured()) {
    const { error } = await (await createAuthClient()).auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL("/admin", url.origin))
  }
  return NextResponse.redirect(new URL("/admin/login?error=link", url.origin))
}
