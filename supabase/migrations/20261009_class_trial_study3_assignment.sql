-- The PSY240 class trial assigns students already in Liliana Study 3 to its
-- Sense Foraging arm instead of randomizing them (decided Sep 28, kept as D6 on
-- Oct 8): its two control arms are copies of Study 3's non-reactivity and
-- reappraisal programs, so a Study 3 participant randomized into one would be
-- exposed to another arm's content, and Liliana's study must not change.
--
-- The match is by email. Study 3 participants joined with their own accounts
-- (SONA, or the paid open route), which are not the accounts students make for
-- the trial, so account ids never coincide. A trial student's address arrives as
-- study_enrollments.contact_email when they give it at /join/classtrial
-- (open-join submit_email), before consent and baseline. This trigger compares
-- it, normalised (normalize_uoft_email: case, +tags, mail. subdomain), with both
-- Study 3 studies' enrollments, by their contact_email and by their account's
-- own address; any status, test enrollments aside.
--
-- On a match it writes the trial's randomize assignment ahead of the fork:
-- participant_assignments (node 'rnd', value "sense_foraging", draw_index NULL).
-- materializeSchedule reads existing assignments before it draws, so the fork
-- uses this one; draw_index NULL takes no place in draw_assignment's blocks of
-- three, so the randomized arms stay equal. The enrollment's notes say why, so the
-- assignment is visible in the admin and the export can set these students apart.
--
-- Scoped to the one study by its open_join_slug; a no-op for every other study.

create or replace function public.class_trial_study3_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_trial uuid;
  v_email text;
begin
  select id into v_trial from studies where open_join_slug = 'classtrial';
  if v_trial is null or new.study_id <> v_trial or new.contact_email is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.contact_email is not distinct from old.contact_email then
    return new;
  end if;

  v_email := normalize_uoft_email(new.contact_email);
  if not exists (
    select 1
      from study_enrollments e
      left join auth.users u on u.id = e.profile_id
     where e.study_id in ('958150a9-7821-4daf-8d83-e9325369d91d', 'ee542d3b-c0da-4a5f-ac34-6b981f153298')
       and not coalesce(e.is_test, false)
       and (normalize_uoft_email(e.contact_email) = v_email or normalize_uoft_email(u.email) = v_email)
  ) then
    return new;
  end if;

  insert into participant_assignments (participant_id, study_id, node_id, kind, value, draw_index)
  values (new.profile_id, v_trial, 'rnd', 'randomize', '"sense_foraging"'::jsonb, null)
  on conflict do nothing;

  -- AFTER trigger: annotate the row itself without re-firing this trigger
  -- (notes is not contact_email, and the guard above returns on an unchanged address).
  update study_enrollments
     set notes = concat_ws(' · ', nullif(notes, ''), 'Assigned to sense_foraging, not randomized: also in Liliana Study 3')
   where id = new.id;

  return new;
end;
$function$;

revoke all on function public.class_trial_study3_assignment() from public, anon, authenticated;

drop trigger if exists class_trial_study3_assignment on study_enrollments;
create trigger class_trial_study3_assignment
  after insert or update of contact_email on study_enrollments
  for each row execute function public.class_trial_study3_assignment();
