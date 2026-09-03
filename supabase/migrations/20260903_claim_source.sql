-- radlab-academic: capture the SOURCE behind a student contribution, so that
-- accepting one can draft the page section from the paper itself rather than
-- from the student's summary.
--
-- Why the full text is cached on the claim rather than re-fetched at accept:
-- acceptance happens days later, open-access URLs rot, and an uploaded PDF we
-- would otherwise have to retain can be dropped once its text is extracted.
-- Only the text needed to draft one section is kept, and only until the claim
-- resolves (see purge_claim_sources below).

alter table gap_claims
  add column if not exists source_kind        text,          -- 'oa' | 'upload'
  add column if not exists source_fulltext    text,          -- extracted, truncated
  add column if not exists source_url_full    text,          -- where the OA text came from
  add column if not exists source_captured_at timestamptz,
  add column if not exists integration_status text,          -- 'drafted' | 'failed' | 'skipped'
  add column if not exists integration_note   text,          -- divergence note, or the error
  add column if not exists integration_version_id uuid references wiki_page_versions(id) on delete set null;

alter table gap_claims drop constraint if exists gap_claims_source_kind_check;
alter table gap_claims add constraint gap_claims_source_kind_check
  check (source_kind is null or source_kind in ('oa', 'upload'));

-- Students upload a PDF only when no open-access full text is found. Scoped to
-- their own folder in the existing bucket; staff policy is unchanged.
drop policy if exists "students upload claim pdfs" on storage.objects;
create policy "students upload claim pdfs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ingest-pdfs'
    and (storage.foldername(name))[1] = 'claims'
    and (storage.foldername(name))[2] = current_person_id()::text
  );

-- No student SELECT policy: extraction runs server-side under the service
-- key, so nobody needs to read these back through the client.

-- Housekeeping: cached source text is working material, not a record. Once a
-- claim is accepted-and-drafted or released, the text has done its job.
create or replace function public.purge_claim_sources(p_older_than interval default interval '30 days')
returns integer
language sql security definer
set search_path = public
as $$
  with cleared as (
    update gap_claims
    set source_fulltext = null
    where source_fulltext is not null
      and source_captured_at < now() - p_older_than
      and ((status = 'accepted' and integration_status is not null) or status = 'withdrawn')
    returning 1
  )
  select count(*)::int from cleared;
$$;

revoke all on function public.purge_claim_sources(interval) from public, anon, authenticated;
