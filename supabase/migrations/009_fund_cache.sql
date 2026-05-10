-- 009_fund_cache.sql
-- Merkezi fundamental veri cache'i (price_cache ile aynı pattern).
-- Write: sadece service_role (fetch-fundamentals edge fn).
-- Read: anon + authenticated (frontend doğrudan okur).

create table if not exists fund_cache (
  ticker      text primary key,
  asset_type  text not null default 'US_STOCK',
  metrics     jsonb,
  annual      jsonb,
  grades      jsonb,
  source      text,          -- 'fmp' | 'edgar' | 'isyatirim'
  updated_at  timestamptz not null default now()
);

comment on table fund_cache is 'Shared fundamental data cache. Written by fetch-fundamentals edge fn (service_role), read by frontend (anon).';

alter table fund_cache enable row level security;

-- Herkes okuyabilir (price_cache ile aynı)
create policy "fund_cache public read"
  on fund_cache for select
  to anon, authenticated
  using (true);

-- Write: service_role only (policy yok = service_role bypass eder)
