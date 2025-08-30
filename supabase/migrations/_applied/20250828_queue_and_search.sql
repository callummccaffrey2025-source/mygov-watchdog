create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

create table if not exists crawl_job (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  jurisdiction text default 'AU',
  type text default 'generic',
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  attempts int not null default 0,
  error text,
  doc_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crawl_job_status_idx on crawl_job(status, created_at);
create index if not exists crawl_job_url_idx on crawl_job using hash(url);

create or replace function set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists set_updated_at on crawl_job;
create trigger set_updated_at before update on crawl_job
for each row execute function set_updated_at();

create index if not exists document_url_idx on document using hash(url);
create index if not exists document_created_idx on document(created_at);
create index if not exists document_content_trgm on document using gin (content gin_trgm_ops);
