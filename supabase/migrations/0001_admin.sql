-- Atrium admin panel: config, knowledge base, analysis log and usage events.
-- Apply in the Supabase SQL editor (or `supabase db push`). All access goes through
-- the server with the service role key; RLS is on with no policies, so the anon
-- key cannot read or write anything here.

create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists config_history (
  id bigint generated always as identity primary key,
  key text not null,
  value jsonb not null,
  note text,
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists config_history_key_created on config_history (key, created_at desc);

create table if not exists knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'note',
  source_name text,
  content text not null,
  tags text[] not null default '{}',
  pinned boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists knowledge_chunks (
  id bigint generated always as identity primary key,
  doc_id uuid not null references knowledge_docs (id) on delete cascade,
  idx int not null,
  content text not null,
  fts tsvector generated always as (to_tsvector('spanish', content) || to_tsvector('english', content)) stored
);
create index if not exists knowledge_chunks_fts on knowledge_chunks using gin (fts);
create index if not exists knowledge_chunks_doc on knowledge_chunks (doc_id, idx);

-- Any-term match (OR) ranked by relevance: agents ask natural-language questions, and
-- requiring every word would miss "cuánto cuesta" against a chunk that says "Precios desde...".
create or replace function search_knowledge(q text, n int default 5)
returns table (doc_id uuid, title text, content text, rank real)
language sql stable as $$
  with terms as (
    select string_agg(w, ' | ') as expr
    from (
      select distinct regexp_replace(lower(w), '[^[:alnum:]áéíóúñü]', '', 'g') as w
      from regexp_split_to_table(left(q, 300), '\s+') as w
    ) t
    where length(w) > 2
  ),
  query as (
    select to_tsquery('spanish', expr) || to_tsquery('english', expr) as tsq from terms where expr is not null
  )
  select c.doc_id, d.title, c.content, ts_rank(c.fts, query.tsq) as rank
  from knowledge_chunks c
  join knowledge_docs d on d.id = c.doc_id and d.enabled
  cross join query
  where c.fts @@ query.tsq
  order by rank desc
  limit greatest(1, least(n, 12));
$$;

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  query text not null,
  business_name text not null,
  score int,
  competitors int not null default 0,
  source text not null default 'web',
  duration_ms int,
  dataset jsonb not null
);
create index if not exists analyses_created on analyses (created_at desc);

create table if not exists events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  meta jsonb not null default '{}'
);
create index if not exists events_kind_created on events (kind, created_at desc);

alter table app_config enable row level security;
alter table config_history enable row level security;
alter table knowledge_docs enable row level security;
alter table knowledge_chunks enable row level security;
alter table analyses enable row level security;
alter table events enable row level security;

-- Aggregates for the admin overview page.
create or replace function admin_overview() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'analyses_7d',  (select count(*) from analyses where created_at > now() - interval '7 days'),
    'analyses_30d', (select count(*) from analyses where created_at > now() - interval '30 days'),
    'analyses_total', (select count(*) from analyses),
    'avg_score_30d', (select round(avg(score)) from analyses where created_at > now() - interval '30 days'),
    'by_source_30d', (select coalesce(jsonb_object_agg(source, c), '{}'::jsonb)
                      from (select source, count(*) c from analyses where created_at > now() - interval '30 days' group by 1) t),
    'chat_7d',  (select count(*) from events where kind = 'chat_message' and created_at > now() - interval '7 days'),
    'chat_30d', (select count(*) from events where kind = 'chat_message' and created_at > now() - interval '30 days'),
    'bookings_30d', (select count(*) from events where kind = 'booking' and created_at > now() - interval '30 days'),
    'errors_7d', (select count(*) from events where kind in ('analysis_error', 'tool_error') and created_at > now() - interval '7 days'),
    'tools_30d', (select coalesce(jsonb_object_agg(tool, c), '{}'::jsonb)
                  from (select meta->>'tool' tool, count(*) c from events
                        where kind = 'tool_call' and created_at > now() - interval '30 days' group by 1) t),
    'credits_7d',  (select coalesce(sum((meta->>'charged')::int), 0) from events where kind = 'credits' and created_at > now() - interval '7 days'),
    'credits_30d', (select coalesce(sum((meta->>'charged')::int), 0) from events where kind = 'credits' and created_at > now() - interval '30 days'),
    'credits_remaining', (select (meta->>'remaining')::int from events
                          where kind = 'credits' and meta->>'remaining' is not null order by created_at desc limit 1),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'analyses', a, 'chats', c) order by d), '[]'::jsonb)
              from (select d::date d,
                           (select count(*) from analyses where created_at::date = d::date) a,
                           (select count(*) from events where kind = 'chat_message' and created_at::date = d::date) c
                    from generate_series(current_date - 13, current_date, interval '1 day') d) t)
  );
$$;
