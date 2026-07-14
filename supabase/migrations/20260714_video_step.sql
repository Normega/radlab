-- Video step category: session steps that play a video_library entry through
-- StudyVideoPlayer with full participant tracking (participant_video_sessions
-- + events + complete_video_session), gated Continue at 90% watched.
-- subcategory = video_library.id. First use: Liliana Study 3 introduction
-- video as the final Baseline step (methods doc §4.1).

ALTER TABLE activities DROP CONSTRAINT activities_category_check;
ALTER TABLE activities ADD CONSTRAINT activities_category_check
  CHECK (category = ANY (ARRAY['form'::text, 'game'::text, 'questionnaire'::text, 'physio'::text, 'training'::text, 'vas'::text, 'display'::text, 'midpoint'::text, 'video'::text]));

INSERT INTO activities (category, subcategory, label, description)
VALUES ('video', '049fd6a4-3a3c-4b3d-bc01-270dd30cb21b', 'Introduction Video',
        'Liliana_Study3_Intro — liliana/9a5c500c_introduction_revised_resampled.mp4 (video_library id as subcategory)')
ON CONFLICT (category, subcategory) DO NOTHING;

-- Append as the final Baseline step (after SSCS-L at order_index 11).
INSERT INTO session_template_nodes (session_template_id, order_index, activity_id, label)
SELECT '65822f05-ff79-4da9-b328-e44934d1024e', 12, a.id, 'Introduction Video'
FROM activities a
WHERE a.category = 'video' AND a.subcategory = '049fd6a4-3a3c-4b3d-bc01-270dd30cb21b'
  AND NOT EXISTS (
    SELECT 1 FROM session_template_nodes n
    WHERE n.session_template_id = '65822f05-ff79-4da9-b328-e44934d1024e' AND n.activity_id = a.id
  );
