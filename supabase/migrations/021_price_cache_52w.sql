-- 021_price_cache_52w.sql — Sprint 22: 52W giriş kalitesi bar
--
-- Adds nullable columns `h_52w` and `l_52w` to price_cache. The refresh-price-cache
-- edge function computes these from the bars array (closes-only) and writes them
-- on each batch refresh. Existing rows remain valid (NULL) until next refresh.
--
-- Frontend (TickerDetailTab) renders a horizontal progress bar placing avg_cost
-- within [l_52w, h_52w] when both are present and the ticker is US_STOCK or
-- non-bank BIST. If either column is NULL the bar is hidden gracefully.

alter table price_cache
  add column if not exists h_52w numeric,
  add column if not exists l_52w numeric;

comment on column price_cache.h_52w is
  '52-week high (max of daily closes over last ~252 trading days). Written by refresh-price-cache; NULL until first computation.';
comment on column price_cache.l_52w is
  '52-week low (min of daily closes). Written by refresh-price-cache; NULL until first computation.';
