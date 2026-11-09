-- Log of every external lookup (ScrapeCreators calls, website social-link discovery and
-- what was parsed from them), so the admin panel can show what data each request returned.
-- Apply in the Supabase SQL editor. Server-only access (RLS on, no policies).

create table if not exists lookup_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null,            -- 'scrape' | 'links' | 'network'
  target text,                   -- handle, url or query that was looked up
  request jsonb not null default '{}',
  ok boolean not null,
  status int,                    -- HTTP status when there was one
  duration_ms int,
  summary jsonb,                 -- compact, parsed result (or the reason it was discarded)
  response text,                 -- truncated raw response / error body
  error text
);
create index if not exists lookup_logs_created on lookup_logs (created_at desc);
create index if not exists lookup_logs_kind_created on lookup_logs (kind, created_at desc);
alter table lookup_logs enable row level security;
