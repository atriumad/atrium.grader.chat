-- Meetings booked through the chat. One row per booking, written by the server after the calendar
-- event exists. Read only from the admin panel. Apply in the Supabase SQL editor.

create table if not exists bookings (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  start_at       timestamptz not null,
  end_at         timestamptz not null,
  provider       text not null check (provider in ('google', 'mock')),
  calendar_event_id text,
  meet_link      text,
  name           text not null,
  email          text not null,
  phone          text,
  business_name  text not null,
  score          integer,
  notes          text,
  email_visitor  boolean,
  email_ops      boolean,
  email_error    text,
  -- Managed from the admin panel. Cancelled is final: the calendar event is deleted.
  status         text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  internal_notes text,
  updated_at     timestamptz,
  updated_by     text
);

create index if not exists bookings_start_idx on bookings (start_at desc);
create index if not exists bookings_status_idx on bookings (status);

-- Same lock-down as every other table (see 0004): only the service role can touch it.
alter table bookings enable row level security;
revoke all on bookings from anon, authenticated;
grant all on bookings to service_role;
