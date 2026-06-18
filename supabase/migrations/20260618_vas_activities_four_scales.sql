-- ============================================================
-- RADlab · Register 4 VAS scales as session activities (2026-06-18)
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
-- Idempotent / re-runnable.
--
-- The vas_scales rows for enjoyment, helpful, effort and sleep were already
-- seeded (they show in the Rating Scale library), but no matching activities
-- rows existed — so they could not be added to a session in the Session
-- Builder, which lists category='vas' activities under "Rating Scales".
--
-- This inserts the missing activities rows, mirroring exactly what
-- VasUploadPage.jsx writes when a scale is created via the admin UI:
--   category='vas', subcategory='vas_<slug>', label='VAS – <Name>',
--   description=<the scale's question>.
-- ============================================================

INSERT INTO public.activities (category, subcategory, label, description)
VALUES
  ('vas', 'vas_enjoyment', 'VAS – Enjoyment', 'How enjoyable did you find today''s practice?'),
  ('vas', 'vas_helpful',   'VAS – Helpful',   'How helpful did you find today''s practice?'),
  ('vas', 'vas_effort',    'VAS – Effort',    'How much effort did you put into completing this practice?'),
  ('vas', 'vas_sleep',     'VAS – Sleep',     'How would you rate the quality of your sleep last night?')
ON CONFLICT (category, subcategory) DO NOTHING;
