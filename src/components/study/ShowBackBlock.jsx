import { useState, useEffect } from 'react'
import { formatAnswer } from './showBack'

// ── ShowBackBlock ─────────────────────────────────────────────────────────────
//
// Shows a participant their own earlier answer: "On Day 10 you wrote: …".
// Written for the class RCT's repeat days, where a worksheet or practice comes
// round again and the student's own words from last time are what make the
// repeat about something rather than a rerun.
//
// Step JSON:
//   { "type": "show_back",
//     "heading": "On Day 10 you wrote",
//     "items": [ { "module_id": "classrct-ra-d10", "index": 5, "label": "The thought you chose" } ],
//     "follow": "Is that still what comes up, or something else?" }
//
// Each item is the latest intervention_responses row for this participant with
// that module_id and response_index (a step's position in its module). Rows
// are read through the participant's own client; RLS limits them to their own.
//
// Nothing is asserted that is not on record: an item with no row is left out,
// and if no item has one the screen says so plainly instead of inventing a
// memory. In an admin preview (no participant) it says what would appear.

export default function ShowBackBlock({ step, participantId, db }) {
  const items = step.items ?? []
  const [found, setFound] = useState(null)   // null = loading; [] once looked up

  useEffect(() => {
    if (!participantId) return
    let cancelled = false
    Promise.all(items.map(async it => {
      const { data } = await db.from('intervention_responses')
        .select('response_text, created_at')
        .eq('participant_id', participantId)
        .eq('module_id', it.module_id)
        .eq('response_index', it.index)
        .order('created_at', { ascending: false })
        .limit(1)
      const text = formatAnswer(data?.[0]?.response_text)
      return text ? { label: it.label, text } : null
    })).then(rows => { if (!cancelled) setFound(rows.filter(Boolean)) })
    return () => { cancelled = true }
  }, [participantId]) // eslint-disable-line react-hooks/exhaustive-deps

  const preview = !participantId

  return (
    <div style={S.wrap}>
      {step.heading && <p style={S.heading}>{step.heading}</p>}

      {preview && items.map((it, i) => (
        <div key={i} style={S.quote}>
          {it.label && <p style={S.label}>{it.label}</p>}
          <p style={S.placeholder}>[The student’s own answer appears here.]</p>
        </div>
      ))}

      {!preview && found === null && <p style={S.placeholder}>Looking up what you wrote…</p>}

      {!preview && found?.length > 0 && found.map((r, i) => (
        <div key={i} style={S.quote}>
          {r.label && <p style={S.label}>{r.label}</p>}
          <p style={S.text}>{r.text}</p>
        </div>
      ))}

      {!preview && found?.length === 0 && (
        <p style={S.text}>
          Nothing was recorded for that day, so there is nothing to show back. Start fresh today.
        </p>
      )}

      {step.follow && (preview || found?.length > 0) && <p style={S.follow}>{step.follow}</p>}
    </div>
  )
}

const FONT = '"DM Sans", system-ui, sans-serif'

const S = {
  wrap:    { fontFamily: FONT },
  heading: { fontSize: 15, fontWeight: 600, color: 'var(--tx)', margin: '0 0 12px' },
  quote:   { borderLeft: '3px solid var(--pk)', background: 'var(--bgp)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 },
  label:   { fontSize: 12, fontWeight: 600, color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' },
  text:    { fontSize: 15, lineHeight: 1.6, color: 'var(--tx)', margin: 0, whiteSpace: 'pre-wrap' },
  placeholder: { fontSize: 14, lineHeight: 1.6, color: 'var(--tx2)', margin: 0, fontStyle: 'italic' },
  follow:  { fontSize: 15, lineHeight: 1.6, color: 'var(--tx)', margin: '14px 0 0' },
}
