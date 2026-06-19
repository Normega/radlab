-- Register confidence/satisfaction VAS scales as session-builder activities (2026-06-19)
-- Run after 20260619_vas_confidence_satisfaction_seed.sql.
-- Idempotent — re-runnable.

INSERT INTO public.activities (category, subcategory, label, description)
VALUES
  ('vas', 'vas_confidence',        'VAS – Confidence',        'How confident are you in that judgment?'),
  ('vas', 'vas_life-satisfaction', 'VAS – Life Satisfaction',  'In general, how satisfied are you with your life?'),
  ('vas', 'vas_task-satisfaction', 'VAS – Task Satisfaction',  'How satisfied are you with your performance in that task?')
ON CONFLICT (category, subcategory) DO NOTHING;
