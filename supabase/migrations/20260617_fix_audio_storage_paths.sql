-- Fix storage_path values for audio files that were uploaded directly to the bucket root
-- before AudioUpload.jsx existed. Those files have name = 'filename.mp3' in storage.objects
-- but study_audios.storage_path was set to 'audio/folder/filename.mp3', causing signed URL
-- generation to fail with "object not found".
--
-- New uploads via AudioUpload.jsx correctly write both the bucket object and the DB record
-- at the same path, so they are unaffected.

UPDATE study_audios sa
SET storage_path = so.name
FROM storage.objects so
WHERE so.bucket_id = 'audios'
  AND regexp_replace(sa.storage_path, '^.*/', '') = so.name
  AND sa.storage_path <> so.name;
