-- radlab-academic (qldgwpneygvgcvexlduz)
-- Catalogue the three generic substance pages as lecture-8 foundations.
--
-- Module 11's paper run produced `substance-use-disorder` (10,233 chars — the
-- longest page in the wiki), `substance-intoxication` (4,310) and
-- `substance-withdrawal` (2,921), none of which had a `disorders` row. Left
-- alone they sit outside the catalogue: reachable by link and by search,
-- invisible in the browse-by-DSM-chapter view, and absent from
-- `reference_worklist` — the same state `internet-gaming-disorder` was in.
--
-- **The model was not wrong, and neither is the catalogue.** This is a *carve*
-- mismatch rather than the naming mismatches seen before (`panic-disorder` /
-- `agoraphobia` was a grouping split; `adjustment-disorder` vs
-- `adjustment-disorders` was number). Module 11's own outline runs
--
--     11.1.2 Substance Use Disorder / 11.1.3 Substance Intoxication /
--     11.1.4 Substance Withdrawal / 11.1.5 Types of Substances Abused
--       → 11.1.5.1 Depressants  11.1.5.2 Stimulants  11.1.5.3 Hallucinogens/Cannabis
--
-- so the source partitions by diagnostic pattern and then by drug *class*, while
-- the catalogue lists five specific substances (alcohol, cannabis, gambling,
-- opioid, stimulant). Paper mode carved the source as the source is built, which
-- is what it is for. Both partitions are legitimate; they simply do not align.
--
-- **Foundation, not Tier A or B.** DSM-5-TR defines use disorder, intoxication
-- and withdrawal generically and applies them across substance classes, so these
-- three are the scaffolding the five substance-specific Tier A pages will lean
-- on — the same role `suicide-and-self-harm` plays for the L6 block. Tier B would
-- misrepresent load-bearing material as supporting detail.
--
-- `dsm_chapter` is null, matching every other foundation row: these are course
-- constructs spanning a chapter rather than entries within one.
--
-- Catalogue 125 → 128 rows. Fall generated-page scope is unchanged: all three
-- pages already exist and are accepted as drafts.
--
-- **This does not close Lecture 8.** Tier A there remains 0 of 5. Four of those
-- five (alcohol, cannabis, opioid, stimulant) are recoverable from this same
-- module by reference mode — the material is present but distributed across the
-- intoxication, withdrawal, epidemiology, etiology and treatment sections
-- (alcohol 52 mentions, cannabis 21, opioid 21, stimulant 19). The fifth,
-- `gambling-disorder`, is **not**: gambling appears zero times in the whole
-- module, so it belongs on the uncovered-topics list in run plan §4 alongside
-- the Lecture 7 material and needs a non-textbook source.

INSERT INTO public.disorders (course_id, slug, title, dsm_chapter, tier, lecture, tier_review_note, page_id)
SELECT c.id, v.slug, v.title, NULL, 'foundation', 8, v.note, p.id
FROM public.courses c
CROSS JOIN (VALUES
  ('substance-use-disorder', 'Substance use disorder',
   'Generic DSM-5-TR construct applied across substance classes; the scaffolding the five substance-specific Tier A pages build on. Catalogued as a foundation after Module 11''s paper run carved the chapter by diagnostic pattern rather than by substance.'),
  ('substance-intoxication', 'Substance intoxication',
   'Generic construct, paired with substance-withdrawal. Declares epidemiology, etiology and treatment gaps — the module treats intoxication descriptively and by drug class rather than as a disorder in its own right.'),
  ('substance-withdrawal', 'Substance withdrawal',
   'Generic construct, paired with substance-intoxication. Thinnest of the three; the module covers withdrawal mainly through the depressant class.')
) AS v(slug, title, note)
LEFT JOIN public.wiki_pages p
  ON p.course_id = c.id AND p.slug = v.slug
WHERE c.code = 'PSY240'
  AND NOT EXISTS (
    SELECT 1 FROM public.disorders d
    WHERE d.course_id = c.id AND d.slug = v.slug
  );
