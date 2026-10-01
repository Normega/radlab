-- Liliana Study 3 — Paid: a second, paid recruitment route (posters, social media).
--
-- WHY. SONA recruitment is running at ~1.5 consented/day (27 by 2026-10-01); the
-- target is 200+. The REB-approved protocol already allows open recruitment with
-- monetary compensation. Norm, 2026-10-01: QR code on posters -> an onboarding
-- page -> the screener -> ONLY THEN a @mail.utoronto.ca address (no identifying
-- information from anyone who is screened out) -> the baseline link is emailed to
-- that address. Paid at $18/h (Ontario minimum wage) for up to 3 h, by Interac
-- e-transfer within ~5 business days of completion or withdrawal.
--
-- WHY A COPY, NOT A SECOND ROUTE INTO THE SAME STUDY. Consent, debrief,
-- compensation wording, completion experience and the payment report all differ
-- by route; as a separate study each is a plain study setting, and the SONA
-- study -- with participants mid-protocol -- is not touched at all. The cost of
-- copying is smaller than it looks: study_sessions point at the SAME session
-- templates (Liliana Study 3 already shares all 51 with its Live Test), so every
-- intervention, questionnaire and feedback screen is literally the same object
-- and cannot drift. The design graph is duplicated (the design is frozen), and
-- the midpoint randomization balances within each route -- stratified by
-- recruitment route, which the pooled analysis wants anyway.
-- studies.parent_study_id records that the copy belongs to Liliana Study 3, for
-- the duplicate-signup checks below and for pooling at analysis.
--
-- WHAT.
--   1. study_enrollments.external_source gains 'open' (QR / poster / ads).
--   2. studies: parent_study_id, open_join_slug (the public /join/<slug> URL),
--      reply_to_email (participant replies), compensation_kind (credit | pay --
--      the wording of the withdrawal and final-reminder emails).
--   3. The paid study, copied column-for-column from Liliana Study 3 (so no
--      setting is silently dropped), with its own consent and debrief.
--   4. Liliana Study 3 itself: replies go to Liliana (Norm, 2026-10-01).
--   5. One sign-up per email per study family: a unique index on the open route,
--      and record_contact_email refuses an address already registered in the
--      same family (so a paid participant cannot later join through SONA, nor
--      vice versa via open-join, which checks the same thing).
--   6. open_join_attempts: one screener attempt per device; IP throttle.

-- ── 1. Recruitment source ────────────────────────────────────────────────────
ALTER TABLE public.study_enrollments DROP CONSTRAINT IF EXISTS study_enrollments_external_source_check;
ALTER TABLE public.study_enrollments ADD CONSTRAINT study_enrollments_external_source_check
  CHECK (external_source = ANY (ARRAY['sona', 'prolific', 'self', 'open']));

-- ── 2. Study settings ────────────────────────────────────────────────────────
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS parent_study_id   uuid REFERENCES public.studies(id);
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS open_join_slug    text UNIQUE;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS reply_to_email    text;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS compensation_kind text NOT NULL DEFAULT 'credit'
  CHECK (compensation_kind IN ('credit', 'pay'));
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS public_title      text;

COMMENT ON COLUMN public.studies.public_title IS
  'The title participants see on public pages and open-join email (the poster headline). NULL = studies.name.';

COMMENT ON COLUMN public.studies.parent_study_id IS
  'Set on a recruitment-route copy (e.g. Liliana Study 3 — Paid): the study it is a route into. A family = a study plus its copies; one sign-up per email per family.';
COMMENT ON COLUMN public.studies.open_join_slug IS
  'Public onboarding URL /join/<slug> (QR codes). Only studies with a slug accept open-join enrolment.';
COMMENT ON COLUMN public.studies.reply_to_email IS
  'Reply-To on participant emails for this study; NULL = research@radlab.zone.';
COMMENT ON COLUMN public.studies.compensation_kind IS
  'credit (course credit) | pay (money). Chooses the wording of withdrawal and final-reminder emails.';

-- ── 3. The paid study ────────────────────────────────────────────────────────
DO $$
DECLARE
  v_src     constant uuid := '958150a9-7821-4daf-8d83-e9325369d91d';  -- Liliana Study 3
  v_new     uuid := gen_random_uuid();
  v_consent uuid;
  v_debrief uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.studies WHERE parent_study_id = v_src) THEN
    RAISE NOTICE 'Liliana Study 3 — Paid already exists';
    RETURN;
  END IF;

  -- Every column copied, then the route-specific ones overridden.
  INSERT INTO public.studies
  SELECT (jsonb_populate_record(NULL::public.studies,
           to_jsonb(s) || jsonb_build_object(
             'id',                        v_new,
             'name',                      'Liliana Study 3 — Paid',
             'created_at',                now(),
             'active_consent_form_id',    NULL,
             'active_debrief_form_id',    NULL,
             'parent_study_id',           v_src,
             'open_join_slug',            'habits',
             'reply_to_email',            'liliana.wu@mail.utoronto.ca',
             'compensation_kind',         'pay',
             'public_title',              'Can small daily habits help with stress and mood?',
             -- Not reachable through auto-enroll (SONA/Prolific links): open-join only.
             'allow_external_enrollment', false,
             'external_enrollment_source', NULL,
             -- No credit-granting redirect at the end: payment is by e-transfer.
             'completion_redirect_url',   NULL
           ))).*
    FROM public.studies s WHERE s.id = v_src;

  INSERT INTO public.study_sessions (study_id, session_template_id, day_number, send_time, link_expires_hours, label, order_index, node_key)
  SELECT v_new, session_template_id, day_number, send_time, link_expires_hours, label, order_index, node_key
    FROM public.study_sessions WHERE study_id = v_src;

  INSERT INTO public.study_protocol_assignments (study_id, protocol_id, assigned_at, notes)
  SELECT v_new, protocol_id, now(), notes FROM public.study_protocol_assignments WHERE study_id = v_src;

  INSERT INTO public.study_tasks (study_id, protocol_id, order_index, task_type, task_ref_id, repeatable, unlock_conditions, window_hours, label)
  SELECT v_new, protocol_id, order_index, task_type, task_ref_id, repeatable, unlock_conditions, window_hours, label
    FROM public.study_tasks WHERE study_id = v_src;

  -- Consent: the text of the REB consent form ver3 (Informed Consent Form_revised_ver3.docx,
  -- Ethics/amendment; ver2 + tracked edits of 2026-10-01: U of T student, $18/h up to
  -- $54 by Interac e-transfer within ~5 business days, deidentification March 1, 2027
  -- (placeholder pending Norm), payment records, Liliana as contact). NOT the SONA
  -- study's live form, which predates the approved ver2 (it still states a Phase 2
  -- minimum and discontinuation) -- see website.md.
  INSERT INTO public.study_consent_forms (study_id, html_content)
  VALUES (v_new, $consent$<p><strong>Informed Consent Form</strong></p><p>Thank you for your interest in participating in the study.</p><p>You are being invited to participate because you are a University of Toronto student, and your pre-screening responses indicate you may be experiencing moderate symptoms of stress or low mood. To be eligible, participants must score within the moderate range on validated measures of depression (PHQ-8: 10-19) and/or anxiety (GAD-7: 10-14) and must not have a current or recent diagnosis of a cognitive, mood, or substance use disorder. Approximately 150-180 students will participate in this study. Please read the following statements associated with the study:</p><p>I agree to participate in a study to examine the impact of brief online interventions on my emotional well-being. I understand that my participation is entirely voluntary: I can leave the study at any time, and this will have no bearing on the compensation I have already earned, nor will it have any other undesirable consequences.</p><p>The following points have been explained to me:</p><ol><li>The purpose of this research is to examine whether brief daily online interventions may improve perceived stress and emotional well-being in university students, and whether giving participants a choice of intervention with or without feedback about their progress leads to better outcomes. Understanding how choice and feedback shape engagement and effectiveness in digital mental health tools may better inform the development of more accessible, low-cost mental health supports for university students and other populations experiencing moderate stress.</li><li>I understand that I will be asked to answer some longer surveys at the start, middle, and end of the study, and to do brief online interventions and reflections (~4 min) each day during the study.</li><li>I understand that I will be exposed to three brief daily interventions during the first 12-day phase of the study, each targeting a different approach to managing stress. At the midpoint of study, I will be randomly assigned to one of the three groups that will determine how I engage with these interventions during second 12-day phase.</li><li>Procedure. In this fully online study, you will be contacted by email over 31 days, and asked to:<ol><li>Complete this consent form, baseline assessment of your wellbeing, intervention preference, and demographics questionnaire (~ 30 minutes).</li><li>For 12 days complete brief online daily interventions and report on your mood, stress, engagement, and enjoyment (~ 4 min per day).</li><li>Complete a midpoint assessment again measuring your wellbeing and report your intervention preferences (~ 20 minutes).</li><li>For an additional 12 days complete brief online daily interventions and report on your mood, stress, engagement, and enjoyment (~ 4 min per day).</li><li>Complete a final wellbeing assessment and receive a debriefing form about the study (~ 25 minutes)</li></ol></li><li>Compensation. If you complete all study elements you will receive 3 hours of course credit. Each daily intervention and check-in link will be provided to you in an email sent each morning. Each of the 3 major assessments (baseline, midpoint, and final) contributes approximately 30, 20, and 25 minutes of credit respectively, for a combined total of ~1.25 hours.  The remaining ~1.75 hours come from completing the daily interventions and check-ins (24 sessions × ~4 minutes each). To receive full credit for Phase 1, you are expected to complete at least 10 out of 12 daily sessions. If you complete fewer than 10 sessions in Phase 1, you will receive credit only for the sessions completed, rounded up to the nearest half hour. There is no minimum session requirement for Phase 2. If you withdraw early, you will receive credit for the portions of the study you completed, rounded up to the nearest half hour. If you are participating through open recruitment (not through SONA), you will be paid $18 per hour (Ontario minimum wage), up to 3 hours ($54) for full participation, pro-rated to the nearest half hour for partial completion. Payment is made by Interac e-transfer to your University of Toronto email address within approximately 5 business days of your completing or withdrawing from the study, so you must be able to receive Interac e-transfers.</li><li>Benefits. The benefits I may expect to receive from this study are: (a) exposure to brief techniques related to adaptive emotion regulation (b) an appreciation of research on emotion and wellbeing, (c) an opportunity to contribute to scientific research, and (d) compensation for your time, either as course credit (SONA participants) or monetary payment (open recruitment participants)</li><li>Risks. The study is considered minimal risk. The activities in this study involve completing questionnaires about mood and participating in brief online well-being exercises. Although these exercises are designed to promote well-being and positive coping strategies, the researchers acknowledge that some participants may experience temporary emotional discomfort when reflecting on their thoughts or feelings. This study is intended for students experiencing moderate symptoms of stress and low mood. It is not a clinical treatment. If you experience feelings of discomfort at any point during the study, you may refrain from answering any question or withdraw from the study at any time before your data are deidentified (anticipated March 1<sup>st</sup>, 2027) without penalty. You will receive compensation for the portion of the study you have completed up to the time of withdrawal. Information about appropriate campus and community mental health resources will be provided throughout the study, including at each daily-check in. By consenting to participate in this study, you do not waive any legal rights you may have.</li><li>Withdrawal / Leaving the Study. Your participation in this study is voluntary. You may withdraw from the study at any time without negative consequences. If you miss a session, you will simply continue with the next scheduled session the following day. Please note that completing at least 10 out of 12 sessions in Phase 1 is required to receive full Phase 1 credit. There is no minimum attendance requirement for Phase 2. You may request that your data be removed from the study up until your data are deidentified (anticipated on March 1<sup>st</sup>, 2027). After this date, your identifying information (such as name and email) will be permanently removed and replaced with a study ID. Once this process is complete, the research team will no longer be able to link your identity to your data. Because your data will no longer be identifiable after March 1<sup>st</sup>, 2027, It will not be possible to withdraw your data beyond this point. If you choose to withdraw before deidentification, you will receive compensation for the portion of the study you have completed. If you do feel any discomfort at any point, please feel free to raise those concerns to the experimenter. If necessary, participation may be discontinued to protect your well-being.</li><li>Confidentiality. All data collected will remain strictly confidential, and I will be referred to only through a unique study ID number. The Research Oversight and Compliance Office - Human Research Ethics Unit (HREU) may also have confidential access to study data for the purpose of ensuring that participant protection procedures are being followed. Only people associated with the study will see my responses. My name will never be recorded. However, to receive daily intervention and check-in links, I will be asked to provide my email address, which is identifying information. If I am participating through open recruitment, my University of Toronto email address will also be used to send my payment by Interac e-transfer; payment records (my email address, the amount and the date paid) are kept separately from my study responses, as required for university financial records. Once the study is complete, or no later than March 1<sup>st</sup>, 2027, all identifying information will be removed from the study. After this point, my data will be fully deidentified, and it will no longer be possible to determine which data belong to me, even if requested.</li><li>Data Storage. Once the study is complete and all the data has been de-identified, we will share the dataset indefinitely on the Open Science Framework (osf.io), which other researchers can access. Once data is posted to the Open Science Framework, we will no longer be able to remove your data if you decide you wish to withdraw consent.</li><li>Contact. The researcher, Liliana Wu (<a href="mailto:liliana.wu@mail.utoronto.ca">liliana.wu@mail.utoronto.ca</a>), will answer any other questions about the research either now or during the course of the experiment. If I have any other questions or concerns, I can address them to the researcher or to principal investigator: Prof. Norman Farb, <a href="mailto:norman.farb@utoronto.ca">norman.farb@utoronto.ca</a> or by phone at 905-828-3959. You may also contact Prof. Norman Farb to request a summary of research results upon study completion. If you have concerns about your rights as a research participant, please contact the Research Oversight and Compliance Office - Human Research Ethics Unit (HREU) by phone at 416-946-3273, or by email at <a href="mailto:ethics.review@utoronto.ca">ethics.review@utoronto.ca</a>.</li><li>Upon completion of my participation, I will receive a full written explanation about the rationale and predictions underlying this experiment. I may also receive a copy of this consent form by saving this page or by emailing a request for the form to the experimenter above.</li></ol><p>Agreement:</p><p>By signing below, I show that I have fully read and understood the process of this study. I understand that:</p><ul><li>I may be randomized to one of three different interventions focused on adaptive emotion regulation skills.</li><li>I am expected to fill out the three major wellbeing assessments at the start, midpoint, and end of the study.</li><li>I am expected to respond to and complete at least 10 out of 12 daily sessions within the first 12-day intervention period.</li><li>I understand that this study is intended for individuals who may be experiencing moderate symptoms of stress and low mood, and who do not have any known reasons that would prevent them from safely participating in daily online interventions and reflections on mood and stress.</li><li>If I am participating through open recruitment, I am a current University of Toronto student and I am able to receive payment by Interac e-transfer.</li><li>I also understand that my participation in this study is completely voluntary and I may withdraw my participation at any time before my data is deidentified (anticipated on March 1<sup>st</sup>, 2027) without any negative consequences.</li></ul>$consent$)
  RETURNING id INTO v_consent;

  -- Debrief: the SONA debrief with its credit sentence replaced. Built from the
  -- live text so the scientific explanation stays identical across routes.
  INSERT INTO public.study_debrief_forms (study_id, docx_url, html_content)
  SELECT v_new, NULL,
         replace(d.html_content,
           'Please note that you will receive 3 hours of course research participation credit for participating in the study. If you have any further questions about the study, please contact the researcher at <a href="mailto:norman.farb@utoronto.ca">norman.farb@utoronto.ca</a> or (905) 828-3959.',
           'Please note that you will be paid for your participation at $18 per hour, up to $54, by Interac e-transfer to your University of Toronto email address within approximately 5 business days. If you have any further questions about the study, please contact the researcher, Liliana Wu, at <a href="mailto:liliana.wu@mail.utoronto.ca">liliana.wu@mail.utoronto.ca</a>, or the principal investigator at <a href="mailto:norman.farb@utoronto.ca">norman.farb@utoronto.ca</a> or (905) 828-3959.')
    FROM public.study_debrief_forms d
    JOIN public.studies s ON s.active_debrief_form_id = d.id
   WHERE s.id = v_src
  RETURNING id INTO v_debrief;

  IF v_debrief IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.study_debrief_forms WHERE id = v_debrief AND html_content LIKE '%$18 per hour%') THEN
    RAISE EXCEPTION 'paid debrief: the credit sentence was not found in the source debrief -- inspect before proceeding';
  END IF;

  UPDATE public.studies
     SET active_consent_form_id = v_consent, active_debrief_form_id = v_debrief
   WHERE id = v_new;

  RAISE NOTICE 'Liliana Study 3 — Paid created: %', v_new;
END $$;

-- ── 4. Replies on Liliana Study 3 go to Liliana ──────────────────────────────
UPDATE public.studies SET reply_to_email = 'liliana.wu@mail.utoronto.ca'
 WHERE id = '958150a9-7821-4daf-8d83-e9325369d91d';

-- ── 5. One sign-up per email per study family ────────────────────────────────
-- Race guard for the open route (open-join also checks the whole family first).
CREATE UNIQUE INDEX IF NOT EXISTS study_enrollments_open_email_once
  ON public.study_enrollments (study_id, lower(contact_email))
  WHERE external_source = 'open' AND contact_email IS NOT NULL;

-- True when this address already belongs to a different enrollment in the same
-- family (a study and its route copies), whatever that enrollment's status:
-- someone who completed, withdrew or is mid-study through one route cannot sign
-- up again through another.
CREATE OR REPLACE FUNCTION public.email_registered_in_family(p_study uuid, p_email text, p_except_profile uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM study_enrollments e
      JOIN studies s  ON s.id = e.study_id
      JOIN studies me ON me.id = p_study
     WHERE COALESCE(s.parent_study_id, s.id) = COALESCE(me.parent_study_id, me.id)
       AND e.contact_email IS NOT NULL
       AND lower(trim(e.contact_email)) = lower(trim(p_email))
       AND (p_except_profile IS NULL OR e.profile_id <> p_except_profile)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.email_registered_in_family(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.email_registered_in_family(uuid, text, uuid) TO service_role;

-- record_contact_email: unchanged from 20260716_participant_contact_email.sql
-- except the marked block. This is the SONA route's email step, so it is where a
-- paid participant trying to join again through SONA is stopped.
CREATE OR REPLACE FUNCTION public.record_contact_email(p_study_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile uuid := auth.uid();
  v_email   text := trim(p_email);
  v_id      uuid;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'record_contact_email: not authenticated';
  END IF;

  IF v_email IS NULL
     OR length(v_email) > 320
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'record_contact_email: invalid email address';
  END IF;

  -- ── 20261001: one sign-up per email per study family ──────────────────────
  IF public.email_registered_in_family(p_study_id, v_email, v_profile) THEN
    RAISE EXCEPTION 'This email address is already registered for this study. If you think this is a mistake, please contact the research team.';
  END IF;
  -- ───────────────────────────────────────────────────────────────────────────

  UPDATE public.study_enrollments
  SET contact_email        = v_email,
      contact_email_set_at = now()
  WHERE profile_id = v_profile AND study_id = p_study_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'record_contact_email: no enrollment found for this study';
  END IF;

  RETURN jsonb_build_object('contact_email', v_email);
END;
$function$;

-- ── 5b. Payment record ───────────────────────────────────────────────────────
-- participant_compensation (20260606) already holds a 'pay' row per participant
-- with their email; it gains what was paid and when. Written from the payment
-- worksheet (LilianaCreditPage on a compensation_kind = 'pay' study) when Norm
-- marks an e-transfer sent. Lab-only RLS is already in place.
ALTER TABLE public.participant_compensation ADD COLUMN IF NOT EXISTS amount_cad numeric(8,2);
ALTER TABLE public.participant_compensation ADD COLUMN IF NOT EXISTS paid_at    timestamptz;
ALTER TABLE public.participant_compensation ADD COLUMN IF NOT EXISTS paid_by    uuid DEFAULT auth.uid();

-- The participant self-insert policy (20260606) predates these columns; without
-- this, a participant could insert their own row already marked paid. Only the
-- lab records a payment.
DROP POLICY IF EXISTS "participant insert own" ON public.participant_compensation;
CREATE POLICY "participant insert own" ON public.participant_compensation
  FOR INSERT TO authenticated
  WITH CHECK (
    paid_at IS NULL AND amount_cad IS NULL
    AND EXISTS (
      SELECT 1 FROM public.study_enrollments
       WHERE id = enrollment_id AND profile_id = auth.uid()
    )
  );

-- ── 6. Screener attempts on the open route ───────────────────────────────────
-- Written and read only by the open-join Edge Function (service role). RLS on
-- with no policies on purpose: no client role may read or write it.
CREATE TABLE IF NOT EXISTS public.open_join_attempts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id      uuid        NOT NULL REFERENCES public.studies(id),
  device_hash   text,
  ip_hash       text,
  enrollment_id uuid        REFERENCES public.study_enrollments(id) ON DELETE SET NULL,
  src           text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS open_join_attempts_device ON public.open_join_attempts (study_id, device_hash);
CREATE INDEX IF NOT EXISTS open_join_attempts_ip     ON public.open_join_attempts (study_id, ip_hash, created_at);
ALTER TABLE public.open_join_attempts ENABLE ROW LEVEL SECURITY;
