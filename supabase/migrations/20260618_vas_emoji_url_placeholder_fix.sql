-- ============================================================
-- RADlab · Fix unresolved <SUPABASE_PROJECT_URL> in vas_scales anchors (2026-06-18)
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
-- Idempotent / re-runnable.
--
-- The VAS seed inserted emoji_url values containing the literal template
-- placeholder "<SUPABASE_PROJECT_URL>" instead of the real project URL, so
-- the emoji images 404'd for participants (VasRenderer renders
-- anchors[].emoji_url directly). This rewrites the placeholder to the real
-- public base URL across every affected scale.
--
-- The WHERE clause makes it idempotent: once rewritten, no row still matches,
-- so re-running is a no-op.
-- ============================================================

UPDATE public.vas_scales
SET anchors = replace(
       anchors::text,
       '<SUPABASE_PROJECT_URL>',
       'https://qajrlfqoicfcfhthsfay.supabase.co'
     )::jsonb
WHERE anchors::text LIKE '%<SUPABASE_PROJECT_URL>%';
