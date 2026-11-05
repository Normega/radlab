import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PracticeTaskStep from '../../components/study/PracticeTaskStep'
import '../../components/study/practiceTask/practiceTask.css'

// The lab's own no-save preview of a practice task step (Sandy Study 4's
// breathing practice or reading task), outside any study.
// Route: /admin/practice-preview (AdminRoute). `?arm=breathing|reading` opens an
// arm directly; `?short=1` runs the breathing practice for 30 seconds;
// `?hold=0` turns off the hold-while-breathing-in check, which Study 4 uses.
//
// It is the real participant step in demoMode, so nothing is written, and at the
// end it shows the record a participant's session would have saved.

const SHORT = { breathing_seconds: 30 }

export default function PracticeTaskPreview() {
  const [params] = useSearchParams()
  const initialArm = ['breathing', 'reading'].includes(params.get('arm')) ? params.get('arm') : null
  const [arm, setArm]     = useState(initialArm)
  const [short, setShort] = useState(params.get('short') === '1')
  const [hold, setHold]   = useState(params.get('hold') !== '0')
  const [run, setRun]     = useState(0)

  const pick = a => { setArm(a); setRun(r => r + 1) }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="pt-page" style={{ paddingBottom: 0 }}>
        <div className="pt-demo" style={{ marginBottom: 0 }}>
          <strong>Practice task preview</strong> (Sandy Study 4, step 6). Nothing is saved. Participants are
          assigned one arm at random and never see these controls.
          <div className="pt-actions">
            <button type="button" className="pt-btn-quiet" aria-pressed={arm === 'breathing'} onClick={() => pick('breathing')}>Breathing practice</button>
            <button type="button" className="pt-btn-quiet" aria-pressed={arm === 'reading'} onClick={() => pick('reading')}>Reading task</button>
            <label className="pt-muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={short} onChange={e => { setShort(e.target.checked); setRun(r => r + 1) }} />
              Short breathing practice (30 seconds)
            </label>
            <label className="pt-muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={hold} onChange={e => { setHold(e.target.checked); setRun(r => r + 1) }} />
              Hold while breathing in (adherence check)
            </label>
          </div>
        </div>
      </div>
      {arm && (
        <PracticeTaskStep
          key={`${arm}-${short}-${hold}-${run}`}
          subcategory="breathing_or_reading"
          demoMode
          previewArm={arm}
          previewConfig={{ ...(short ? SHORT : {}), hold_to_inhale: hold }}
        />
      )}
    </div>
  )
}
