-- Fix for the avatar-png backfill RLS failures (2026-08-22).
-- storage-api (object-versioning-core, migration 62) writes uploads as
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING *, and under RLS the
-- RETURNING row must satisfy a SELECT policy. avatar-png had write policies
-- but no SELECT policy (public-URL reads bypass RLS), so every upload —
-- including a user's own — failed with "new row violates row-level security".
CREATE POLICY "avatar png authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatar-png');
