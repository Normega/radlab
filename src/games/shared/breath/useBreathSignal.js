import { useRef, useState, useCallback, useEffect } from 'react'
import {
  fitBestModel, processPacketMLR, initFilterState3,
  computeMLRPredictions, getPacerRadius, medianPeakTimingError,
} from '../../BreathBelt/breathUtils'
import {
  PMD_SERVICE, PMD_CONTROL, PMD_DATA, HR_SERVICE, HR_MEASUREMENT,
} from '../../BreathBelt/constants'
import {
  parseHrPacket, createPhaseDetector, createRateTracker,
  rsaAmplitudeMs, createHistory, createQualityTracker,
} from './breathFeatures'

// ── useBreathSignal ─────────────────────────────────────────────────────────
//
// Shared Polar-H10 breath biofeedback layer, extracted from BreathBelt's
// useBeltConnection but stripped of study-specific machinery (event triggers,
// raw-row phase/trial labelling, Supabase buffers). Gives any game a live,
// calibrated breath signal plus derived features, with zero hardware code in
// the game itself.
//
// Calibration surface is prop-compatible with BreathBelt's CalibrationScreen:
//   calibPhase, calibReviewData, startCalibration, beginCalibCollection,
//   acceptCalibration, redoCalibration  →  pass straight through.
//
// Live data (poll refs inside rAF — 25 Hz updates, never React state):
//   signalRef.current = {
//     t,               // wall-clock ms of last update
//     value,           // breath amplitude 0–1 (0 exhale trough, 1 inhale peak)
//     phase,           // 'inhale' | 'exhale' | 'pause'
//     bpm,             // median breath rate, null until ~3 breaths seen
//     regularitySdMs,  // SD of recent breath periods (lower = steadier), null early
//     lastPeriodMs,    // most recent onset-to-onset breath period
//     hr,              // latest heart rate, bpm
//     rsaMs,           // max−min RR over last 12 s (breath-driven HR swing)
//     lagMs,           // calibrated belt latency — shift feedback by this
//   }
//   getRecentBreath(ms) → [{ t, value, phase }]   (last 60 s kept)
//   getRecentRR(ms)     → [{ t, rr }]             (rr in ms)
//   getRecentHr(ms)     → [{ t, hr }]
//   onBreathEvent(cb)   → unsubscribe; cb({ type: 'inhale_start'|'exhale_start', t })
//
// Sim mode (isSimMode): startSimulation() runs a sine breath + RSA-coupled
// fake heartbeat, no hardware. setSimPeriodMs(ms) retunes it live so rate/
// regularity feedback can be exercised by hand.

const SIM_MLR_WEIGHTS = { bias: 0.5, weights: [0.8, 0.1, 0.1], modelLabel: 'sim-mlr3w', lagMs: 50, fitR: 0.92 }
const INGEST_CHUNK = 8       // accel samples per live-processing step (200 Hz / 8 ≈ 25 Hz)
const SAMPLE_DT_MS = 5       // Polar PMD accel at 200 Hz
const HISTORY_MS   = 60000

// Signal-quality (explained-variance) monitor thresholds
const QUALITY_STATS_MS       = 700    // recompute EVR at most this often
const BASELINE_MIN_ELAPSED_MS = 8000  // wait this long post-(re)calibration before snapshotting the baseline
const DEGRADE_EVR_FRAC       = 0.55   // EVR below this fraction of baseline is suspicious
const MIN_ACTIVITY_FRAC      = 0.50   // ...but only flag if total variance stays this high (breathing present, not a hold)
const DEGRADE_HOLD_MS        = 4000   // sustained this long before signalDegraded latches true

export function useBreathSignal({ isSimMode = false } = {}) {
  const [btState,         setBtState]        = useState('IDLE')
  const [calibPhase,      setCalibPhase]     = useState('NONE')
  const [calibReviewData, setCalibReviewData] = useState(null)

  // Hardware
  const deviceRef        = useRef(null)
  const readAccCharRef   = useRef(null)
  const heartRateCharRef = useRef(null)

  // Calibration / model
  const calibSamplesRef  = useRef([])
  const calibStartMsRef  = useRef(0)
  const calibPeriodMsRef = useRef(0)
  const mlrWeightsRef    = useRef(null)
  const filterState3Ref  = useRef(initFilterState3())
  const collectingRef    = useRef(false) // true only during calib BREATHE

  // Derived-feature state
  const phaseDetectorRef = useRef(createPhaseDetector())
  const rateTrackerRef   = useRef(createRateTracker())
  const breathHistoryRef = useRef(createHistory(HISTORY_MS))
  const rrHistoryRef     = useRef(createHistory(HISTORY_MS))
  const hrHistoryRef     = useRef(createHistory(HISTORY_MS))
  const listenersRef     = useRef(new Set())

  // The one object games poll
  const signalRef = useRef({
    t: 0, value: 0, phase: 'pause', bpm: null, regularitySdMs: null, regularityCv: null,
    lastPeriodMs: null, hr: null, rsaMs: null, lagMs: 0,
    qualityEvr: null, qualityTotalVar: null, signalDegraded: false,
    filtered: null,   // last bandpassed [x,y,z] — recorded for offline EVR analysis
  })

  // Signal-quality monitor state
  const qualityTrackerRef  = useRef(null)
  const qualityBaselineRef = useRef({ evr: null, totalVar: null, createdAt: 0 })
  const qualityLastStatsRef = useRef(0)
  const degradeSinceRef    = useRef(null)

  // Sim
  const simIntervalRef  = useRef(null)
  const simPeriodMsRef  = useRef(4000)
  const simNextBeatRef  = useRef(0)

  // ── Core ingest: every derived feature flows from here ───────────────────

  const emit = (event) => {
    for (const cb of listenersRef.current) {
      try { cb(event) } catch (err) { console.error('breath event listener:', err) }
    }
  }

  const ingestBreathValue = useCallback((t, rawValue) => {
    const value = Math.max(0, Math.min(1, rawValue))
    const { phase, transition } = phaseDetectorRef.current.push(t, value)
    if (transition?.type === 'inhale_start') rateTrackerRef.current.pushOnset(transition.t)

    breathHistoryRef.current.push({ t, value, phase })

    const s = signalRef.current
    s.t = t
    s.value = value
    s.phase = phase
    s.bpm = rateTrackerRef.current.bpm
    s.regularitySdMs = rateTrackerRef.current.regularitySdMs
    s.regularityCv = rateTrackerRef.current.regularityCv
    s.lastPeriodMs = rateTrackerRef.current.lastPeriodMs
    s.lagMs = mlrWeightsRef.current?.lagMs ?? 0

    if (transition) emit(transition)
  }, [])

  const ingestHr = useCallback((t, hr, rrMs) => {
    if (hr != null && hr > 0) {
      hrHistoryRef.current.push({ t, hr })
      signalRef.current.hr = hr
    }
    for (const rr of rrMs) rrHistoryRef.current.push({ t, rr })
    signalRef.current.rsaMs = rsaAmplitudeMs(rrHistoryRef.current.all, t)
  }, [])

  // ── Signal-quality (explained-variance) monitor ───────────────────────────
  // (Re)start it for a fitted model; must be called whenever mlrWeights change.
  const initQuality = useCallback((weights) => {
    qualityTrackerRef.current  = createQualityTracker(weights)
    qualityBaselineRef.current = { evr: null, totalVar: null, createdAt: Date.now() }
    qualityLastStatsRef.current = 0
    degradeSinceRef.current    = null
    const s = signalRef.current
    s.qualityEvr = null; s.qualityTotalVar = null; s.signalDegraded = false
  }, [])

  // Recompute EVR (throttled), snapshot a baseline a few seconds after
  // (re)calibration, and latch signalDegraded when EVR collapses while total
  // variance stays high (breathing on a different axis = posture/fit drift).
  const updateQuality = useCallback((now) => {
    const q = qualityTrackerRef.current
    if (!q || now - qualityLastStatsRef.current < QUALITY_STATS_MS) return
    qualityLastStatsRef.current = now
    const st = q.stats()
    const s = signalRef.current
    s.qualityEvr = st.evr
    s.qualityTotalVar = st.totalVar
    const base = qualityBaselineRef.current
    if (st.evr != null && base.evr == null && now - base.createdAt > BASELINE_MIN_ELAPSED_MS) {
      base.evr = st.evr; base.totalVar = st.totalVar
    }
    let degraded = false
    if (base.evr != null && st.evr != null) {
      const evrLow = st.evr < DEGRADE_EVR_FRAC * base.evr
      const active = st.totalVar > MIN_ACTIVITY_FRAC * base.totalVar
      if (evrLow && active) {
        if (degradeSinceRef.current == null) degradeSinceRef.current = now
        degraded = now - degradeSinceRef.current >= DEGRADE_HOLD_MS
      } else {
        degradeSinceRef.current = null
      }
    }
    s.signalDegraded = degraded
  }, [])

  // ── BLE handlers ──────────────────────────────────────────────────────────

  const accelHandler = useCallback((e) => {
    const timestamp = Date.now()
    const dv = e.target?.value
    if (!dv || dv.byteLength < 11) return

    // Polar PMD accel frame: same layout as BreathBelt's parser
    const step = Math.ceil(((dv.getInt8(9) + 1) * 8) / 8)
    const measurements = []
    let offset = 10
    while (offset + 3 * step <= dv.byteLength) {
      measurements.push([
        dv.getInt16(offset,            true) / 100,
        dv.getInt16(offset + step,     true) / 100,
        dv.getInt16(offset + 2 * step, true) / 100,
      ])
      offset += 3 * step
    }
    if (!measurements.length) return

    if (collectingRef.current) {
      measurements.forEach((m, idx) => {
        calibSamplesRef.current.push({ t: timestamp + idx * SAMPLE_DT_MS, x: m[0], y: m[1], z: m[2] })
      })
    }

    // Live MLR in sub-packet chunks so games get ~25 Hz updates instead of
    // one value per BLE packet (~5 Hz)
    if (mlrWeightsRef.current) {
      for (let i = 0; i < measurements.length; i += INGEST_CHUNK) {
        const chunk = measurements.slice(i, i + INGEST_CHUNK)
        const { prediction, state, filtered } = processPacketMLR(chunk, filterState3Ref.current, mlrWeightsRef.current)
        filterState3Ref.current = state
        const tt = timestamp + (i + chunk.length - 1) * SAMPLE_DT_MS
        ingestBreathValue(tt, prediction)
        qualityTrackerRef.current?.push(tt, filtered[0], filtered[1], filtered[2])
        signalRef.current.filtered = filtered
      }
      updateQuality(timestamp)
    }
  }, [ingestBreathValue, updateQuality])

  const hrHandler = useCallback((e) => {
    const parsed = parseHrPacket(e.target?.value)
    if (parsed) ingestHr(Date.now(), parsed.hr, parsed.rrMs)
  }, [ingestHr])

  // ── Connect ───────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    setBtState('CONNECTING')
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HR_SERVICE] }],
        optionalServices: [PMD_SERVICE],
      })
      deviceRef.current = device
      const server = await device.gatt.connect()
      await new Promise(r => setTimeout(r, 1000))
      const pmdSvc  = await server.getPrimaryService(PMD_SERVICE)
      const hrSvc   = await server.getPrimaryService(HR_SERVICE)
      const control = await pmdSvc.getCharacteristic(PMD_CONTROL)
      const data    = await pmdSvc.getCharacteristic(PMD_DATA)
      const hrChar  = await hrSvc.getCharacteristic(HR_MEASUREMENT)
      readAccCharRef.current   = data
      heartRateCharRef.current = hrChar
      await new Promise(r => setTimeout(r, 1000))
      // HR first — PMD startNotifications() briefly drops GATT on Windows/Chrome
      data.oncharacteristicvaluechanged   = accelHandler
      hrChar.oncharacteristicvaluechanged = hrHandler
      await hrChar.startNotifications()
      await new Promise(r => setTimeout(r, 200))
      // PMD control: start accelerometer stream, 200 Hz ±8 g, 16-bit
      const pmdCmd = new Uint8Array([0x02,0x02,0x00,0x01,0xC8,0x00,0x01,0x01,0x10,0x00,0x02,0x01,0x08,0x00])
      if (control.properties.writeWithoutResponse) {
        await control.writeValueWithoutResponse(pmdCmd)
      } else {
        await control.writeValueWithResponse(pmdCmd)
      }
      await data.startNotifications()
      setBtState('CONNECTED')
    } catch (err) { console.error('BT:', err); setBtState('ERROR') }
  }, [accelHandler, hrHandler])

  // ── Calibration state machine (mirrors useBeltConnection) ────────────────

  useEffect(() => {
    if (calibPhase !== 'BREATHE') return
    const periodMs = calibPeriodMsRef.current
    const t = setTimeout(() => {
      collectingRef.current = false
      setCalibPhase('FITTING')
      const result = fitBestModel(calibSamplesRef.current, calibStartMsRef.current, periodMs)
      if (!result || result.fitR < 0.4) { setCalibPhase('FAILED'); return }

      mlrWeightsRef.current   = result
      filterState3Ref.current = initFilterState3()
      initQuality(result.weights)   // start the explained-variance monitor for this fit

      const beltRaw  = computeMLRPredictions(calibSamplesRef.current, result)
      const samples  = calibSamplesRef.current
      const pacerPts = samples.filter((_, i) => i % 5 === 0)
        .map(sm => ({ t: sm.t, value: getPacerRadius(sm.t, calibStartMsRef.current, periodMs) }))
      const beltAll  = samples.map((sm, i) => ({ t: sm.t, value: beltRaw[i] }))
      const beltPts  = beltAll.filter((_, i) => i % 5 === 0)
      const peakErrorMs = medianPeakTimingError(beltAll, pacerPts, periodMs)

      setCalibReviewData({ pacerPts, beltPts, fitR: result.fitR, peakErrorMs, modelLabel: result.modelLabel, lagMs: result.lagMs })
      setCalibPhase('REVIEW')
    }, 4 * periodMs)
    return () => clearTimeout(t)
  }, [calibPhase, initQuality])

  const startCalibration = useCallback(() => {
    calibSamplesRef.current = []
    setCalibReviewData(null)
    setCalibPhase('FIXATION')
  }, [])

  const beginCalibCollection = useCallback((calibStartMs, breathPeriodMs) => {
    calibSamplesRef.current  = []
    calibStartMsRef.current  = calibStartMs
    calibPeriodMsRef.current = breathPeriodMs
    collectingRef.current    = true
    setCalibPhase('BREATHE')
  }, [])

  const acceptCalibration = useCallback(() => setCalibPhase('COMPLETE'), [])

  const redoCalibration = useCallback(() => {
    calibSamplesRef.current = []
    collectingRef.current   = false
    setCalibReviewData(null)
    setCalibPhase('FIXATION')
  }, [])

  const resetCalibration = useCallback(() => {
    calibSamplesRef.current = []
    collectingRef.current   = false
    mlrWeightsRef.current   = null
    filterState3Ref.current = initFilterState3()
    qualityTrackerRef.current = null
    degradeSinceRef.current   = null
    const s = signalRef.current
    s.qualityEvr = null; s.qualityTotalVar = null; s.signalDegraded = false
    setCalibReviewData(null)
    setCalibPhase('NONE')
  }, [])

  // ── Sim mode ──────────────────────────────────────────────────────────────
  // Sine breath + a fake heartbeat whose RR shortens on inhale (RSA), so the
  // whole feature stack — phase, rate, regularity, RR, RSA — is exercisable
  // with no hardware.

  const startSimulation = useCallback(() => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current)
    setBtState('CONNECTED')
    mlrWeightsRef.current   = { ...SIM_MLR_WEIGHTS }
    filterState3Ref.current = initFilterState3()
    simNextBeatRef.current  = Date.now()
    let lastTick = Date.now()
    simIntervalRef.current  = setInterval(() => {
      const now = Date.now()
      // Background tabs throttle timers to ~1 Hz; backfill 40 ms steps so the
      // phase/rate detectors always see a dense signal (capped at 3 s of catch-up)
      if (now - lastTick > 3000) lastTick = now - 3000
      for (let t = lastTick + 40; t <= now; t += 40) {
        const breath = 0.5 + 0.45 * Math.sin(2 * Math.PI * t / simPeriodMsRef.current)
        ingestBreathValue(t, breath)
        // Heartbeat: base 65 bpm, +12 bpm at inhale peak → RR 780–920 ms swing
        if (t >= simNextBeatRef.current) {
          const hrNow = 65 + 12 * breath
          const rr = 60000 / hrNow
          ingestHr(t, Math.round(hrNow), [rr])
          simNextBeatRef.current = t + rr
        }
      }
      lastTick = now
    }, 40)
  }, [ingestBreathValue, ingestHr])

  const setSimPeriodMs = useCallback((ms) => {
    if (ms >= 1000 && ms <= 20000) simPeriodMsRef.current = ms
  }, [])

  const acceptSimCalib = useCallback(() => {
    setCalibReviewData({ fitR: 0.92, lagMs: 50, peakErrorMs: 120, modelLabel: 'sim-mlr3w', pacerPts: [], beltPts: [] })
    setCalibPhase('REVIEW')
  }, [])

  // ── Subscriptions & history accessors ─────────────────────────────────────

  const onBreathEvent = useCallback((cb) => {
    listenersRef.current.add(cb)
    return () => listenersRef.current.delete(cb)
  }, [])

  // Clear the derived-feature state (phase, rate, regularity, signal history)
  // without touching the fitted belt model. Call when a game begins so its
  // feedback reflects play-time breathing, not the breaths carried over from
  // the 15 bpm calibration — otherwise the rate/regularity trackers stay
  // polluted by the calibration pace for their whole window (~a minute).
  const resetFeatures = useCallback(() => {
    phaseDetectorRef.current = createPhaseDetector()
    rateTrackerRef.current   = createRateTracker()
    breathHistoryRef.current = createHistory(HISTORY_MS)
    const s = signalRef.current
    s.phase = 'pause'; s.bpm = null; s.regularitySdMs = null; s.regularityCv = null; s.lastPeriodMs = null
  }, [])

  const getRecentBreath = useCallback((ms) => breathHistoryRef.current.recent(ms, Date.now()), [])
  const getRecentRR     = useCallback((ms) => rrHistoryRef.current.recent(ms, Date.now()), [])
  const getRecentHr     = useCallback((ms) => hrHistoryRef.current.recent(ms, Date.now()), [])

  // ── Teardown ──────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    if (simIntervalRef.current) { clearInterval(simIntervalRef.current); simIntervalRef.current = null }
    try { await readAccCharRef.current?.stopNotifications() }   catch { /* already closed */ }
    try { await heartRateCharRef.current?.stopNotifications() } catch { /* already closed */ }
    try { deviceRef.current?.gatt?.disconnect() }               catch { /* already closed */ }
    setBtState('IDLE')
  }, [])

  useEffect(() => () => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current)
    try { readAccCharRef.current?.stopNotifications() }   catch { /* unmount */ }
    try { heartRateCharRef.current?.stopNotifications() } catch { /* unmount */ }
    try { deviceRef.current?.gatt?.disconnect() }         catch { /* unmount */ }
  }, [])

  return {
    // connection
    btState, connect, disconnect, isSimMode,
    // calibration (prop-compatible with BreathBelt CalibrationScreen)
    calibPhase, calibReviewData,
    startCalibration, beginCalibCollection, acceptCalibration, redoCalibration, resetCalibration,
    // sim
    startSimulation, setSimPeriodMs, acceptSimCalib,
    // live data
    signalRef, getRecentBreath, getRecentRR, getRecentHr, onBreathEvent, resetFeatures,
    mlrWeightsRef,
  }
}
