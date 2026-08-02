-- radlab-academic (qldgwpneygvgcvexlduz)
-- Retire the `-ncd` abbreviation from the catalogue; use the long form.
--
-- Norm's call, 2026-08-02: `X-ncd` is hard to read and hard to parse.
--
-- It was also costing a rename every time. Three consecutive runs wrote DSM
-- long-form slugs — `neurocognitive-disorder-due-to-alzheimers-disease`,
-- `vascular-neurocognitive-disorder`, `frontotemporal-neurocognitive-disorder`
-- — and each had to be renamed onto the catalogue's abbreviation by hand, which
-- orphaned inbound links each time (run plan §8.7). Three more subtypes are still
-- unwritten (`ncd-with-lewy-bodies`, `substance-medication-induced-ncd`,
-- `ncd-other-aetiologies`), so the same tax was queued up three more times.
--
-- This is the §3 lesson again, one level down. Slug convergence works because
-- disorder *names* are canonical — "major depressive disorder" is what the field
-- calls it, so the model's independent choice and our hand-written slug meet.
-- **`-ncd` is our abbreviation, not the field's.** There is nothing for the model
-- to converge on, exactly as with the foundations slugs, so it will miss forever.
-- The cheap fix is to move the catalogue to what the model reliably produces
-- rather than keep correcting it.
--
-- Evidence that these are the right targets: the first four are precisely the
-- slugs the model generated unprompted before being renamed away from them.
--
-- Titles are expanded to match — the point is readability, and "Major/mild NCD
-- due to Alzheimer's disease" has the same problem as the slug.
--
-- Ordering matters, and this file is only step one of three:
--   1. (here) rename the catalogue rows. `disorders.page_id` is a UUID FK, so the
--      four existing page links survive untouched.
--   2. `rename_page()` on those four pages. Because the catalogue already carries
--      the new slug, `rename_page`'s unlink clause (`slug <> new_slug`) does not
--      fire and the catalogue link is preserved.
--   3. `edit_page()` to retarget the 10 inbound wikilinks across 5 pages.
-- Steps 2 and 3 are done from the session, not here, because both are
-- SECURITY DEFINER functions that need an instructor JWT.
--
-- NOT renamed: `major-and-mild-ncd-as-one-continuum`, a model-invented debate page
-- rather than a catalogue slug. Renaming it would not stop the model reinventing
-- the same title next time, so it buys nothing.
--
-- Still abbreviated, deliberately: `adhd`. Unlike `-ncd`, that abbreviation *is*
-- canonical in the field, so convergence should hold — but it is the one
-- remaining slug of this shape, and Module 16 will test it.

UPDATE public.disorders d
SET slug  = v.new_slug,
    title = v.new_title
FROM (VALUES
  ('alzheimers-disease-ncd',          'neurocognitive-disorder-due-to-alzheimers-disease',
   'Neurocognitive disorder due to Alzheimer''s disease'),
  ('vascular-ncd',                    'vascular-neurocognitive-disorder',
   'Vascular neurocognitive disorder'),
  ('frontotemporal-ncd',              'frontotemporal-neurocognitive-disorder',
   'Frontotemporal neurocognitive disorder (Pick''s disease)'),
  ('traumatic-brain-injury-ncd',      'neurocognitive-disorder-due-to-traumatic-brain-injury',
   'Neurocognitive disorder due to traumatic brain injury'),
  ('ncd-with-lewy-bodies',            'neurocognitive-disorder-with-lewy-bodies',
   'Neurocognitive disorder with Lewy bodies'),
  ('substance-medication-induced-ncd','substance-medication-induced-neurocognitive-disorder',
   'Substance/medication-induced neurocognitive disorder'),
  ('ncd-other-aetiologies',           'neurocognitive-disorder-other-aetiologies',
   'Neurocognitive disorder due to Parkinson''s, Huntington''s, HIV infection, and prion disease')
) AS v(old_slug, new_slug, new_title)
WHERE d.slug = v.old_slug
  AND d.course_id = (SELECT id FROM public.courses WHERE code = 'PSY240');
