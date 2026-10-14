-- "Prefer not to answer" on the face and slider rating steps, as a study setting.
--
-- The PSY240 class trial's consent says any question may be declined, and since
-- 20261013_class_trial_attention_checks every questionnaire item offers it. The
-- face ratings were the exception (stress and mood before and after each day's
-- practice, life satisfaction in both surveys), because vas_responses.value had to
-- be a number. Norm asked for the same small opt-out under them (Oct 13).
--
-- A decline is recorded, not skipped (CLAUDE.md data rules 4 and 5): its own row,
-- declined = true and no value, so a declined rating can be told apart from one
-- never reached or lost. The check keeps every other row exactly as before: a
-- writer that does not set declined must still send a value from 1 to 100.
-- note_response_trg needs no change: it hashes coalesce(value::text, ''), and an
-- empty value now means exactly a decline. (Slider steps store their answers in
-- questionnaire_responses, where a decline is the string 'pna' as on any item.)
--
-- Per study and off by default, like questionnaire_layout: the stress and
-- life-satisfaction scales are shared with Liliana Study 3, which is running and
-- must not change mid-study. Only the class trial turns it on, before anyone has
-- answered. Turning it on or off once a study has answers mixes two
-- administrations, so it has no switch on the study page.

alter table public.vas_responses alter column value drop not null;

alter table public.vas_responses add column declined boolean not null default false;

alter table public.vas_responses add constraint vas_responses_value_or_declined
  check (declined = (value is null));

comment on column public.vas_responses.declined is
  'The participant chose "Prefer not to answer" (value is then null). Only on studies with ratings_allow_pna.';

alter table public.studies add column ratings_allow_pna boolean not null default false;

comment on column public.studies.ratings_allow_pna is
  'Face (VAS) and slider rating steps offer "Prefer not to answer". Set before anyone answers; never change it mid-study.';

update public.studies set ratings_allow_pna = true
 where id = '8ca4f362-f878-41f0-b5b3-8563e91c9a12';  -- PSY240 class trial
