-- Lecture Lounge Phase 1 schema + RLS.
-- Spec: website.md §29. Brief: resources/lecture_lounge_phase1_brief.md.
--
-- checkin_responses and question_votes intentionally do NOT grant students a
-- SELECT policy on other students' rows (privacy — mood taps and votes are
-- per-person). Aggregate views for ResultsView are served through the
-- SECURITY DEFINER get_checkin_mood_results()/get_checkin_pacing_results()
-- RPCs below instead, which return anonymized rows (own row flagged, others
-- unlinked from profile_id).

-- ── classes ─────────────────────────────────────────────────────────────
CREATE TABLE classes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classes: authenticated read"
  ON classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "classes: lab admins create"
  ON classes FOR INSERT
  TO authenticated
  WITH CHECK (my_role() = 'lab' OR is_super_admin());

CREATE POLICY "classes: lab admins delete"
  ON classes FOR DELETE
  TO authenticated
  USING (my_role() = 'lab' OR is_super_admin());

-- ── class_admins ────────────────────────────────────────────────────────
CREATE TABLE class_admins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (class_id, user_id)
);

ALTER TABLE class_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_admins: own or lab read"
  ON class_admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR my_role() = 'lab' OR is_super_admin());

CREATE POLICY "class_admins: lab manage"
  ON class_admins FOR ALL
  TO authenticated
  USING (my_role() = 'lab' OR is_super_admin())
  WITH CHECK (my_role() = 'lab' OR is_super_admin());

-- Deferred from the classes block above: needs class_admins to exist first.
CREATE POLICY "classes: admins update"
  ON classes FOR UPDATE
  TO authenticated
  USING (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (SELECT 1 FROM class_admins ca WHERE ca.class_id = classes.id AND ca.user_id = auth.uid())
  )
  WITH CHECK (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (SELECT 1 FROM class_admins ca WHERE ca.class_id = classes.id AND ca.user_id = auth.uid())
  );

-- ── class_members ───────────────────────────────────────────────────────
CREATE TABLE class_members (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id               uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id                uuid NOT NULL REFERENCES profiles(id),
  utoronto_email         text,
  utoronto_verified_at   timestamptz,
  email_verify_token     text,
  email_verify_expires_at timestamptz,
  created_at             timestamptz DEFAULT now(),
  UNIQUE (class_id, user_id)
);

ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_members: own read"
  ON class_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "class_members: admins read all"
  ON class_members FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM class_admins ca WHERE ca.class_id = class_members.class_id AND ca.user_id = auth.uid()
  ));

CREATE POLICY "class_members: join own"
  ON class_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Verification itself only happens through verify_class_email() (SECURITY
-- DEFINER, bypasses RLS as table owner). This policy only lets a member set
-- their own email/token pre-verification — it can never flip verified_at.
CREATE POLICY "class_members: own update pre-verify"
  ON class_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND utoronto_verified_at IS NULL)
  WITH CHECK (user_id = auth.uid() AND utoronto_verified_at IS NULL);

-- ── lectures ────────────────────────────────────────────────────────────
CREATE TABLE lectures (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  number       integer,
  title        text,
  lecture_date date,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lectures: admins all"
  ON lectures FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM class_admins ca WHERE ca.class_id = lectures.class_id AND ca.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM class_admins ca WHERE ca.class_id = lectures.class_id AND ca.user_id = auth.uid()
  ));

CREATE POLICY "lectures: members read"
  ON lectures FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM class_members cm WHERE cm.class_id = lectures.class_id AND cm.user_id = auth.uid()
  ));

-- ── checkins ────────────────────────────────────────────────────────────
-- status: plain text ('planned' | 'staged' | 'open' | 'closed' | 'results_ready') — platform convention, not a Postgres enum.
CREATE TABLE checkins (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id         uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  position           integer NOT NULL DEFAULT 0,
  config             jsonb NOT NULL DEFAULT '{}'::jsonb,
  status             text NOT NULL DEFAULT 'planned',
  auto_close_seconds integer,
  opened_at          timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins: admins all"
  ON checkins FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lectures l JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE l.id = checkins.lecture_id AND ca.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lectures l JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE l.id = checkins.lecture_id AND ca.user_id = auth.uid()
  ));

CREATE POLICY "checkins: members read live"
  ON checkins FOR SELECT
  TO authenticated
  USING (
    status <> 'planned'
    AND EXISTS (
      SELECT 1 FROM lectures l JOIN class_members cm ON cm.class_id = l.class_id
      WHERE l.id = checkins.lecture_id AND cm.user_id = auth.uid()
    )
  );

-- ── checkin_responses ───────────────────────────────────────────────────
CREATE TABLE checkin_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id       uuid NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
  profile_id       uuid NOT NULL REFERENCES profiles(id),
  mood             jsonb,
  pacing           integer,
  prompt_response  text,
  points_awarded   boolean NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (checkin_id, profile_id)
);

ALTER TABLE checkin_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkin_responses: own read"
  ON checkin_responses FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "checkin_responses: admins read all"
  ON checkin_responses FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE c.id = checkin_responses.checkin_id AND ca.user_id = auth.uid()
  ));

CREATE POLICY "checkin_responses: own write while open"
  ON checkin_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM checkins c WHERE c.id = checkin_responses.checkin_id AND c.status = 'open')
  );

CREATE POLICY "checkin_responses: own update while open"
  ON checkin_responses FOR UPDATE
  TO authenticated
  USING (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM checkins c WHERE c.id = checkin_responses.checkin_id AND c.status = 'open')
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM checkins c WHERE c.id = checkin_responses.checkin_id AND c.status = 'open')
  );

-- ── class_questions ─────────────────────────────────────────────────────
-- status: 'submitted' | 'published' | 'answered' (plain text).
CREATE TABLE class_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id     uuid NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
  profile_id     uuid NOT NULL REFERENCES profiles(id),
  question_text  text NOT NULL,
  status         text NOT NULL DEFAULT 'submitted',
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE class_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_questions: own or published read"
  ON class_questions FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR status = 'published');

CREATE POLICY "class_questions: admins read all"
  ON class_questions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE c.id = class_questions.checkin_id AND ca.user_id = auth.uid()
  ));

CREATE POLICY "class_questions: own write while open"
  ON class_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM checkins c WHERE c.id = class_questions.checkin_id AND c.status = 'open')
  );

CREATE POLICY "class_questions: admins update"
  ON class_questions FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE c.id = class_questions.checkin_id AND ca.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE c.id = class_questions.checkin_id AND ca.user_id = auth.uid()
  ));

-- ── question_votes ──────────────────────────────────────────────────────
CREATE TABLE question_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES class_questions(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (question_id, profile_id)
);

ALTER TABLE question_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "question_votes: members read"
  ON question_votes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM class_questions q JOIN checkins c ON c.id = q.checkin_id
      JOIN lectures l ON l.id = c.lecture_id JOIN class_members cm ON cm.class_id = l.class_id
    WHERE q.id = question_votes.question_id AND q.status = 'published' AND cm.user_id = auth.uid()
  ));

CREATE POLICY "question_votes: own insert on published"
  ON question_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM class_questions q WHERE q.id = question_votes.question_id AND q.status = 'published')
  );

CREATE POLICY "question_votes: own delete"
  ON question_votes FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- ── Realtime: live response counter on the remote (WP3b) ───────────────
ALTER PUBLICATION supabase_realtime ADD TABLE checkin_responses;

-- ── RPCs ────────────────────────────────────────────────────────────────

-- Email verification. Runs as table owner (bypasses RLS), so it is the only
-- path that can ever set utoronto_verified_at — client UPDATE policy above
-- structurally cannot (WITH CHECK forces utoronto_verified_at IS NULL).
CREATE OR REPLACE FUNCTION public.verify_class_email(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member class_members%ROWTYPE;
BEGIN
  SELECT * INTO v_member FROM class_members WHERE email_verify_token = p_token LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_member.email_verify_expires_at IS NULL OR v_member.email_verify_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  UPDATE class_members
    SET utoronto_verified_at = now(), email_verify_token = NULL, email_verify_expires_at = NULL
    WHERE id = v_member.id;

  RETURN jsonb_build_object('ok', true, 'class_id', v_member.class_id);
END;
$function$;

-- Award the fixed 5-point check-in bonus exactly once per (checkin, profile).
-- SECURITY DEFINER so it can flip points_awarded and profiles.points
-- atomically without depending on client-visible row state (RLS on
-- checkin_responses/profiles already permit the equivalent client-side
-- update pattern used by other games, but doing it server-side here closes
-- the re-submit-while-open double-award race the brief calls out).
CREATE OR REPLACE FUNCTION public.award_checkin_points(p_checkin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_already boolean;
BEGIN
  SELECT points_awarded INTO v_already
    FROM checkin_responses WHERE checkin_id = p_checkin_id AND profile_id = auth.uid();

  IF v_already IS NULL THEN
    RETURN jsonb_build_object('error', 'no_response');
  END IF;

  IF v_already THEN
    RETURN jsonb_build_object('ok', true, 'already_awarded', true);
  END IF;

  UPDATE checkin_responses SET points_awarded = true
    WHERE checkin_id = p_checkin_id AND profile_id = auth.uid();

  UPDATE profiles SET points = COALESCE(points, 0) + 5 WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'already_awarded', false);
END;
$function$;

-- Anonymized mood results for ResultsView: every member may see the shape of
-- the aggregate (valence/arousal) but never whose row is whose except their
-- own — checkin_responses itself grants no such cross-member SELECT.
CREATE OR REPLACE FUNCTION public.get_checkin_mood_results(p_checkin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_results jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_members cm ON cm.class_id = l.class_id
    WHERE c.id = p_checkin_id AND cm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE c.id = p_checkin_id AND ca.user_id = auth.uid()
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'valence', mood->>'valence',
    'arousal', mood->>'arousal',
    'pacing', pacing,
    'is_self', profile_id = auth.uid()
  ))
  INTO v_results
  FROM checkin_responses
  WHERE checkin_id = p_checkin_id AND mood IS NOT NULL;

  RETURN COALESCE(v_results, '[]'::jsonb);
END;
$function$;
