import { Suspense } from "react"

import { LoginForm } from "@/components/admin/login-form"
import { missingEnv, SetupGuide } from "@/components/admin/setup-guide"
import { authConfigured } from "@/lib/supabase/server"

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  )
}

async function LoginContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!authConfigured()) return <SetupGuide missing={missingEnv()} />
  const { error } = await searchParams
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 px-4">
      <div className="flex flex-col gap-1.5">
        <span className="font-display text-lg leading-none">Atrium</span>
        <h1 className="font-display text-3xl leading-tight">Panel administrativo</h1>
        <p className="text-sm text-muted-foreground">Te enviamos un enlace al correo para entrar. Solo funciona con correos autorizados.</p>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">El enlace no es válido o venció. Pide uno nuevo.</p> : null}
      <LoginForm />
    </main>
  )
}
