-- A VAS scale gets a name, every instrument's slug gets locked.
--
-- WHY (part 1, the name). `vas_scales` carries no human-readable string but the
-- question itself: the library, the session-builder picker and the package
-- builder all show a researcher the SLUG. VasUploadPage has asked for a "Scale
-- name *" since it was written and has never stored the answer — it derives the
-- slug from it and throws it away. This is the same defect fixed for numeric
-- sliders in 20260911_slider_scale_label.sql, and the fix is the same shape:
-- additive, nullable, NO backfill. A row without a name still reads exactly as
-- it does today. Nothing is rewritten, so nothing can be rewritten wrongly.
--
-- `vas_packages` already has `name` (NOT NULL) and needs no column — only the
-- policy below, so a rename can actually land.
--
-- WHY (part 2, the lock). Renaming must never change how an instrument is
-- resolved, because eight studies are live against these rows right now
-- (Liliana Study 3: 96 package nodes and 3 VAS; Sandy Study 3: 5 VAS and 12
-- sliders; the four Dana / Academic Feedback studies: 25-47 sliders each).
--
-- The resolution chain, verified 2026-09-12:
--   session_template_nodes.activity_id -> activities.category/subcategory
--   -> StepDispatcher (category) -> VasStepWrapper strips the 'vas_' /
--   'vas_pkg_' / 'slider_' prefix -> .eq('slug', slug).single()
-- and each answer records `vas_responses.scale_id` (uuid) plus `package_slug`,
-- while the export names its columns from `vas_scales.slug`. So the slug is
-- both the runtime key AND the recorded fact that names an export column
-- (CLAUDE.md, participant data #3). There is no server half to this: no Edge
-- Function, no api/ function and no RPC reads these tables — `admin_delete_user`
-- is the only routine that mentions them, and it deletes by user id.
--
-- Until now "the slug is never updated" was a convention held by the client
-- (InstrumentCreatePage builds its edit patch without it, and says why). A
-- lab-wide UPDATE policy would hand every lab member the ability to write one
-- over the REST API, because RLS grants rows and cannot withhold a column. So
-- section 3 makes it an invariant instead: no participant-facing role may
-- change a slug on any of the four instrument tables, whatever it asks for.
-- Nothing legitimate does — confirmed by reading every update() call against
-- them in src/.

-- ── 1. The column ────────────────────────────────────────────────────────────

ALTER TABLE public.vas_scales
  ADD COLUMN IF NOT EXISTS label text;

COMMENT ON COLUMN public.vas_scales.label IS
  'Human-readable name for the library, the package builder and the session-builder picker. NULL falls back to the question, then the slug. Never used to resolve a step or to name an export column - both of those come from the slug.';

-- ── 2. A rename by any lab member, not only the row's author ─────────────────
--
-- Both tables had exactly one write policy, `created_by = auth.uid()`, so
-- renaming a colleague's scale would have matched zero rows and returned no
-- error - a silent no-op, the failure mode CLAUDE.md opens with. There are 8
-- VAS scales split across 2 owners today, so 7 of the 8 are unwritable by the
-- other lab member.
--
-- UPDATE only, deliberately. `FOR ALL` would also widen DELETE, and deleting a
-- colleague's scale is not what anyone asked for. (An in-use scale is already
-- undeletable - the `activities` row is FK-referenced by session_template_nodes,
-- which is what VasLibraryPage's delete relies on - but an unused one would
-- become fair game for anybody.) INSERT and DELETE stay owner-scoped.

DROP POLICY IF EXISTS "lab rename scales" ON public.vas_scales;
CREATE POLICY "lab rename scales"
  ON public.vas_scales
  FOR UPDATE
  TO authenticated
  USING      (my_role() = 'lab' OR is_super_admin())
  WITH CHECK (my_role() = 'lab' OR is_super_admin());

DROP POLICY IF EXISTS "lab rename packages" ON public.vas_packages;
CREATE POLICY "lab rename packages"
  ON public.vas_packages
  FOR UPDATE
  TO authenticated
  USING      (my_role() = 'lab' OR is_super_admin())
  WITH CHECK (my_role() = 'lab' OR is_super_admin());

-- ── 3. The slug is immutable from the client ─────────────────────────────────
--
-- Shaped after `forbid_response_overwrite` (20260911_responses_never_overwrite):
-- refuse for the participant-facing roles, pass for service_role and postgres,
-- so a deliberate repair from a migration or the SQL editor is still possible.

CREATE OR REPLACE FUNCTION public.forbid_instrument_slug_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION
      '%.slug is immutable: it is the key a live session step resolves and the value recorded on every answer, so renaming one would strand running studies and split a variable across two export columns. Change the name instead.',
      TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.forbid_instrument_slug_change() IS
  'BEFORE UPDATE guard on the instrument tables: authenticated/anon may never change a slug. service_role and postgres are unaffected.';

DROP TRIGGER IF EXISTS forbid_slug_change_trg ON public.vas_scales;
CREATE TRIGGER forbid_slug_change_trg
  BEFORE UPDATE ON public.vas_scales
  FOR EACH ROW EXECUTE FUNCTION public.forbid_instrument_slug_change();

DROP TRIGGER IF EXISTS forbid_slug_change_trg ON public.vas_packages;
CREATE TRIGGER forbid_slug_change_trg
  BEFORE UPDATE ON public.vas_packages
  FOR EACH ROW EXECUTE FUNCTION public.forbid_instrument_slug_change();

DROP TRIGGER IF EXISTS forbid_slug_change_trg ON public.slider_scales;
CREATE TRIGGER forbid_slug_change_trg
  BEFORE UPDATE ON public.slider_scales
  FOR EACH ROW EXECUTE FUNCTION public.forbid_instrument_slug_change();

DROP TRIGGER IF EXISTS forbid_slug_change_trg ON public.composable_instruments;
CREATE TRIGGER forbid_slug_change_trg
  BEFORE UPDATE ON public.composable_instruments
  FOR EACH ROW EXECUTE FUNCTION public.forbid_instrument_slug_change();
