import { Card, PageHeader } from "@/components/admin/ui"

const ENV = [
  ["NEXT_PUBLIC_SUPABASE_URL", "URL del proyecto (Project Settings → API)"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Clave anon / publishable (solo para el login)"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Clave service_role. Secreta: solo en el servidor, nunca en el navegador"],
  ["ADMIN_EMAILS", "Correos que pueden entrar al panel, separados por comas"],
] as const

export function SetupGuide({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <PageHeader title="Falta configurar el panel">Conecta un proyecto de Supabase para guardar las reglas, el contenido y las métricas.</PageHeader>
      <Card title="1. Variables de entorno" hint="En apps/web/.env.local para desarrollo y en Vercel para producción.">
        <ul className="flex flex-col gap-2 text-sm">
          {ENV.map(([k, d]) => (
            <li key={k} className="flex flex-col gap-0.5">
              <code className={`w-fit rounded bg-muted px-1.5 py-0.5 text-xs ${missing.includes(k) ? "text-destructive" : ""}`}>
                {k}
                {missing.includes(k) ? " · falta" : ""}
              </code>
              <span className="text-muted-foreground">{d}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="2. Base de datos" hint="Ejecuta supabase/migrations/0001_admin.sql en el SQL Editor de Supabase (o con supabase db push).">
        <p className="text-sm text-muted-foreground">Crea las tablas de configuración, conocimiento, análisis y eventos, y la función de búsqueda.</p>
      </Card>
      <Card title="3. Login" hint="Authentication → URL Configuration en Supabase.">
        <p className="text-sm text-muted-foreground text-pretty">
          Añade tu dominio como Site URL y <code className="rounded bg-muted px-1 text-xs">/auth/callback</code> en Redirect URLs (por ejemplo{" "}
          <code className="rounded bg-muted px-1 text-xs">http://localhost:3000/auth/callback</code> en desarrollo). El acceso es con un enlace al correo.
        </p>
      </Card>
    </main>
  )
}

export function missingEnv(): string[] {
  return ENV.map(([k]) => k).filter((k) => !process.env[k])
}
