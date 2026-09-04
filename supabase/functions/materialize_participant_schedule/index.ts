// materialize_participant_schedule — builds the schedule for a participant an
// admin has just enrolled into an Experiment Builder (design_graph) study.
//
// Why this exists: admin enrollment used the client-side legacy helper
// `src/lib/scheduleGenerator.js`, which dates only the FIRST row and leaves the
// rest null, expecting `advanceSchedule()` to fill each next date on
// completion. But `advanceSchedule` is only ever called from the admin session
// runner — a participant completing through their own link goes via
// `complete_session_by_token`, which does not advance anything. So every
// session after the first stayed `pending` with a null `scheduled_date`, and
// `check_schedule` only fetches rows with `scheduled_date <= today`, which NULL
// never satisfies.
//
// Worse, those stranded rows are self-perpetuating: check_schedule's advance
// pass (which re-walks the graph and would have materialised them properly)
// skips any participant with an outstanding row, and a null-dated `pending` row
// counts as outstanding. So the participant was stuck permanently, not merely
// delayed. Found 2026-09-04 from a researcher's own protocol test.
//
// `auto-enroll` never had this problem because it calls materializeSchedule
// directly. This function exists so the admin path can reach the SAME module
// rather than a second implementation — materializeSchedule is Deno-only
// (npm: imports) and cannot be imported by the browser.
//
// SCOPE: graph studies only. Non-graph studies keep the existing client-side
// `generateSchedule`, untouched — every non-graph study with participants today
// is single-session, where that helper is correct (one row, dated). The caller
// branches, so this function is never reached for them.
//
// POST body: { participantId, studyId }
// Returns:   { inserted, mode } | { error }

import { createClient } from 'npm:@supabase/supabase-js@2'
import { baselineTimeOfDay, materializeSchedule } from '../_shared/materializeSchedule.ts'
import type { Graph } from '../_shared/materializeSchedule.ts'
import { todayInLabTz } from '../_shared/labDate.ts'
import { requireLabCaller } from '../_shared/requireLabCaller.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed.' }, 405)

  try {
    // Admin-only: this writes schedule rows for someone else, so unlike
    // auto-enroll (which is public by design) it requires a lab caller.
    const caller = await requireLabCaller(req)
    if (caller.error) return json({ error: caller.error.message }, caller.error.status)

    const { participantId, studyId } = await req.json()
    if (!participantId || !studyId) {
      return json({ error: 'participantId and studyId are required' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: study, error: studyErr } = await admin
      .from('studies')
      .select('id, design_graph')
      .eq('id', studyId)
      .single()
    if (studyErr || !study) return json({ error: 'Study not found.' }, 404)

    if (!study.design_graph) {
      // The caller is supposed to branch before reaching here. Refusing rather
      // than silently doing nothing keeps a future miswiring loud.
      return json({ error: 'This study has no design graph; use the legacy schedule path.' }, 400)
    }

    const graph = study.design_graph as Graph

    const result = await materializeSchedule(admin, {
      participantId,
      studyId,
      graph,
      // Lab-local, not UTC: an evening enrollment must anchor to today's date,
      // not UTC's already-rolled-over tomorrow.
      t0Date: todayInLabTz(),
      baselineSendTime: baselineTimeOfDay(graph),
      // unlockFirst deliberately omitted (false). auto-enroll sets it because
      // the PARTICIPANT is in the browser and is handed their link in the same
      // response. Here the RA is in the browser and the participant is not, so
      // the first row must be 'pending' for check_schedule's due-row sender to
      // email it — an 'unlocked' row is never sent (the exact bug that stranded
      // the Phase 2 day-1 email until 2026-07-15).
    })

    return json({ inserted: result.inserted, mode: 'graph' })

  } catch (err) {
    console.error('materialize_participant_schedule error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
