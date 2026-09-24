-- main radlab. Question of the Week walls run themselves: they open on a
-- schedule, stay open all term, and close together at a class's term end.
-- (Norm, 2026-09-24: "the discussion questions keep closing... just have them
-- open each week and stay open til end of term", both courses.)
--
-- The 2026-09-17 guard (20260917_weekly_walls_stay_open.sql) left two gaps:
--   1. Opening was manual. PSY240 week 3 (lecture Sep 23) was never opened at
--      all; nothing noticed.
--   2. A super admin could still close from the planner, and one did:
--      PSY309 week 3 was closed Sep 22 08:30 ET, the morning of its own
--      lecture, after 2 answers.
-- So the walls come off the console's controls entirely:
--
--   * qotw_tick(), run every 5 minutes by pg_cron, opens each planned weekly
--     wall at noon Toronto time on its lecture's date (both courses end
--     lecture by noon), and closes every open wall once the class's
--     walls_close_at has passed. Staff can still open one early from the
--     planner; opening is harmless.
--   * The trigger now refuses ANY app session taking a weekly wall out of
--     'open', super admin included. Only the cron job and direct SQL
--     (auth.uid() is null) can close one.
--
-- Closing at term end is deliberate, not tidying: while a wall is open,
-- get_weekly_wall withholds other people's answers until you post your own,
-- so closing is what lets everyone read the whole wall afterwards.
-- walls_close_at null = never auto-close.

alter table classes add column if not exists walls_close_at timestamptz;
comment on column classes.walls_close_at is
  'When every Question of the Week wall in this class closes (qotw_tick). Null = never.';

update classes set walls_close_at = '2026-12-09 04:59:00+00'   -- Tue Dec 8, 11:59 PM ET
 where slug in ('psy309', 'psy240') and walls_close_at is null;

create or replace function public.forbid_weekly_wall_close()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.kind <> 'weekly' then
    return NEW;
  end if;
  if OLD.status = 'open' and NEW.status is distinct from 'open' and auth.uid() is not null then
    raise exception
      'A Question of the Week wall stays open until the end of term; it closes on its own then';
  end if;
  return NEW;
end $$;

create or replace function public.qotw_tick()
returns void language plpgsql security definer set search_path = public as $$
begin
  update checkins k set status = 'open', opened_at = now()
    from lectures l
   where k.lecture_id = l.id and k.kind = 'weekly' and k.status = 'planned'
     and l.lecture_date is not null
     and ((l.lecture_date + time '12:00') at time zone 'America/Toronto') <= now();

  update checkins k set status = 'closed', closed_at = now()
    from lectures l join classes c on c.id = l.class_id
   where k.lecture_id = l.id and k.kind = 'weekly' and k.status = 'open'
     and c.walls_close_at is not null and c.walls_close_at <= now();
end $$;

revoke execute on function public.qotw_tick() from public, anon, authenticated;

-- One-off repair: reopen any wall closed before its class's term end (at
-- apply time, PSY309 week 3). Its answers were never touched; closing only
-- stopped new ones. closed_at is kept as the record of what happened.
update checkins k set status = 'open'
  from lectures l join classes c on c.id = l.class_id
 where k.lecture_id = l.id and k.kind = 'weekly' and k.status = 'closed'
   and c.walls_close_at > now();

-- The first tick also opens anything overdue (PSY240 week 3, lecture Sep 23).
select public.qotw_tick();

select cron.schedule('qotw-open-close', '*/5 * * * *', 'select public.qotw_tick()');
