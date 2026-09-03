-- Per-class discussion boards (Norm, 2026-09-03): a Content board and a
-- Technical/Evaluation board per class. Students open threads; ONLY class
-- staff (class_admins) can reply — the rule lives in RLS, not the UI. Reads
-- go through SECURITY DEFINER RPCs that follow the weekly wall's privacy
-- architecture exactly: anonymous avatars, no stable author ids, a `mine`
-- flag, and the derived staff label ('instructor' = classes.created_by,
-- 'ta' = other class_admins). Students can read each other's threads
-- (Norm's call: one answer serves the room). Board presence = feature
-- enabled: a class with no class_boards rows has no boards UI.

create table class_boards (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  key text not null check (key in ('content','technical')),
  title text not null,
  blurb text,
  created_at timestamptz not null default now(),
  unique (class_id, key)
);

create table board_threads (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references class_boards(id) on delete cascade,
  author_id uuid not null references profiles(id),
  title text not null check (btrim(title) <> ''),
  body text not null check (btrim(body) <> ''),
  pinned boolean not null default false,
  answered_at timestamptz,
  closed_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);
create index board_threads_board_idx on board_threads (board_id, created_at desc);

create table board_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references board_threads(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null check (btrim(body) <> ''),
  removed_at timestamptz,
  created_at timestamptz not null default now()
);
create index board_replies_thread_idx on board_replies (thread_id, created_at);

alter table class_boards  enable row level security;
alter table board_threads enable row level security;
alter table board_replies enable row level security;

create policy "class_boards: class read" on class_boards for select to authenticated
using (
  exists (select 1 from class_members cm where cm.class_id = class_boards.class_id and cm.user_id = auth.uid())
  or exists (select 1 from class_admins ca where ca.class_id = class_boards.class_id and ca.user_id = auth.uid())
);

-- Threads: members open them; a student may edit their own thread only until
-- the first reply lands (same spirit as the wall's edit-while-open). Admins
-- manage everything (pin/close/remove/restore). No student SELECT — author_id
-- would leak identity; students read through the RPCs below.
create policy "board_threads: member insert" on board_threads for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from class_boards b
    join class_members cm on cm.class_id = b.class_id and cm.user_id = auth.uid()
    where b.id = board_threads.board_id)
);

create policy "board_threads: own edit until answered" on board_threads for update to authenticated
using (
  author_id = auth.uid() and removed_at is null and closed_at is null
  and not exists (select 1 from board_replies r where r.thread_id = board_threads.id)
) with check (author_id = auth.uid());

create policy "board_threads: admins all" on board_threads for all to authenticated
using (
  exists (
    select 1 from class_boards b
    join class_admins ca on ca.class_id = b.class_id and ca.user_id = auth.uid()
    where b.id = board_threads.board_id)
);

-- Replies: THE rule — only class staff insert. Admin-only select/update too;
-- students read replies via the RPCs.
create policy "board_replies: staff insert" on board_replies for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from board_threads t
    join class_boards b on b.id = t.board_id
    join class_admins ca on ca.class_id = b.class_id and ca.user_id = auth.uid()
    where t.id = board_replies.thread_id)
);

create policy "board_replies: admins manage" on board_replies for all to authenticated
using (
  exists (
    select 1 from board_threads t
    join class_boards b on b.id = t.board_id
    join class_admins ca on ca.class_id = b.class_id and ca.user_id = auth.uid()
    where t.id = board_replies.thread_id)
);

-- First staff reply stamps the thread answered; derived, never hand-set.
create or replace function board_reply_stamps_answered()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update board_threads set answered_at = coalesce(answered_at, now()) where id = new.thread_id;
  return new;
end $$;
create trigger board_reply_answered after insert on board_replies
for each row execute function board_reply_stamps_answered();

-- ---- reads ----------------------------------------------------------------

-- Boards for a class, with thread/unanswered counts. Member-or-admin gated.
create or replace function get_class_boards(p_class_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (
    exists (select 1 from class_members cm where cm.class_id = p_class_id and cm.user_id = auth.uid())
    or exists (select 1 from class_admins ca where ca.class_id = p_class_id and ca.user_id = auth.uid())
  ) then
    raise exception 'not a member of this class';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id, 'key', b.key, 'title', b.title, 'blurb', b.blurb,
      'threads', (select count(*) from board_threads t where t.board_id = b.id and t.removed_at is null),
      'unanswered', (select count(*) from board_threads t where t.board_id = b.id and t.removed_at is null and t.answered_at is null)
    ) order by b.key)
    from class_boards b where b.class_id = p_class_id), '[]'::jsonb);
end $$;

-- Thread list for a board. Identity-stripped: avatar + mine + staff only.
create or replace function get_board_threads(p_board_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_class uuid; v_owner uuid; v_is_admin boolean;
begin
  select b.class_id, cl.created_by into v_class, v_owner
  from class_boards b join classes cl on cl.id = b.class_id where b.id = p_board_id;
  if v_class is null then raise exception 'board not found'; end if;

  v_is_admin := exists (select 1 from class_admins ca where ca.class_id = v_class and ca.user_id = auth.uid());
  if not (v_is_admin or exists (select 1 from class_members cm where cm.class_id = v_class and cm.user_id = auth.uid())) then
    raise exception 'not a member of this class';
  end if;

  return jsonb_build_object(
    'is_admin', v_is_admin,
    'threads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'created_at', t.created_at,
        'pinned', t.pinned, 'answered', t.answered_at is not null,
        'closed', t.closed_at is not null, 'removed', t.removed_at is not null,
        'mine', t.author_id = auth.uid(),
        'replies', (select count(*) from board_replies r where r.thread_id = t.id and r.removed_at is null),
        'staff', case when t.author_id = v_owner then 'instructor'
                      when exists (select 1 from class_admins ca where ca.class_id = v_class and ca.user_id = t.author_id) then 'ta' end,
        'avatar', (select case when a.user_id is null then '{}'::jsonb else jsonb_build_object(
            'skin_color', a.skin_color, 'eye_color', a.eye_color, 'species', a.species,
            'aura', a.aura, 'hair_style', a.hair_style, 'hair_color', a.hair_color)
          end from (select 1) one left join avatars a on a.user_id = t.author_id)
      ) order by t.pinned desc, t.created_at desc)
      from board_threads t
      where t.board_id = p_board_id and (t.removed_at is null or v_is_admin)), '[]'::jsonb)
  );
end $$;

-- One thread with its replies, same stripping.
create or replace function get_board_thread(p_thread_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_class uuid; v_owner uuid; v_is_admin boolean; v_thread jsonb;
begin
  select b.class_id, cl.created_by into v_class, v_owner
  from board_threads t join class_boards b on b.id = t.board_id join classes cl on cl.id = b.class_id
  where t.id = p_thread_id;
  if v_class is null then raise exception 'thread not found'; end if;

  v_is_admin := exists (select 1 from class_admins ca where ca.class_id = v_class and ca.user_id = auth.uid());
  if not (v_is_admin or exists (select 1 from class_members cm where cm.class_id = v_class and cm.user_id = auth.uid())) then
    raise exception 'not a member of this class';
  end if;

  select jsonb_build_object(
    'is_admin', v_is_admin,
    'id', t.id, 'board_id', t.board_id, 'title', t.title, 'body', t.body,
    'created_at', t.created_at, 'pinned', t.pinned,
    'answered', t.answered_at is not null, 'closed', t.closed_at is not null,
    'removed', t.removed_at is not null, 'mine', t.author_id = auth.uid(),
    'editable', t.author_id = auth.uid() and t.removed_at is null and t.closed_at is null
      and not exists (select 1 from board_replies r where r.thread_id = t.id),
    'staff', case when t.author_id = v_owner then 'instructor'
                  when exists (select 1 from class_admins ca where ca.class_id = v_class and ca.user_id = t.author_id) then 'ta' end,
    'avatar', (select case when a.user_id is null then '{}'::jsonb else jsonb_build_object(
        'skin_color', a.skin_color, 'eye_color', a.eye_color, 'species', a.species,
        'aura', a.aura, 'hair_style', a.hair_style, 'hair_color', a.hair_color)
      end from (select 1) one left join avatars a on a.user_id = t.author_id),
    'replies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'body', r.body, 'created_at', r.created_at,
        'removed', r.removed_at is not null, 'mine', r.author_id = auth.uid(),
        'staff', case when r.author_id = v_owner then 'instructor' else 'ta' end,
        'avatar', (select case when a.user_id is null then '{}'::jsonb else jsonb_build_object(
            'skin_color', a.skin_color, 'eye_color', a.eye_color, 'species', a.species,
            'aura', a.aura, 'hair_style', a.hair_style, 'hair_color', a.hair_color)
          end from (select 1) one left join avatars a on a.user_id = r.author_id)
      ) order by r.created_at asc)
      from board_replies r
      where r.thread_id = t.id and (r.removed_at is null or v_is_admin)), '[]'::jsonb)
  ) into v_thread
  from board_threads t
  where t.id = p_thread_id and (t.removed_at is null or v_is_admin);

  if v_thread is null then raise exception 'thread not found'; end if;
  return v_thread;
end $$;

revoke all on function get_class_boards(uuid), get_board_threads(uuid), get_board_thread(uuid) from public, anon;
grant execute on function get_class_boards(uuid), get_board_threads(uuid), get_board_thread(uuid) to authenticated;

-- Seed the two boards for both 2026F classes.
insert into class_boards (class_id, key, title, blurb)
select c.id, v.key, v.title, v.blurb
from classes c
cross join (values
  ('content', 'Content', 'Concepts, readings, lecture material. Ask here — one answer helps the whole class.'),
  ('technical', 'Technical & evaluation', 'R, datatools, assignment mechanics, test logistics. Personal grade matters go to email, not the board.')
) as v(key, title, blurb)
where c.slug in ('psy309', 'psy240')
on conflict (class_id, key) do nothing;
