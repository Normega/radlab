-- 20261107_repro_checklist.sql
--
-- Back end of the reproducibility checklist page, public/repro/check.html: Rose's
-- independent rerun of the BCAT and MAIA analyses (Norm, 2026-11-07). The page
-- saves each step's state, messages between Rose and Norm, and uploaded logs.
--
-- Nothing readable is stored here. The page encrypts every payload, message and
-- file in the browser (AES-GCM, key from the passcode in the link Norm sends), so
-- these tables hold ciphertext plus the step id, author and time. The same
-- passcode gives the access token the functions below check; only its SHA-256 is
-- stored, in repro_boards. Board rows are added by hand (execute_sql), so the
-- hash is not in the repository.
--
-- Access is only through the SECURITY DEFINER functions, which check the token.
-- History is append-only: a step's state is its latest 'state' entry.

-- no-api-grants: public.repro_boards -- reached only via the repro_* functions below
create table public.repro_boards (
  board      text primary key check (board ~ '^[a-z0-9-]{3,40}$'),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

-- no-api-grants: public.repro_entries -- reached only via repro_get() and repro_add()
create table public.repro_entries (
  id         bigint generated always as identity primary key,
  board      text not null references public.repro_boards(board),
  item       text not null check (item ~ '^[A-Za-z0-9_.-]{1,40}$'),
  kind       text not null check (kind in ('state', 'message')),
  author     text not null check (author in ('rose', 'norm')),
  payload    text not null check (length(payload) <= 200000),
  created_at timestamptz not null default now()
);
create index repro_entries_board_idx on public.repro_entries (board, id);

-- no-api-grants: public.repro_files -- reached only via repro_add_file() and repro_get_file()
create table public.repro_files (
  id         bigint generated always as identity primary key,
  board      text not null references public.repro_boards(board),
  item       text not null check (item ~ '^[A-Za-z0-9_.-]{1,40}$'),
  author     text not null check (author in ('rose', 'norm')),
  meta       text not null check (length(meta) <= 4000),
  data       text not null check (length(data) <= 14000000),
  bytes      integer not null,
  created_at timestamptz not null default now()
);
create index repro_files_board_idx on public.repro_files (board, id);

-- no-api-grants: public.repro_notifications -- reached only via repro_notify_claim() (service_role)
create table public.repro_notifications (
  board      text not null references public.repro_boards(board),
  kind       text not null check (kind in ('message', 'step')),
  ref        text not null check (length(ref) <= 40),
  created_at timestamptz not null default now(),
  primary key (board, kind, ref)
);

alter table public.repro_boards        enable row level security;
alter table public.repro_entries       enable row level security;
alter table public.repro_files         enable row level security;
alter table public.repro_notifications enable row level security;
-- The project still grants new tables to every role by default; take that back.
revoke all on public.repro_boards, public.repro_entries, public.repro_files, public.repro_notifications
  from public, anon, authenticated;

-- Everything the page needs on load: all entries, and the file list without the data.
create or replace function public.repro_get(p_board text, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.repro_boards b where b.board = p_board
                 and b.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')) then
    raise exception 'not found' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'entries', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'item', e.item, 'kind', e.kind,
                 'author', e.author, 'payload', e.payload, 'at', e.created_at) order by e.id)
               from public.repro_entries e where e.board = p_board), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'item', f.item, 'author', f.author,
                 'meta', f.meta, 'bytes', f.bytes, 'at', f.created_at) order by f.id)
               from public.repro_files f where f.board = p_board), '[]'::jsonb),
    'now', now());
end $$;

create or replace function public.repro_add(p_board text, p_token text, p_item text, p_kind text,
                                            p_author text, p_payload text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.repro_entries;
begin
  if not exists (select 1 from public.repro_boards b where b.board = p_board
                 and b.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')) then
    raise exception 'not found' using errcode = '42501';
  end if;
  insert into public.repro_entries (board, item, kind, author, payload)
  values (p_board, p_item, p_kind, p_author, p_payload) returning * into r;
  return jsonb_build_object('id', r.id, 'at', r.created_at);
end $$;

create or replace function public.repro_add_file(p_board text, p_token text, p_item text, p_author text,
                                                 p_meta text, p_data text, p_bytes integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.repro_files;
begin
  if not exists (select 1 from public.repro_boards b where b.board = p_board
                 and b.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')) then
    raise exception 'not found' using errcode = '42501';
  end if;
  if (select count(*) from public.repro_files f where f.board = p_board) >= 200 then
    raise exception 'too many files' using errcode = '54000';
  end if;
  insert into public.repro_files (board, item, author, meta, data, bytes)
  values (p_board, p_item, p_author, p_meta, p_data, p_bytes) returning * into r;
  return jsonb_build_object('id', r.id, 'at', r.created_at);
end $$;

create or replace function public.repro_get_file(p_board text, p_token text, p_id bigint)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.repro_boards b where b.board = p_board
                 and b.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')) then
    raise exception 'not found' using errcode = '42501';
  end if;
  return (select f.data from public.repro_files f where f.board = p_board and f.id = p_id);
end $$;

-- For the notify_repro Edge Function: checks the token and claims a notification,
-- at most once per message or step and 30 per board per day. Returns null when
-- nothing should be sent.
create or replace function public.repro_notify_claim(p_board text, p_token text, p_kind text, p_ref text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.repro_entries;
begin
  if not exists (select 1 from public.repro_boards b where b.board = p_board
                 and b.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')) then
    return null;
  end if;
  if (select count(*) from public.repro_notifications n
      where n.board = p_board and n.created_at > now() - interval '1 day') >= 30 then
    return null;
  end if;
  if p_kind = 'message' then
    select * into m from public.repro_entries e
    where e.board = p_board and e.kind = 'message' and e.id::text = p_ref;
    if not found then return null; end if;
  elsif p_kind = 'step' then
    select * into m from public.repro_entries e
    where e.board = p_board and e.kind = 'state' and e.item = p_ref order by e.id desc limit 1;
    if not found then return null; end if;
  else
    return null;
  end if;
  insert into public.repro_notifications (board, kind, ref) values (p_board, p_kind, p_ref)
  on conflict do nothing;
  if not found then return null; end if;
  return jsonb_build_object('kind', p_kind, 'item', m.item, 'author', m.author, 'at', m.created_at);
end $$;

revoke all on function public.repro_get(text, text) from public;
revoke all on function public.repro_add(text, text, text, text, text, text) from public;
revoke all on function public.repro_add_file(text, text, text, text, text, text, integer) from public;
revoke all on function public.repro_get_file(text, text, bigint) from public;
revoke all on function public.repro_notify_claim(text, text, text, text) from public, anon, authenticated;
grant execute on function public.repro_get(text, text) to anon, authenticated;
grant execute on function public.repro_add(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.repro_add_file(text, text, text, text, text, text, integer) to anon, authenticated;
grant execute on function public.repro_get_file(text, text, bigint) to anon, authenticated;
grant execute on function public.repro_notify_claim(text, text, text, text) to service_role;
