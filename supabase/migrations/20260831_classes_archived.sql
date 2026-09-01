-- Archive flag for classes, and archive the three July test classes.
--
-- Why a flag and not a DELETE (Norm, 2026-08-31: "remove CLASS1, N2, N3 from
-- the academic class list"):
--
--   * The ask is about the DIRECTORY, not the data. /academic lists a course
--     card per class the caller belongs to, and three test classes from July
--     were sitting beside PSY240 and PSY309.
--   * Deleting would not have been limited to Norm's own test data. n2 has one
--     other member and n3 has two, plus 5 lectures between the three — a
--     DELETE cascades their rows away too.
--   * Same reasoning as `studies.active` (CLAUDE.md): the switch that stops a
--     thing appearing should be a flag you can flip back, not a destruction.
--
-- Archived means UNLISTED, not disabled: /academic/<code>, the lounge, the
-- console and the slides all still resolve by direct URL, and the class still
-- appears in /academic/admin (with a chip) so it stays findable and can be
-- un-archived from there. Nothing about a running class changes.

ALTER TABLE classes
  ADD COLUMN archived boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN classes.archived IS
  'Unlisted in the /academic directory. Still fully reachable by direct URL and still shown in /academic/admin. Reversible — this is the archive switch, deletion is separate.';

UPDATE classes SET archived = true
 WHERE slug IN ('class1', 'n2', 'n3');
