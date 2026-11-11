-- Security hardening. Apply in the Supabase SQL editor.
-- All data is read and written by the server with the service-role key. The public (anon) key must
-- not reach any table or function, even though row level security already hides the rows.

alter table if exists app_config       enable row level security;
alter table if exists config_history   enable row level security;
alter table if exists knowledge_docs   enable row level security;
alter table if exists knowledge_chunks enable row level security;
alter table if exists analyses         enable row level security;
alter table if exists events           enable row level security;
alter table if exists lookup_logs      enable row level security;
alter table if exists social_cache     enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Objects created later stay private too.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- The service role keeps working: it is not subject to these grants.
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
