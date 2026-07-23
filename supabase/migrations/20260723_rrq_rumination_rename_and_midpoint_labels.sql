-- Rumination-Reflection Questionnaire — Rumination subscale correction.
--
-- The questionnaire stored as slug 'rrs' / "Ruminative Response Scale (RRS)"
-- is actually the Rumination subscale of the Rumination-Reflection
-- Questionnaire (RRQ; Trapnell & Campbell, 1999): 12 items on a 5-point
-- Strongly Disagree–Strongly Agree scale, items such as "I always seem to be
-- 're-hashing' in my mind recent things I've said or done" and "My attention
-- is often focused on aspects of myself I wish I'd stop thinking about." The
-- genuine RRS (Nolen-Hoeksema Ruminative Responses Scale) is a different
-- instrument (22/10 items, 4-point almost never–almost always, depression
-- framing) and does not match. The platform already hosts this scale's twin as
-- slug 'rrq-reflection' ("… – Reflection Subscale (RRQ)"), so this renames the
-- mislabeled scale to match its sibling.
--
-- Safe to rename the slug: only 6 questionnaire_responses rows (4 test users,
-- no real participants) reference 'rrs', and no code hardcodes the slug — the
-- Sandy Study 3 session step references it by questionnaires.id and
-- get_session_by_token resolves the slug at read time, so the rename flows
-- through automatically.
--
-- Separately, labels the previously-bare midpoint on BOTH RRQ subscales. They
-- are fully anchored (1 Strongly Disagree, 2 Disagree, 4 Agree, 5 Strongly
-- Agree) except point 3, whose bare "3" looked conspicuously unlabeled. The
-- other platform scales with bare interior points (brief-maia-2, lms-14,
-- mpod-t, scs-26, sscs-s) are intentionally endpoint-anchored and are left
-- untouched.

-- 1. Rename the questionnaire (slug + display name).
UPDATE questionnaires
SET slug = 'rrq-rumination',
    name = 'Rumination-Reflection Questionnaire – Rumination Subscale (RRQ)'
WHERE slug = 'rrs';

-- 2. Migrate the existing (test-only) response rows to the new slug.
UPDATE questionnaire_responses
SET questionnaire_slug = 'rrq-rumination'
WHERE questionnaire_slug = 'rrs';

-- 3. Label the midpoint (value 3, scale_labels array index 2) on both RRQ
--    subscales. Verified pre-migration: index 2 is value 3 with a bare "3"
--    label on both; the guard keeps this a no-op if that ever changes.
UPDATE questionnaires
SET definition = jsonb_set(definition, '{scale_labels,2,label}', '"Neither Agree nor Disagree"')
WHERE slug IN ('rrq-rumination', 'rrq-reflection')
  AND definition->'scale_labels'->2->>'value' = '3';
