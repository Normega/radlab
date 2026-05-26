-- Storage policies for the 'videos' bucket.
-- Authenticated users need SELECT to call createSignedUrl.
-- Lab and admin users can upload and delete.

CREATE POLICY "videos: authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'videos');

CREATE POLICY "videos: lab upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'videos'
    AND my_role() IN ('lab', 'admin')
  );

CREATE POLICY "videos: lab delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'videos'
    AND my_role() IN ('lab', 'admin')
  );
