import { useState } from 'react'
import InterventionPage from '../../components/study/InterventionPage'
import * as nonreactivity from '../../data/classRct/nonreactivity'
import * as reappraisal from '../../data/classRct/reappraisal'

const ARMS = {
  nr: { label: 'Non-reactivity', data: nonreactivity },
  sm: { label: 'Stress mindset', data: reappraisal },
}

// Review surface for the class RCT's text-delivered arms.
// Route: /dev/class-rct?arm=nr|sm&day=N   (add &demo=1 for skip buttons)
// Renders the module exactly as a participant would see it; writes nothing.

export default function ClassRctPreview() {
  const params = new URLSearchParams(window.location.search)
  const demo = params.has('demo')
  const [day, setDay] = useState(() => Number(params.get('day')) || 1)
  const [arm, setArm] = useState(() => (ARMS[params.get('arm')] ? params.get('arm') : 'nr'))
  const [run, setRun] = useState(0)
  const { MODULES, CALENDAR } = ARMS[arm].data

  const go = (d, a) => {
    setDay(d)
    setArm(a)
    setRun(r => r + 1)
    const p = new URLSearchParams(window.location.search)
    p.set('day', String(d))
    p.set('arm', a)
    window.history.replaceState(null, '', `?${p}`)
  }
  const pick = d => go(d, arm)

  const mod = MODULES[day]
  const entry = CALENDAR.find(c => c.day === day)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 8px' }}>
        Class RCT · preview
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {Object.entries(ARMS).map(([key, a]) => (
          <button
            key={key}
            type="button"
            onClick={() => go(day, key)}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${key === arm ? 'var(--tx)' : 'var(--bds)'}`,
              background: key === arm ? 'var(--tx)' : '#fff',
              color: key === arm ? '#fff' : 'var(--tx2)',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
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
          key={`${arm}-${day}-${run}`}
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
