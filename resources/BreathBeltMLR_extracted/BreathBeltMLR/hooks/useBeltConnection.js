import { useRef, useState, useCallback, useEffect } from 'react'
import {
  fitBestModel, processPacketMLR, initFilterState3,
  rollingPearsonR, computeMLRPredictions,
  getPacerRadius, medianPeakTimingError,
} from '../breathUtils'
import {
  PMD_SERVICE, PMD_CONTROL, PMD_DATA, HR_SERVICE, HR_MEASUREMENT,
} from '../constants'

// ── COM trigger vocabulary ─────────────────────────────────────────────────
// (unchanged — 0–12 range)

const LIVE_PRED_WINDOW = 60   // keep last N predictions for rolling Pearson R

// ── useBeltConnection ──────────────────────────────────────────────────────
//
// Manages BT connection, COM port, and the full MLR calibration pipeline.
//
// calibPhase transitions:
//   NONE    → FIXATION     via startCalibration()
//   FIXATION → BREATHE     via beginCalibCollection(calibStartMs, breathPeriodMs)
//                           called by CalibrationScreen when avatar animation begins
//   BREATHE → FITTING      automatically after CALIB_CYCLES * breathPeriodMs
//   FITTING → REVIEW       automatically after fitBestModel() completes
//   FITTING → FAILED       if fitBestModel() returns null or fitR < 0.4
//   REVIEW  → COMPLETE     via acceptCalibration()
//   REVIEW  → FIXATION     via redoCalibration()
//   any     → NONE         via resetCalibration()
//
// breathValueRef: 0–1 live belt signal from causal MLR processing
// syncQuality:    rolling Pearson R (React state, for SynchronyBar)
// calibReviewData: { pacerPts, beltPts, fitR, peakErrorMs, modelLabel, lagMs } after FITTING

export function useBeltConnection() {
  const [btState,    setBtState]    = useState('IDLE')   // IDLE|CONNECTING|CONNECTED|ERROR
  const [comState,   setComState]   = useState('IDLE')
  const [calibPhase, setCalibPhase] = useState('NONE')   // NONE|FIXATION|BREATHE|FITTING|REVIEW|COMPLETE|FAILED
  const [syncQuality, setSyncQuality] = useState(0)      // rolling Pearson R for SynchronyBar
  const [calibReviewData, setCalibReviewData] = useState(null)

  // ── Hardware refs ─────────────────────────────────────────────────────────
  const readAccCharRef          = useRef(null)
  const heartRateCharRef        = useRef(null)
  const serialPortWriterRef     = useRef(null)
  const serialPortRef           = useRef(null)
  const writableStreamClosedRef = useRef(null)

  // ── Calibration refs ──────────────────────────────────────────────────────
  const calibSamplesRef    = useRef([])     // { t, x, y, z } — collected during BREATHE
  const calibStartMsRef    = useRef(0)
  const calibPeriodMsRef   = useRef(0)
  const mlrWeightsRef      = useRef(null)   // { bias, weights, modelLabel, lagMs, fitR }
  const filterState3Ref    = useRef(initFilterState3())

  // ── Live signal refs ──────────────────────────────────────────────────────
  const breathValueRef     = useRef(0)      // 0–1 causal MLR prediction
  const livePredBufferRef  = useRef([])     // { t, value }[] for rollingPearsonR
  const pacerStartMsRef    = useRef(0)      // current pacer start (for sync quality)
  const pacerPeriodMsRef   = useRef(0)      // current pacer period

  // ── Phase/trial labelling ─────────────────────────────────────────────────
  const currentPhaseRef    = useRef('idle')
  const currentTrialRef    = useRef(-1)

  // ── Raw data accumulation ─────────────────────────────────────────────────
  const rawAccelRowsRef    = useRef([])
  const rawHRRowsRef       = useRef([])
  const pendingAccelRef    = useRef([])
  const pendingHRRef       = useRef([])

  // Fn ref for current pacer radius — set by trial screens, read by accel handler
  // Returns NaN when no pacer is running
  const getPacerRadiusFnRef = useRef(() => NaN)

  // ── Calibration BREATHE timer ──────────────────────────────────────────────
  // useEffect watches calibPhase === 'BREATHE'; fires after CALIB_CYCLES * period

  useEffect(() => {
    if (calibPhase !== 'BREATHE') return
    const periodMs = calibPeriodMsRef.current
    const cycles   = 4  // CALIB_CYCLES from constants
    const t = setTimeout(async () => {
      setCalibPhase('FITTING')

      // Run fitBestModel — synchronous but can take ~50ms for large buffers
      const result = fitBestModel(calibSamplesRef.current, calibStartMsRef.current, periodMs)

      if (!result || result.fitR < 0.4) {
        setCalibPhase('FAILED')
        return
      }

      mlrWeightsRef.current       = result
      filterState3Ref.current     = initFilterState3()  // reset live filter state

      // Build review data (offline pass over calib samples)
      const beltRaw = computeMLRPredictions(calibSamplesRef.current, result)
      const s = calibSamplesRef.current
      const pacerPts = s
        .filter((_, i) => i % 5 === 0)
        .map(samp => ({ t: samp.t, value: getPacerRadius(samp.t, calibStartMsRef.current, periodMs) }))
      const beltPtsAll = s.map((samp, i) => ({ t: samp.t, value: beltRaw[i] }))
      const beltPts    = beltPtsAll.filter((_, i) => i % 5 === 0)
      const peakErrorMs = medianPeakTimingError(beltPtsAll, pacerPts, periodMs)

      setCalibReviewData({
        pacerPts,
        beltPts,
        fitR:        result.fitR,
        peakErrorMs,
        modelLabel:  result.modelLabel,
        lagMs:       result.lagMs,
      })
      setCalibPhase('REVIEW')
    }, cycles * periodMs)

    return () => clearTimeout(t)
  }, [calibPhase])

  // ── Accel handler factory ──────────────────────────────────────────────────
  // phase/trial captured in closure. Reads getPacerRadiusFnRef for pacer logging.

  const makeAccelHandler = useCallback((phase, trial) => (e) => {
    const timestamp  = Date.now()
    const dv         = e.target?.value
    if (!dv) return

    // Parse packet
    const step       = Math.ceil(((dv.getInt8(9) + 1) * 8) / 8)
    const measurements = []
    let offset = 10
    while (offset + 3 * step <= dv.byteLength) {
      measurements.push([
        dv.getInt16(offset,          true) / 100,
        dv.getInt16(offset + step,   true) / 100,
        dv.getInt16(offset + 2*step, true) / 100,
      ])
      offset += 3 * step
    }
    if (!measurements.length) return

    const pacerRadius = getPacerRadiusFnRef.current()

    // Log raw rows
    measurements.forEach((s, idx) => {
      const row = {
        phase, trial,
        packetTimestamp: timestamp, sampleIndex: idx,
        x: s[0], y: s[1], z: s[2],
        pacerRadius,
      }
      rawAccelRowsRef.current.push(row)
      pendingAccelRef.current.push(row)
    })

    // Accumulate CalibSamples during BREATHE phase
    if (phase === 'calib_breathe') {
      measurements.forEach((s, idx) => {
        calibSamplesRef.current.push({
          t: timestamp + idx * 5,  // ~5ms between samples at 200Hz
          x: s[0], y: s[1], z: s[2],
        })
      })
    }

    // Live MLR processing — only after calibration is complete
    if (mlrWeightsRef.current) {
      const { prediction, state } = processPacketMLR(
        measurements, filterState3Ref.current, mlrWeightsRef.current
      )
      filterState3Ref.current = state
      breathValueRef.current  = Math.max(0, Math.min(1, prediction))

      // Accumulate for rolling Pearson R
      const pred = { t: timestamp, value: breathValueRef.current }
      livePredBufferRef.current.push(pred)
      if (livePredBufferRef.current.length > LIVE_PRED_WINDOW) {
        livePredBufferRef.current.shift()
      }

      // Update sync quality (only when pacer is running)
      if (pacerStartMsRef.current > 0 && pacerPeriodMsRef.current > 0) {
        const r = rollingPearsonR(
          livePredBufferRef.current,
          pacerStartMsRef.current,
          pacerPeriodMsRef.current,
          mlrWeightsRef.current.lagMs,
        )
        setSyncQuality(r)
      }
    }
  }, [])

  // HR handler
  const hrHandlerRef = useRef((e) => {
    const hr = e.target?.value?.getInt8(1) ?? -1
    const row = {
      phase:     currentPhaseRef.current,
      trial:     currentTrialRef.current,
      timestamp: Date.now(),
      heartRate: hr,
    }
    rawHRRowsRef.current.push(row)
    pendingHRRef.current.push(row)
  })

  // ── BT connect ────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    setBtState('CONNECTING')
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HR_SERVICE] }],
        optionalServices: [PMD_SERVICE],
      })
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
      await control.writeValue(
        new Uint8Array([0x02,0x02,0x00,0x01,0xC8,0x00,0x01,0x01,0x10,0x00,0x02,0x01,0x08,0x00]).buffer
      )

      data.oncharacteristicvaluechanged   = makeAccelHandler('idle', -1)
      hrChar.oncharacteristicvaluechanged = hrHandlerRef.current
      await data.startNotifications()
      await hrChar.startNotifications()

      setBtState('CONNECTED')
    } catch (err) {
      console.error('BT connect:', err)
      setBtState('ERROR')
    }
  }, [makeAccelHandler])

  // ── COM port ──────────────────────────────────────────────────────────────

  const connectCOM = useCallback(async () => {
    setComState('CONNECTING')
    try {
      const port = await navigator.serial.requestPort()
      if (port.readable || port.writable) {
        try { await port.close(); await new Promise(r => setTimeout(r, 100)) } catch {}
      }
      await port.open({ baudRate: 115200 })
      const enc = new TextEncoderStream()
      writableStreamClosedRef.current = enc.readable.pipeTo(port.writable)
      serialPortWriterRef.current     = enc.writable.getWriter()
      serialPortRef.current           = port
      setComState('CONNECTED')
    } catch (err) {
      console.error('COM connect:', err)
      setComState('ERROR')
    }
  }, [])

  const sendTrigger = useCallback(async (value) => {
    try { await serialPortWriterRef.current?.write(`${value}\n`) } catch (err) {
      console.error('COM trigger:', err)
    }
  }, [])

  // ── Calibration control ───────────────────────────────────────────────────

  // Step 1: begin fixation — clear old data, freeze avatar
  const startCalibration = useCallback(() => {
    calibSamplesRef.current  = []
    calibStartMsRef.current  = 0
    calibPeriodMsRef.current = 0
    breathValueRef.current   = 0
    livePredBufferRef.current = []
    setSyncQuality(0)
    setCalibReviewData(null)
    currentPhaseRef.current  = 'calib_fixation'
    if (readAccCharRef.current) {
      readAccCharRef.current.oncharacteristicvaluechanged = makeAccelHandler('calib_fixation', -1)
    }
    setCalibPhase('FIXATION')
  }, [makeAccelHandler])

  // Step 2: called by CalibrationScreen exactly when avatar animation begins
  const beginCalibCollection = useCallback((calibStartMs, breathPeriodMs) => {
    calibSamplesRef.current  = []
    calibStartMsRef.current  = calibStartMs
    calibPeriodMsRef.current = breathPeriodMs
    currentPhaseRef.current  = 'calib_breathe'
    if (readAccCharRef.current) {
      readAccCharRef.current.oncharacteristicvaluechanged = makeAccelHandler('calib_breathe', -1)
    }
    setCalibPhase('BREATHE')
  }, [makeAccelHandler])

  const acceptCalibration = useCallback(() => {
    currentPhaseRef.current = 'idle'
    if (readAccCharRef.current) {
      readAccCharRef.current.oncharacteristicvaluechanged = makeAccelHandler('idle', -1)
    }
    setCalibPhase('COMPLETE')
  }, [makeAccelHandler])

  const redoCalibration = useCallback(() => {
    calibSamplesRef.current  = []
    breathValueRef.current   = 0
    livePredBufferRef.current = []
    setCalibReviewData(null)
    setSyncQuality(0)
    currentPhaseRef.current  = 'calib_fixation'
    if (readAccCharRef.current) {
      readAccCharRef.current.oncharacteristicvaluechanged = makeAccelHandler('calib_fixation', -1)
    }
    setCalibPhase('FIXATION')
  }, [makeAccelHandler])

  const resetCalibration = useCallback(() => {
    calibSamplesRef.current  = []
    mlrWeightsRef.current    = null
    filterState3Ref.current  = initFilterState3()
    breathValueRef.current   = 0
    livePredBufferRef.current = []
    setCalibReviewData(null)
    setSyncQuality(0)
    currentPhaseRef.current  = 'idle'
    if (readAccCharRef.current) {
      readAccCharRef.current.oncharacteristicvaluechanged = makeAccelHandler('idle', -1)
    }
    setCalibPhase('NONE')
  }, [makeAccelHandler])

  // ── Pacer tracking (for sync quality during trials) ───────────────────────
  const setPacerContext = useCallback((startMs, periodMs) => {
    pacerStartMsRef.current  = startMs
    pacerPeriodMsRef.current = periodMs
  }, [])

  const clearPacerContext = useCallback(() => {
    pacerStartMsRef.current  = 0
    pacerPeriodMsRef.current = 0
  }, [])

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const stopNotifications = useCallback(async () => {
    try { await readAccCharRef.current?.stopNotifications() }    catch {}
    try { await heartRateCharRef.current?.stopNotifications() }  catch {}
    try {
      await serialPortWriterRef.current?.close()
      await writableStreamClosedRef.current
    } catch {}
    try { await serialPortRef.current?.close() } catch {}
  }, [])

  return {
    // State
    btState, comState, calibPhase, syncQuality, calibReviewData,
    // Signal refs
    breathValueRef, mlrWeightsRef, filterState3Ref,
    // Data refs
    rawAccelRowsRef, rawHRRowsRef, pendingAccelRef, pendingHRRef,
    currentPhaseRef, currentTrialRef,
    // Pacer radius fn ref — set by trial screens
    getPacerRadiusFnRef,
    // BT / COM
    connect, connectCOM, sendTrigger,
    // Calibration
    startCalibration, beginCalibCollection,
    acceptCalibration, redoCalibration, resetCalibration,
    // Pacer context (for sync quality)
    setPacerContext, clearPacerContext,
    // Cleanup
    stopNotifications,
  }
}
