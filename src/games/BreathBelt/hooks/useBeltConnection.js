import { useRef, useState, useCallback, useEffect } from 'react'
import {
  fitBestModel, processPacketMLR, initFilterState3,
  rollingPearsonR, computeMLRPredictions,
  getPacerRadius, medianPeakTimingError,
} from '../breathUtils'
import {
  PMD_SERVICE, PMD_CONTROL, PMD_DATA, HR_SERVICE, HR_MEASUREMENT,
  DEFAULT_TRIGGER_DEVICE, TRIGGER_DEVICES, BIOPAC_SERVER_URL,
} from '../constants'

const LIVE_PRED_WINDOW = 60

// Relay a single parallel-port write to the local Biopac helper. A missed
// trigger must not crash the session, so failures are logged, never thrown.
async function postParallel(address, value) {
  try {
    await fetch(`${BIOPAC_SERVER_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, value }),
    })
  } catch (err) {
    console.error(`Biopac trigger failed (address 0x${address.toString(16)}, value ${value}):`, err)
  }
}

export function useBeltConnection() {
  const [btState,         setBtState]         = useState('IDLE')
  const [comState,        setComState]         = useState('IDLE')
  const [comMessage,      setComMessage]       = useState('')
  const [testRunning,     setTestRunning]      = useState(false)
  const [calibPhase,      setCalibPhase]       = useState('NONE')
  const [syncQuality,     setSyncQuality]      = useState(0)
  const [calibReviewData, setCalibReviewData]  = useState(null)

  // Hardware
  const readAccCharRef          = useRef(null)
  const heartRateCharRef        = useRef(null)
  const serialPortWriterRef     = useRef(null)
  const serialPortRef           = useRef(null)
  const writableStreamClosedRef = useRef(null)
  const triggerDeviceRef        = useRef(DEFAULT_TRIGGER_DEVICE)

  // Calibration
  const calibSamplesRef    = useRef([])
  const calibStartMsRef    = useRef(0)
  const calibPeriodMsRef   = useRef(0)
  const mlrWeightsRef      = useRef(null)
  const filterState3Ref    = useRef(initFilterState3())

  // Live signal
  const breathValueRef      = useRef(0)
  const livePredBufferRef   = useRef([])
  const pacerStartMsRef     = useRef(0)
  const pacerPeriodMsRef    = useRef(0)

  // Per-trial raw samples for offline sync scoring
  // Accumulated whenever currentPhaseRef is 'phase2' or 'phase3'
  const trialRawSamplesRef  = useRef([])

  // Phase / trial labels
  const currentPhaseRef     = useRef('idle')
  const currentTrialRef     = useRef(-1)

  // Raw data (all phases)
  const rawAccelRowsRef     = useRef([])
  const rawHRRowsRef        = useRef([])
  const pendingAccelRef     = useRef([])
  const pendingHRRef        = useRef([])

  // Pacer radius fn — set by trial screens, read per accel packet
  const getPacerRadiusFnRef = useRef(() => NaN)

  // ── Calibration BREATHE timer ────────────────────────────────────────────

  useEffect(() => {
    if (calibPhase !== 'BREATHE') return
    const periodMs = calibPeriodMsRef.current
    const t = setTimeout(async () => {
      setCalibPhase('FITTING')
      const result = fitBestModel(calibSamplesRef.current, calibStartMsRef.current, periodMs)
      if (!result || result.fitR < 0.4) { setCalibPhase('FAILED'); return }

      mlrWeightsRef.current   = result
      filterState3Ref.current = initFilterState3()

      const beltRaw   = computeMLRPredictions(calibSamplesRef.current, result)
      const s         = calibSamplesRef.current
      const pacerPts  = s.filter((_, i) => i % 5 === 0)
        .map(samp => ({ t: samp.t, value: getPacerRadius(samp.t, calibStartMsRef.current, periodMs) }))
      const beltAll   = s.map((samp, i) => ({ t: samp.t, value: beltRaw[i] }))
      const beltPts   = beltAll.filter((_, i) => i % 5 === 0)
      const peakErrorMs = medianPeakTimingError(beltAll, pacerPts, periodMs)

      setCalibReviewData({ pacerPts, beltPts, fitR: result.fitR, peakErrorMs, modelLabel: result.modelLabel, lagMs: result.lagMs })
      setCalibPhase('REVIEW')
    }, 4 * periodMs)
    return () => clearTimeout(t)
  }, [calibPhase])

  // ── Accel handler ────────────────────────────────────────────────────────
  // Reads phase/trial dynamically from refs so updates from useTrialRunner
  // (which sets currentPhaseRef = 'phase2'/'phase3') take effect immediately
  // without rebinding `oncharacteristicvaluechanged`.

  const accelHandler = useCallback((e) => {
    const phase = currentPhaseRef.current
    const trial = currentTrialRef.current
    const timestamp = Date.now()
    const dv = e.target?.value
    if (!dv) return

    const step = Math.ceil(((dv.getInt8(9) + 1) * 8) / 8)
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

    measurements.forEach((s, idx) => {
      const row = { phase, trial, packetTimestamp: timestamp, sampleIndex: idx, x: s[0], y: s[1], z: s[2], pacerRadius }
      rawAccelRowsRef.current.push(row)
      pendingAccelRef.current.push(row)
    })

    // Calibration sample collection
    if (phase === 'calib_breathe') {
      measurements.forEach((s, idx) => {
        calibSamplesRef.current.push({ t: timestamp + idx * 5, x: s[0], y: s[1], z: s[2] })
      })
    }

    // Per-trial raw sample collection for offline sync scoring
    if (phase === 'phase2' || phase === 'phase3') {
      measurements.forEach((s, idx) => {
        trialRawSamplesRef.current.push({ t: timestamp + idx * 5, x: s[0], y: s[1], z: s[2] })
      })
    }

    // Live MLR processing
    if (mlrWeightsRef.current) {
      const { prediction, state } = processPacketMLR(measurements, filterState3Ref.current, mlrWeightsRef.current)
      filterState3Ref.current = state
      breathValueRef.current  = Math.max(0, Math.min(1, prediction))

      livePredBufferRef.current.push({ t: timestamp, value: breathValueRef.current })
      if (livePredBufferRef.current.length > LIVE_PRED_WINDOW) livePredBufferRef.current.shift()

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

  const hrHandlerRef = useRef((e) => {
    const hr  = e.target?.value?.getInt8(1) ?? -1
    const row = { phase: currentPhaseRef.current, trial: currentTrialRef.current, timestamp: Date.now(), heartRate: hr }
    rawHRRowsRef.current.push(row)
    pendingHRRef.current.push(row)
  })

  // ── BT connect ───────────────────────────────────────────────────────────

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
      data.oncharacteristicvaluechanged   = accelHandler
      hrChar.oncharacteristicvaluechanged = hrHandlerRef.current
      await data.startNotifications()
      await hrChar.startNotifications()
      setBtState('CONNECTED')
    } catch (err) { console.error('BT:', err); setBtState('ERROR') }
  }, [accelHandler])

  // ── COM port ─────────────────────────────────────────────────────────────

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
      // Black Box ToolKit USB TTL Module init: "RR" resets and clears all output lines.
      if (triggerDeviceRef.current === 'AD_BBT') {
        try { await serialPortWriterRef.current.write('RR') } catch {}
      }
      setComState('CONNECTED')
    } catch (err) { console.error('COM:', err); setComState('ERROR') }
  }, [])

  // ── Biopac parallel-port server ───────────────────────────────────────────
  // Biopac rigs aren't serial and the browser can't drive a parallel port, so
  // there is no port picker / writer / reader. Instead we confirm the local
  // helper is up and has loaded its parallel-port DLL. Reuses comState so the
  // setup screen's existing status indicator works unchanged.

  const connectBiopac = useCallback(async () => {
    setComState('CONNECTING')
    setComMessage('')
    try {
      const res  = await fetch(`${BIOPAC_SERVER_URL}/status`)
      const data = await res.json().catch(() => ({}))
      if (data?.ok && data?.dll) {
        setComMessage('Parallel server connected.')
        setComState('CONNECTED')
      } else if (data?.ok) {
        setComMessage('Parallel server reachable, but its parallel-port DLL is not loaded.')
        setComState('ERROR')
      } else {
        setComMessage('Parallel server responded but is not ready.')
        setComState('ERROR')
      }
    } catch (err) {
      console.error('Biopac status:', err)
      setComMessage('Parallel server offline — could not reach localhost:8765.')
      setComState('ERROR')
    }
  }, [])

  // Chosen at session setup (see TRIGGER_DEVICES). Determines the trigger protocol.
  const setTriggerDevice = useCallback((device) => {
    if (device) triggerDeviceRef.current = device
  }, [])

  const sendTrigger = useCallback(async (value) => {
    const device = triggerDeviceRef.current
    const dev    = TRIGGER_DEVICES.find(d => d.value === device)

    // Biopac (parallel-port) devices: send code * shift on the port's high or
    // low nibble, hold 25ms, then clear to 0 — same pulse shape as AD_BBT.
    if (dev && dev.address != null) {
      const wire = Math.max(0, Math.min(255, Math.round(Number(value) * dev.shift)))
      await postParallel(dev.address, wire)
      await new Promise(r => setTimeout(r, 25))
      await postParallel(dev.address, 0)
      return
    }

    // AD_BBT (Web Serial): Black Box ToolKit USB TTL Module. A two-char
    // uppercase hex string (no terminator) sets the 8 TTL output lines to that
    // byte value; "00" clears. Pulse high for 25ms then clear so PowerLab sees a
    // clean edge. NB: must be hex — decimal "10".."12" lands on lines 16..18.
    const w = serialPortWriterRef.current
    if (!w) return
    try {
      const hex = (Number(value) & 0xFF).toString(16).padStart(2, '0').toUpperCase()
      await w.write(hex)
      await new Promise(r => setTimeout(r, 25))
      await w.write('00')
    } catch (err) {
      console.error('COM trigger:', err)
    }
  }, [])

  // Connection check: pulse every event code 1..13 through the active device so
  // the RA can confirm all 13 marks land in the recording. Uses sendTrigger, so
  // it's correct for both AD_BBT (hex) and Biopac (code*shift) automatically.
  const sendTestCascade = useCallback(async () => {
    setTestRunning(true)
    try {
      for (let code = 1; code <= 13; code++) {
        await sendTrigger(String(code))            // pulses high ~25ms then clears
        await new Promise(r => setTimeout(r, 250)) // gap so marks are distinct
      }
    } finally {
      setTestRunning(false)
    }
  }, [sendTrigger])

  // ── Calibration ──────────────────────────────────────────────────────────

  const startCalibration = useCallback(() => {
    calibSamplesRef.current   = []
    breathValueRef.current    = 0
    livePredBufferRef.current = []
    setSyncQuality(0)
    setCalibReviewData(null)
    currentPhaseRef.current   = 'calib_fixation'
    setCalibPhase('FIXATION')
  }, [])

  const beginCalibCollection = useCallback((calibStartMs, breathPeriodMs) => {
    calibSamplesRef.current  = []
    calibStartMsRef.current  = calibStartMs
    calibPeriodMsRef.current = breathPeriodMs
    currentPhaseRef.current  = 'calib_breathe'
    setCalibPhase('BREATHE')
  }, [])

  const acceptCalibration = useCallback(() => {
    currentPhaseRef.current = 'idle'
    setCalibPhase('COMPLETE')
  }, [])

  const redoCalibration = useCallback(() => {
    calibSamplesRef.current   = []
    breathValueRef.current    = 0
    livePredBufferRef.current = []
    setCalibReviewData(null)
    setSyncQuality(0)
    currentPhaseRef.current   = 'calib_fixation'
    setCalibPhase('FIXATION')
  }, [])

  const resetCalibration = useCallback(() => {
    calibSamplesRef.current   = []
    mlrWeightsRef.current     = null
    filterState3Ref.current   = initFilterState3()
    breathValueRef.current    = 0
    livePredBufferRef.current = []
    setCalibReviewData(null)
    setSyncQuality(0)
    currentPhaseRef.current   = 'idle'
    setCalibPhase('NONE')
  }, [])

  // ── Trial raw sample access ───────────────────────────────────────────────
  // Called by useTrialRunner after sendTrigger('12') to retrieve this trial's
  // raw samples for offline sync scoring, then clears the buffer.

  const getAndClearTrialSamples = useCallback(() => {
    const samples = trialRawSamplesRef.current
    trialRawSamplesRef.current = []
    return samples
  }, [])

  // ── Pacer context ─────────────────────────────────────────────────────────

  const setPacerContext  = useCallback((startMs, periodMs) => {
    pacerStartMsRef.current  = startMs
    pacerPeriodMsRef.current = periodMs
  }, [])

  const clearPacerContext = useCallback(() => {
    pacerStartMsRef.current  = 0
    pacerPeriodMsRef.current = 0
  }, [])

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const stopNotifications = useCallback(async () => {
    try { await readAccCharRef.current?.stopNotifications() }   catch {}
    try { await heartRateCharRef.current?.stopNotifications() } catch {}
    try { await serialPortWriterRef.current?.close(); await writableStreamClosedRef.current } catch {}
    try { await serialPortRef.current?.close() } catch {}
  }, [])

  return {
    btState, comState, comMessage, testRunning, calibPhase, syncQuality, calibReviewData,
    breathValueRef, mlrWeightsRef, filterState3Ref,
    rawAccelRowsRef, rawHRRowsRef, pendingAccelRef, pendingHRRef,
    currentPhaseRef, currentTrialRef,
    getPacerRadiusFnRef,
    connect, connectCOM, connectBiopac, sendTrigger, sendTestCascade, setTriggerDevice,
    startCalibration, beginCalibCollection,
    acceptCalibration, redoCalibration, resetCalibration,
    getAndClearTrialSamples,
    setPacerContext, clearPacerContext,
    stopNotifications,
  }
}
