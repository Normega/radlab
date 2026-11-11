// /mcc (and /mcc/:code for rehearsal) — the audience's phone during "Two ways
// of paying attention" (MCC Summit, Nov 15 2026, on Zoom). Public, no login,
// nothing personal: the same random device id as the other talk phones
// (localStorage 'talkpoll:device').
//
// Two parts, one link, so it can sit in the Zoom chat for the whole talk:
//   1. eight statements, the 8-statement Sense Foraging Scale after a short
//      definition of the two modes (talk_poll_scale_submit, 20261111_talk_poll_scale.sql);
//   2. a two-minute Toggle practice anchored on sounds (talk_poll_toggle_submit,
//      the Tanenbaum phone's Practice and Timeline).
//
// The phone does not follow the projector; the presenter says when to move on.
// Progress is remembered per poll round, so a refresh doesn't restart it and a
// new round (before the real talk) does. Late arrivals can skip to the practice.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSubmitLock } from '../../lib/useSubmitLock'
import { deviceId, P } from '../socpers-oct-2026/PollPhone'
import { Practice, Timeline } from '../tanenbaum-nov-2026/LivePhone'
import { STORY, SENSE } from '../tanenbaum-nov-2026/toggle'
import { LIVE_POLL, FORM, ANCHOR, MODES_INTRO, SCALE, ITEMS, personScore } from './scale'

export default function MccPhone() {
  const params = useParams()
  const code = params.code ?? LIVE_POLL
  const [device] = useState(deviceId)
  const [info, setInfo] = useState(undefined)     // undefined = loading, null = unknown poll
  // welcome → scale → thanks → toggle → run → done
  const [stage, setStage] = useState('welcome')
  const [answers, setAnswers] = useState(null)    // what this phone sent, for its own summary
  const [taps, setTaps] = useState([])
  const key = info ? `mcc:${code}:${info.round}` : null

  useEffect(() => {
    document.title = 'Live · Two ways of paying attention'
    supabase.rpc('talk_poll_info', { p_code: code }).then(({ data }) => {
      const row = data?.[0] ?? null
      setInfo(row)
      if (!row) return
      try {
        const k = `mcc:${code}:${row.round}`
        const sent = JSON.parse(localStorage.getItem(`${k}:scale`) || 'null')
        const tog = JSON.parse(localStorage.getItem(`${k}:toggle`) || 'null')
        if (sent) { setAnswers(sent); setStage('toggle') }
        if (tog?.taps?.length) { setTaps(tog.taps); setStage('done') }
      } catch { /* fresh start */ }
    })
  }, [code])

  const scaleSent = (a) => {
    setAnswers(a); setStage('thanks')
    try { localStorage.setItem(`${key}:scale`, JSON.stringify(a)) } catch { /* ignore */ }
  }
  const finished = (all) => {
    setTaps(all); setStage('done')
    try { localStorage.setItem(`${key}:toggle`, JSON.stringify({ taps: all })) } catch { /* ignore */ }
  }

  if (stage === 'run') return <Practice code={code} device={device} onDone={finished} anchor={ANCHOR} />

  let body
  let kicker = 'Live'
  if (info === undefined) body = <p style={P.sub}>Loading…</p>
  else if (info === null) body = <p style={P.sub}>This link isn’t active.</p>
  else if (!info.is_open) body = <p style={P.sub}>This poll is closed. Thanks for taking part.</p>
  else if (stage === 'welcome') {
    kicker = 'Part 1 · about a minute'
    body = (
      <div style={P.form}>
        <h1 style={P.h1}>Two ways of paying attention</h1>
        {MODES_INTRO.map((t, k) => <p key={k} style={P.sub}>{t}</p>)}
        <p style={{ ...P.sub, color: 'var(--tx)' }}>Next: eight short statements about how you pay attention in general. There are no right or wrong answers.</p>
        <button style={P.primary} onClick={() => setStage('scale')}>Start</button>
        <button style={M.link} onClick={() => setStage('toggle')}>Joining late? Skip to the listening practice</button>
      </div>
    )
  }
  else if (stage === 'scale') { kicker = 'Part 1 · how you pay attention'; body = <ScaleForm code={code} device={device} onDone={scaleSent} /> }
  else if (stage === 'thanks') {
    kicker = 'Part 1 · sent'
    body = <Thanks answers={answers} onNext={() => setStage('toggle')} />
  }
  else if (stage === 'toggle') {
    kicker = 'Part 2 · a listening practice'
    body = (
      <div style={P.form}>
        <h1 style={P.h1}>Toggle</h1>
        <p style={P.sub}>For two minutes, rest your attention on the sounds around you, near and far. Minds wander; that’s expected. Your only job is to notice.</p>
        <div style={M.modes}>
          <div style={{ ...M.mode, borderColor: `${STORY}66` }}><b style={{ ...M.modeName, color: STORY }}>Story</b><span>Tap when you notice you’re thinking: planning, remembering, judging, explaining.</span></div>
          <div style={{ ...M.mode, borderColor: `${SENSE}66` }}><b style={{ ...M.modeName, color: '#c04a82' }}>Sense</b><span>Tap when you’re back with the sounds: whatever you can hear, as it is.</span></div>
        </div>
        <p style={P.sub}>You start in Sense. Wait for the cue, then press Begin. Eyes open or closed, whichever is comfortable.</p>
        <button style={P.primary} onClick={() => setStage('run')}>Begin</button>
        {!answers && <button style={M.link} onClick={() => setStage('welcome')}>Back to the eight statements</button>}
      </div>
    )
  }
  else { kicker = 'Your two minutes'; body = <Timeline taps={taps} anchor={ANCHOR} /> }

  return (
    <div style={P.page}>
      <div style={P.card}>
        <p style={P.kicker}>{kicker} · {info?.title ?? ''}</p>
        {body}
        <p style={P.foot}>Anonymous. No name, no login. Answers are shown only as a group, and nothing is kept for research.</p>
      </div>
    </div>
  )
}

function ScaleForm({ code, device, onDone }) {
  // undefined = not yet answered, null = prefer not to answer, 1-6 = the answer
  const [vals, setVals] = useState(() => ITEMS.map(() => undefined))
  const [err, setErr] = useState(null)
  const { submit, busy } = useSubmitLock('mcc-scale')
  const left = vals.filter(v => v === undefined).length
  const answered = vals.filter(v => v != null).length
  const set = (k, v) => setVals(vs => vs.map((x, j) => (j === k ? v : x)))

  const send = () => submit(async () => {
    setErr(null)
    const answers = vals.map(v => (v === undefined ? null : v))
    const { data, error } = await supabase.rpc('talk_poll_scale_submit', {
      p_code: code, p_device: device, p_form: FORM, p_answers: answers,
    })
    if (error || data !== 'ok') {
      setErr(data === 'closed' ? 'The poll has closed.' : data === 'limit' ? 'That’s the most times this poll takes answers.' : 'That didn’t go through. Try again.')
      throw error ?? new Error(data)
    }
    onDone(answers)
  })

  return (
    <div style={P.form}>
      <h1 style={{ ...P.h1, fontSize: 28 }}>In general, how much do you agree with each statement?</h1>
      {ITEMS.map((it, k) => (
        <div key={it.code} style={M.item}>
          <p style={M.stem}><span style={M.num}>{k + 1}</span>{it.text}</p>
          <div style={M.scale} role="radiogroup" aria-label={it.text}>
            {SCALE.map(o => (
              <button key={o.value} role="radio" aria-checked={vals[k] === o.value} aria-label={o.label}
                onClick={() => set(k, o.value)} style={{ ...M.opt, ...(vals[k] === o.value ? P.optOn : {}) }}>{o.value}</button>
            ))}
          </div>
          <div style={P.ends}><span>Strongly disagree</span><span>Strongly agree</span></div>
          <button onClick={() => set(k, null)} style={{ ...M.pna, ...(vals[k] === null ? M.pnaOn : {}) }}>Prefer not to answer</button>
        </div>
      ))}
      {err && <p style={P.err}>{err}</p>}
      <button style={{ ...P.primary, opacity: left === 0 && answered > 0 && !busy ? 1 : 0.4 }} disabled={left > 0 || answered === 0 || busy} onClick={send}>
        {busy ? 'Sending…' : left > 0 ? `${left} to go` : 'Send'}
      </button>
    </div>
  )
}

function Thanks({ answers, onNext }) {
  const score = personScore(answers)
  return (
    <div style={P.form}>
      <h1 style={P.h1}>Thank you</h1>
      <p style={P.sub}>Look up: the room’s answers will be on the screen later in the talk.</p>
      {score != null && (
        <div style={M.scoreBox}>
          <div style={M.scoreTrack}>
            <span style={{ ...M.scoreDot, left: `${((score - 1) / 5) * 100}%` }} />
          </div>
          <div style={P.ends}><span>1 · more doing</span><span>6 · more sensing</span></div>
          <p style={{ ...P.sub, fontSize: 14 }}>Your average, {score.toFixed(1)}, with the three reversed statements flipped. This scale is still being developed; it isn’t a test, and there’s no good or bad score.</p>
        </div>
      )}
      <p style={P.sub}>Keep this page open: we’ll use it again for a two-minute listening practice.</p>
      <button style={P.primary} onClick={onNext}>Next →</button>
    </div>
  )
}

const M = {
  item: { background: '#fff', border: '1px solid #ecd6e1', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 },
  stem: { fontSize: 16, lineHeight: 1.45, color: 'var(--tx)', margin: 0, display: 'flex', gap: 8 },
  num: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--pkd)', paddingTop: 4, flex: '0 0 auto' },
  scale: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 },
  opt: { padding: '12px 0', fontSize: 16, fontWeight: 600, borderRadius: 12, border: '2px solid var(--tx3)', background: '#fff', color: 'var(--tx)', cursor: 'pointer', touchAction: 'manipulation' },
  pna: { alignSelf: 'flex-start', border: 'none', background: 'none', padding: '4px 0', fontSize: 12, color: 'var(--tx3)', textDecoration: 'underline', cursor: 'pointer' },
  pnaOn: { color: 'var(--pkd)', fontWeight: 600 },
  link: { border: 'none', background: 'none', padding: '8px 0', fontSize: 14, color: 'var(--tx2)', textDecoration: 'underline', cursor: 'pointer' },
  modes: { display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0' },
  mode: { borderRadius: 12, padding: '12px 16px', background: '#fff', border: '2px solid', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 16, color: 'var(--tx2)', lineHeight: 1.4 },
  modeName: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 24 },
  scoreBox: { background: '#fff', border: '1px solid #ecd6e1', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 },
  scoreTrack: { position: 'relative', height: 12, borderRadius: 12, background: `linear-gradient(90deg, ${STORY}55, ${SENSE}88)` },
  scoreDot: { position: 'absolute', top: -6, width: 24, height: 24, marginLeft: -12, borderRadius: 24, background: '#fff', border: '4px solid var(--pkd)' },
}
