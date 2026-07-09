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

---

## Migration convention

All Supabase migrations live in `.\supabase\migrations\` and are named `YYYYMMDD_description.sql` (e.g. `20260606_compensation_form.sql`). **Never write migration SQL to the project root.** Run migrations manually in the Supabase SQL editor, or via the Supabase MCP `apply_migration` tool.

**Applied-status manifest**: `supabase/migrations/README.md` records that every migration file up to 2026-07-08 is confirmed applied to the live project (with evidence per file). Do not re-audit those; only migrations dated after 2026-07-08 need checking. When you apply a new migration, add a row to that manifest.

---

## website.md convention — required on every merge to main

`website.md` is the platform's living architecture record. **Every commit/merge to `main` must include a check of website.md, and an update when the change touches anything it documents.** Do this as part of the same commit, not as a follow-up.

The check, concretely:

1. Does the change add/alter behavior, schema, routes, files, or status that website.md describes? If yes, amend the relevant section(s) — status lines, file lists, verified behavior, key decisions.
2. For substantive work (a feature, a migration, a fix verified live), prepend a short clause to the `> Last updated:` header line (newest first, "Prior update:" chaining — see existing entries for the pattern).
3. Tick or add roadmap items in §30 if the work closes or opens one.
4. Docs-only, comment-only, or trivial changes that website.md doesn't describe need no update — but the check itself is not optional.

Rationale: website.md is the context handed to every new working session; a stale entry silently misleads the next session (and has — e.g. an implementation brief that predated a shipped primitive nearly caused a parallel reimplementation).
