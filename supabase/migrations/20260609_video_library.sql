-- Video library: standalone video file registry.
-- Separate from study_videos (which ties videos to specific study tasks).
-- Folder field provides logical grouping in the admin UI; storage path uses a
-- matching prefix but the bucket itself remains flat.

CREATE TABLE IF NOT EXISTS video_library (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text        NOT NULL,
  description      text,
  folder           text        NOT NULL DEFAULT 'General',
  storage_path     text        NOT NULL UNIQUE,
  file_name        text        NOT NULL,
  duration_secs    int,
  file_size_bytes  bigint,
  mime_type        text,
  created_by       uuid        REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE video_library ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read (needed for study runners)
CREATE POLICY "authenticated read" ON video_library
  FOR SELECT TO authenticated USING (true);

-- Lab/admin can upload, update metadata, delete
CREATE POLICY "lab insert" ON video_library
  FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('lab', 'admin'));

CREATE POLICY "lab update" ON video_library
  FOR UPDATE TO authenticated
  USING (my_role() IN ('lab', 'admin'));

CREATE POLICY "lab delete" ON video_library
  FOR DELETE TO authenticated
  USING (my_role() IN ('lab', 'admin'));


-- Fix study_videos: add missing lab write policies.
-- It only had SELECT; lab users need INSERT/UPDATE/DELETE to manage video tasks.
CREATE POLICY "lab insert" ON study_videos
  FOR INSERT TO authenticated
  WITH CHECK (my_role() IN ('lab', 'admin'));

CREATE POLICY "lab update" ON study_videos
  FOR UPDATE TO authenticated
  USING (my_role() IN ('lab', 'admin'));

CREATE POLICY "lab delete" ON study_videos
  FOR DELETE TO authenticated
  USING (my_role() IN ('lab', 'admin'));
