-- WP2 finding (caught before any client code shipped, during the join/verify
-- flow design): the WP1 "class_members: own update pre-verify" policy let a
-- client set email_verify_token to any value they chose via a direct table
-- UPDATE. That defeats verification entirely — a client could set
-- utoronto_email + a token of their choosing, then immediately call
-- verify_class_email() with that same token, "verifying" an email address
-- they never received mail at.
--
-- Fix: tighten WITH CHECK so a client-initiated UPDATE can only ever leave
-- email_verify_token/email_verify_expires_at NULL. The only way those
-- columns get a non-null value is the send-class-verification-email Edge
-- Function, which runs with the service-role key (bypasses RLS entirely)
-- after independently confirming the caller owns that class_members row.
-- verify_class_email() (SECURITY DEFINER, also bypasses RLS) remains the
-- only path that can ever set utoronto_verified_at.

DROP POLICY "class_members: own update pre-verify" ON class_members;

CREATE POLICY "class_members: own update pre-verify"
  ON class_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND utoronto_verified_at IS NULL)
  WITH CHECK (
    user_id = auth.uid()
    AND utoronto_verified_at IS NULL
    AND email_verify_token IS NULL
    AND email_verify_expires_at IS NULL
  );

-- verify_class_email now also returns the class slug (looked up under the
-- function's own SECURITY DEFINER privileges) so the client can deep-link
-- back to /class/:slug even when the verifying browser has no session.
CREATE OR REPLACE FUNCTION public.verify_class_email(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member class_members%ROWTYPE;
  v_slug   text;
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

  SELECT slug INTO v_slug FROM classes WHERE id = v_member.class_id;

  RETURN jsonb_build_object('ok', true, 'class_id', v_member.class_id, 'slug', v_slug);
END;
$function$;
