import { Card, PageHeader } from "@/components/admin/ui"

const ENV = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Project URL (Project Settings → API)"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Anon / publishable key (login only)"],
  ["SUPABASE_SERVICE_ROLE_KEY", "service_role key. Secret: server only, never in the browser"],
  ["ADMIN_EMAILS", "Emails allowed into the panel, comma-separated"],
] as const

export function SetupGuide({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <PageHeader title="The panel needs setup">Connect a Supabase project to store the rules, the content and the metrics.</PageHeader>
      <Card title="1. Environment variables" hint="In apps/web/.env.local for development and in Vercel for production.">
        <ul className="flex flex-col gap-2 text-sm">
          {ENV.map(([k, d]) => (
            <li key={k} className="flex flex-col gap-0.5">
              <code className={`w-fit rounded bg-muted px-1.5 py-0.5 text-xs ${missing.includes(k) ? "text-destructive" : ""}`}>
                {k}
                {missing.includes(k) ? " · missing" : ""}
              </code>
              <span className="text-muted-foreground">{d}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="2. Database" hint="Run supabase/migrations/0001_admin.sql in the Supabase SQL Editor (or with supabase db push).">
        <p className="text-sm text-muted-foreground">Creates the configuration, knowledge, analysis and event tables, and the search function.</p>
      </Card>
      <Card title="3. Login" hint="Authentication → URL Configuration in Supabase.">
        <p className="text-sm text-muted-foreground text-pretty">
          Add your domain as the Site URL and <code className="rounded bg-muted px-1 text-xs">/auth/callback</code> in Redirect URLs (for example{" "}
          <code className="rounded bg-muted px-1 text-xs">http://localhost:3000/auth/callback</code> in development). Sign-in is done with a link sent by email.
        </p>
      </Card>
    </main>
  )
}

export function missingEnv(): string[] {
  return ENV.map(([k]) => k).filter((k) => !process.env[k])
}
