-- Re-uploading a claim PDF failed with "new row violates row-level security
-- policy" (Norm, 2026-09-08): the uploader uses upsert:true, an upsert over
-- an existing object is an UPDATE on storage.objects, and the bucket had
-- INSERT policies only. First upload worked; every retry — the exact path a
-- student takes after a DOI with no open-access copy — was refused.
--
-- These mirror the existing INSERT policies precisely: staff anywhere in the
-- bucket, students only within claims/<their-person-id>/.

create policy "staff update pdfs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'ingest-pdfs'
    and exists (
      select 1 from enrollments e
      where e.person_id = current_person_id()
        and e.role in ('ta','instructor') and e.status = 'active'
    )
  )
  with check (
    bucket_id = 'ingest-pdfs'
    and exists (
      select 1 from enrollments e
      where e.person_id = current_person_id()
        and e.role in ('ta','instructor') and e.status = 'active'
    )
  );

create policy "students update own claim pdfs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'ingest-pdfs'
    and (storage.foldername(name))[1] = 'claims'
    and (storage.foldername(name))[2] = (current_person_id())::text
  )
  with check (
    bucket_id = 'ingest-pdfs'
    and (storage.foldername(name))[1] = 'claims'
    and (storage.foldername(name))[2] = (current_person_id())::text
  );
