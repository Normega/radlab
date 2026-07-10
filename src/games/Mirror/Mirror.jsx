// Mirror — a breath-driven avatar. During calibration the avatar breathes at an
// easy pace and the wearer syncs to it while it *materializes* (opacity = the
// calibration-confidence session); once the connection is forged the avatar
// follows the wearer's own breath, pulsing to the live (auto-ranged) signal.
// Reference use of the shared breath layer's mirror mode + MirrorCalibration.
// Demo route: writes nothing (no Supabase, no auth). ?sim=1 rehearses beltless.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useBreathSignal } from '../shared/breath/useBreathSignal'
import MirrorCalibration from '../shared/breath/MirrorCalibration.jsx'
import AvatarBreathPacer from '../EbbAndFlow/components/AvatarBreathPacer'
import BrowserWarning from '../BreathBelt/components/BrowserWarning'

const AVATAR_PROPS = { skinColor: '#FDBCB4', eyeColor: '#4A90D9', species: 'human' }

export default function Mirror() {
  const location = useLocation()
  const isSimMode = new URLSearchParams(location.search).get('sim') === '1'

  // mirrorMode on: the live breath value is auto-ranged so the pulse fills the
  // range regardless of breathing depth.
  const breath = useBreathSignal({ isSimMode, mirrorMode: true })
  const [act, setAct] = useState('WELCOME') // WELCOME → CONNECT → CALIBRATE → PLAY

  useEffect(() => {
    if (act === 'CONNECT' && breath.btState === 'CONNECTED') setAct('CALIBRATE')
  }, [act, breath.btState])

  useEffect(() => {
    if (act === 'CALIBRATE' && breath.calibPhase === 'COMPLETE') {
      breath.resetFeatures()   // re-anchor the pulse's range to play-time breathing
      setAct('PLAY')
    }
  }, [act, breath])

  if (!navigator.bluetooth && !isSimMode) return <BrowserWarning />

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={S.brand}>RADlab · Mirror</span>
        <span style={S.badge}>BREATH FEEDBACK{isSimMode ? ' · SIM' : ''}</span>
      </div>

      {act === 'WELCOME' && (
        <Panel>
          <h1 style={S.h1}>Mirror</h1>
          <p style={S.body}>
            A figure that breathes with you. First it sets an easy pace and learns your
            breath — breathe along and it comes into focus. Once the connection is forged,
            it follows you: expanding as you breathe in, settling as you breathe out.
          </p>
          <p style={{ ...S.body, fontSize: 13, color: 'var(--tx3)' }}>
            Uses a Polar H10 chest strap over Bluetooth. Nothing is recorded.
          </p>
          <Btn onClick={() => {
            if (isSimMode) { breath.startSimulation(); setAct('CALIBRATE') }
            else setAct('CONNECT')
          }}>
            {isSimMode ? 'Start (sim)' : 'Begin'}
          </Btn>
        </Panel>
      )}

      {act === 'CONNECT' && (
        <Panel>
          <h2 style={S.h2}>Pair the belt</h2>
          <p style={S.body}>
            Put on the Polar H10 — connector centred on the chest, electrodes moistened.
            Chrome will ask which device to connect.
          </p>
          {breath.btState === 'ERROR' && <p style={S.err}>Connection failed. Check the belt and try again.</p>}
          <Btn onClick={breath.connect} disabled={breath.btState === 'CONNECTING'}>
            {breath.btState === 'CONNECTING' ? 'Connecting…' : 'Connect to Polar H10'}
          </Btn>
        </Panel>
      )}

      {act === 'CALIBRATE' && (
        <Panel wide>
          <MirrorCalibration breath={breath} avatarProps={AVATAR_PROPS} />
        </Panel>
      )}

      {act === 'PLAY' && <MirrorStage breath={breath} isSimMode={isSimMode} />}
    </div>
  )
}

// ── PLAY: the avatar follows your breath ─────────────────────────────────────

function MirrorStage({ breath, isSimMode }) {
  const [simPeriodS, setSimPeriodS] = useState(5)
  const levelRef = useRef(0.5)

  // getLevel runs inside the avatar's rAF; EMA-smooth the live value for grace.
  const getLevel = useCallback(() => {
    const v = breath.signalRef.current.value
    const target = v == null ? 0.5 : v
    levelRef.current += (target - levelRef.current) * 0.28
    return levelRef.current
  }, [breath])

  // A soft glow behind the avatar that breathes with it too.
  const glowRef = useRef(null)
  useEffect(() => {
    const id = setInterval(() => {
      const el = glowRef.current
      if (!el) return
      const lvl = levelRef.current
      el.style.transform = `scale(${(0.9 + lvl * 0.5).toFixed(3)})`
      el.style.opacity = String(0.25 + lvl * 0.35)
    }, 33)
    return () => clearInterval(id)
  }, [])

  return (
    <Panel wide>
      <div style={S.stage}>
        <div ref={glowRef} style={S.glow} />
        <AvatarBreathPacer {...AVATAR_PROPS} getLevel={getLevel} scaleAmplitude={0.26} size={300} />
      </div>
      <p style={{ ...S.body, marginTop: 4 }}>
        Breathe naturally — the figure follows you. There's nothing to score; just watch it move with you.
      </p>
      {isSimMode && (
        <label style={{ ...S.body, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, width: '100%', maxWidth: 420 }}>
          <span style={{ whiteSpace: 'nowrap', color: 'var(--tx3)' }}>sim breath {simPeriodS.toFixed(1)}s</span>
          <input
            type="range" min="2" max="12" step="0.5" value={simPeriodS}
            onChange={e => { const s = Number(e.target.value); setSimPeriodS(s); breath.setSimPeriodMs(s * 1000) }}
            style={{ flex: 1 }}
          />
        </label>
      )}
      <Btn onClick={() => window.location.reload()}>Finish</Btn>
    </Panel>
  )
}

// ── shared bits ──────────────────────────────────────────────────────────────

function Panel({ children, wide = false }) {
  return <div style={{ ...S.panel, maxWidth: wide ? 600 : 460 }}>{children}</div>
}

function Btn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...S.btn, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  )
}

const S = {
  page: {
    minHeight: '100vh', background: 'var(--bg, #FCF0F5)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '0 16px 48px', fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  header: {
    width: '100%', maxWidth: 600, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '18px 4px',
  },
  brand: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 18, color: 'var(--tx)' },
  badge: {
    fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: '0.1em',
    color: 'var(--pkd)', background: 'var(--pkb)', borderRadius: 6, padding: '4px 10px',
  },
  panel: {
    width: '100%', background: '#fff', border: '1px solid var(--bd)',
    borderRadius: 14, padding: '28px 24px', marginTop: 12,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
  },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 30, fontWeight: 400, color: 'var(--tx)', margin: 0, textAlign: 'center' },
  h2: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 22, fontWeight: 400, color: 'var(--tx)', margin: 0, textAlign: 'center' },
  body: { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6, textAlign: 'center', margin: 0, maxWidth: 460 },
  err: { fontSize: 13, color: '#e04', margin: 0 },
  btn: {
    background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 12,
    padding: '13px 32px', fontSize: 15, fontWeight: 500, fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  stage: {
    position: 'relative', width: 340, height: 340,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  glow: {
    position: 'absolute', width: 260, height: 260, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(192,87,127,0.55) 0%, rgba(192,87,127,0) 70%)',
    transformOrigin: 'center', transition: 'transform 90ms linear, opacity 90ms linear',
    pointerEvents: 'none',
  },
}
