-- VAS scale seed: confidence, life-satisfaction, task-satisfaction (2026-06-19)
-- Run in Supabase SQL editor.
-- created_by is set to the first lab-role profile (same pattern as stress scale seed).
-- Images must already exist in the public-assets bucket at:
--   vas-emojis/confidence/confidence_{1..6}.png
--   vas-emojis/satisfaction/satisfaction_{1..6}.png

INSERT INTO vas_scales (slug, question, scale_type, anchors, created_by) VALUES
  (
    'confidence',
    'How confident are you in that judgment?',
    'emoji_6',
    '[
      {"value": 1, "label": "no idea",      "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/confidence/confidence_1.png"},
      {"value": 2, "label": "guessing",     "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/confidence/confidence_2.png"},
      {"value": 3, "label": "leaning",      "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/confidence/confidence_3.png"},
      {"value": 4, "label": "somewhat sure","emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/confidence/confidence_4.png"},
      {"value": 5, "label": "fairly sure",  "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/confidence/confidence_5.png"},
      {"value": 6, "label": "certain",      "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/confidence/confidence_6.png"}
    ]'::jsonb,
    (SELECT id FROM profiles WHERE role = 'lab' LIMIT 1)
  ),
  (
    'life-satisfaction',
    'In general, how satisfied are you with your life?',
    'emoji_6',
    '[
      {"value": 1, "label": "unhappy",      "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_1.png"},
      {"value": 2, "label": "disappointed", "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_2.png"},
      {"value": 3, "label": "unsettled",    "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_3.png"},
      {"value": 4, "label": "content",      "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_4.png"},
      {"value": 5, "label": "pleased",      "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_5.png"},
      {"value": 6, "label": "delighted",    "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_6.png"}
    ]'::jsonb,
    (SELECT id FROM profiles WHERE role = 'lab' LIMIT 1)
  ),
  (
    'task-satisfaction',
    'How satisfied are you with your performance in that task?',
    'emoji_6',
    '[
      {"value": 1, "label": "unhappy",      "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_1.png"},
      {"value": 2, "label": "disappointed", "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_2.png"},
      {"value": 3, "label": "unsettled",    "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_3.png"},
      {"value": 4, "label": "content",      "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_4.png"},
      {"value": 5, "label": "pleased",      "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_5.png"},
      {"value": 6, "label": "delighted",    "emoji_url": "https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/satisfaction_6.png"}
    ]'::jsonb,
    (SELECT id FROM profiles WHERE role = 'lab' LIMIT 1)
  );
