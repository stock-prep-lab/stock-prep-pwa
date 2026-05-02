create table if not exists public.stock_prep_dataset_state (
  id text primary key,
  dataset_version text not null,
  generated_at timestamptz not null,
  latest_manifest_key text not null,
  market_data_key text not null,
  status text not null default 'ready',
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.stock_prep_dataset_state
  add column if not exists status text not null default 'ready';

alter table public.stock_prep_dataset_state
  drop constraint if exists stock_prep_dataset_state_status_check;

alter table public.stock_prep_dataset_state
  add constraint stock_prep_dataset_state_status_check
  check (status in ('ready', 'importing', 'failed'));

create table if not exists public.stock_prep_import_jobs (
  id text primary key,
  scope_id text not null,
  file_name text not null,
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  dataset_version text,
  manifest_key text,
  raw_object_key text,
  symbol_count integer not null default 0,
  daily_price_count integer not null default 0,
  exchange_rate_count integer not null default 0,
  error_message text
);

alter table public.stock_prep_import_jobs
  add column if not exists raw_object_key text;

alter table public.stock_prep_import_jobs
  add column if not exists attempt_count integer not null default 0;

alter table public.stock_prep_import_jobs
  add column if not exists processing_started_at timestamptz;

alter table public.stock_prep_import_jobs
  add column if not exists heartbeat_at timestamptz;

update public.stock_prep_import_jobs
set status = 'processing'
where status = 'running';

update public.stock_prep_import_jobs
set status = 'completed'
where status = 'succeeded';

update public.stock_prep_import_jobs
set attempt_count = case
      when status = 'processing' and attempt_count = 0 then 1
      else attempt_count
    end,
    processing_started_at = coalesce(processing_started_at, started_at),
    heartbeat_at = coalesce(heartbeat_at, started_at)
where status = 'processing';

alter table public.stock_prep_import_jobs
  drop constraint if exists stock_prep_import_jobs_status_check;

alter table public.stock_prep_import_jobs
  add constraint stock_prep_import_jobs_status_check
  check (status in ('queued', 'processing', 'completed', 'failed'));

create index if not exists stock_prep_import_jobs_started_at_idx
  on public.stock_prep_import_jobs (started_at desc);

create index if not exists stock_prep_import_jobs_status_heartbeat_idx
  on public.stock_prep_import_jobs (status, heartbeat_at, started_at);

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
