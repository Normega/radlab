-- main radlab. Instructor-side preview of quizzes and tests.
--
-- Two things course staff could not do before this:
--   1. See a weekly quiz's answers. weekly_quiz_keys has no client policies
--      (by design), and get_weekly_quiz() only serves members after opens_at,
--      so an instructor could preview a quiz only by joining the class as a
--      student and burning their own first answers.
--   2. Review a TEST pool anywhere but a local file. Test items carry answer
--      keys and this repo is public, so the pool is loaded from the Teaching
--      drive YAMLs via MCP into assessment_bank and never enters the repo.
--
-- assessment_bank deliberately has RLS enabled and NO policies, like
-- weekly_quiz_keys: the definer RPCs below are the only readers, and both
-- admit class staff only -- a class_admins row for that class, or the super
-- admin. profiles.role = 'lab' is NOT admitted: it is research staff, not
-- course staff (see ClassAdminRoute.jsx, 2026-09-10), and an enrolled student
-- held that role in one class.
--
-- Items are stored whole (stem, options, key, rationale, model answers, the
-- Field Guide fact they burn), so a later Quercus export can be built from the
-- same rows the instructor reviewed.

create table assessment_bank (
  class_id   uuid not null references classes(id) on delete cascade,
  pool       text not null,          -- 'test1', 'quiz_4', ... (the YAML file stem)
  pool_title text not null,
  position   int  not null,          -- order within the pool
  item_id    text not null,
  item       jsonb not null,         -- the full YAML item, keys included
  loaded_at  timestamptz not null default now(),
  primary key (class_id, item_id)
);
create index idx_assessment_bank_pool on assessment_bank (class_id, pool, position);

alter table assessment_bank enable row level security;
-- assessment_bank: deliberately NO policies -- definer RPCs only.

create or replace function is_class_staff(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_super_admin() or exists (
    select 1 from class_admins ca
    where ca.class_id = p_class_id and ca.user_id = auth.uid());
$$;

-- Every weekly quiz in the class, opened or not, with its keys merged into
-- each item and a completion count -- what the students get, plus the answers.
create or replace function get_quiz_preview(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_class_staff(p_class_id) then raise exception 'staff only'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', w.id, 'week_no', w.week_no, 'title', w.title,
      'opens_at', w.opens_at, 'due_at', w.due_at, 'hard_close_at', w.hard_close_at,
      'completions', (select count(*) from weekly_quiz_completions c where c.quiz_id = w.id),
      'started', (select count(distinct a.profile_id) from weekly_quiz_answers a where a.quiz_id = w.id),
      'items', (
        select jsonb_agg(it.value || jsonb_build_object('reveal', k.payload) order by it.ordinality)
        from jsonb_array_elements(w.items) with ordinality it
        left join weekly_quiz_keys k on k.quiz_id = w.id and k.item_id = it.value->>'id')
    ) order by w.week_no)
    from weekly_quizzes w where w.class_id = p_class_id), '[]'::jsonb);
end $$;

-- The item bank, grouped by pool.
create or replace function get_assessment_bank(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_class_staff(p_class_id) then raise exception 'staff only'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'pool', p.pool, 'pool_title', p.pool_title, 'loaded_at', p.loaded_at, 'items', p.items)
      order by p.pool)
    from (
      select pool, max(pool_title) pool_title, max(loaded_at) loaded_at,
             jsonb_agg(item order by position) items
      from assessment_bank where class_id = p_class_id group by pool
    ) p), '[]'::jsonb);
end $$;

revoke execute on function is_class_staff(uuid) from public, anon;
revoke execute on function get_quiz_preview(uuid) from public, anon;
revoke execute on function get_assessment_bank(uuid) from public, anon;
