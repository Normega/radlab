-- ============================================================
-- RADlab · Activities + Questionnaire Nodes Migration
-- Apply once in the Supabase SQL Editor
-- ============================================================

-- ─── 1. Add missing games to the activities registry ─────────────────────────
-- Seeded games at infrastructure time: Pond Watch, Ebb and Flow, Farm Joy.
-- These six were built since then and were absent from the picker.

INSERT INTO activities (category, subcategory, label) VALUES
  ('game', 'breath_belt',   'Breath Belt'),
  ('game', 'drift',         'Drift'),
  ('game', 'face_read',     'Face Read'),
  ('game', 'first_contact', 'First Contact'),
  ('game', 'owl_barn',      'Owl Barn'),
  ('game', 'still_water',   'Still Water')
ON CONFLICT DO NOTHING;

-- ─── 2. Allow session nodes to reference uploaded questionnaires ──────────────
-- session_template_nodes previously only stored activity_id (FK → activities).
-- Uploaded questionnaires live in the questionnaires table and have no activities
-- row, so nodes need a direct questionnaire_id column as an alternative reference.
-- Exactly one of activity_id / questionnaire_id should be non-null per node.

ALTER TABLE session_template_nodes
  ADD COLUMN IF NOT EXISTS questionnaire_id uuid REFERENCES questionnaires(id) ON DELETE SET NULL;
