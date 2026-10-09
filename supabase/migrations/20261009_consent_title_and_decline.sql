-- Two per-study consent options, for studies that are not research or that
-- want a way to say no (first use: the PSY240 class trial, a teaching
-- exercise whose consent form must not call itself research, and whose
-- students may decline without giving a reason, Norm's D7).
--
--   studies.consent_title    replaces ConsentGate's fixed "Research Consent
--                            Form" heading. NULL keeps it.
--   studies.decline_message  when set, ConsentGate offers "No thanks" beside
--                            the agreement. Declining calls decline_consent(),
--                            which withdraws the enrollment and ends its links,
--                            and the page shows this message. NULL = no button,
--                            as before.
--
-- Why a decline is needed at all: without consent, a participant's entry
-- session never completes, and a `hold` entry session (a baseline gate) is
-- re-sent every day for as long as the study runs. Someone who said no would be
-- emailed daily. Declining sets the enrollment to withdrawn, which every send
-- path refuses (schedule_row_block_reason).
--
-- ConsentGate reads both columns in its existing small options read (with
-- allow_credit_only_consent and offer_repository_consent) and falls back to
-- the old heading and no button if that read fails, so consent is never blocked
-- by them. get_session_by_token is not changed.

alter table studies
  add column if not exists consent_title text,
  add column if not exists decline_message text;

comment on column studies.consent_title is
  'ConsentGate heading; NULL = "Research Consent Form".';
comment on column studies.decline_message is
  'When set, ConsentGate offers "No thanks"; declining withdraws the enrollment (decline_consent) and shows this text.';

-- The participant declines their own enrollment, before consenting. Never
-- after: once consent is on record, stopping is a withdrawal, with its own page.
-- No email is sent: they are on the page reading the outcome.
create or replace function public.decline_consent(p_study_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_msg text;
  v_enr study_enrollments%rowtype;
begin
  if v_uid is null then
    raise exception 'decline_consent: not authenticated';
  end if;

  select decline_message into v_msg from studies where id = p_study_id;
  if v_msg is null then
    return jsonb_build_object('error', 'not_offered');
  end if;

  select * into v_enr from study_enrollments
   where study_id = p_study_id and profile_id = v_uid
   order by enrolled_at desc
   limit 1;
  if not found then
    return jsonb_build_object('error', 'not_enrolled');
  end if;
  if v_enr.consent_date is not null then
    return jsonb_build_object('error', 'already_consented');
  end if;

  if v_enr.status <> 'withdrawn' then
    update study_enrollments
       set status = 'withdrawn', withdrawn_at = now(), withdrawal_reason = 'declined_consent'
     where id = v_enr.id;
    update participant_links
       set status = 'revoked', ended_reason = 'withdrawn', ended_at = now()
     where study_id = p_study_id and participant_id = v_uid and status = 'active';
  end if;

  return jsonb_build_object('status', 'declined', 'message', v_msg);
end;
$function$;

revoke all on function public.decline_consent(uuid) from public, anon;
grant execute on function public.decline_consent(uuid) to authenticated;
