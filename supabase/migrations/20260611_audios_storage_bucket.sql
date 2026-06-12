-- L4: Create a dedicated 'audios' storage bucket separate from 'videos'.
-- Audio files were previously stored in the 'videos' bucket with no path-level
-- isolation; any authenticated user could request signed URLs for audio files
-- they were not enrolled in if they knew the storage path.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('audios', 'audios', false, 52428800, ARRAY['audio/mpeg'])
ON CONFLICT (id) DO NOTHING;

-- Lab can upload, update, and delete audio files
CREATE POLICY "lab upload audio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audios' AND (my_role() = 'lab' OR is_super_admin()));

CREATE POLICY "lab update audio" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audios' AND (my_role() = 'lab' OR is_super_admin()));

CREATE POLICY "lab delete audio" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audios' AND (my_role() = 'lab' OR is_super_admin()));

-- All authenticated users can read (needed to generate signed URLs for participants)
CREATE POLICY "authenticated read audio" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audios');
