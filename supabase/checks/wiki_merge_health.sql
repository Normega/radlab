-- radlab-academic (qldgwpneygvgcvexlduz)
-- Read-only, re-runnable. Health of the `action: update` merge path.
--
-- Run after triaging any batch that contained update deltas. Every check should
-- return zero rows; each returns the offending pages when it doesn't.
--
-- Why this file exists: an `update` proposal is a *delta*, and accepting one is
-- the only place in the pipeline where two bodies get combined. Three distinct
-- things go wrong there, and none of them raises an error — the page just ends
-- up quietly wrong, and a reader finds it months later.

\echo '== 1. Duplicate headings (the delta restated a section the page already had) =='
-- A delta whose headings collide with the target's is semantically a `replace`,
-- not an `update`: concatenating gives two `## Etiology` sections. Found on
-- 2026-08-01 in Module 08's somatic-symptom-disorder delta, whose five headings
-- were exactly the target's first five. Expect it wherever the target is a stub
-- (headings present, near-empty bodies) — bulimia-nervosa, anorexia-nervosa and
-- borderline-personality-disorder are all in that state for Modules 10 and 13.
WITH h AS (
  SELECT p.slug, m[1] AS heading
  FROM wiki_pages p, LATERAL regexp_matches(p.content, '^(#{2,3} .+)$', 'gm') m
  WHERE p.content IS NOT NULL AND p.status <> 'archived'
)
SELECT slug, heading, count(*) AS times
FROM h GROUP BY slug, heading HAVING count(*) > 1
ORDER BY times DESC, slug;

\echo '== 2. Pages that SHRANK across an accepted update (delta replaced instead of merging) =='
-- `review_proposal()` sets content = coalesce(p_content, v.content) — it
-- REPLACES. The review UI is what pre-merges an update before calling it. Accept
-- an update from anywhere else while passing only the delta as p_content and the
-- page body is silently overwritten by the delta.
--
-- Done exactly that on 2026-08-01: biofeedback went 2,428 -> 1,565 chars and lost
-- Procedure/Theory/Evidence. Recovered from its accepted version 1, which is why
-- this check compares against version history rather than trusting the current body.
--
-- A shrink is not automatically a bug — deliberate trims are a normal part of
-- review, and this corpus has several (integrative-model was cut 20.4k -> 2.8k on
-- purpose). The discriminator is the **note**: `edit_page()` requires one and
-- `review_proposal()` never sets one, so a shrink whose newest accepted version
-- carries a note was a human decision, and one without a note was not. Only the
-- unexplained shrinks are listed here.
WITH newest AS (
  SELECT DISTINCT ON (v.page_id) v.page_id, v.note
  FROM wiki_page_versions v
  WHERE v.review_status = 'accepted' AND v.kind = 'accepted'
  ORDER BY v.page_id, v.created_at DESC
)
SELECT p.slug,
       max(length(prev.content)) AS longest_prior_version,
       length(p.content)         AS current_len,
       max(length(prev.content)) - length(p.content) AS chars_lost
FROM wiki_pages p
JOIN wiki_page_versions prev ON prev.page_id = p.id AND prev.review_status = 'accepted'
LEFT JOIN newest n ON n.page_id = p.id
WHERE p.content IS NOT NULL AND p.status <> 'archived'
  AND nullif(btrim(coalesce(n.note, '')), '') IS NULL   -- unexplained only
  AND EXISTS (
    SELECT 1 FROM wiki_page_versions u
    WHERE u.page_id = p.id AND u.action = 'update' AND u.review_status = 'accepted')
GROUP BY p.id, p.slug, p.content
HAVING max(length(prev.content)) > length(p.content)
ORDER BY chars_lost DESC;
-- Known benign hit: borderline-personality-disorder (3,370 -> 3,029), where a
-- competing `new` full draft was accepted over an already-merged version at
-- triage. A reviewer's choice, not a merge fault — but it is worth seeing.

\echo '== 3. Provenance leaking into headings a student reads =='
-- Deltas sometimes name their source module in the heading itself — Module 08''s
-- biofeedback delta arrived as "## Application to ... (Module 8)". Attribution
-- belongs in `wiki_page_provenance` (derived from ingest_jobs.source_citation),
-- never in the prose. Also catches the "## Update from ..." seam shape.
SELECT p.slug, m[1] AS heading
FROM wiki_pages p, LATERAL regexp_matches(p.content, '^(#{2,3} .+)$', 'gm') m
WHERE p.content IS NOT NULL AND p.status <> 'archived'
  AND (m[1] ~* '\(module\s*\d+\)' OR m[1] ~* '^#+\s*(update|addition)\b' OR m[1] ~* 'from module')
ORDER BY p.slug;

\echo '== 4. Pending update deltas whose headings will collide on accept =='
-- The forward-looking version of check 1: run BEFORE triage to see which pending
-- deltas need merging by hand (or reclassifying as `replace`) rather than being
-- accepted straight through.
SELECT p.slug,
       (SELECT string_agg(m[1], ' / ') FROM regexp_matches(p.content, '^## (.+)$', 'gm') m) AS target_headings,
       (SELECT string_agg(m[1], ' / ') FROM regexp_matches(v.content, '^## (.+)$', 'gm') m) AS delta_headings
FROM wiki_page_versions v
JOIN wiki_pages p ON p.id = v.page_id
WHERE v.review_status = 'pending' AND v.action = 'update' AND p.content IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM regexp_matches(v.content, '^## (.+)$', 'gm') d
    JOIN LATERAL (SELECT m[1] AS h FROM regexp_matches(p.content, '^## (.+)$', 'gm') m) e
      ON e.h = d[1])
ORDER BY p.slug;
