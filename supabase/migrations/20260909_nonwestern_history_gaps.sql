-- radlab-academic. Non-Western history gaps, curated (Norm, 2026-09-09).
--
-- The Noba ingest (Farreras 2026) narrowed but could not fill the
-- historical-traditions page's non-Western hole: it added one Chinese
-- yin/yang sentence and the 1900 BC hysteria papyri, and nothing else.
-- The L1 "missing histories" slide points students at this gap, so the
-- broad auto-detected asks are replaced with specific claimable ones.
--
-- kind='curated' per 20260811_wp7_curated_gaps.sql: staff-flagged gaps
-- populate_page_gaps() never writes or deletes. ask_hash = md5(lower(ask)),
-- idempotent on (page_id, ask_hash).
--
-- Also retired (all unclaimed at the time):
--   * the two broad annotation gaps ("outside the Euro-American frame",
--     "non-Western classification traditions") — superseded by the
--     specific set, and their ask text no longer matches the page after
--     the Farreras integration;
--   * the curated Indigenous gap created minutes earlier in this same
--     pass — an auto-detected Indigenous-healing gap already existed
--     with a LIVE STUDENT CLAIM, and a claimed gap is never pulled out
--     from under its claimant, so that one remains the Indigenous gap
--     (capacity 2, one slot still free).
--
-- Net open inventory on historical-traditions after this pass: Islamic
-- (curated, cap 2) + Chinese classification (curated, cap 2) + choose-your-
-- own non-European tradition (curated, cap 3) + Indigenous (annotation,
-- 1 of 2 slots claimed) + the two reform-outcomes annotation gaps.

insert into page_gaps (course_id, page_id, slug, kind, section, ask, ask_hash, tier, difficulty, capacity, notes)
select p.course_id, p.id, p.slug, 'curated', 'nonwestern-and-global-histories',
       v.ask, md5(lower(v.ask)), 'foundation', v.difficulty, v.capacity,
       'Added 2026-09-09: the Noba ingest (Farreras 2026) narrowed but could not fill the non-Western histories gap, so the broad annotation gaps were retired and split into these specific claimable asks.'
from (values
  ('Islamic golden-age medicine and its hospitals — what medieval Islamic physicians (for example al-Razi or Ibn Sina/Avicenna) actually said about mental illness, and the bimaristans that treated it centuries before Bethlem opened. Wholly absent from this corpus: both Bridley & Daffin and Farreras (2026) skip straight from Rome to medieval Europe.', 'amber', 2),
  ('Chinese medical classification of madness, beyond the single yin/yang sentence this page now carries — how classical Chinese medicine categorised and treated mental disorder (for example the dian/kuang distinction), and where those categories do and do not map onto the Western ones this course teaches.', 'amber', 2),
  ('Indigenous understandings of mental distress and healing in what is now Canada, and the role of residential schools and the mental-health consequences documented since — a gap a Canadian course cannot leave open. Use published scholarship, ideally by Indigenous authors, and describe healing traditions on their own terms rather than through the disorder categories of this course.', 'amber', 2),
  ('A non-European historical tradition of your choosing not otherwise covered — for example Ayurvedic/South Asian, Japanese, African or Latin American accounts of madness and its treatment. Name the tradition, work from a proper historical source, and say how its explanation-to-treatment link compares with the supernatural/somatogenic/psychogenic scheme this page teaches.', 'amber', 3)
) as v(ask, difficulty, capacity)
join wiki_pages p on p.slug='historical-traditions' and p.course_id='35e9842a-51a5-4f1e-aa5f-3a52f938196f'
on conflict (page_id, ask_hash) do nothing;

update page_gaps set status='retired',
  notes = coalesce(notes||' ','') || 'Retired 2026-09-09: superseded by four specific curated gaps (Islamic, Chinese, Indigenous, other traditions); ask text also no longer matches the page after the Farreras integration.'
where id in ('a203018e-b87c-4378-994e-3ae51d7eb435','f4e0614c-2d85-4072-b7a2-e9b34cff096b') and status='open';

update page_gaps set status='retired',
  notes = coalesce(notes||' ','') || 'Retired 2026-09-09 minutes after creation: an auto-detected Indigenous-healing gap already exists on this page and carries a live student claim; keeping both would double-serve the topic.'
where slug='historical-traditions' and kind='curated' and status='open'
  and ask ilike 'Indigenous understandings%'
  and not exists (select 1 from gap_claims c where c.gap_id = page_gaps.id);
