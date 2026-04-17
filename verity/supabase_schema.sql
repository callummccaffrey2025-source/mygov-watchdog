create table if not exists public.bills(
  id text primary key,
  title text not null,
  stage text,
  introduced text,
  sponsor text,
  summary text,
  progress numeric
);
