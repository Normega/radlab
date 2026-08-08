-- 20260808_gap_triage_adjudicated.sql
--
-- Norm adjudicated all 13 flagged rows in gap_review_queue on 2026-08-08,
-- accepting every recommendation:
--
--   * 2 "MAYBE NOT RED" rows KEEP RED — both were regex blind spots, not
--     misclassifications: "Canadian reporting duties" (pedophilic-disorder) is
--     mandatory-reporting law, and "involuntary hospitalisation"
--     (suicide-and-self-harm) is civil-commitment territory. The view's
--     not-red trigger list simply lacked both phrases; fixed below.
--   * 10 of 11 "MAYBE NOT GREEN" rows DEMOTE to amber — multi-part, contested,
--     or synthesis asks that no light-check TA can verify against one figure.
--   * 1 keeps green: vascular-neurocognitive-disorder's "does midlife BP
--     lowering reduce later dementia incidence" — reads conceptual but has a
--     landmark single-source answer (SPRINT MIND and successor meta-analyses).
--
-- CAPACITY DECISION (Norm, 2026-08-08): the demoted ambers KEEP capacity 2.
-- Capacity is "how many independent contributions this ask can absorb", which
-- is orthogonal to difficulty:
--   * a green at capacity 2 collects CONVERGENT evidence — two sources
--     answering the same lookup (precheck's duplicate_claim_source already
--     forces the second student onto a different source);
--   * a multi-part amber at capacity 2 collects COMPLEMENTARY evidence — each
--     submission takes a different facet of the ask;
--   * ordinary single-question ambers stay capacity 1.
--
-- Net board effect: green 134 -> 124 gaps (268 -> 248 slots, still >= 200
-- students needing a green first task, headroom 1.24x); amber 592 -> 602 gaps
-- (10 of them capacity-2, so amber slots 592 -> 612); total slots unchanged
-- at 860.

-- ---------------------------------------------------------------------------
-- 1. The ten demotions (identified by the same predicate that flagged them,
--    minus the one page Norm kept green)
-- ---------------------------------------------------------------------------

update page_gaps g
set difficulty = 'amber',
    notes = coalesce(g.notes || ' · ', '')
            || 'demoted green→amber 2026-08-08 (adjudicated: conceptual/multi-part, not a lookup); capacity 2 retained — complementary sources, one facet each'
from gap_review_queue q
where q.id = g.id
  and q.review_reason like 'MAYBE NOT GREEN%'
  and g.slug <> 'vascular-neurocognitive-disorder';

-- ---------------------------------------------------------------------------
-- 2. gap_review_queue: add the two phrases the not-red check was missing, so
--    the view stops second-guessing correct classifications. Only the final
--    (MAYBE NOT RED) branch changes; the rest is verbatim.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3. Keep-green marker + adjudication override (applied as _p2 on the server;
--    one file here because it is one decision). vascular-neurocognitive-
--    disorder stays green by adjudication but matches the "whether " pattern,
--    so without an override the view would nag about it forever. An explicit
--    human adjudication in notes now outranks every heuristic.
-- ---------------------------------------------------------------------------

update page_gaps
set notes = coalesce(notes || ' · ', '')
            || 'adjudicated: keep green 2026-08-08 — reads conceptual but has a landmark single-source answer (SPRINT MIND / successor meta-analyses)'
where slug = 'vascular-neurocognitive-disorder'
  and difficulty = 'green' and status = 'open'
  and ask like 'whether blood-pressure lowering%'
  and coalesce(notes,'') not like '%adjudicated: keep green%';

create or replace view public.gap_review_queue
with (security_invoker = true) as
select id, slug, difficulty, tier, kind, capacity, ask, notes,
    case
      -- An explicit human adjudication outranks every heuristic below.
      when coalesce(notes,'') ~* 'adjudicated: keep' then null
      when difficulty <> 'red' and ask ~* '(dosing|dose of| mg |taper|titrat|deprescrib|regimen|contraindic|antidote|overdose|withdrawal manage|detox)'
        then 'MAYBE RED: reads as clinical instruction'
      when difficulty <> 'red' and ask ~* '(statute|legislation|sentencing|civil commitment|involuntary hospitalis|involuntary admission|criminal responsib|fitness to stand|duty to (report|warn)|forensic (use|criteria|status)|mandated report)'
        then 'MAYBE RED: legal or forensic standard'
      when difficulty <> 'red' and ask ~* '(crisis line|helpline|safety plan|restraint|seclusion)'
        then 'MAYBE RED: crisis resource or coercive practice'
      when difficulty = 'green' and ask ~* '(mechanism|why |whether |debate|contested|critique|theor|conceptual|account of|explain)'
        then 'MAYBE NOT GREEN: conceptual, not a lookup'
      when difficulty = 'red' and ask !~* '(dosing|dose of| mg |taper|titrat|deprescrib|consent|contraindic|antidote|overdose|withdrawal manage|statute|sentencing|civil commitment|criminal responsib|duty to (report|warn)|forensic|mandated report|crisis line|helpline|reporting dut|involuntary hospitalis|involuntary admission)'
        then 'MAYBE NOT RED: no clinical or legal trigger found'
      else null
    end as review_reason
from page_gaps g
where status = 'open';
