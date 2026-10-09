-- The class trial names no arm to students (Norm, D6, Oct 8 2026), but a
-- questionnaire's title is shown to participants: QuestionnaireStepWrapper
-- renders definition.name above the items and on the instruction screen. The
-- three arm measures were titled "Sense Foraging questionnaire (item pool 5,
-- draft)", "Metacognitive Processes of Decentering Scale - Trait (MPoD-t)" and
-- "Stress Mindset Measure (SMM)": the first and last name an arm outright.
--
-- The trial's copies take neutral titles in their definitions; the row `name`
-- (what admins see in the library) keeps the instrument's real name. Pool 5
-- gets a trial copy, like the MPoD-t, so the course's own draft stays as it is.
-- Items, scales, instructions and scoring are unchanged.

insert into questionnaires (slug, name, definition, locked)
select 'psy240-sf-pool-5', name || ' — class trial copy',
  definition || jsonb_build_object('slug', 'psy240-sf-pool-5', 'name', 'Paying attention'),
  false
from questionnaires where slug = 'sf-pool-5';

update questionnaires
   set definition = definition || jsonb_build_object('name', 'Thoughts and feelings'), updated_at = now()
 where slug = 'psy240-mpod-t';

update questionnaires
   set definition = definition || jsonb_build_object('name', 'Views about stress'), updated_at = now()
 where slug = 'smm-8';
