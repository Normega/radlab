-- Class join funnel (2026-08-27)
--
-- Three pieces, decided with Norm 2026-08-27:
--
-- 1. classes.field_guide_url — per-class link to the course textbook (the
--    Field Guide join door). Rendered as a card on /class/:slug. Both fall
--    2026 classes point at the same guide (PSY309 roster access is a
--    follow-up in the academic project).
--
-- 2. class_public_info(slug) — the logged-out /class/:slug page now renders a
--    class-branded join card instead of bouncing to the generic /login (which
--    lost the class context and fed new students into the Ripple welcome
--    flow). classes has authenticated-only read policies, so the card reads
--    name/field_guide_url through this narrow definer RPC, callable by anon.
--    Exposes exactly (id, name, field_guide_url) for one slug — nothing else.
--
-- 3. verify_utoronto_email now also returns the verified email. On a
--    successful verification the client fires the Field Guide's
--    /api/roster-join for that address (best-effort): a roster-matched
--    student gets their Field Guide magic link in the same inbox they are
--    already standing in — Lecture Lounge registration is primary, Field
--    Guide access is inherited from the proven email. Students never enroll
--    anywhere without clicking a link sent to that address (§2a.4 preserved).

ALTER TABLE classes ADD COLUMN field_guide_url text;

UPDATE classes SET field_guide_url = 'https://radlab.zone/academic/fieldguide/join'
 WHERE slug IN ('psy240', 'psy309');

CREATE OR REPLACE FUNCTION public.class_public_info(p_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('id', id, 'name', name, 'field_guide_url', field_guide_url)
  FROM classes WHERE slug = p_slug;
$$;

REVOKE ALL ON FUNCTION public.class_public_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.class_public_info(text) TO anon, authenticated;

-- Same body as 20260711, plus 'email' in the success payload so the client
-- can hand the proven address to the Field Guide bridge.
CREATE OR REPLACE FUNCTION public.verify_utoronto_email(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE email_verify_token = p_token LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_profile.email_verify_expires_at IS NULL OR v_profile.email_verify_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  UPDATE profiles
    SET utoronto_verified_at = now(), email_verify_token = NULL, email_verify_expires_at = NULL
    WHERE id = v_profile.id;

  RETURN jsonb_build_object('ok', true, 'email', v_profile.utoronto_email);
END;
$function$;
