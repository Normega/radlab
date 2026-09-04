-- Store the comparison verdict as a value, not as prose to be guessed at.
--
-- The review pass returns a structured agrees/diverges/unclear judgement, but
-- only the explanatory note was kept, and the queue inferred its badge by
-- searching that note for the word "diverge". Tested against a deliberately
-- weak summary, the model caught three real contradictions — a reversal of the
-- paper's finding, experiments credited to a narrative review, and a
-- sample-size critique that cannot apply to a review — and described them
-- precisely without ever using the word. The badge therefore read
-- "summary matches": the check failed towards reassurance, which is the one
-- direction a misreading check must never fail.

alter table gap_claims add column if not exists integration_verdict text;

alter table gap_claims drop constraint if exists gap_claims_integration_verdict_check;
alter table gap_claims add constraint gap_claims_integration_verdict_check
  check (integration_verdict is null or integration_verdict in ('agrees', 'diverges', 'unclear'));

-- integration_verdict joins the bookkeeping columns the guard lets through.
create or replace function public.gap_claims_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $function$
declare
  v_staff boolean;
  v_flow  boolean := coalesce(current_setting('radlab.claim_flow', true), '') = '1';
  v_book  text[] := array['notified_at', 'source_kind', 'source_fulltext', 'source_url_full',
                          'source_captured_at', 'integration_status', 'integration_note',
                          'integration_version_id', 'integration_draft', 'integration_verdict'];
begin
  select is_course_staff(g.course_id) into v_staff
  from page_gaps g where g.id = coalesce(new.gap_id, old.gap_id);
  if coalesce(v_staff, false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not v_flow then
      raise exception 'claims are created through claim_gap(), not direct insert';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - 'notified_at') = (to_jsonb(old) - 'notified_at') then
    return new;
  end if;

  if v_flow and (to_jsonb(new) - v_book) = (to_jsonb(old) - v_book) then
    return new;
  end if;

  if old.person_id is distinct from current_person_id() and not v_flow then
    raise exception 'not your claim';
  end if;

  if old.status = 'accepted' then
    raise exception 'accepted claims are read-only';
  end if;

  if old.status = 'submitted' then
    raise exception 'submitted claims are locked while under review';
  end if;

  if old.status = 'withdrawn' then
    if new.status = 'claimed' and v_flow then
      return new;
    end if;
    raise exception 'withdrawn claims are re-opened through claim_gap()';
  end if;

  if new.status = 'claimed' or new.status = 'withdrawn' then
    return new;
  end if;
  if new.status = 'submitted' then
    if not v_flow then
      raise exception 'submissions go through submit_claim(), which runs the precheck';
    end if;
    if old.expires_at is not null and old.expires_at < now() then
      raise exception 'this claim expired on % — re-claim the gap if slots remain', old.expires_at::date;
    end if;
    new.submitted_at := coalesce(new.submitted_at, now());
    return new;
  end if;

  raise exception 'transition % -> % is not allowed', old.status, new.status;
end;
$function$;

drop function if exists public.record_claim_integration(uuid, text, text, uuid, text);

create or replace function public.record_claim_integration(
  p_claim_id uuid, p_status text, p_note text, p_version_id uuid default null,
  p_draft text default null, p_verdict text default null)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform set_config('radlab.claim_flow', '1', true);
  update gap_claims
  set integration_status = p_status, integration_note = p_note,
      integration_version_id = coalesce(p_version_id, integration_version_id),
      integration_draft = coalesce(p_draft, integration_draft),
      integration_verdict = coalesce(p_verdict, integration_verdict)
  where id = p_claim_id;
end;
$$;

revoke all on function public.record_claim_integration(uuid, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_claim_integration(uuid, text, text, uuid, text, text) to service_role;

create or replace view public.submission_review_queue as
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
    c.integration_verdict
   FROM gap_claims c
     JOIN page_gaps g ON g.id = c.gap_id
     JOIN courses co ON co.id = g.course_id
     JOIN identity.people pe ON pe.id = c.person_id
  WHERE c.status = 'submitted'::text;
