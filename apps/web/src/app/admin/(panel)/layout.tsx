import { Suspense } from "react"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { AdminNav } from "@/components/admin/nav"
import { missingEnv, SetupGuide } from "@/components/admin/setup-guide"
import { adminEmails, createAuthClient, getAdmin } from "@/lib/supabase/auth"
import { authConfigured, supabaseConfigured } from "@/lib/supabase/server"

// Session and database reads happen at request time, so they live inside a Suspense boundary
// (required by cacheComponents); the static shell is just the loading state.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Cargando…</p>}>
      <Guard>{children}</Guard>
    </Suspense>
  )
}

async function Guard({ children }: { children: React.ReactNode }) {
  await connection()
  if (!authConfigured() || !supabaseConfigured() || !adminEmails().length) return <SetupGuide missing={missingEnv()} />
  const admin = await getAdmin()
  if (!admin) {
    // Signed in but not on the allowlist is shown a dead end instead of a redirect loop.
    const { data } = await (await createAuthClient()).auth.getUser()
    if (data.user) {
      return (
        <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-2 px-4">
          <h1 className="font-display text-2xl">Sin acceso</h1>
          <p className="text-sm text-muted-foreground">Tu correo no está en la lista de administradores.</p>
        </main>
      )
    }
    redirect("/admin/login")
  }
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-0 px-4 sm:px-6 md:flex-row md:gap-8">
      <AdminNav email={admin.email} />
      <main className="min-w-0 flex-1 pb-16 md:pt-6">{children}</main>
    </div>
  )
}
