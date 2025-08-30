-- Personalization primitives
create extension if not exists pg_trgm;

create table if not exists user_profile (
  user_id uuid primary key,
  jurisdiction text default 'AU',
  electorate text,
  interests text[] default '{}',         -- ['privacy','climate',...]
  parties text[] default '{}',           -- ['Labor','Coalition','Greens',...]
  email_opt_in boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function set_updated_at_user_profile()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists trg_up_user_profile on user_profile;
create trigger trg_up_user_profile before update on user_profile
for each row execute function set_updated_at_user_profile();

-- Watchlists
create table if not exists watch_document (
  user_id uuid not null,
  doc_id uuid not null,
  created_at timestamptz default now(),
  primary key (user_id, doc_id)
);

-- Simple alert rules (v1)
create table if not exists alert_rule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  keywords text[] default '{}',
  categories text[] default '{}',
  jurisdictions text[] default '{AU}',
  last_checked timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function set_updated_at_alert_rule()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists trg_up_alert_rule on alert_rule;
create trigger trg_up_alert_rule before update on alert_rule
for each row execute function set_updated_at_alert_rule();
