-- radlab-academic (qldgwpneygvgcvexlduz)
-- Split the catalogue row `panic-disorder-and-agoraphobia` into two Tier A rows.
--
-- Module 07's paper run produced `panic-disorder` (7,956 chars) and `agoraphobia` (4,817)
-- as separate pages, against a catalogue that carried them as one combined slug. The model
-- has the better case: DSM-5 promoted agoraphobia to an independent diagnosis — it was a
-- specifier of panic disorder only in DSM-IV — so the combined slug reflected how the
-- lecture groups them rather than how the manual lists them. Norm's call, 2026-07-31.
--
-- Left as-is this was a standing inconsistency: `panic-disorder-and-agoraphobia` read
-- "no page yet" in `reference_worklist` — so it would have kept surfacing as unwritten
-- work — while two off-catalogue pages carrying exactly its content sat beside it with ten
-- inbound links between them and no chapter placement in the index's browse view.
--
-- Both pages already exist and are accepted as drafts, so `page_id` is set directly here;
-- the seed-side trigger only fires for newly inserted rows, not for a slug UPDATE.
--
-- Catalogue 124 -> 125 rows (Tier A 53 -> 54). Fall generated-page scope moves 78 -> 79,
-- though the content already exists, so the review burden is the part that actually grew.

-- 1. Repoint the existing row at panic disorder.
UPDATE public.disorders d
SET slug  = 'panic-disorder',
    title = 'Panic disorder',
    page_id = (SELECT p.id FROM public.wiki_pages p
               WHERE p.course_id = d.course_id AND p.slug = 'panic-disorder')
WHERE d.slug = 'panic-disorder-and-agoraphobia';

-- 2. Add agoraphobia alongside it, same chapter/tier/lecture.
INSERT INTO public.disorders (course_id, slug, title, dsm_chapter, tier, lecture, tier_review_note, page_id)
SELECT c.id, 'agoraphobia', 'Agoraphobia', 5, 'A', 3,
       'Split from the combined panic-disorder-and-agoraphobia catalogue row on 2026-07-31. Independent diagnosis since DSM-5; L3 teaches it alongside panic disorder, so the two pages should cross-link rather than restate each other.',
       p.id
FROM public.courses c
LEFT JOIN public.wiki_pages p ON p.course_id = c.id AND p.slug = 'agoraphobia'
WHERE c.code = 'PSY240'
  AND NOT EXISTS (
    SELECT 1 FROM public.disorders d WHERE d.course_id = c.id AND d.slug = 'agoraphobia'
  );
