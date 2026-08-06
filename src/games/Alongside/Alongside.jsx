import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../../components/Nav'
import { supabase } from '../../lib/supabase'
import { createAlongside } from './engine'

/* ── Alongside ────────────────────────────────────────────────────────────────

   The fourth sense-foraging practice, after Delve (sight) and Tune (sound).
   Where those two are still, this one moves: the receptive dynamic here is
   "follow without catching" — accompanying something that cannot be caught.

   No SQL of its own. It writes a plain `game_sessions` row like the other
   open-ended games; nothing about the visit is scored, and the summary is
   descriptive rather than evaluative.

──────────────────────────────────────────────────────────────────────────── */

// ─── SUPABASE ─────────────────────────────────────────────────────────────────

async function startSession(userId) {
  if (!userId) return null
  const { data } = await supabase.from('game_sessions').insert({
    user_id: userId, game_name: 'alongside', study_id: null,
    started_at: new Date().toISOString(),
  }).select('id').single()
  return data?.id ?? null
}

async function endSession(sessionId) {
  if (!sessionId) return
  await supabase.from('game_sessions')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', sessionId)
}

// ─── SCREENS ──────────────────────────────────────────────────────────────────

function IntroScreen({ onStart }) {
  return (
    <div style={{ maxWidth: 380, textAlign: 'center', padding: '0 16px' }}>
      <p style={S.eyebrow}>RADlab · Come, See</p>
      <h1 style={S.h1}>Alongside.</h1>
      <p style={S.sub}>
        Something is moving through the meadow.<br />
        This is a practice in keeping company — not in catching anything.
      </p>

      <div style={S.card}>
        {[
          {
            n: 1,
            title: 'Hold to walk',
            body: 'Press and hold anywhere; you drift toward it. Let go to stop. There is nowhere you need to be.',
          },
          {
            n: 2,
            title: 'It cannot be caught',
            body: 'Go straight at the light and it scatters into mist and gathers again further off. Nothing is lost when it does — it simply will not be held.',
          },
          {
            n: 3,
            title: 'Walk beside it instead',
            body: 'Stay near, at its pace, and something settles between you. Listen for it: your two notes drift into tune when you have it.',
          },
        ].map(({ n, title, body }) => (
          <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={S.num}>{n}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{body}</div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ ...S.sub, marginBottom: 18, fontSize: 12 }}>
        Sound on, if you can — most of what tells you how you are doing is in it.
        Take about five minutes, or leave whenever you like.
      </p>
      <button style={S.btnPrimary} onClick={onStart}>Begin &rarr;</button>
    </div>
  )
}

function SummaryScreen({ summary, onPlay }) {
  const { durationMs, togetherS, sitesSeen, sitesAlone, arrived, mists } = summary
  const mins = Math.max(1, Math.round(durationMs / 60000))

  // Descriptive, never evaluative: the compendium's rule is that the world
  // deepening is the only feedback, so this reads back what happened rather
  // than rating it. Every line is true of a visit where nothing "worked".
  const lines = []
  if (togetherS > 20) {
    lines.push(`You walked alongside it for about ${Math.round(togetherS)} seconds.`)
  } else {
    lines.push('It kept its distance this time — some evenings are like that.')
  }
  if (sitesSeen > 0) {
    lines.push(`${sitesSeen === 1 ? 'One place' : `${sitesSeen} places`} woke while you were there${sitesAlone > 0 ? ', and some of them for you alone' : ''}.`)
  }
  if (arrived) lines.push('You settled together in the clearing, and the meadow opened.')
  if (mists > 6 && togetherS < 20) lines.push('Reaching for it is how most of us start.')

  return (
    <div style={{ maxWidth: 400, textAlign: 'center', padding: '0 16px', width: '100%' }}>
      <p style={S.eyebrow}>Done</p>
      <h1 style={S.h1}>{mins} {mins === 1 ? 'minute' : 'minutes'} in the meadow</h1>
      <p style={S.sub}>{lines.join(' ')}</p>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...S.btnOutline, flex: 1 }} onClick={onPlay}>Again</button>
        <Link to="/games" style={{ ...S.btnPrimary, flex: 1, textAlign: 'center', textDecoration: 'none' }}>Games &rarr;</Link>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function Alongside({ session }) {
  const [phase, setPhase]     = useState('intro')   // intro | walk | summary
  const [summary, setSummary] = useState(null)
  const canvasRef  = useRef(null)
  const engineRef  = useRef(null)
  const sessionRef = useRef(null)

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (phase !== 'walk') return
    const cv = canvasRef.current
    if (!cv) return
    const engine = createAlongside(cv)
    engineRef.current = engine
    return () => { engine.destroy(); engineRef.current = null }
  }, [phase])

  async function startGame() {
    setSummary(null)
    setPhase('walk')
    sessionRef.current = await startSession(userId)
  }

  function finish() {
    const stats = engineRef.current?.stats() ?? null
    setSummary(stats)
    setPhase('summary')
    endSession(sessionRef.current)
    sessionRef.current = null
  }

  if (phase === 'walk') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#091620', zIndex: 50, userSelect: 'none', WebkitUserSelect: 'none' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
        />
        <button style={S.finishBtn} onClick={finish}>finish</button>
      </div>
    )
  }

  return (
    <div style={{ background: '#FCF0F5', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', userSelect: 'none' }}>
        {phase === 'intro' && <IntroScreen onStart={startGame} />}
        {phase === 'summary' && summary && <SummaryScreen summary={summary} onPlay={() => setPhase('intro')} />}
      </div>
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  eyebrow:    { fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#abadb0', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 },
  h1:         { fontFamily: 'DM Serif Display,serif', fontSize: 28, color: '#1c1c1e', fontWeight: 400, margin: '0 0 8px' },
  sub:        { color: '#888', fontSize: 13, marginBottom: 28, lineHeight: 1.6 },
  card:       { background: 'white', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 18px rgba(180,120,160,0.10)', marginBottom: 20, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 },
  num:        { background: '#F4E0F0', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#f068a4', fontWeight: 700 },
  btnPrimary: { background: '#f068a4', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontFamily: 'DM Sans,sans-serif', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'block', width: '100%' },
  btnOutline: { background: 'white', color: '#f068a4', border: '1.5px solid #f068a4', borderRadius: 12, padding: 11, fontFamily: 'DM Sans,sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' },

  // Deliberately faint and out of the way: a visible "finish" is a goal, and
  // this practice does not have one.
  finishBtn: {
    position: 'fixed', bottom: 18, right: 18, zIndex: 60,
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'rgba(215,255,190,0.34)', fontFamily: 'Space Mono,monospace',
    fontSize: 12, letterSpacing: '0.14em', textTransform: 'lowercase',
    padding: 10,
  },
}
