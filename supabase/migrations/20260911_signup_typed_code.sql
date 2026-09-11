-- Self-enrollment gains a typed one-time code, harmonising it with the
-- academic side's sign-in doors.
--
-- WHY. University Microsoft 365 mail runs Defender Safe Links, which opens every
-- URL in every message in a real, JavaScript-running browser. The confirmation
-- link is therefore opened by a machine before the student sees it. The
-- academic side met this on 2026-09-04 and settled on TWO independent paths,
-- recorded in academic.md: an emailed link to a page that is inert until a human
-- presses its button, AND a code typed on the door the student started from. As
-- that commit put it, "a scanner clever enough to press buttons still cannot
-- type a code nobody typed". /study/verify became button-gated on 2026-09-11;
-- this adds the second path so the research side works the same way.
--
-- The academic side verifies its code with Supabase's own OTP, which carries
-- server-side brute-force protection. Self-enrollment owns its token, so that
-- protection has to be built here:
--
--   * the code is only valid together with the study AND the email address —
--     never on its own;
--   * five wrong guesses lock the request, after which a new code must be
--     requested (itself throttled by the address cooldown and the IP limiter);
--   * guesses are serialised with FOR UPDATE, so parallel requests cannot race
--     past the limit;
--   * only a salted hash is stored — the plaintext code never lands in a table;
--   * a newer request supersedes older live ones for the same address, so only
--     the most recent email works (matching "a newer code has replaced it").
--
-- Five guesses at a million-code space, per request, per two-minute cooldown, is
-- not a practical brute force. The trade-off worth knowing: someone who knows a
-- student's address can burn five guesses and force them to request a new code.
-- That is the standard OTP trade-off and costs the student one extra email.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.study_signup_requests
  ADD COLUMN IF NOT EXISTS code_hash     text,
  ADD COLUMN IF NOT EXISTS code_attempts integer NOT NULL DEFAULT 0;

-- ── 2. Salted hash ───────────────────────────────────────────────────────────
-- Salted with the request id: identical codes on different requests hash
-- differently, and a leaked table cannot be reversed with a single
-- million-entry lookup table.
CREATE OR REPLACE FUNCTION public.signup_code_hash(p_request_id uuid, p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT encode(extensions.digest(p_request_id::text || ':' || btrim(p_code), 'sha256'), 'hex')
$$;

REVOKE ALL ON FUNCTION public.signup_code_hash(uuid, text) FROM public, anon, authenticated;

-- ── 3. Store a code ──────────────────────────────────────────────────────────
-- The Edge Function generates the code and calls this, so hashing happens in
-- one place and the plaintext is never written anywhere.
CREATE OR REPLACE FUNCTION public.set_signup_code(p_request_id uuid, p_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE study_signup_requests
     SET code_hash = signup_code_hash(p_request_id, p_code),
         code_attempts = 0
   WHERE id = p_request_id;
$$;

-- ── 4. Claim by code ─────────────────────────────────────────────────────────
-- Same return shape as claim_signup_request, so study-signup-verify shares one
-- enrollment path for both. Adds two statuses: 'wrong' (with attempts left) and
-- 'locked'.
--
-- An already-verified address returns 'not_found' here, because finalising a
-- request clears its email_match_key. The caller must NOT resolve that case by
-- looking the enrollment up by email and returning its session link: this
-- function answers 'not_found' BEFORE comparing the code, so doing that would
-- hand any student's session link to anyone who knows their address. The token
-- path can return an existing link safely only because its 32-byte token is
-- itself the secret; an email address is not.
CREATE OR REPLACE FUNCTION public.claim_signup_request_by_code(
  p_study_id uuid, p_match_key text, p_code text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c_max_attempts CONSTANT integer := 5;
  v_req study_signup_requests%ROWTYPE;
BEGIN
  -- The newest live request for this address in this study. FOR UPDATE
  -- serialises concurrent guesses, so the attempt count cannot be raced.
  SELECT * INTO v_req
    FROM study_signup_requests
   WHERE study_id = p_study_id
     AND email_match_key = p_match_key
     AND consumed_at IS NULL
     AND expires_at > now()
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND OR v_req.code_hash IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_req.code_attempts >= c_max_attempts THEN
    RETURN jsonb_build_object('status', 'locked');
  END IF;

  IF v_req.code_hash IS DISTINCT FROM signup_code_hash(v_req.id, p_code) THEN
    UPDATE study_signup_requests
       SET code_attempts = code_attempts + 1
     WHERE id = v_req.id;
    RETURN jsonb_build_object(
      'status', 'wrong',
      'attempts_left', GREATEST(0, c_max_attempts - v_req.code_attempts - 1)
    );
  END IF;

  -- Correct code: claim with the same atomic guarantee as the token path.
  UPDATE study_signup_requests
     SET consumed_at = now()
   WHERE id = v_req.id AND consumed_at IS NULL
  RETURNING * INTO v_req;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'already', 'study_id', p_study_id);
  END IF;

  RETURN jsonb_build_object(
    'status',         'claimed',
    'request_id',     v_req.id,
    'study_id',       v_req.study_id,
    'email',          v_req.email,
    'match_key',      v_req.email_match_key,
    'student_number', v_req.student_number,
    'consented_at',   v_req.consented_at
  );
END;
$$;

-- ── 5. Supersede older live requests ─────────────────────────────────────────
-- Called before a new request is inserted, so only the newest email's link and
-- code work. Expiring (rather than deleting) keeps claim_signup_request's
-- 'expired' answer truthful for anyone who opens an older email.
CREATE OR REPLACE FUNCTION public.supersede_signup_requests(p_study_id uuid, p_match_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE study_signup_requests
     SET expires_at = now()
   WHERE study_id = p_study_id
     AND email_match_key = p_match_key
     AND consumed_at IS NULL
     AND expires_at > now();
$$;

-- ── 6. Purge identifiers from dead requests ──────────────────────────────────
-- Owed since 20260903_self_enrollment.sql. That migration cleared a request's
-- identifiers the moment it was consumed, but a request that is never completed
-- — abandoned, or superseded — kept the email and student number indefinitely,
-- in a table with no consent record to scope them. The design always called for
-- a purge; it was not built. An hour's grace avoids racing a verification that
-- is in flight at the instant of expiry.
--
-- Called opportunistically by study-signup (the same pattern auto-enroll uses to
-- prune enrollment_attempts) rather than adding a standing cron job.
CREATE OR REPLACE FUNCTION public.purge_expired_signup_pii()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE study_signup_requests
     SET email = NULL,
         email_match_key = NULL,
         student_number = NULL,
         code_hash = NULL
   WHERE consumed_at IS NULL
     AND expires_at < now() - interval '1 hour'
     AND (email IS NOT NULL OR student_number IS NOT NULL OR code_hash IS NOT NULL);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── 7. Finalising also discards the code hash ────────────────────────────────
-- Redefines 20260903's finalize_signup_request: a consumed request already
-- lost its email and student number; the hash of a code that can never be used
-- again has no reason to remain either.
CREATE OR REPLACE FUNCTION public.finalize_signup_request(
  p_request_id uuid, p_enrollment_id uuid
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE study_signup_requests
     SET enrollment_id   = p_enrollment_id,
         email           = NULL,
         email_match_key = NULL,
         student_number  = NULL,
         code_hash       = NULL
   WHERE id = p_request_id;
$$;

REVOKE ALL ON FUNCTION public.set_signup_code(uuid, text)                     FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_signup_request_by_code(uuid, text, text)  FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.supersede_signup_requests(uuid, text)           FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_expired_signup_pii()                      FROM public, anon, authenticated;
-- Service role only: these are the Edge Functions' own machinery. A browser able
-- to call claim_signup_request_by_code could guess codes without the address
-- cooldown or IP limiter in front of it.
GRANT EXECUTE ON FUNCTION public.set_signup_code(uuid, text)                    TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_signup_request_by_code(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.supersede_signup_requests(uuid, text)          TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_signup_pii()                     TO service_role;

-- ── 8. Clear what is already stranded ────────────────────────────────────────
SELECT public.purge_expired_signup_pii();
