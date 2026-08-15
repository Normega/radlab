import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../../components/Nav'
import GameIntro from '../shared/GameIntro'
import { supabase } from '../../lib/supabase'
import { createSidelong } from './engine'

/* ── Sidelong ─────────────────────────────────────────────────────────────────

   The fourth sense-foraging practice on the catalog, and the anti-Delve:
   where Delve clarifies the spot attention rests on, here the faint stars are
   only ever visible BESIDE the gaze — look straight at one and it goes out.
   Gaze stability opens the whole field; darting closes it.

   No SQL of its own. It writes a plain `game_sessions` row like the other
   open-ended games; nothing about the visit is scored, and the summary is
   descriptive rather than evaluative.

──────────────────────────────────────────────────────────────────────────── */

// ─── SUPABASE ─────────────────────────────────────────────────────────────────

async function startSession(userId) {
  if (!userId) return null
  const { data } = await supabase.from('game_sessions').insert({
    user_id: userId, game_name: 'sidelong', study_id: null,
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
    <GameIntro
      title="Sidelong."
      lead={<>The night is fuller than it looks.<br />This is a practice in looking beside things — not at them.</>}
      steps={[
        {
          title: 'The moon is the easy place to rest',
          body: 'Move, or touch and hold — wherever you point is where your eyes sit. Start on the moon; it asks nothing.',
        },
        {
          title: 'The faint ones are never where you point',
          body: 'Look straight at a faint star and it goes out. It blooms again beside your gaze — rest nearby and let it come.',
        },
        {
          title: 'Hurry empties the sky',
          body: 'Darting about closes the whole field; stillness opens it. Stay with what arrives, and the night does the rest.',
        },
      ]}
      note={<>Sound on, if you can — the night answers quietly. Take about five minutes, or leave whenever you like.</>}
      onStart={onStart}
    />
  )
}

function SummaryScreen({ summary, onPlay }) {
  const { durationMs, starsFound, figuresLinked, figuresRead, names, firstLight, meanOpen } = summary
  const mins = Math.max(1, Math.round(durationMs / 60000))

  // Descriptive, never evaluative: the compendium's rule is that the world
  // deepening is the only feedback, so this reads back what happened rather
  // than rating it. Every line is true of a visit where nothing "worked".
  const lines = []
  if (starsFound > 12) {
    lines.push(`${starsFound} faint stars came out beside your gaze.`)
  } else {
    lines.push('The sky held back this time — some nights are like that.')
  }
  if (figuresLinked > 0) {
    lines.push(`${figuresLinked === 1 ? 'One figure' : `${figuresLinked} figures`} linked ${figuresLinked === 1 ? 'itself' : 'themselves'} out of what you found.`)
  }
  if (figuresRead > 0 && names.length > 0) {
    lines.push(`You read ${names.length === 1 ? 'a name' : 'names'}: ${names.join(', ')}.`)
  }
  if (firstLight) lines.push('You stayed until first light, and the sky finished its own figures.')
  if (starsFound <= 12 && meanOpen < 0.35) lines.push('Pointing at them is how most of us start.')

  return (
    <div style={{ maxWidth: 400, textAlign: 'center', padding: '0 16px', width: '100%' }}>
      <p style={S.eyebrow}>Done</p>
      <h1 style={S.h1}>{mins} {mins === 1 ? 'minute' : 'minutes'} under the sky</h1>
      <p style={S.sub}>{lines.join(' ')}</p>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...S.btnOutline, flex: 1 }} onClick={onPlay}>Again</button>
        <Link to="/games" style={{ ...S.btnPrimary, flex: 1, textAlign: 'center', textDecoration: 'none' }}>Games &rarr;</Link>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function Sidelong({ session }) {
  const [phase, setPhase]     = useState('intro')   // intro | night | summary
  const [summary, setSummary] = useState(null)
  const canvasRef  = useRef(null)
  const engineRef  = useRef(null)
  const sessionRef = useRef(null)

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (phase !== 'night') return
    const cv = canvasRef.current
    if (!cv) return
    const engine = createSidelong(cv)
    engineRef.current = engine
    return () => { engine.destroy(); engineRef.current = null }
  }, [phase])

  async function startGame() {
    setSummary(null)
    setPhase('night')
    sessionRef.current = await startSession(userId)
  }

  function finish() {
    const stats = engineRef.current?.stats() ?? null
    setSummary(stats)
    setPhase('summary')
    endSession(sessionRef.current)
    sessionRef.current = null
  }

  if (phase === 'night') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#04060c', zIndex: 50, userSelect: 'none', WebkitUserSelect: 'none' }}>
        {/* cursor hidden: the dim gaze ring the engine draws is the pointer,
            and a system cursor sitting on it would pull the eye */}
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: 'none' }}
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
  btnPrimary: { background: '#f068a4', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontFamily: 'DM Sans,sans-serif', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'block', width: '100%' },
  btnOutline: { background: 'white', color: '#f068a4', border: '1.5px solid #f068a4', borderRadius: 12, padding: 11, fontFamily: 'DM Sans,sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' },

  // Deliberately faint and out of the way: a visible "finish" is a goal, and
  // this practice does not have one.
  finishBtn: {
    position: 'fixed', bottom: 18, right: 18, zIndex: 60,
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'rgba(190,205,240,0.30)', fontFamily: 'Space Mono,monospace',
    fontSize: 12, letterSpacing: '0.14em', textTransform: 'lowercase',
    padding: 10,
  },
}
