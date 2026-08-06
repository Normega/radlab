-- 20260806_gap_submission_precheck.sql
--
-- Student submission fields on gap_claims, the mechanical precheck that runs
-- before a human reads a submission, and the two staff review queues.
--
-- PROVENANCE NOTE: these objects were created live via MCP on 2026-08-06 and
-- ran for a day without a migration file. This file is that record, written
-- 2026-08-06 by transcribing pg_get_functiondef()/pg_get_viewdef() back out of
-- the live database -- with two regex bugs fixed (see below). Re-applying it is
-- safe and idempotent.
--
-- TWO BUGS FIXED RELATIVE TO WHAT WAS RUNNING LIVE. Neither had reached a
-- student, because gap_claims was still empty:
--
--   1. WORD COUNT NEVER WORKED. The split pattern was written '\\s+', which in
--      a standard-conforming string is backslash-backslash-s-plus -- an escaped
--      literal backslash followed by 's'. It matched nothing, so
--      regexp_split_to_array returned a single element for any input.
--      Consequence: EVERY submission would have been blocked with
--      'too_short: 1 words. Minimum 60.', and every one would also have warned
--      'thin_limitation' (1 < 8). The precheck would have rejected the entire
--      class. Now '\s+'.
--
--   2. FIVE OF TEN CLINICAL-INSTRUCTION PATTERNS WERE DEAD. They used \b as a
--      word boundary. In Postgres ARE \b is the BACKSPACE CHARACTER; the word
--      boundary is \y. So '\d+\s?mg\b', '\bdosage\b', '\bdosing\b', '\btitrat'
--      and '\btaper\b' could never match -- "start with 20 mg daily" sailed
--      through the rule written to stop exactly that. Only the plain-text
--      alternatives (first-line treatment, patients should, ...) were live.
--      Now \y throughout.
--
-- The other patterns here -- the DOI shape, the quotation scanner, the legal
-- assertion list -- were verified against live data and are unchanged.

-- ---------------------------------------------------------------------------
-- 1. Submission payload on gap_claims
-- ---------------------------------------------------------------------------

alter table gap_claims add column if not exists submitted_at  timestamptz;
alter table gap_claims add column if not exists submitted_text text;
alter table gap_claims add column if not exists source_doi     text;
alter table gap_claims add column if not exists source_url     text;
alter table gap_claims add column if not exists limitation     text;
alter table gap_claims add column if not exists precheck       jsonb;
alter table gap_claims add column if not exists precheck_at    timestamptz;

comment on column gap_claims.limitation is
  'What this source cannot tell us. Required; it is the field that shows comprehension.';
comment on column gap_claims.precheck is
  'jsonb array of {severity, code, detail} from run_precheck(). Advisory -- a human still decides.';

-- ---------------------------------------------------------------------------
-- 2. precheck_submission() -- mechanical checks, no judgement
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER because it reads page_gaps and other students' claims (for
-- duplicate detection) that the submitting student cannot see. It is keyed to a
-- single claim id and returns only findings about that claim.

create or replace function public.precheck_submission(p_claim_id uuid)
returns table(severity text, code text, detail text)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  c record;
  g record;
  v_words int;
  v_longest_quote int;
begin
  select * into c from gap_claims where id = p_claim_id;
  if not found then
    return query select 'block','no_claim','No such claim.'; return;
  end if;
  select * into g from page_gaps where id = c.gap_id;

  v_words := coalesce(array_length(regexp_split_to_array(btrim(coalesce(c.submitted_text,'')), '\s+'), 1), 0);

  -- longest run inside double quotes, as a crude fair-dealing proxy
  select coalesce(max(length(m[1])), 0) into v_longest_quote
  from regexp_matches(coalesce(c.submitted_text,''), '"([^"]{20,})"', 'g') m;

  -- 1. the red line: never allow a red gap through the student path
  if g.difficulty = 'red' then
    return query select 'block','red_gap',
      'This gap is classified red (clinical instruction or legal/compliance exposure) and is not student work.';
  end if;

  -- 2. citation must be resolvable, not just named
  if coalesce(c.source_doi,'') = '' and coalesce(c.source_url,'') = '' then
    return query select 'block','no_identifier',
      'No DOI or URL supplied. A citation that cannot be resolved cannot be checked.';
  end if;
  if coalesce(c.source_doi,'') <> '' and c.source_doi !~* '^(https?://(dx\.)?doi\.org/)?10\.[0-9]{4,9}/\S+$' then
    return query select 'warn','doi_malformed',
      'DOI does not look like a DOI: ' || c.source_doi;
  end if;

  -- 3. scope creep -- the likeliest novice failure: answering a lookup with clinical advice
  if c.submitted_text ~* '(\d+\s?mg\y|\ydosage\y|\ydosing\y|\ytitrat|\ytaper\y|first-line treatment|should be (given|prescribed|treated)|patients should|clinicians should|recommended dose)' then
    return query select 'block','clinical_instruction',
      'Reads as clinical instruction (dose, first-line, "should be given"). Report what the source found; do not advise.';
  end if;

  -- 4. legal or forensic assertion
  if c.submitted_text ~* '(is required by law|must report|legally obligated|the law requires|statute requires|is a criminal offence)' then
    return query select 'warn','legal_assertion',
      'Contains a legal assertion. Legal standards are staff-written -- see run plan §29.';
  end if;

  -- 5. fair dealing
  if v_longest_quote > 300 then
    return query select 'block','quote_too_long',
      'Longest quotation is ' || v_longest_quote || ' characters. Paraphrase and cite instead.';
  elsif v_longest_quote > 150 then
    return query select 'warn','quote_long',
      'Longest quotation is ' || v_longest_quote || ' characters -- check this is necessary.';
  end if;

  -- 6. length
  if v_words < 60 then
    return query select 'block','too_short', v_words || ' words. Minimum 60.';
  elsif v_words > 400 then
    return query select 'warn','too_long', v_words || ' words -- aim for ~150.';
  end if;

  -- 7. the field that shows comprehension
  if coalesce(btrim(c.limitation),'') = '' then
    return query select 'block','no_limitation',
      'The "what this source cannot tell us" field is empty. It is the point of the exercise.';
  elsif array_length(regexp_split_to_array(btrim(c.limitation), '\s+'),1) < 8 then
    return query select 'warn','thin_limitation','Limitation statement is very short.';
  end if;

  -- 8. duplicate source already on this page
  if exists (
    select 1 from wiki_page_versions v
    join ingest_jobs j on j.id = v.job_id
    where v.page_id = g.page_id and v.review_status = 'accepted'
      and coalesce(c.source_doi,'~~none~~') <> '~~none~~'
      and j.source_citation ilike '%' || c.source_doi || '%')
  then
    return query select 'warn','duplicate_source',
      'This DOI is already cited on ' || g.slug || '.';
  end if;

  -- 9. another student already claimed the same source for this gap
  if exists (
    select 1 from gap_claims o
    where o.gap_id = c.gap_id and o.id <> c.id
      and o.status in ('submitted','accepted')
      and coalesce(o.source_doi,'') = coalesce(c.source_doi,'')
      and coalesce(c.source_doi,'') <> '')
  then
    return query select 'block','duplicate_claim_source',
      'Another submission for this gap already uses this source.';
  end if;

  return;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. run_precheck() -- the write wrapper students' submit action calls
-- ---------------------------------------------------------------------------

create or replace function public.run_precheck(p_claim_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('severity',severity,'code',code,'detail',detail)), '[]'::jsonb)
    into v from precheck_submission(p_claim_id);
  update gap_claims set precheck = v, precheck_at = now() where id = p_claim_id;
  return v;
end;
$function$;

grant execute on function public.precheck_submission(uuid) to authenticated;
grant execute on function public.run_precheck(uuid)        to authenticated;

-- ---------------------------------------------------------------------------
-- 4. submission_review_queue -- what staff read
-- ---------------------------------------------------------------------------
--
-- security_invoker = true is mandatory: a view over roster-gated tables is
-- SECURITY DEFINER by default in Postgres, which would expose every course's
-- submissions to every member. The join to identity.people is what required
-- 20260806_staff_read_enrolled_people.sql.

create or replace view public.submission_review_queue
with (security_invoker = true) as
select c.id as claim_id,
    c.status,
    coalesce(nullif(btrim(pe.full_name), ''), pe.email) as student,
    pe.email as student_email,
    g.difficulty,
    g.tier,
    g.slug as page_slug,
    g.section,
    '/academic/fieldguide/wiki/' || g.slug || coalesce('#' || g.section, '') as review_url,
    'https://radlab.zone/academic/fieldguide/wiki/' || g.slug || coalesce('#' || g.section, '') as review_url_full,
    g.ask,
    c.source_doi,
    c.source_url,
    c.submitted_text,
    c.limitation,
    case
      when jsonb_path_exists(coalesce(c.precheck, '[]'::jsonb), '$[*]?(@."severity" == "block")') then 'BLOCKED'
      when jsonb_path_exists(coalesce(c.precheck, '[]'::jsonb), '$[*]?(@."severity" == "warn")')  then 'warnings'
      when c.precheck is null then 'not checked'
      when g.difficulty = 'green' then 'light check'
      else 'full read'
    end as route,
    coalesce(jsonb_array_length(c.precheck), 0) as finding_count,
    c.precheck as findings,
    c.submitted_at,
    c.precheck_at
from gap_claims c
  join page_gaps g on g.id = c.gap_id
  join identity.people pe on pe.id = c.person_id
where c.status = any (array['submitted','claimed']);

-- ---------------------------------------------------------------------------
-- 5. gap_review_queue -- staff triage of the gap catalogue itself
-- ---------------------------------------------------------------------------
--
-- Flags gaps whose difficulty tier looks wrong. Advisory only: review_reason is
-- a prompt for a human, never an automatic reclassification. The red tier is a
-- safety boundary (clinical instruction, legal standards, crisis resources) and
-- moving a gap into or out of it is a judgement call.

create or replace view public.gap_review_queue
with (security_invoker = true) as
select id, slug, difficulty, tier, kind, capacity, ask, notes,
    case
      when difficulty <> 'red' and ask ~* '(dosing|dose of| mg |taper|titrat|deprescrib|regimen|contraindic|antidote|overdose|withdrawal manage|detox)'
        then 'MAYBE RED: reads as clinical instruction'
      when difficulty <> 'red' and ask ~* '(statute|legislation|sentencing|civil commitment|involuntary hospitalis|involuntary admission|criminal responsib|fitness to stand|duty to (report|warn)|forensic (use|criteria|status)|mandated report)'
        then 'MAYBE RED: legal or forensic standard'
      when difficulty <> 'red' and ask ~* '(crisis line|helpline|safety plan|restraint|seclusion)'
        then 'MAYBE RED: crisis resource or coercive practice'
      when difficulty = 'green' and ask ~* '(mechanism|why |whether |debate|contested|critique|theor|conceptual|account of|explain)'
        then 'MAYBE NOT GREEN: conceptual, not a lookup'
      when difficulty = 'red' and ask !~* '(dosing|dose of| mg |taper|titrat|deprescrib|consent|contraindic|antidote|overdose|withdrawal manage|statute|sentencing|civil commitment|criminal responsib|duty to (report|warn)|forensic|mandated report|crisis line|helpline)'
        then 'MAYBE NOT RED: no clinical or legal trigger found'
      else null
    end as review_reason
from page_gaps g
where status = 'open';
