import { useState } from 'react'

// ── Proposed instrument samples (Dana's composable-surveys package) ───────────
// Faithful React reproductions of the approved HTML prototypes in
// "I:\Shared drives\Dana\Dana React Components\radlab-composable-surveys\
// prototypes\", for the PROPOSED column of /admin/instruments. Visual specs
// (palette, radii, box sizes, selected states) are transcribed from the
// prototypes' CSS; her palette values map 1:1 onto our existing tokens
// (--bgp = her tint, --bds = her border-strong, etc.), which is itself
// evidence the proposal was built against the brand.
//
// These are DEMO components — local state, nothing saved. If adopted, the
// real implementations come from her src/components/questionnaire/composable/
// package (which reuses NoDefaultSlider), not from this file.
//
// The `.dana-range` slider chrome lives in index.css (thumb/track are
// pseudo-elements, unreachable from inline styles).

// ── Proposed Likert: horizontal 7-box, endpoint anchors ───────────────────────

export function ProposedLikert() {
  const [v, setV] = useState(null)
  const labels = { 1: 'Not at all a goal for me', 7: 'Very much a goal for me' }
  return (
    <div style={P.pad}>
      <div style={P.card}>
        <span style={P.itemEyebrow}>Item 1</span>
        <p style={P.stem}>I want to learn and master the course material.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10 }}>
          {[1, 2, 3, 4, 5, 6, 7].map(n => {
            const sel = v === n
            return (
              <button
                key={n}
                onClick={() => setV(n)}
                aria-pressed={sel}
                style={{
                  ...P.likertBox,
                  ...(sel ? P.likertBoxSel : {}),
                }}
              >
                <span style={{ ...P.likertValue, color: sel ? 'var(--pkd)' : 'var(--tx)' }}>{n}</span>
                <span style={{ ...P.likertLabel, color: sel ? 'var(--pkd)' : 'var(--tx2)' }}>
                  {labels[n] ?? '\u00a0'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Adopted sliders (Norm, 2026-08-19): two instruments, one chrome ───────────
// Decision: sliders split into a LIKERT slider (discrete steps, point labels,
// no numeric readout — the label is the value) and a NUMERIC slider
// (continuous, sparse numbered anchors, VALUE readout). Both wear Dana's
// track/thumb chrome, combined with the platform's no-default behavior: no
// thumb until the first touch (`is-untouched` in index.css), the same
// anti-anchoring stance NoDefaultSlider has always taken — which her package
// planned to reuse anyway. The VALUE box shows "—" until touched.

export function AdoptedNumericSlider() {
  const [touched, setTouched] = useState(false)
  const [v, setV] = useState(0)
  return (
    <div style={P.pad}>
      <div style={P.card}>
        <p style={P.stem}>
          To what extent does pursuing this goal feel like your own choice, rather than something
          you feel pressured or required to pursue?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 92px', gap: 24, alignItems: 'start' }}>
          <div style={{ minWidth: 0, paddingTop: 9 }}>
            <input
              type="range" min={0} max={100} step={1} value={v}
              className={`dana-range${touched ? '' : ' is-untouched'}`}
              style={{ '--fill': touched ? `${v}%` : '0%' }}
              onChange={e => { setV(Number(e.target.value)); setTouched(true) }}
              aria-label="Own choice rating"
            />
            <div style={{ position: 'relative', minHeight: 44, marginTop: 8, fontSize: 12, lineHeight: 1.35, color: 'var(--tx2)' }}>
              <span style={{ ...P.anchor, left: 0, textAlign: 'left' }}>
                <strong style={P.anchorNum}>0</strong>It does not feel like my own choice
              </span>
              <span style={{ ...P.anchor, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', width: '24%' }}>
                <strong style={P.anchorNum}>50</strong>It partly feels like my own choice
              </span>
              <span style={{ ...P.anchor, right: 0, textAlign: 'right' }}>
                <strong style={P.anchorNum}>100</strong>It feels completely like my own choice
              </span>
            </div>
          </div>
          <div style={P.valuePanel}>
            <span style={P.valueCaption}>Value</span>
            <span style={{ ...P.valueNumber, color: touched ? 'var(--pkd)' : 'var(--gy)' }}>
              {touched ? v : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const LIKERT_SLIDER_LABELS = ['Never', 'Rarely', 'Sometimes', 'Often', 'Very often', 'Almost always']

export function AdoptedLikertSlider() {
  const [touched, setTouched] = useState(false)
  const [v, setV] = useState(1)
  return (
    <div style={P.pad}>
      <div style={P.card}>
        <p style={P.stem}>How often did you notice this feeling today?</p>
        <input
          type="range" min={1} max={6} step={1} value={v}
          className={`dana-range${touched ? '' : ' is-untouched'}`}
          style={{ '--fill': touched ? `${((v - 1) / 5) * 100}%` : '0%' }}
          onChange={e => { setV(Number(e.target.value)); setTouched(true) }}
          aria-label="How often did you notice this feeling today?"
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', marginTop: 8 }}>
          {LIKERT_SLIDER_LABELS.map((label, i) => {
            const sel = touched && v === i + 1
            return (
              <span key={label} style={{
                fontFamily: SANS, fontSize: 11, lineHeight: 1.3, textAlign: 'center',
                color: sel ? 'var(--tx)' : 'var(--tx2)', fontWeight: sel ? 600 : 400,
                overflowWrap: 'anywhere', padding: '0 2px',
              }}>
                {label}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Proposed multiple choice: options with inline text/number entry ───────────

export function ProposedMultipleChoice() {
  const [sel, setSel] = useState(null)
  const [grade, setGrade] = useState('')
  return (
    <div style={P.pad}>
      <p style={P.pageQ}>What final grade are you aiming to achieve in this course?</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...P.mcRow, ...(sel === 'specific' ? P.mcRowSel : {}) }}>
          <button style={P.mcMain} onClick={() => setSel('specific')}>
            <span style={{ ...P.radio, ...(sel === 'specific' ? P.radioSel : {}) }} />
            I am aiming for a specific final grade.
          </button>
          {sel === 'specific' && (
            <div style={P.mcEntry}>
              <input
                type="number" min={0} max={100} value={grade}
                onChange={e => setGrade(e.target.value)}
                placeholder="85"
                style={P.mcInput}
                aria-label="Target grade"
              />
              <span style={{ fontFamily: SANS, fontSize: 14, color: 'var(--tx2)' }}>%</span>
            </div>
          )}
        </div>
        <div style={{ ...P.mcRow, ...(sel === 'pass' ? P.mcRowSel : {}) }}>
          <button style={P.mcMain} onClick={() => setSel('pass')}>
            <span style={{ ...P.radio, ...(sel === 'pass' ? P.radioSel : {}) }} />
            I do not have a specific target grade, as long as I pass.
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Proposed open text list: factors + per-factor contribution slider ─────────

const MAX_WORDS = 5
const wordCount = t => t.trim().split(/\s+/).filter(Boolean).length

export function ProposedOpenList() {
  const [rows, setRows] = useState([
    { text: '', contribution: null, touched: false },
    { text: '', contribution: null, touched: false },
    { text: '', contribution: null, touched: false },
  ])

  function setText(i, text) {
    setRows(prev => {
      const next = prev.map((r, j) => (j === i ? { ...r, text } : r))
      // Typing into the last row grows a new one (capped for the demo).
      if (i === prev.length - 1 && text.trim() && prev.length < 6) {
        next.push({ text: '', contribution: null, touched: false })
      }
      return next
    })
  }

  return (
    <div style={P.pad}>
      <p style={P.pageQ}>
        What do you think caused this outcome? Please list all the factors that you think
        contributed, and indicate how much each factor contributed.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((r, i) => (
          <div key={i} style={P.listRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                value={r.text}
                onChange={e => setText(i, e.target.value)}
                placeholder="Ex. I need better study strategies…"
                style={P.listInput}
                aria-label={`Factor ${i + 1}`}
              />
              <span style={{
                fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', flexShrink: 0,
                color: wordCount(r.text) > MAX_WORDS ? 'var(--err-tx)' : 'var(--gy)',
              }}>
                {wordCount(r.text)}/{MAX_WORDS} words
              </span>
            </div>
            {r.text.trim() !== '' && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
                <p style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--tx2)', margin: '0 0 8px' }}>
                  How much did this factor contribute?
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <input
                    type="range" min={0} max={100} step={1}
                    value={r.contribution ?? 50}
                    className="dana-range"
                    style={{ flex: 1, '--fill': `${r.contribution ?? 50}%` }}
                    onChange={e => setRows(prev => prev.map((row, j) => j === i ? { ...row, contribution: Number(e.target.value), touched: true } : row))}
                    aria-label={`Contribution of factor ${i + 1}`}
                  />
                  <span style={{ fontFamily: MONO, fontSize: 13, color: r.touched ? 'var(--pkd)' : 'var(--gy)', width: 28, textAlign: 'right' }}>
                    {r.touched ? r.contribution : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Proposed hierarchical belief question ─────────────────────────────────────

const BELIEFS = [
  { id: 'skill',    depth: 0, level: 'Skill-specific',                  text: 'My understanding of the specific topic or skill assessed' },
  { id: 'strategy', depth: 1, level: 'Strategy-specific',               text: 'Whether my current study strategy works for this course' },
  { id: 'meta',     depth: 2, level: 'Meta-strategy specific',          text: 'Whether my current strategy for managing my time, effort, and study process works for this course' },
  { id: 'course',   depth: 3, level: 'Course-specific · self-efficacy', text: 'My ability to succeed in this subject area' },
  { id: 'domain',   depth: 4, level: 'Domain-specific · self-efficacy', text: 'My ability to succeed in this domain' },
  { id: 'global',   depth: 5, level: 'Self-global · self-efficacy',     text: 'My general competence / self-worth' },
]

export function ProposedHierarchy() {
  const [state, setState] = useState({})
  const nSel = Object.values(state).filter(s => s?.selected).length

  function toggle(id) {
    setState(prev => ({
      ...prev,
      [id]: prev[id]?.selected ? { selected: false, direction: null, touched: false } : { selected: true, direction: 0, touched: false },
    }))
  }

  return (
    <div style={P.pad}>
      <p style={P.pageQ}>How much did this feedback change your belief about…</p>
      <p style={{ fontFamily: SANS, fontSize: 13, color: 'var(--tx2)', margin: '0 0 14px' }}>
        Select all of the beliefs that changed. You can select more than one.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BELIEFS.map(b => {
          const s = state[b.id]
          return (
            <div key={b.id} style={{ marginLeft: b.depth * 16 }}>
              <div style={{ ...P.mcRow, ...(s?.selected ? P.mcRowSel : {}) }}>
                <button style={P.mcMain} onClick={() => toggle(b.id)}>
                  <span style={{ ...P.checkBox, ...(s?.selected ? P.checkBoxSel : {}) }}>
                    {s?.selected ? '✓' : ''}
                  </span>
                  <span style={P.beliefLevel}>{b.level}</span>
                  <span style={{ fontFamily: SANS, fontSize: 14, color: 'var(--tx)' }}>{b.text}</span>
                </button>
                {s?.selected && (
                  <div style={{ padding: '0 16px 14px 44px' }}>
                    <p style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--tx2)', margin: '0 0 8px' }}>
                      Did this belief change in a positive or negative direction?
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <input
                        type="range" min={-50} max={50} step={1}
                        value={s.direction ?? 0}
                        className="dana-range"
                        style={{ flex: 1, '--fill': `${(s.direction + 50)}%` }}
                        onChange={e => setState(prev => ({ ...prev, [b.id]: { ...prev[b.id], direction: Number(e.target.value), touched: true } }))}
                        aria-label={`Direction of change for ${b.level}`}
                      />
                      <span style={{ fontFamily: MONO, fontSize: 13, color: s.touched ? 'var(--pkd)' : 'var(--gy)', width: 34, textAlign: 'right' }}>
                        {s.touched ? (s.direction > 0 ? `+${s.direction}` : s.direction) : '—'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 11, color: 'var(--gy)', marginTop: 4 }}>
                      <span>Negative change</span><span>No directional change</span><span>Positive change</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gy)', margin: '12px 0 0' }}>
        {nSel === 0 ? 'No beliefs selected' : `${nSel} belief${nSel === 1 ? '' : 's'} selected`}
      </p>
    </div>
  )
}

// ── Styles (transcribed from the prototypes' CSS) ─────────────────────────────

const MONO  = '"Space Mono", "Courier New", monospace'
const SANS  = '"DM Sans", system-ui, sans-serif'
const SERIF = '"DM Serif Display", Georgia, serif'

const P = {
  pad:  { padding: '20px 20px 24px' },
  card: {
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12,
    boxShadow: '0 12px 32px rgba(74, 36, 55, 0.06)', padding: '20px 22px 22px',
  },
  pageQ: {
    fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: 'var(--tx)',
    lineHeight: 1.25, margin: '0 0 12px',
  },
  itemEyebrow: {
    display: 'block', marginBottom: 6, color: 'var(--pkd)', fontFamily: MONO,
    fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
  },
  stem: { margin: '0 0 17px', color: 'var(--tx)', fontFamily: SANS, fontSize: 17, fontWeight: 600, lineHeight: 1.45 },

  likertBox: {
    minHeight: 86, height: '100%', padding: '11px 8px', width: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'var(--bgc)', border: '1.5px solid var(--bds)', borderRadius: 12,
    cursor: 'pointer', textAlign: 'center', transition: 'border-color 180ms ease, background 180ms ease, transform 180ms ease',
  },
  likertBoxSel: {
    background: 'var(--bgp)', borderColor: 'var(--pk)',
    boxShadow: '0 0 0 2px rgba(240, 104, 164, 0.10)', transform: 'translateY(-1px)',
  },
  likertValue: { fontFamily: MONO, fontSize: 18, lineHeight: 1 },
  likertLabel: { minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 11, lineHeight: 1.35 },

  anchor:    { position: 'absolute', top: 0, width: '22%', maxWidth: 165, fontFamily: SANS },
  anchorNum: { display: 'block', marginBottom: 2, color: 'var(--tx)', fontFamily: MONO, fontSize: 11, fontWeight: 400 },
  valuePanel: {
    minHeight: 76, padding: '12px 10px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    background: 'var(--bgp)', border: '1px solid rgba(240, 104, 164, 0.20)', borderRadius: 12,
  },
  valueCaption: { marginBottom: 5, color: 'var(--gy)', fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' },
  valueNumber:  { fontFamily: MONO, fontSize: 25, lineHeight: 1 },

  mcRow: {
    background: 'var(--bgc)', border: '1.5px solid var(--bd)', borderRadius: 12,
    transition: 'border-color 180ms ease, background 180ms ease',
  },
  mcRowSel: { borderColor: 'var(--pk)', background: '#fffafd' },
  mcMain: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
    background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px',
    fontFamily: SANS, fontSize: 15, color: 'var(--tx)',
  },
  radio: {
    width: 18, height: 18, borderRadius: '50%', border: '1.5px solid var(--bds)',
    background: 'var(--bgc)', flexShrink: 0, transition: 'border 180ms ease',
  },
  radioSel: { border: '5px solid var(--pk)' },
  mcEntry: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 14px 46px' },
  mcInput: {
    fontFamily: SANS, fontSize: 15, padding: '8px 12px', width: 110,
    border: '1px solid var(--bds)', borderRadius: 8, background: 'var(--bgc)', color: 'var(--tx)',
  },

  listRow:   { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '14px 16px' },
  listInput: {
    flex: 1, minWidth: 0, fontFamily: SANS, fontSize: 15, padding: '9px 12px',
    border: '1px solid var(--bds)', borderRadius: 8, background: 'var(--bgc)', color: 'var(--tx)',
  },

  checkBox: {
    width: 18, height: 18, borderRadius: 5, border: '1.5px solid var(--bds)', background: 'var(--bgc)',
    flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, color: '#fff', transition: 'all 180ms ease',
  },
  checkBoxSel: { background: 'var(--pk)', borderColor: 'var(--pk)' },
  beliefLevel: {
    fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--pkd)', flexShrink: 0, width: 118, lineHeight: 1.4,
  },
}
