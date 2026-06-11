-- ColorMax schema changes (applied 2026-06-10)
-- Extends aptitude_sessions / aptitude_events for the ColorMax paint-by-number game.

-- 1. Make category_assigned nullable (ColorMax has no category assignment)
ALTER TABLE aptitude_sessions ALTER COLUMN category_assigned DROP NOT NULL;

-- 2. Add game discriminator column ('color_max' | 'aptitude_suite' | ...)
ALTER TABLE aptitude_sessions ADD COLUMN IF NOT EXISTS game    text;

-- 3. Add JSONB results column (per-image scores, toolTime, toolTimeByPage, totalSecs)
ALTER TABLE aptitude_sessions ADD COLUMN IF NOT EXISTS results jsonb;

-- 4. Extend aptitude_events task CHECK to allow 'color_max' events
DO $$
DECLARE v text;
BEGIN
  SELECT conname INTO v
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'aptitude_events' AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%anagram%';
  IF v IS NOT NULL THEN
    EXECUTE 'ALTER TABLE aptitude_events DROP CONSTRAINT ' || quote_ident(v);
  END IF;
END $$;

ALTER TABLE aptitude_events ADD CONSTRAINT aptitude_events_task_check
  CHECK (task IN ('anagram','fluency','wordprobe','color_max'));
