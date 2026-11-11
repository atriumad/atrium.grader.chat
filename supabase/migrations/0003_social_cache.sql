-- Shared cache of paid social lookups (Instagram, Facebook, TikTok profiles and handle searches),
-- so the same account read for one client is not paid for again for the next one.
-- Apply in the Supabase SQL editor. Server-only access (RLS on, no policies).

create table if not exists social_cache (
  key text primary key,          -- e.g. 'ig:katzsdeli', 'fb:https://www.facebook.com/KatzsDeli'
  value jsonb not null,          -- { v: <result> }; v may be null for "looked up, nothing there"
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists social_cache_expires on social_cache (expires_at);
alter table social_cache enable row level security;
