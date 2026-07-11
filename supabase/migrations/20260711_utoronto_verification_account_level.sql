-- Verification was per-class-membership; moving it to per-account (profiles)
-- so proving utoronto email ownership once carries across every class the
-- student joins with that account, instead of re-verifying per class.
--
-- Security note: profiles already has a broad "own update safe" policy
-- (id = auth.uid(), role/super_admin/study_id held constant) used by every
-- profile-editing feature — avatar, game points, etc. Simply adding
-- utoronto_verified_at as a plain column would let that policy allow a
-- client to set it directly via a raw UPDATE (the exact spoof we already
-- closed once on class_members). RLS can't do column-level restriction
-- inside a single broad policy without breaking every other legitimate
-- profile update, so this uses a BEFORE UPDATE trigger instead: any UPDATE
-- arriving as the `authenticated` role has these 4 columns forced back to
-- their old values. SECURITY DEFINER functions run as their owner (not
-- `authenticated`) and the verification Edge Function runs as `service_role`
-- (also not `authenticated`), so both bypass the trigger's lock — exactly
-- the two trusted paths that should be able to write these columns.

ALTER TABLE profiles
  ADD COLUMN utoronto_email text,
  ADD COLUMN utoronto_verified_at timestamptz,
  ADD COLUMN email_verify_token text,
  ADD COLUMN email_verify_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.protect_utoronto_verification_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.utoronto_email := OLD.utoronto_email;
    NEW.utoronto_verified_at := OLD.utoronto_verified_at;
    NEW.email_verify_token := OLD.email_verify_token;
    NEW.email_verify_expires_at := OLD.email_verify_expires_at;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER protect_utoronto_verification
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_utoronto_verification_columns();

-- class_members no longer carries verification state — drop the columns and
-- the RLS policy that existed only to gate client writes to them. Safe: no
-- real students exist yet, only test rows from this session.
DROP POLICY "class_members: own update pre-verify" ON class_members;
ALTER TABLE class_members
  DROP COLUMN utoronto_email,
  DROP COLUMN utoronto_verified_at,
  DROP COLUMN email_verify_token,
  DROP COLUMN email_verify_expires_at;

DROP FUNCTION public.verify_class_email(text);

-- Replaces verify_class_email. No longer resolves/returns a class slug —
-- verification isn't tied to one class anymore. The email link instead
-- carries the initiating class's slug as its own query param (see the
-- send-class-verification-email Edge Function) so the client can still
-- deep-link "back to class" without the RPC needing to know about classes.
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

  RETURN jsonb_build_object('ok', true);
END;
$function$;
