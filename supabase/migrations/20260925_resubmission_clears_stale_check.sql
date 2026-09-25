-- radlab-academic. A resubmitted claim no longer carries the previous round's
-- source check, and the queue can tell a resubmission from a first submission
-- (Norm, 2026-09-25).
--
-- 1. STALE VERDICTS. The comparison against the cited source (integration_*)
--    is written by /api/integrate-claim, which the student's browser fires in
--    the background after submit_claim() succeeds — deliberately not awaited,
--    so a failed check never reads as a failed submission. But nothing cleared
--    the previous round's result. When a TA sent a claim back and the student
--    resubmitted, the card kept round one's verdict, note and draft until the
--    new check landed; if that background call failed, it kept them for good.
--    A TA would then see "summary matches" (integration_status = 'reviewed')
--    beside text written AFTER that verdict, and the claim would stay out of
--    "Awaiting source check", the one group built to catch an unchecked card.
--    Accepting it would also file the stale draft: integrate-claim reuses a
--    stored draft whenever integration_status = 'reviewed'.
--
--    submit_claim() now clears integration_status/note/draft/verdict in the
--    same UPDATE that makes the claim 'submitted'. Every verdict a TA sees is
--    therefore newer than the text it judges, and a check that never arrives
--    leaves the card visibly unchecked instead of silently old. The blocked-
--    precheck path is unchanged: nothing is submitted there. gap_claims_guard
--    already permits these columns on the submit transition (they are in its
--    bookkeeping list, and the flow flag is set).
--
-- 2. RESUBMISSION MARKER. A send-back leaves its note, decided_at and
--    resolved_by on the claim, and resubmitting does not touch them, so the
--    history the queue needs is already on the row — it just was not in the
--    view. submission_review_queue gains four columns (appended; CREATE OR
--    REPLACE VIEW cannot reorder):
--      previously_sent_back  a TA decision is recorded, or a reviewer note is.
--                            decided_at only exists since 2026-09-21, so a
--                            send-back from before then is known by its note.
--      previous_note         the note minus the " · expired YYYY-MM-DD (14-day
--                            claim TTL)" text expire_claims() appends — the same
--                            rule as reviewerNote() in fieldguide/contributions.js.
--                            System bookkeeping is not a reviewer's words.
--      previous_decided_at   when it was sent back (null before 2026-09-21).
--      previous_reviewer     who sent it back, when recorded.
--    Only the most recent send-back is on the row: the student saw exactly
--    one note, and so does the queue.
--
-- 3. ONE-TIME RESET of the claims already in the queue as resubmissions with a
--    'reviewed' check. Nothing records when a check ran, so whether their
--    verdicts postdate the resubmission cannot be shown. They drop to
--    "Awaiting source check" and one press of "Compare with source" re-runs
--    it. At the time of writing: 3 claims ('skipped' ones had no source to
--    check and are left alone). Resetting costs a click; a stale green costs a
--    wrong acceptance.

CREATE OR REPLACE FUNCTION public.submit_claim(p_claim_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c record;
  findings jsonb;
  has_block boolean;
begin
  select * into c from gap_claims where id = p_claim_id and person_id = current_person_id();
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No such claim of yours.');
  end if;
  if c.status <> 'claimed' then
    return jsonb_build_object('ok', false, 'code', 'wrong_status',
      'message', 'Only an open claim can be submitted (this one is ' || c.status || ').');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'expired',
      'message', 'This claim expired on ' || c.expires_at::date || '. Re-claim the gap if slots remain.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('severity', severity, 'code', code, 'detail', detail)), '[]'::jsonb)
    into findings from precheck_submission(p_claim_id);
  has_block := jsonb_path_exists(findings, '$[*] ? (@."severity" == "block")');

  perform set_config('radlab.claim_flow', '1', true);
  if has_block then
    update gap_claims set precheck = findings, precheck_at = now() where id = p_claim_id;
    return jsonb_build_object('ok', false, 'code', 'blocked', 'findings', findings,
      'message', 'The precheck found problems that must be fixed before submitting.');
  end if;

  -- A new submission starts unchecked: the previous round's comparison judged
  -- different text. See the header of 20260925_resubmission_clears_stale_check.
  update gap_claims
  set status = 'submitted', submitted_at = now(), precheck = findings, precheck_at = now(),
      integration_status = null, integration_note = null,
      integration_draft = null, integration_verdict = null
  where id = p_claim_id;

  return jsonb_build_object('ok', true, 'findings', findings);
end;
$function$;

CREATE OR REPLACE VIEW public.submission_review_queue
WITH (security_invoker = true) AS
 SELECT c.id AS claim_id,
    c.status,
    COALESCE(NULLIF(btrim(pe.full_name), ''::text), pe.email) AS student,
    pe.email AS student_email,
    g.difficulty,
    g.tier,
    g.slug AS page_slug,
    g.section,
    ((('/academic/'::text || lower(co.code)) || '/wiki/'::text) || g.slug) || COALESCE('#'::text || g.section, ''::text) AS review_url,
    ((('https://radlab.zone/academic/'::text || lower(co.code)) || '/wiki/'::text) || g.slug) || COALESCE('#'::text || g.section, ''::text) AS review_url_full,
    g.ask,
    c.source_doi,
    c.source_url,
    c.submitted_text,
    c.limitation,
        CASE
            WHEN jsonb_path_exists(COALESCE(c.precheck, '[]'::jsonb), '$[*]?(@."severity" == "block")'::jsonpath) THEN 'BLOCKED'::text
            WHEN jsonb_path_exists(COALESCE(c.precheck, '[]'::jsonb), '$[*]?(@."severity" == "warn")'::jsonpath) THEN 'warnings'::text
            WHEN c.precheck IS NULL THEN 'not checked'::text
            WHEN g.difficulty = 'green'::text THEN 'light check'::text
            ELSE 'full read'::text
        END AS route,
    COALESCE(jsonb_array_length(c.precheck), 0) AS finding_count,
    c.precheck AS findings,
    c.submitted_at,
    c.precheck_at,
    g.course_id,
    c.source_fulltext IS NOT NULL AS has_source,
    c.integration_status,
    c.integration_note,
    c.integration_draft,
    c.integration_verdict,
    (c.decided_at IS NOT NULL OR n.clean IS NOT NULL) AS previously_sent_back,
    n.clean AS previous_note,
    c.decided_at AS previous_decided_at,
    NULLIF(btrim(rb.full_name), ''::text) AS previous_reviewer
   FROM gap_claims c
     JOIN page_gaps g ON g.id = c.gap_id
     JOIN courses co ON co.id = g.course_id
     JOIN identity.people pe ON pe.id = c.person_id
     LEFT JOIN identity.people rb ON rb.id = c.resolved_by
     CROSS JOIN LATERAL (
       SELECT NULLIF(btrim(regexp_replace(COALESCE(c.note, ''::text),
         '(\s*·\s*)?expired \d{4}-\d{2}-\d{2} \(14-day claim TTL\)', '', 'g')), ''::text) AS clean
     ) n
  WHERE c.status = 'submitted'::text;

-- 3. One-time: resubmissions already in the queue whose check may predate the
--    resubmission. A migration has no person, so it is not course staff and
--    gap_claims_guard would refuse any write to a submitted claim. The claim-
--    flow flag lets through exactly the bookkeeping columns (integration_* are
--    among them) and nothing else; `true` scopes it to this transaction.
DO $$
BEGIN
  PERFORM set_config('radlab.claim_flow', '1', true);
  UPDATE public.gap_claims
     SET integration_status = null, integration_note = null,
         integration_draft = null, integration_verdict = null
   WHERE status = 'submitted'
     AND integration_status = 'reviewed'
     AND (decided_at IS NOT NULL
          OR NULLIF(btrim(regexp_replace(COALESCE(note, ''),
               '(\s*·\s*)?expired \d{4}-\d{2}-\d{2} \(14-day claim TTL\)', '', 'g')), '') IS NOT NULL);
END $$;
