insert into public.mps (name, party, electorate) values
  ('Jane Citizen','Independent','Example'),
  ('Alex Nguyen','Labor','Sydney'),
  ('Priya Shah','Liberal','Higgins')
on conflict do nothing;

insert into public.bills (title, status) values
  ('Electoral Reform Bill 2025','Second reading'),
  ('Digital Privacy Amendment','Introduced'),
  ('Infrastructure Funding Act','Committee')
on conflict do nothing;

insert into public.news_articles (title, source, url) values
  ('Reform bill advances in Senate','ABC','https://example.com/abc'),
  ('Privacy amendment draws crossbench support','The Age','https://example.com/age'),
  ('Infrastructure bill clears committee','Guardian AU','https://example.com/guardian')
on conflict do nothing;
