-- radlab-academic (qldgwpneygvgcvexlduz)
-- Catalogue the internet gaming disorder page under DSM ch 16.
--
-- Module 15's reference run produced `internet-gaming-disorder` from the module's closing
-- "Check This Out" box. It is a good page, but it had no `disorders` row, so it sat outside
-- the catalogue: reachable by link and by search, invisible in the wiki index's browse-by-
-- DSM-chapter view, and absent from `reference_worklist`.
--
-- Placement: chapter 16 (Substance-Related and Addictive Disorders), lecture 8, tier B —
-- alongside `gambling-disorder` (ch 16, tier A, L8). The chapter's *addictive behaviours*
-- half is the right home, not substance use as such: DSM-5-TR groups non-substance
-- addictions there, and ICD-11 files gaming disorder under "disorders due to substance use
-- or addictive behaviours."
--
-- Tier B because it is a Section III condition for further study rather than a formal
-- DSM-5-TR diagnosis — the course teaches it as a boundary case, not as a disorder to be
-- learned. This takes the catalogue from 123 rows to 124 (Tier B 45 -> 46); the fall
-- generated-page scope of 78 is unchanged, because the page already exists.

INSERT INTO public.disorders (course_id, slug, title, dsm_chapter, tier, lecture, tier_review_note, page_id)
SELECT
  c.id,
  'internet-gaming-disorder',
  'Internet gaming disorder',
  16,
  'B',
  8,
  'Not a formal DSM-5-TR diagnosis — Section III, conditions for further study, while ICD-11 does list gaming disorder. Taught as a live example of where the boundary of "disorder" is still being argued, so the page is short by design and its value is the disagreement, not the criteria.',
  p.id
FROM public.courses c
LEFT JOIN public.wiki_pages p
  ON p.course_id = c.id AND p.slug = 'internet-gaming-disorder'
WHERE c.code = 'PSY240'
  AND NOT EXISTS (
    SELECT 1 FROM public.disorders d
    WHERE d.course_id = c.id AND d.slug = 'internet-gaming-disorder'
  );
