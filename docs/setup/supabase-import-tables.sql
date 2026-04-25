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

create table if not exists public.stock_prep_holdings (
  id text primary key,
  symbol_id text not null,
  quantity double precision not null,
  average_price double precision not null,
  currency text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists stock_prep_holdings_symbol_id_idx
  on public.stock_prep_holdings (symbol_id);

create table if not exists public.stock_prep_cash_balances (
  currency text primary key,
  amount double precision not null,
  updated_at timestamptz not null default timezone('utc', now())
);
