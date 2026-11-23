-- bre_ratings held only 1–7, but the packet's "Breathing during the breaks" set ends with a
-- percentage item: "For about what percentage of the time were you using the strategy you were
-- taught? (0% to 100%)" (07_Questionnaire_Packet.md, In-task ratings). That item, and only that one,
-- takes 0–100. Applied while the table was empty (20261123_bre_task_tables.sql, same day).

ALTER TABLE public.bre_ratings DROP CONSTRAINT IF EXISTS bre_ratings_value_check;
ALTER TABLE public.bre_ratings ADD CONSTRAINT bre_ratings_value_check CHECK (
  CASE WHEN item_id = 'breath_adherence_pct' THEN value BETWEEN 0 AND 100
       ELSE value BETWEEN 1 AND 7 END
);
