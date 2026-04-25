create table if not exists public.stock_prep_dataset_state (
  id text primary key,
  dataset_version text not null,
  generated_at timestamptz not null,
  latest_manifest_key text not null,
  market_data_key text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stock_prep_import_jobs (
  id text primary key,
  scope_id text not null,
  file_name text not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null,
  finished_at timestamptz,
  dataset_version text,
  manifest_key text,
  symbol_count integer not null default 0,
  daily_price_count integer not null default 0,
  exchange_rate_count integer not null default 0,
  error_message text
);

create index if not exists stock_prep_import_jobs_started_at_idx
  on public.stock_prep_import_jobs (started_at desc);

create table if not exists public.stock_prep_symbol_snapshots (
  id text primary key,
  code text not null,
  name text not null,
  region text not null,
  currency text not null,
  source text not null,
  source_symbol text not null,
  security_type text not null,
  stooq_category text,
  import_status text not null,
  unsupported_reason text,
  last_close double precision,
  last_close_date date,
  dataset_version text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists stock_prep_symbol_snapshots_region_idx
  on public.stock_prep_symbol_snapshots (region);

create table if not exists public.stock_prep_screening_snapshots (
  dataset_version text primary key,
  generated_at timestamptz not null,
  candidate_count integer not null,
  candidates jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);
