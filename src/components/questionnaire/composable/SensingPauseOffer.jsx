import { useEffect, useMemo, useRef, useState } from 'react'
import RichText from './RichText'
import { useScrollToTopOn } from '../../../lib/scrollToTop'

// The free-choice pause: a behavioural criterion for the Sense Foraging Scale
// (Study 2b). Mid-survey the participant is offered a break to look, listen and
// feel what is around them, with nothing to do or report. Whether they take it,
// and how long they stay on the quiet screen, is the criterion; nothing about it
// changes their payment. Design: two offers per session (`slot` 1 and 2), chosen
// on 2026-11-02 from five candidates; notes in the sense-foraging-scale repo.
//
// It runs its own little flow on one survey page (offer -> pause or reason ->
// note -> context) and hides the page's Back/Next (`ownsNavigation` in the
// registry); its last button advances the survey through `onAdvance`.
//
// Time on the quiet screen is split three ways on the monotonic clock, so a
// wrong wall clock cannot distort it: on the page (tab visible and focused),
// visible but unfocused (another window in front, on a desktop), and hidden
// (another tab or app, or the phone locked). The value records the split, not a
// single dwell time: walking away is not the same as staying.

export const NUDGE_MS = 180_000   // "Whenever you're ready" after 3 min on the page
export const CAP_MS = 600_000     // the pause ends itself after 10 min in all

const OFFER = 'If you\'d like, you can take a short break here to look, listen and feel what\'s around you.\n\nThere\'s nothing to do and nothing to report. It doesn\'t affect your payment.'

const REASONS = [
  { id: 'no_time', label: 'No time right now' },
  { id: 'not_good_place', label: 'Not a good place' },
  { id: 'not_interested', label: 'Not interested' },
  { id: 'other', label: 'Something else' },
]

const SETTINGS = [
  { id: 'home', label: 'At home' },
  { id: 'work', label: 'At work or school' },
  { id: 'outdoors', label: 'Outdoors' },
  { id: 'transit', label: 'Travelling' },
  { id: 'other', label: 'Somewhere else' },
]

const TIRED = ['Not at all', '', '', '', '', 'Very']

// A stable 0/1 from the seed's participant part (the step wrapper's seed is
// `${scheduleId}:${slug}`), so both offers put the buttons on the same sides.
function sideFromSeed(seed) {
  const key = String(seed ?? '').split(':')[0]
  if (!key) return Math.random() < 0.5 ? 0 : 1
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h % 2
}

function deviceClass() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const w = window.innerWidth
  if (coarse && w < 768) return 'phone'
  if (coarse) return 'tablet'
  return 'desktop'
}

// Accumulates time into on-page / unfocused / hidden buckets and counts what
// the participant does while the quiet screen is up.
function usePauseClock(running, onTick) {
  const ref = useRef(null)
  const tickRef = useRef(onTick)
  useEffect(() => { tickRef.current = onTick })

  useEffect(() => {
    if (!running) return undefined
    const now = () => performance.now()
    const state = () => (document.visibilityState === 'hidden' ? 'hidden' : document.hasFocus() ? 'on' : 'unfocused')
    const c = {
      t0: now(), last: now(), cur: state(),
      on_page_ms: 0, unfocused_ms: 0, hidden_ms: 0,
      hidden_episodes: 0, unfocused_episodes: 0,
      taps: 0, keys: 0, scrolls: 0, lastScroll: -Infinity,
    }
    ref.current = c
    const settle = () => {
      const t = now()
      const d = t - c.last
      if (c.cur === 'on') c.on_page_ms += d
      else if (c.cur === 'unfocused') c.unfocused_ms += d
      else c.hidden_ms += d
      c.last = t
    }
    const change = () => {
      settle()
      const next = state()
      if (next !== c.cur) {
        if (next === 'hidden') c.hidden_episodes += 1
        if (next === 'unfocused') c.unfocused_episodes += 1
        c.cur = next
      }
    }
    const tap = () => { c.taps += 1 }
    const key = () => { c.keys += 1 }
    const scroll = () => {
      const t = now()
      if (t - c.lastScroll > 500) c.scrolls += 1
      c.lastScroll = t
    }
    document.addEventListener('visibilitychange', change)
    window.addEventListener('focus', change)
    window.addEventListener('blur', change)
    window.addEventListener('pointerdown', tap)
    window.addEventListener('keydown', key)
    window.addEventListener('wheel', scroll, { passive: true })
    window.addEventListener('scroll', scroll, { passive: true })
    const timer = setInterval(() => { settle(); tickRef.current?.(c, now() - c.t0) }, 1000)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', change)
      window.removeEventListener('focus', change)
      window.removeEventListener('blur', change)
      window.removeEventListener('pointerdown', tap)
      window.removeEventListener('keydown', key)
      window.removeEventListener('wheel', scroll)
      window.removeEventListener('scroll', scroll)
    }
  }, [running])

  // Closes the books and returns the record (call once, when the pause ends).
  return function stop(endedByTap) {
    const c = ref.current
    if (!c) return null
    const t = performance.now()
    const d = t - c.last
    if (c.cur === 'on') c.on_page_ms += d
    else if (c.cur === 'unfocused') c.unfocused_ms += d
    else c.hidden_ms += d
    c.last = t
    const r = Math.round
    return {
      total_ms: r(t - c.t0),
      on_page_ms: r(c.on_page_ms),
      unfocused_ms: r(c.unfocused_ms),
      hidden_ms: r(c.hidden_ms),
      hidden_episodes: c.hidden_episodes,
      unfocused_episodes: c.unfocused_episodes,
      taps: Math.max(0, c.taps - (endedByTap ? 1 : 0)), // not the tap on "I'm back" itself
      keys: c.keys,
      scrolls: c.scrolls,
    }
  }
}

function Choice({ children, onClick, className = '' }) {
  return (
    <button type="button" className={`cs-pause-choice ${className}`} onClick={onClick}>
      {children}
    </button>
  )
}

export default function SensingPauseOffer({ config, value, onChange, onAdvance, seed }) {
  const slot = config.slot ?? 1
  // Overridable only so a preview can show the nudge and the cap without waiting.
  const nudgeMs = config.nudge_ms ?? NUDGE_MS
  const capMs = config.cap_ms ?? CAP_MS
  const askContext = config.ask_context ?? slot === 2
  const side = useMemo(() => sideFromSeed(seed), [seed])
  const [phase, setPhase] = useState(value?.done ? 'done' : 'offer')
  // Each step of the flow opens at the top, like a new survey page.
  useScrollToTopOn(phase)
  const [nudged, setNudged] = useState(false)
  const [note, setNote] = useState('')
  const [setting, setSetting] = useState(null)
  const [tired, setTired] = useState(null)
  const [shownAt] = useState(() => performance.now())
  // The record is built up as the participant goes and handed to the survey
  // once, when done.
  const [initial] = useState(() => {
    if (value?.done) return value
    const d = new Date()
    return {
      v: 1,
      slot,
      pause_button_side: side === 0 ? 'left' : 'right',
      device: deviceClass(),
      viewport_w: window.innerWidth,
      local_hour: d.getHours(),
      choice: null,
      decision_ms: null,
      decline_reason: null,
      pause: null,
      note: null,
      setting: null,
      tired: null,
      done: false,
    }
  })
  const record = useRef(initial)

  const endRef = useRef(null)
  const stop = usePauseClock(phase === 'quiet', (c, elapsed) => {
    if (!nudged && c.on_page_ms >= nudgeMs) {
      setNudged(true)
      record.current.nudged = true
    }
    if (elapsed >= capMs) endRef.current?.('cap')
  })

  function decide(choice) {
    record.current.choice = choice
    record.current.decision_ms = Math.round(performance.now() - shownAt)
    setPhase(choice === 'pause' ? 'quiet' : 'reason')
  }

  function endPause(endedBy) {
    if (phase !== 'quiet' || record.current.pause) return
    record.current.pause = { ...stop(endedBy === 'button'), ended_by: endedBy, nudged: record.current.nudged === true }
    delete record.current.nudged
    setPhase('note')
  }
  useEffect(() => { endRef.current = endPause })

  function finish(patch = {}) {
    Object.assign(record.current, patch, { done: true })
    const answer = { ...record.current }
    onChange(answer)
    setPhase('done')
    onAdvance?.(answer)
  }

  function afterMain(patch) {
    Object.assign(record.current, patch)
    if (askContext) setPhase('context')
    else finish()
  }

  if (phase === 'offer') {
    const pause = <Choice key="p" onClick={() => decide('pause')}>Take a pause</Choice>
    const go = <Choice key="c" onClick={() => decide('continue')}>Continue the survey</Choice>
    return (
      <section className="cs-question-card cs-pause">
        <div className="cs-pause-text"><RichText text={config.text ?? OFFER} /></div>
        <div className="cs-pause-pair">{side === 0 ? [pause, go] : [go, pause]}</div>
      </section>
    )
  }

  if (phase === 'quiet') {
    return (
      <section className="cs-pause-quiet" aria-live="polite">
        <div className="cs-pause-field" aria-hidden="true" />
        <p className="cs-pause-quiet-text">
          {nudged ? 'Whenever you\'re ready.' : 'Take as long as you like. Tap “I\'m back” when you\'re ready.'}
        </p>
        <button type="button" className="cs-primary-button" onClick={() => endPause('button')}>
          I&apos;m back
        </button>
      </section>
    )
  }

  if (phase === 'reason') {
    return (
      <section className="cs-question-card cs-pause">
        <p className="cs-pause-ask">Any reason? <span className="cs-pause-optional">Optional</span></p>
        <div className="cs-pause-list">
          {REASONS.map(r => (
            <Choice key={r.id} onClick={() => afterMain({ decline_reason: r.id })}>{r.label}</Choice>
          ))}
        </div>
        <button type="button" className="cs-pause-skip" onClick={() => afterMain({ decline_reason: 'skipped' })}>
          Skip
        </button>
      </section>
    )
  }

  if (phase === 'note') {
    return (
      <section className="cs-question-card cs-pause">
        <label className="cs-pause-ask" htmlFor={`${config.id}-note`}>
          Anything you noticed? <span className="cs-pause-optional">Optional</span>
        </label>
        <textarea
          id={`${config.id}-note`}
          className="cs-open-text-input cs-pause-note"
          rows={3}
          maxLength={1000}
          value={note}
          onChange={e => setNote(e.target.value)}
        />
        <div className="cs-pause-end">
          <button type="button" className="cs-primary-button" onClick={() => afterMain({ note: note.trim() || null })}>
            Continue
          </button>
        </div>
      </section>
    )
  }

  if (phase === 'context') {
    const ready = setting != null && tired != null
    return (
      <section className="cs-question-card cs-pause">
        <p className="cs-pause-ask">Where are you right now?</p>
        <div className="cs-pause-list">
          {SETTINGS.map(s => (
            <Choice key={s.id} className={setting === s.id ? 'is-selected' : ''} onClick={() => setSetting(s.id)}>
              {s.label}
            </Choice>
          ))}
          <Choice className={`cs-pause-pna ${setting === 'pna' ? 'is-selected' : ''}`} onClick={() => setSetting('pna')}>
            Prefer not to answer
          </Choice>
        </div>
        <p className="cs-pause-ask cs-pause-ask-next">How tired are you right now?</p>
        <div className="cs-pause-scale" role="radiogroup" aria-label="How tired are you right now?">
          {TIRED.map((label, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={tired === i + 1}
              className={`cs-pause-point ${tired === i + 1 ? 'is-selected' : ''}`}
              onClick={() => setTired(i + 1)}
            >
              <span className="cs-pause-point-n">{i + 1}</span>
              {label ? <span className="cs-pause-point-label">{label}</span> : null}
            </button>
          ))}
        </div>
        <Choice className={`cs-pause-pna ${tired === 'pna' ? 'is-selected' : ''}`} onClick={() => setTired('pna')}>
          Prefer not to answer
        </Choice>
        <div className="cs-pause-end">
          <button
            type="button"
            className={ready ? 'cs-primary-button' : 'cs-primary-button is-waiting'}
            aria-disabled={!ready}
            onClick={() => ready && finish({ setting, tired })}
          >
            Continue
          </button>
        </div>
      </section>
    )
  }

  // Back from a later page: the offer has been answered and is not offered again.
  return (
    <section className="cs-question-card cs-pause">
      <p className="cs-pause-ask">You&apos;ve already answered this part.</p>
      <div className="cs-pause-end">
        <button type="button" className="cs-primary-button" onClick={() => onAdvance?.()}>Continue</button>
      </div>
    </section>
  )
}
