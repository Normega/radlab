-- radlab-academic (qldgwpneygvgcvexlduz)
-- Catalogue major and mild NCD as lecture-10 foundations.
--
-- Second instance of the carve mismatch first seen on Module 11, and the
-- resolution is the same, so this follows `20260801_catalogue_substance_foundations.sql`
-- rather than inventing a second pattern.
--
-- Module 14's outline:
--
--     14.1 Clinical Presentation → Delirium / Major NCD / Mild NCD
--     14.2 Epidemiology          → Delirium / Major and Mild NCD / Subtypes
--     14.3 Etiology              → Alzheimer's / TBI / Vascular / Substance /
--                                  Lewy Bodies / Frontotemporal / Parkinson's / Huntington's
--     14.4 Treatment
--
-- so the module carves by diagnostic *level* for presentation and epidemiology,
-- then by *aetiology* under etiology. The catalogue lists the aetiologies as
-- separate disorders (`alzheimers-disease-ncd` Tier A, `vascular-ncd` Tier A, and
-- five Tier B) and has no row for the level constructs at all. Paper mode wrote
-- `major-neurocognitive-disorder` (7,669 chars) and `mild-neurocognitive-disorder`
-- (3,432), which is what the source is built from.
--
-- **Foundation for the same reason as the substance three.** DSM-5-TR defines
-- major and mild NCD generically — the severity threshold, the six cognitive
-- domains, the independence-in-daily-activities criterion — and then applies that
-- frame to each aetiology. Every subtype page leans on them, so Tier B would file
-- load-bearing material as supporting detail.
--
-- Catalogue 128 → 130 rows. Fall generated-page scope unchanged: both pages exist
-- and are accepted as drafts.
--
-- Two related fixes went in alongside this, by hand rather than by migration:
--
--   * `neurocognitive-disorder-due-to-alzheimers-disease` → `alzheimers-disease-ncd`
--     and `…-due-to-traumatic-brain-injury` → `traumatic-brain-injury-ncd`, via
--     `rename_page()`. The model wrote DSM long-form names; the catalogue uses the
--     `X-ncd` convention. Both renames linked their catalogue rows and orphaned two
--     inbound links from `major-neurocognitive-disorder`, retargeted with
--     `edit_page()` (run plan §8.7: rename *after* accepting, because links are
--     extracted on accept).
--   * `vascular-ncd` (**Tier A**) is still unwritten even though the module covers
--     it in §14.3.3 with 11 mentions. Recoverable from this module by reference
--     mode, queued in run plan §5 — the same remedy as the four Lecture 8
--     substances, and not to be confused with `gambling-disorder`, which no amount
--     of re-running will produce because the content is absent.

INSERT INTO public.disorders (course_id, slug, title, dsm_chapter, tier, lecture, tier_review_note, page_id)
SELECT c.id, v.slug, v.title, NULL, 'foundation', 10, v.note, p.id
FROM public.courses c
CROSS JOIN (VALUES
  ('major-neurocognitive-disorder', 'Major neurocognitive disorder',
   'Generic DSM-5-TR severity construct applied across aetiologies; defines the six cognitive domains and the independence-in-daily-activities threshold that every subtype page relies on. Catalogued as a foundation after Module 14 carved the chapter by diagnostic level rather than by aetiology.'),
  ('mild-neurocognitive-disorder', 'Mild neurocognitive disorder',
   'The sub-threshold counterpart to major NCD, distinguished by preserved independence. Paired with it; the major/mild boundary is itself a live question — see the major-and-mild-ncd-as-one-continuum debate page.')
) AS v(slug, title, note)
LEFT JOIN public.wiki_pages p
  ON p.course_id = c.id AND p.slug = v.slug
WHERE c.code = 'PSY240'
  AND NOT EXISTS (
    SELECT 1 FROM public.disorders d
    WHERE d.course_id = c.id AND d.slug = v.slug
  );
