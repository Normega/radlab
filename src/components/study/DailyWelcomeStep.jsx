import { useState, useEffect } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
import { interventionStyles as S } from './InterventionPage'

/**
 * Owl "Begin" greeting shown before the pre-check-in of every Liliana daily
 * training session (Phase 1 + Phase 2) — the one node attached to all 48
 * daily templates, per trainingSKILL.md: "The platform handles ... session
 * wrapping (greeting, pre check-in, post check-in, farewell)." Copy is
 * Liliana's canonical wording (Study3/interventions/JSON/landing_page_farewell/
 * welcome-*.json, 2026-07-14).
 *
 * The first_session vs returning variant can't be pinned to a specific
 * session template — Phase 1's condition-block order is counterbalanced, so
 * whichever condition draws first is the participant's literal first daily
 * session, and it varies per participant. Decided at render time instead:
 * first_session iff this participant has zero liliana_day_data rows yet.
 */

const WELCOME = {
  first_session: {
    paragraphs: [
      "Hey there! I'm your friendly Sage Owl, and I'll be here to guide you through today's session. Each day, you'll complete a short check-in, take part in a brief activity, and then answer a few quick questions afterward. The whole session should only take a few minutes.",
      'When you\'re ready, click "Begin" to get started.',
    ],
  },
  returning: {
    paragraphs: [
      "Hey there! Welcome back! It's great to see you again. Before we fly into today's practice, let's begin with a quick check-in.",
      'When you\'re ready, click "Begin" to start today\'s practice.',
    ],
  },
}

const SESSION_STEPS = ['Welcome', 'Check-in', 'Practice', 'Check-in', 'Farewell']

export default function DailyWelcomeStep({ enrollment, scheduleId, onComplete, supabaseClient, demoMode = false }) {
  const supabase = supabaseClient ?? globalSupabase

  const [variant, setVariant] = useState(demoMode ? 'returning' : null)

  useEffect(() => {
    if (demoMode) return
    if (!enrollment?.profile_id) { setVariant('returning'); return }

    let cancelled = false

    async function detect() {
      const { data: lp, error: lpErr } = await supabase.rpc('ensure_liliana_participant', {
        p_schedule_id: scheduleId ?? null,
      })
      if (lpErr || !lp?.participant_id) { if (!cancelled) setVariant('returning'); return }

      const { data: priorDay } = await supabase
        .from('liliana_day_data')
        .select('id')
        .eq('participant_id', lp.participant_id)
        .limit(1)
        .maybeSingle()

      if (!cancelled) setVariant(priorDay ? 'returning' : 'first_session')
    }

    detect()
    return () => { cancelled = true }
  }, [demoMode, enrollment?.profile_id, scheduleId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!variant) return <div style={M.loading}>Preparing your session…</div>

  const content = WELCOME[variant]

  return (
    <div style={S.bg}>
      <div style={S.page}>
        <div style={S.progressBar}>
          <div style={{ display: 'flex' }}>
            {SESSION_STEPS.map((label, i) => {
              const isActive = i === 0
              const color = isActive ? '#2c2c2a' : '#a09d98'
              const track = isActive ? '#2c2c2a' : '#ddd'
              return (
                <div key={label} style={S.stepCol}>
                  <span style={{ ...S.stepLabel, color }}>{label}</span>
                  <div style={{ ...S.stepTrack, background: track }}>
                    <div style={{ ...S.stepDot, background: track }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={S.owlScreen}>
          <img src="/assets/owls/owl_waving.png" alt="" style={S.owlImg} />
          <div style={S.speechBubble}>
            {content.paragraphs.map((p, i) => (
              <p key={i} style={{ margin: i === 0 ? 0 : '12px 0 0' }}>{p}</p>
            ))}
          </div>
        </div>

        <div style={S.footer}>
          <button style={S.btnNext} onClick={() => onComplete?.({ welcome_variant: variant })}>
            Begin
          </button>
        </div>
      </div>
    </div>
  )
}

const M = {
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 300, padding: 40, textAlign: 'center',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 15, color: '#888780',
  },
}
