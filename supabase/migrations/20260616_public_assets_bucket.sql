-- Create public-assets bucket for display assets (emojis, icons, images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-assets',
  'public-assets',
  true,
  5242880,  -- 5 MB per file
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
);

-- Anyone (including unauthenticated browsers) can read
CREATE POLICY "public-assets: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'public-assets');

-- Only lab members can upload / update / delete
CREATE POLICY "public-assets: lab write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'public-assets' AND my_role() = 'lab');

CREATE POLICY "public-assets: lab update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING  (bucket_id = 'public-assets' AND my_role() = 'lab')
  WITH CHECK (bucket_id = 'public-assets' AND my_role() = 'lab');

CREATE POLICY "public-assets: lab delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'public-assets' AND my_role() = 'lab');
