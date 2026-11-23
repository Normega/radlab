-- Breath Attention and Emotional Recovery (plan WP-I3): Screens 1 and 2 as display steps, verbatim from
-- 06_Participant_Instructions_and_Scripts.md. Screen 12 (end of tasks) is not a display: it shows the
-- study code and sends end marker 255, so it is a coded step, added with the tasks (WP-C2).
-- Data only; idempotent.

INSERT INTO public.displays (slug, name, blocks, public)
SELECT v.slug, v.name, v.blocks::jsonb, false
  FROM (VALUES
    ('bre_screen_1_welcome', 'Breath Attention: Screen 1, Welcome',
     '[{"type":"text","showIf":null,"text":"Thank you for taking part. First, you will answer two short questionnaires about how you have been feeling over the past two weeks. Please answer honestly; there are no right or wrong answers. The computer uses these answers to set up the rest of your session."}]'),
    ('bre_screen_2_background', 'Breath Attention: Screen 2, Background questionnaires',
     '[{"type":"text","showIf":null,"text":"Next, you will answer some questions about yourself, your personality, and your experiences. Every background question has a \"Prefer not to answer\" option. Please take your time."}]')
  ) AS v(slug, name, blocks)
 WHERE NOT EXISTS (SELECT 1 FROM public.displays d WHERE d.slug = v.slug);

INSERT INTO public.activities (category, subcategory, label, description, estimated_minutes, is_active)
SELECT 'display', v.slug, v.label, v.description, 1, true
  FROM (VALUES
    ('bre_screen_1_welcome',    'Display – Breath Attention Screen 1 (welcome)',    'Breath Attention and Emotional Recovery, Screen 1. Before GAD-7 and PHQ-8.'),
    ('bre_screen_2_background', 'Display – Breath Attention Screen 2 (background)', 'Breath Attention and Emotional Recovery, Screen 2. Before demographics, BFI-2, ASI-3 and SF-20.')
  ) AS v(slug, label, description)
 WHERE NOT EXISTS (SELECT 1 FROM public.activities a WHERE a.subcategory = v.slug);
