# RADlab — Claude Code guidance

## RLS policy pattern for game tables

Every table that game code writes to must have explicit RLS policies for the `authenticated` role. RLS is enabled on all tables by default — **a table with RLS enabled but no matching policy silently blocks all operations**, with no error surfaced to the client.

### When adding a new game table, always add at minimum:

**If the table has a `user_id` column:**
```sql
CREATE POLICY "own rows"
  ON your_table
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**If the table only has a `session_id` referencing `game_sessions`:**
```sql
CREATE POLICY "own rows"
  ON your_table
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM game_sessions WHERE id = your_table.session_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM game_sessions WHERE id = your_table.session_id AND user_id = auth.uid()
  ));
```

**If the table has a `participant_id` (text) column:**
```sql
CREATE POLICY "own rows"
  ON your_table
  FOR ALL
  TO authenticated
  USING (participant_id = auth.uid()::text)
  WITH CHECK (participant_id = auth.uid()::text);
```

### Auditing

To check for tables with RLS enabled but no policies (the broken state):
```sql
SELECT c.relname
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relkind = 'r'
  AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND c.relrowsecurity = true
GROUP BY c.relname
HAVING COUNT(p.oid) = 0;
```

### Background

Discovered May 2026: `stillwater_responses` had an anon-only INSERT policy; `drift_performance` and `drift_trials` had no policies at all. Authenticated users were silently blocked from writing game data with no client-side error.
