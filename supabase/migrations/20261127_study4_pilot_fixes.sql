-- Sandy Study 4: two fixes from the internal pilot (Norm, 2026-11-27).
-- Sandy Study 3 still accepts Prolific joins and shares both the Aptitude Suite
-- activity and the DASS-21 definition, so both changes apply to Study 4 only.
--
-- 1. Word Probe letter board. Pilot participants expected Wordle's keyboard: the
--    letters already tried, coloured green / yellow / grey, so a ruled-out letter
--    isn't tried again. It resets with each new word. A study setting, off by
--    default, so Study 3's Aptitude Suite stays exactly as its participants saw it.
--    Read by src/games/AptitudeSuite/AptitudeSuite.jsx under the participant's own
--    session ("studies: enrolled participant read"), like ratings_allow_pna.
--
-- 2. DASS-21 timeframe. The shared definition gives no timeframe ("…the degree to
--    which these statements apply to you"). Study 4 gets its own copy with the
--    standard past-week timeframe; the shared DASS-21 (Study 3) is unchanged.
--    The copy keeps definition.name "DASS-21" (what participants see) and the
--    same item ids and scoring; its slug, dass-21-week, makes its export columns
--    dass21week_*. Study 4's pilot answers so far stay under dass-21.

BEGIN;

-- 1 ------------------------------------------------------------------------
alter table public.studies add column wordprobe_letter_board boolean not null default false;

comment on column public.studies.wordprobe_letter_board is
  'Aptitude Suite Word Probe shows a letter board under the input: each letter tried this word, coloured as on the grid (green / yellow / grey). Resets each word. Set before anyone plays; never change it mid-study.';

update public.studies set wordprobe_letter_board = true
 where id = '0ba55341-0931-4ee3-9c44-f7d31af758da';  -- Sandy Study 4

-- 2 ------------------------------------------------------------------------
do $$
begin
  if (select md5(definition::text) from public.questionnaires
       where id = 'dd4cc08c-4f19-4e92-bd15-949af5791008') is distinct from '96514db74d5bfc7eb15339a12837e235' then
    raise exception 'DASS-21 definition changed since this migration was written';
  end if;
end $$;

insert into public.questionnaires (slug, name, definition, locked, created_by)
select 'dass-21-week',
       'DASS-21 (past week, Study 4)',
       jsonb_set(
         jsonb_set(definition, '{slug}', '"dass-21-week"'),
         '{instructions}',
         to_jsonb('The next questions ask about your mood and stress levels. Rate how much each statement applied to you over the past week.'::text)),
       false,
       created_by
  from public.questionnaires
 where id = 'dd4cc08c-4f19-4e92-bd15-949af5791008';

update public.session_template_nodes
   set questionnaire_id = (select id from public.questionnaires where slug = 'dass-21-week')
 where id = '0372fa9f-80e4-4e21-9671-5b2742cf6e5d'              -- Sandy Study 4, step 27
   and questionnaire_id = 'dd4cc08c-4f19-4e92-bd15-949af5791008';

COMMIT;
