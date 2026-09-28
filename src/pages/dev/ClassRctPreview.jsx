import { useState } from 'react'
import InterventionPage from '../../components/study/InterventionPage'
import { MODULES, CALENDAR } from '../../data/classRct/nonreactivity'

// Review surface for the class RCT's non-reactivity arm.
// Route: /dev/class-rct?day=N   (add &demo=1 for skip buttons)
// Renders the module exactly as a participant would see it; writes nothing.

export default function ClassRctPreview() {
  const params = new URLSearchParams(window.location.search)
  const demo = params.has('demo')
  const [day, setDay] = useState(() => Number(params.get('day')) || 1)
  const [run, setRun] = useState(0)

  const pick = d => {
    setDay(d)
    setRun(r => r + 1)
    const p = new URLSearchParams(window.location.search)
    p.set('day', String(d))
    window.history.replaceState(null, '', `?${p}`)
  }

  const mod = MODULES[day]
  const entry = CALENDAR.find(c => c.day === day)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 8px' }}>
        Class RCT · non-reactivity arm · preview
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
        {CALENDAR.map(c => {
          const built = !!MODULES[c.day]
          const on = c.day === day
          return (
            <button
              key={c.day}
              type="button"
              onClick={() => pick(c.day)}
              title={`${c.title}${c.again ? ` (again, from day ${c.again})` : ''}${built ? '' : ' — not built yet'}`}
              style={{
                width: 38, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${on ? 'var(--tx)' : 'var(--bds)'}`,
                background: on ? 'var(--tx)' : built ? '#fff' : 'transparent',
                color: on ? '#fff' : built ? 'var(--tx)' : 'var(--gy)',
                fontStyle: c.again ? 'italic' : 'normal',
              }}
            >
              {c.day}
            </button>
          )
        })}
      </div>

      {mod ? (
        <InterventionPage
          key={`${day}-${run}`}
          module={mod}
          participantId={null}
          dayDataId={null}
          scheduleId={null}
          studyDay={day}
          onComplete={() => setRun(r => r + 1)}
          demoMode={demo}
        />
      ) : (
        <p style={{ fontSize: 15, color: 'var(--tx2)' }}>
          Day {day} · {entry?.title}{entry?.again ? ` (again, from day ${entry.again})` : ''} — not built yet.
        </p>
      )}
    </div>
  )
}
