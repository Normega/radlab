-- Recreate the ingest-pdfs storage policies (radlab-academic project).
--
-- Since the storage-infra upgrade (schema now carries archived_at /
-- is_versioned / is_delete_marker; upserts arbitrate on
-- (bucket_id, name COLLATE "C") WHERE archived_at IS NULL), EVERY upload to
-- ingest-pdfs failed with "new row violates row-level security policy for
-- table objects" — student claim PDFs (three students on 2026-09-16; zero
-- claims/ objects have ever landed) AND staff ingest uploads (last success
-- 2026-09-09, before the upgrade).
--
-- Diagnosis, all under RLS impersonation of a real student: every conjunct of
-- the stored WITH CHECK evaluates TRUE standalone, and a freshly created
-- policy with the byte-identical expression PASSES the same insert — but the
-- stored policy FAILS it. The stored parse trees no longer match today's
-- catalog; re-creating the policies re-binds them. Expressions are unchanged.
--
-- Also NEW here: a student SELECT policy on the same path. GapBrowser uploads
-- with upsert:true to a fixed path (claims/<person>/<claim>.pdf), so a second
-- upload takes the ON CONFLICT DO UPDATE branch, which under RLS needs SELECT
-- visibility of the conflicting row. Without it, re-uploading a corrected PDF
-- would fail even with healthy policies.

-- ── students ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "students upload claim pdfs" ON storage.objects;
CREATE POLICY "students upload claim pdfs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ingest-pdfs'
    AND (storage.foldername(name))[1] = 'claims'
    AND (storage.foldername(name))[2] = (current_person_id())::text
  );

DROP POLICY IF EXISTS "students update own claim pdfs" ON storage.objects;
CREATE POLICY "students update own claim pdfs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ingest-pdfs'
    AND (storage.foldername(name))[1] = 'claims'
    AND (storage.foldername(name))[2] = (current_person_id())::text
  )
  WITH CHECK (
    bucket_id = 'ingest-pdfs'
    AND (storage.foldername(name))[1] = 'claims'
    AND (storage.foldername(name))[2] = (current_person_id())::text
  );

-- New: required by upsert's conflict branch on re-upload.
DROP POLICY IF EXISTS "students read own claim pdfs" ON storage.objects;
CREATE POLICY "students read own claim pdfs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ingest-pdfs'
    AND (storage.foldername(name))[1] = 'claims'
    AND (storage.foldername(name))[2] = (current_person_id())::text
  );

-- ── staff ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff upload pdfs" ON storage.objects;
CREATE POLICY "staff upload pdfs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ingest-pdfs'
    AND EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.person_id = current_person_id()
        AND e.role IN ('ta','instructor')
        AND e.status = 'active'
    )
  );

DROP POLICY IF EXISTS "staff update pdfs" ON storage.objects;
CREATE POLICY "staff update pdfs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ingest-pdfs'
    AND EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.person_id = current_person_id()
        AND e.role IN ('ta','instructor')
        AND e.status = 'active'
    )
  )
  WITH CHECK (
    bucket_id = 'ingest-pdfs'
    AND EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.person_id = current_person_id()
        AND e.role IN ('ta','instructor')
        AND e.status = 'active'
    )
  );
