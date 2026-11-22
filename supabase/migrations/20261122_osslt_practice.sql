-- OSSLT practice test submissions (public/osslt/practice.html).
--
-- A logged-out page where a Grade 10 student practises the Ontario Secondary
-- School Literacy Test. "Submit" sends one session's answers here so Norm (or
-- Claude, through SQL) can grade the written responses. Not a study: no
-- enrollment, consent or schedule, so the participant-data schedule_id rule does
-- not apply. The never-overwrite rule (CLAUDE.md rule 5) does: every submission
-- is its own row, a provable double-submit is flagged, never dropped.
--
-- Access: anon may only call osslt_submit(). Nobody reads through the API; staff
-- read the table in the SQL editor or through the Supabase MCP.

create table if not exists public.osslt_submissions (
  id               uuid primary key default gen_random_uuid(),
  student_name     text not null check (char_length(student_name) between 1 and 60),
  session          text not null check (session in ('a', 'b')),
  mc_answers       jsonb not null,           -- { "<question id>": [chosen option indexes] }
  written          jsonb not null,           -- { "<response id>": "text" }
  mc_correct       integer not null,         -- as scored by the page at submit time
  mc_total         integer not null,
  client_elapsed_s integer,                  -- timer reading, if the student used it
  received_at      timestamptz not null default now(),
  resubmission_of  uuid references public.osslt_submissions(id) on delete set null
);
-- no-api-grants: public.osslt_submissions -- reached only via osslt_submit(); staff read it in SQL

create index if not exists osslt_submissions_received_idx on public.osslt_submissions (received_at desc);

alter table public.osslt_submissions enable row level security;
-- The project may still grant new tables to every role by default; take that back.
revoke all on public.osslt_submissions from public, anon, authenticated;

-- Never overwrite (rule 5).
drop trigger if exists forbid_response_overwrite_trg on public.osslt_submissions;
create trigger forbid_response_overwrite_trg before update on public.osslt_submissions
  for each row execute function public.forbid_response_overwrite();

-- One submission. A byte-identical copy of the same student's immediately
-- preceding submission for the same session, within 5 s by the server clock, is
-- kept and marked resubmission_of. A cap of 300 a day stops the endpoint being
-- used as free storage.
create or replace function public.osslt_submit(p_name text, p_session text, p_mc jsonb,
                                               p_written jsonb, p_correct integer, p_total integer,
                                               p_elapsed integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  prev public.osslt_submissions;
  r public.osslt_submissions;
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'name required' using errcode = '22023';
  end if;
  if p_session not in ('a', 'b') or jsonb_typeof(p_mc) <> 'object' or jsonb_typeof(p_written) <> 'object' then
    raise exception 'bad submission' using errcode = '22023';
  end if;
  if octet_length(p_mc::text) + octet_length(p_written::text) > 60000 then
    raise exception 'submission too large' using errcode = '54000';
  end if;
  if (select count(*) from public.osslt_submissions s where s.received_at > now() - interval '1 day') >= 300 then
    raise exception 'too many submissions today' using errcode = '54000';
  end if;

  select * into prev from public.osslt_submissions s
   where lower(s.student_name) = lower(v_name) and s.session = p_session
   order by s.received_at desc limit 1;

  insert into public.osslt_submissions (student_name, session, mc_answers, written, mc_correct, mc_total,
                                        client_elapsed_s, resubmission_of)
  values (v_name, p_session, p_mc, p_written, p_correct, p_total, p_elapsed,
          case when prev.id is not null and prev.received_at > now() - interval '5 seconds'
                    and prev.mc_answers = p_mc and prev.written = p_written
               then prev.id end)
  returning * into r;
  return jsonb_build_object('id', r.id, 'at', r.received_at);
end $$;

revoke all on function public.osslt_submit(text, text, jsonb, jsonb, integer, integer, integer) from public;
grant execute on function public.osslt_submit(text, text, jsonb, jsonb, integer, integer, integer) to anon, authenticated;
