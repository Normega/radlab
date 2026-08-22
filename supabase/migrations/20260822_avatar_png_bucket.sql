-- Avatar PNG rasters for email embedding (2026-08-22).
-- The Ripple avatar exists only as a client-rendered SVG; emails need a PNG
-- at an HTTPS URL. The client rasterizes on avatar save and uploads here;
-- an admin backfill page covers pre-existing users. Bucket is public: paths
-- are unguessable user-id UUIDs, content is a cartoon avatar (low sensitivity).

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatar-png', 'avatar-png', true)
ON CONFLICT (id) DO NOTHING;

-- Users may write exactly their own file: {auth.uid()}.png
CREATE POLICY "avatar png insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatar-png' AND name = auth.uid()::text || '.png');

CREATE POLICY "avatar png update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatar-png' AND name = auth.uid()::text || '.png')
  WITH CHECK (bucket_id = 'avatar-png' AND name = auth.uid()::text || '.png');

-- Lab admins may write any file in this bucket (backfill page).
CREATE POLICY "avatar png admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatar-png' AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'lab' OR super_admin = true)
  ));

CREATE POLICY "avatar png admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatar-png' AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'lab' OR super_admin = true)
  ))
  WITH CHECK (bucket_id = 'avatar-png' AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'lab' OR super_admin = true)
  ));

-- Backfill needs to read every user's avatar config; avatars was own-rows only.
CREATE POLICY "Lab admins read all avatars"
  ON public.avatars FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'lab' OR super_admin = true)
  ));
