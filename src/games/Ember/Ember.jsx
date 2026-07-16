// Ember — breath biofeedback campfire. Slow, steady breathing feeds the flame;
// fast or ragged breathing makes it gutter and smoke. Reference implementation
// for the shared breath-signal layer (src/games/shared/breath/useBreathSignal).
// Demo route: writes nothing (no Supabase, no auth). ?sim=1 rehearses beltless.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useBreathSignal } from '../shared/breath/useBreathSignal'
import CalibrationScreen from '../BreathBelt/components/CalibrationScreen'
import BrowserWarning from '../BreathBelt/components/BrowserWarning'
import Campfire from './Campfire'
import { summarize } from './emberMechanics'

const AVATAR_PROPS = { skinColor: '#FDBCB4', eyeColor: '#4A90D9', species: 'human' }

export default function Ember() {
  const location = useLocation()
  const isSimMode = new URLSearchParams(location.search).get('sim') === '1'

  const breath = useBreathSignal({ isSimMode })
  const [act, setAct] = useState('WELCOME') // WELCOME → CONNECT → CALIBRATE → PLAY → SUMMARY
  const finishRef = useRef(null)             // holds the summary object between PLAY and SUMMARY

  useEffect(() => {
    if (act === 'CONNECT' && breath.btState === 'CONNECTED') setAct('CALIBRATE')
  }, [act, breath.btState])

  useEffect(() => {
    if (act === 'CALIBRATE' && breath.calibPhase === 'COMPLETE') {
      breath.resetFeatures()   // fresh slate so the fire reflects play-time breathing, not the calibration pace
      setAct('PLAY')
    }
  }, [act, breath])

  if (!navigator.bluetooth && !isSimMode) return <BrowserWarning />

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={S.brand}>RADlab · Ember</span>
        <span style={S.badge}>BREATH FEEDBACK{isSimMode ? ' · SIM' : ''}</span>
      </div>

      {act === 'WELCOME' && (
        <Panel>
          <h1 style={S.h1}>Ember</h1>
          <p style={S.body}>
            A campfire you keep alive with your breath. Breathe slowly and steadily and
            the flame grows and roars. Breathe fast or raggedly and it guts down to embers
            and smoke. See how bright you can make it.
          </p>
          <p style={{ ...S.body, fontSize: 13, color: 'var(--tx3)' }}>
            Uses a Polar H10 chest strap over Bluetooth. We fit a per-person breathing model
            in about twenty seconds, then the fire follows your breath.
          </p>
          <Btn onClick={() => {
            if (isSimMode) { breath.startSimulation(); breath.acceptSimCalib(); setAct('CALIBRATE') }
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
          <h2 style={S.h2}>Calibration</h2>
          <CalibrationScreen
            calibPhase={breath.calibPhase}
            calibReviewData={breath.calibReviewData}
            avatarProps={AVATAR_PROPS}
            startCalibration={breath.startCalibration}
            beginCalibCollection={breath.beginCalibCollection}
            acceptCalibration={breath.acceptCalibration}
            redoCalibration={breath.redoCalibration}
          />
        </Panel>
      )}

      {act === 'PLAY' && (
        <PlayAct
          breath={breath}
          isSimMode={isSimMode}
          onFinish={(summary) => { finishRef.current = summary; setAct('SUMMARY') }}
        />
      )}

      {act === 'SUMMARY' && <SummaryAct summary={finishRef.current} />}
    </div>
  )
}

// ── PLAY ────────────────────────────────────────────────────────────────────

function PlayAct({ breath, isSimMode, onFinish }) {
  const [caught, setCaught] = useState(false)
  const [simPeriodS, setSimPeriodS] = useState(4)
  const metricsRef = useRef(null)

  const handleCaught = useCallback(() => setCaught(true), [])

  const finish = useCallback(() => {
    const m = metricsRef.current
    onFinish(m ? summarize(m, Date.now()) : null)
  }, [onFinish])

  return (
    <Panel wide>
      <Campfire
        breath={breath}
        running={true}
        showPacer={true}
        metricsRef={metricsRef}
        onCaughtFire={handleCaught}
      />
      <p style={{ ...S.body, marginTop: 4 }}>
        {caught
          ? 'The fire is roaring. Stay with it, or finish whenever you like.'
          : 'Breathe slowly — aim for about one long breath every ten seconds. Follow the faint blue ring.'}
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
      <Btn onClick={finish}>{caught ? 'Finish' : 'Finish early'}</Btn>
    </Panel>
  )
}

// ── SUMMARY ─────────────────────────────────────────────────────────────────

function SummaryAct({ summary }) {
  if (!summary) {
    return (
      <Panel>
        <h2 style={S.h2}>Session ended</h2>
        <p style={S.body}>No data captured.</p>
        <Btn onClick={() => window.location.reload()}>Again</Btn>
      </Panel>
    )
  }
  const s = summary
  const rows = [
    ['Brightest the fire got', `${Math.round(s.maxWarmth * 100)}%`],
    ['Longest steady stretch', `${(s.longestHoldMs / 1000).toFixed(0)} s`],
    ['Time in the calm zone', `${(s.timeInResonanceMs / 1000).toFixed(0)} s`],
    ['Average breath rate', s.meanBpm != null ? `${s.meanBpm.toFixed(1)} / min` : '—'],
    ['Session length', `${(s.durationMs / 1000).toFixed(0)} s`],
  ]
  return (
    <Panel>
      <h2 style={S.h2}>{s.caughtFire ? 'You got it roaring 🔥' : 'Nicely tended'}</h2>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={S.sumRow}>
            <span style={S.sumKey}>{k}</span>
            <span style={S.sumVal}>{v}</span>
          </div>
        ))}
      </div>
      <p style={{ ...S.body, fontSize: 13, color: 'var(--tx3)' }}>
        The calm zone is breathing at about six breaths a minute — the pace where the heart
        and breath fall into step. No data was stored during this demo.
      </p>
      <Btn onClick={() => window.location.reload()}>Tend it again</Btn>
    </Panel>
  )
}

// ── shared bits ─────────────────────────────────────────────────────────────

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
    padding: '13px 32px', fontSize: 15, fontWeight: 600, fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  sumRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '10px 0', borderBottom: '1px solid var(--bd)',
  },
  sumKey: { fontSize: 14, color: 'var(--tx2)' },
  sumVal: { fontSize: 17, fontWeight: 600, color: 'var(--tx)', fontFamily: '"Space Mono",monospace' },
}
