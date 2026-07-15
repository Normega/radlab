-- Record the raw phase-1 eligibility answers on each screener result, so a
-- "not sure" answer on a safety item (Zerin distress gate — passes through for
-- follow-up rather than failing) is recoverable for the research team, and so
-- eligibility responses are auditable in general. Additive + nullable; existing
-- rows and the Liliana screener write path are unaffected (both simply start
-- populating it).

alter table public.screener_results
  add column if not exists phase1_answers jsonb;
