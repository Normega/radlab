import { useState, useEffect } from 'react'
import { usePhysioContext } from './PhysioContext'
import BrowserWarning from '../../games/BreathBelt/components/BrowserWarning'
import CalibrationScreen from '../../games/BreathBelt/components/CalibrationScreen'
import { TRIGGER_DEVICES, DEFAULT_TRIGGER_DEVICE, BASE_BREATH_SPEED_S } from '../../games/BreathBelt/constants'

// ── Phase FSM ────────────────────────────────────────────────────────────────
const P = {
  BROWSER_CHECK: 'BROWSER_CHECK',
  BT_CONNECT:    'BT_CONNECT',
  COM_CONNECT:   'COM_CONNECT',
  SESSION_SETUP: 'SESSION_SETUP',
  CALIB_READY:   'CALIB_READY',
  CALIBRATING:   'CALIBRATING',
  COMPLETE:      'COMPLETE',
}

const avatarProps = { skinColor: '#FDBCB4', eyeColor: '#4A90D9', species: 'human' }
const BASE_PERIOD_MS = BASE_BREATH_SPEED_S * 1000

/**
 * PhysioSetupStep — study step that guides the researcher through:
 *   BROWSER_CHECK → BT_CONNECT → COM_CONNECT → SESSION_SETUP → CALIB_READY → CALIBRATING → COMPLETE
 *
 * Pulls the shared belt object from PhysioContext so the connection persists
 * across all subsequent study steps.
 *
 * Props: enrollment, onComplete, isSimMode
 */
export default function PhysioSetupStep({ enrollment, onComplete, isSimMode = false }) {
  const { belt, sessionNumber, setSessionNumber, triggerDevice, setTriggerDevice } = usePhysioContext()

  // Local trigger-device selector state (committed to context on Continue)
  const [localTriggerDevice, setLocalTriggerDevice] = useState(triggerDevice)
  const [phase, setPhase] = useState(P.BROWSER_CHECK)
  const [cascadeFired, setCascadeFired] = useState(false)

  // ── BROWSER_CHECK ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== P.BROWSER_CHECK) return
    if (!navigator.bluetooth) return   // will render <BrowserWarning />
    setPhase(P.BT_CONNECT)
  }, [phase])

  // ── BT_CONNECT → COM_CONNECT ───────────────────────────────────────────────
  useEffect(() => {
    if (phase === P.BT_CONNECT && belt.btState === 'CONNECTED') setPhase(P.COM_CONNECT)
  }, [belt.btState, phase])

  // ── COM_CONNECT: fire test cascade once on connect ─────────────────────────
  useEffect(() => {
    if (belt.comState !== 'CONNECTED') { setCascadeFired(false); return }
    if (phase === P.COM_CONNECT && !cascadeFired) {
      setCascadeFired(true)
      belt.sendTestCascade()
    }
  }, [belt.comState, phase, cascadeFired])

  // ── Calibration COMPLETE → COMPLETE ────────────────────────────────────────
  useEffect(() => {
    const inCalibPhase = phase === P.CALIBRATING || (isSimMode && phase === P.CALIB_READY)
    if (inCalibPhase && belt.calibPhase === 'COMPLETE') setPhase(P.COMPLETE)
  }, [belt.calibPhase, phase, isSimMode])

  // ── COMPLETE: call onComplete ───────────────────────────────────────────────
  useEffect(() => {
    if (phase === P.COMPLETE) onComplete({})
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sim-mode auto-advance effects ──────────────────────────────────────────

  // BT_CONNECT: call startSimulation() (sets btState+comState → CONNECTED)
  useEffect(() => {
    if (!isSimMode) return
    if (phase !== P.BT_CONNECT) return
    belt.startSimulation()
  }, [phase, isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // COM_CONNECT: skip cascade verification, go to SESSION_SETUP
  useEffect(() => {
    if (!isSimMode) return
    if (phase !== P.COM_CONNECT || belt.comState !== 'CONNECTED') return
    const t = setTimeout(() => setPhase(P.SESSION_SETUP), 50)
    return () => clearTimeout(t)
  }, [phase, belt.comState, isSimMode])

  // SESSION_SETUP: set defaults and advance
  useEffect(() => {
    if (!isSimMode) return
    if (phase !== P.SESSION_SETUP) return
    setSessionNumber(1)
    setTriggerDevice(DEFAULT_TRIGGER_DEVICE)
    belt.setTriggerDevice(DEFAULT_TRIGGER_DEVICE)
    const t = setTimeout(() => setPhase(P.CALIB_READY), 50)
    return () => clearTimeout(t)
  }, [phase, isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // CALIB_READY: call acceptSimCalib() to enter REVIEW
  useEffect(() => {
    if (!isSimMode) return
    if (phase !== P.CALIB_READY) return
    belt.acceptSimCalib()
  }, [phase, isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // REVIEW state: auto-accept calibration then advance to COMPLETE
  useEffect(() => {
    if (!isSimMode) return
    if (belt.calibPhase !== 'REVIEW') return
    const t = setTimeout(() => {
      belt.acceptCalibration()
    }, 200)
    return () => clearTimeout(t)
  }, [belt.calibPhase, isSimMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!navigator.bluetooth) return <BrowserWarning />

  if (phase === P.BROWSER_CHECK) {
    return <Screen title="Physio Setup"><Spinner /></Screen>
  }

  // ── BT_CONNECT ──────────────────────────────────────────────────────────────
  if (phase === P.BT_CONNECT) {
    return (
      <Layout title="Connect Polar H10">
        <Screen>
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 400 }}>
            Put on the Polar H10 belt — connector centred on chest, electrodes moistened.
          </p>
          {belt.btState === 'ERROR' && <Err>Connection failed. Check the belt and try again.</Err>}
          <Btn onClick={belt.connect} disabled={belt.btState === 'CONNECTING'}>
            {belt.btState === 'CONNECTING' ? 'Connecting…' : 'Connect to Polar H10'}
          </Btn>
        </Screen>
      </Layout>
    )
  }

  // ── COM_CONNECT ─────────────────────────────────────────────────────────────
  if (phase === P.COM_CONNECT) {
    const dev      = TRIGGER_DEVICES.find(d => d.value === localTriggerDevice)
    const isBiopac = !!dev && dev.address != null

    if (belt.comState === 'CONNECTED') {
      return (
        <Layout title={isBiopac ? 'Parallel server ready' : 'COM port ready'}>
          <Screen>
            <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 420 }}>
              Connected to <strong style={{ color: 'var(--tx)' }}>{dev?.label ?? localTriggerDevice}</strong>.
            </p>
            <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 420 }}>
              {belt.testRunning
                ? 'Sending test cascade — watch the recording for marks 1 through 13…'
                : 'A test cascade of codes 1–13 was sent. Confirm all 13 marks appear in the recording, then continue.'}
            </p>
            <Btn secondary onClick={belt.sendTestCascade} disabled={belt.testRunning}>
              {belt.testRunning ? 'Sending 1–13…' : 'Send test cascade again'}
            </Btn>
            <Btn onClick={() => setPhase(P.SESSION_SETUP)} disabled={belt.testRunning}>
              Continue to session setup
            </Btn>
          </Screen>
        </Layout>
      )
    }

    return (
      <Layout title={isBiopac ? 'Check parallel server' : 'Connect COM port'}>
        <Screen>
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 400 }}>
            {isBiopac
              ? 'Confirm the local parallel-port server is running before starting triggers.'
              : 'Connect to the physio equipment COM port to enable trial triggers.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280 }}>
            <label style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)' }}>
              Trigger device
            </label>
            <select
              value={localTriggerDevice}
              onChange={e => setLocalTriggerDevice(e.target.value)}
              disabled={belt.comState === 'CONNECTING'}
              style={{
                fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-md)',
                color: 'var(--tx)', background: 'var(--bgc)',
                border: '1px solid var(--bd)', borderRadius: 10,
                padding: '10px 14px', width: '100%',
              }}
            >
              {TRIGGER_DEVICES.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx3)', margin: 0 }}>
              Match the physio equipment on this testing computer.
            </p>
          </div>

          {belt.comState === 'ERROR' && (
            <Err>{belt.comMessage || (isBiopac ? 'Parallel server check failed. Try again.' : 'COM port connection failed. Try again.')}</Err>
          )}
          <Btn
            onClick={() => {
              belt.setTriggerDevice(localTriggerDevice)
              if (isBiopac) belt.connectBiopac(); else belt.connectCOM()
            }}
            disabled={belt.comState === 'CONNECTING'}
          >
            {belt.comState === 'CONNECTING'
              ? (isBiopac ? 'Checking…' : 'Connecting…')
              : (isBiopac ? 'Check parallel server' : 'Connect to COM port')}
          </Btn>
        </Screen>
      </Layout>
    )
  }

  // ── SESSION_SETUP ───────────────────────────────────────────────────────────
  if (phase === P.SESSION_SETUP) {
    return (
      <Layout title="Session setup">
        <Screen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 280 }}>

            {/* Session number */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)' }}>
                Session number
              </label>
              <input
                type="number" min={1} value={sessionNumber}
                onChange={e => setSessionNumber(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-md)',
                  color: 'var(--tx)', background: 'var(--bgc)',
                  border: '1px solid var(--bd)', borderRadius: 10,
                  padding: '10px 14px', textAlign: 'center', width: '100%',
                }}
              />
              <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx3)', margin: 0 }}>
                Increment for each visit by the same participant.
              </p>
            </div>

            {/* Trigger device — confirmed on the COM connect screen, shown read-only here */}
            <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx3)', margin: 0 }}>
              Trigger device: <span style={{ fontFamily: 'Space Mono', color: 'var(--tx2)' }}>
                {TRIGGER_DEVICES.find(d => d.value === localTriggerDevice)?.label ?? localTriggerDevice}
              </span>
            </p>

            {enrollment?.external_id && (
              <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx3)', margin: 0 }}>
                Participant: <span style={{ fontFamily: 'Space Mono', color: 'var(--tx2)' }}>{enrollment.external_id}</span>
              </p>
            )}
          </div>

          <Btn onClick={() => {
            setTriggerDevice(localTriggerDevice)
            belt.setTriggerDevice(localTriggerDevice)
            setPhase(P.CALIB_READY)
          }}>
            Continue to calibration
          </Btn>
        </Screen>
      </Layout>
    )
  }

  // ── CALIB_READY / CALIBRATING ───────────────────────────────────────────────
  if (phase === P.CALIB_READY || phase === P.CALIBRATING) {
    return (
      <Layout title="Calibration">
        <CalibrationScreen
          calibPhase={belt.calibPhase}
          calibReviewData={belt.calibReviewData}
          avatarProps={avatarProps}
          breathPeriodMs={BASE_PERIOD_MS}
          startCalibration={() => { belt.startCalibration(); setPhase(P.CALIBRATING) }}
          beginCalibCollection={belt.beginCalibCollection}
          acceptCalibration={belt.acceptCalibration}
          redoCalibration={belt.redoCalibration}
        />
      </Layout>
    )
  }

  // COMPLETE is handled by the useEffect that calls onComplete({})
  return null
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Layout({ title, children }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="px-6 pt-8 pb-2">
          <h1 style={{ fontFamily: 'DM Serif Display', fontSize: 22, color: 'var(--tx)' }}>
            Physio Setup — {title}
          </h1>
        </div>
        {children}
      </div>
    </div>
  )
}

function Screen({ title, children }) {
  return (
    <div className="flex flex-col items-center gap-6 px-6 py-12">
      {title && (
        <h2 style={{ fontFamily: 'DM Serif Display', fontSize: 20, color: 'var(--tx)' }}>{title}</h2>
      )}
      {children}
    </div>
  )
}

function Btn({ onClick, disabled, secondary, children }) {
  const base = {
    border:     'none', borderRadius: 12, padding: '12px 28px',
    fontFamily: 'DM Sans', fontSize: 'var(--fs-body)', fontWeight: 600,
    cursor:     disabled ? 'default' : 'pointer',
  }
  const style = secondary
    ? { ...base,
        background: 'transparent',
        color:      disabled ? 'var(--tx3)' : 'var(--pkd)',
        border:     `1px solid ${disabled ? 'var(--bd)' : 'var(--pkbs)'}` }
    : { ...base,
        background: disabled ? 'var(--bd)' : 'var(--pk)',
        color:      disabled ? 'var(--tx3)' : '#fff' }
  return <button onClick={onClick} disabled={disabled} style={style}>{children}</button>
}

function Err({ children }) {
  return (
    <p style={{ color: '#c0392b', fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)' }}>
      {children}
    </p>
  )
}

function Spinner() {
  return (
    <div
      style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '3px solid var(--bd)',
        borderTopColor: 'var(--pk)',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  )
}
