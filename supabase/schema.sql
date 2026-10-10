-- MedLens label cache. Holds public drug-label summaries only, keyed by drug name.
-- No personal data (allergies, goals, saved medicines) is ever stored here.
create table if not exists public.label_cache (
  key text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Only the server (service role key) reads and writes this table.
alter table public.label_cache enable row level security;
