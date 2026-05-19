import { useRef, useState, useCallback, useEffect } from 'react';
import {
  BASE_BREATH_SPEED_S, CALIB_CYCLES,
  PMD_SERVICE, PMD_CONTROL, PMD_DATA, HR_SERVICE, HR_MEASUREMENT,
} from '../constants';

const BREATH_PERIOD_MS = BASE_BREATH_SPEED_S * 1000;

// ── Signal processing (ported from breathbelt-main/functions.ts) ──────────

function processAccDataView(e) {
  const dv = e.target?.value;
  if (!dv) return [];
  const step = Math.ceil(((dv.getInt8(9) + 1) * 8) / 8);
  const out = [];
  let offset = 10;
  while (offset + 3 * step <= dv.byteLength) {
    out.push([
      dv.getInt16(offset,          true) / 100,
      dv.getInt16(offset + step,   true) / 100,
      dv.getInt16(offset + 2*step, true) / 100,
    ]);
    offset += 3 * step;
  }
  return out;
}

function axisAvg(samples, axis) {
  return samples.reduce((s, r) => s + r[axis], 0) / samples.length;
}

function timeSeries(buf, axis) {
  return buf.map(({ timestamp, samples }) => ({ timestamp, v: axisAvg(samples, axis) }));
}

function selectAxis(buf) {
  let best = 0, bestRange = 0;
  for (const a of [0, 1, 2]) {
    const vs = timeSeries(buf, a).map(s => s.v);
    const r  = Math.max(...vs) - Math.min(...vs);
    if (r > bestRange) { bestRange = r; best = a; }
  }
  return best;
}

function detectPolarity(buf, axis, t0, periodMs) {
  const s = timeSeries(buf, axis).filter(s => s.timestamp - t0 < periodMs / 2);
  if (s.length < 4) return 1;
  const n  = Math.max(1, Math.floor(s.length / 3));
  const fa = s.slice(0, n).reduce((a, x) => a + x.v, 0) / n;
  const la = s.slice(-n).reduce((a, x) => a + x.v, 0) / n;
  return la >= fa ? 1 : -1;
}

function sortedMedian(sorted) {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[m-1] + sorted[m]) / 2 : sorted[m];
}

function computeBaseline(buf, axis, t0, windowMs = 500) {
  const vs = timeSeries(buf, axis)
    .filter(s => s.timestamp - t0 < windowMs)
    .map(s => s.v)
    .sort((a, b) => a - b);
  return vs.length ? sortedMedian(vs) : 0;
}

function normBounds(buf, axis, polarity, baseline) {
  const vs = timeSeries(buf, axis)
    .map(s => polarity * (s.v - baseline))
    .sort((a, b) => a - b);
  if (vs.length < 10) return { normFloor: 0, normCeiling: 1 };
  return {
    normFloor:   vs[Math.floor(vs.length * 0.1)],
    normCeiling: vs[Math.floor(vs.length * 0.9)],
  };
}

function runCalibration(buf, t0, periodMs) {
  if (buf.length < 10) return null;
  const selectedAxis = selectAxis(buf);
  const polarity     = detectPolarity(buf, selectedAxis, t0, periodMs);
  const baseline     = computeBaseline(buf, selectedAxis, t0);
  const { normFloor, normCeiling } = normBounds(buf, selectedAxis, polarity, baseline);
  if (normCeiling - normFloor < 0.005) return null;
  return { selectedAxis, polarity, baseline, normFloor, normCeiling };
}

function computeBreathValue(samples, calib) {
  const avg   = axisAvg(samples, calib.selectedAxis);
  const sig   = calib.polarity * (avg - calib.baseline);
  const range = calib.normCeiling - calib.normFloor;
  if (range <= 0) return 0;
  return Math.min(1, Math.max(0, (sig - calib.normFloor) / range));
}

function updateCalibSmoothed(calib, buf, alpha = 0.08) {
  const { normFloor: nf, normCeiling: nc } =
    normBounds(buf, calib.selectedAxis, calib.polarity, calib.baseline);
  return {
    ...calib,
    normFloor:   calib.normFloor   + alpha * (nf - calib.normFloor),
    normCeiling: calib.normCeiling + alpha * (nc - calib.normCeiling),
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────
//
// calibPhase: 'NONE' | 'PHASE_1' | 'PHASE_2' | 'REVIEW' | 'COMPLETE' | 'FAILED'
//   NONE      → PHASE_1  via startCalibration()
//   PHASE_1   → PHASE_2  automatically after CALIB_CYCLES * BREATH_PERIOD_MS
//   PHASE_1   → FAILED   if runCalibration() returns null
//   PHASE_2   → REVIEW   automatically after CALIB_CYCLES * BREATH_PERIOD_MS
//   REVIEW    → PHASE_2  via redoPhase2()
//   REVIEW    → COMPLETE via acceptCalibration()
//   any       → NONE     via resetCalibration()

export function useBeltConnection() {
  const [btState,    setBtState]    = useState('IDLE');   // IDLE|CONNECTING|CONNECTED|ERROR
  const [comState,   setComState]   = useState('IDLE');   // IDLE|CONNECTING|CONNECTED|ERROR
  const [calibPhase, setCalibPhase] = useState('NONE');

  // Hardware
  const readAccCharRef          = useRef(null);
  const heartRateCharRef        = useRef(null);
  const serialPortWriterRef     = useRef(null);
  const serialPortRef           = useRef(null);
  const writableStreamClosedRef = useRef(null);

  // Calibration
  const calibBufRef    = useRef([]);
  const calibT0Ref     = useRef(0);
  const calibStateRef  = useRef(null);

  // Live 0–1 signal — written by BT handler, read by rAF in BeltSyncRing
  const breathValueRef = useRef(0);

  // Phase/trial labels for raw row tagging
  const currentPhaseRef = useRef('idle');
  const currentTrialRef = useRef(-1);

  // Raw accumulation
  const rawAccelRowsRef = useRef([]);
  const rawHRRowsRef    = useRef([]);

  // ── Accel packet handler factory ─────────────────────────────────────────
  // Returns a new handler closure for each phase/trial label change.
  // We use useCallback with stable deps so makeAccelHandler itself is stable.

  const makeAccelHandler = useCallback((phase, trial) => (e) => {
    const timestamp = Date.now();
    const samples   = processAccDataView(e);
    if (!samples.length) return;

    samples.forEach((s, idx) => {
      rawAccelRowsRef.current.push({
        phase, trial,
        packetTimestamp: timestamp, sampleIndex: idx,
        x: s[0], y: s[1], z: s[2],
      });
    });

    if (phase === 'calib_1' || phase === 'calib_2') {
      calibBufRef.current.push({ timestamp, samples });
    }

    if (calibStateRef.current) {
      breathValueRef.current = computeBreathValue(samples, calibStateRef.current);
      if (phase === 'calib_2') {
        calibStateRef.current = updateCalibSmoothed(calibStateRef.current, calibBufRef.current);
      }
    }
  }, []);

  // HR handler is persistent — reads phase/trial from mutable refs (no stale closure)
  const hrHandlerRef = useRef((e) => {
    const hr = e.target?.value?.getInt8(1) ?? -1;
    rawHRRowsRef.current.push({
      phase:     currentPhaseRef.current,
      trial:     currentTrialRef.current,
      timestamp: Date.now(),
      heartRate: hr,
    });
  });

  // ── Calibration phase timers ─────────────────────────────────────────────
  // Mirror the pattern from breathbelt-main/App.tsx — separate useEffects per phase.

  useEffect(() => {
    if (calibPhase !== 'PHASE_1') return;
    const t = setTimeout(() => {
      const calib = runCalibration(calibBufRef.current, calibT0Ref.current, BREATH_PERIOD_MS);
      if (!calib) {
        setCalibPhase('FAILED');
        return;
      }
      calibStateRef.current  = calib;
      breathValueRef.current = 0;
      currentPhaseRef.current = 'calib_2';
      if (readAccCharRef.current) {
        readAccCharRef.current.oncharacteristicvaluechanged = makeAccelHandler('calib_2', -1);
      }
      setCalibPhase('PHASE_2');
    }, CALIB_CYCLES * BREATH_PERIOD_MS);
    return () => clearTimeout(t);
  }, [calibPhase, makeAccelHandler]);

  useEffect(() => {
    if (calibPhase !== 'PHASE_2') return;
    const t = setTimeout(() => setCalibPhase('REVIEW'), CALIB_CYCLES * BREATH_PERIOD_MS);
    return () => clearTimeout(t);
  }, [calibPhase]);

  // ── BT connect ───────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    setBtState('CONNECTING');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HR_SERVICE] }],
        optionalServices: [PMD_SERVICE],
      });
      const server = await device.gatt.connect();
      await new Promise(r => setTimeout(r, 1000));

      const pmdSvc  = await server.getPrimaryService(PMD_SERVICE);
      const hrSvc   = await server.getPrimaryService(HR_SERVICE);
      const control = await pmdSvc.getCharacteristic(PMD_CONTROL);
      const data    = await pmdSvc.getCharacteristic(PMD_DATA);
      const hrChar  = await hrSvc.getCharacteristic(HR_MEASUREMENT);

      readAccCharRef.current   = data;
      heartRateCharRef.current = hrChar;

      await new Promise(r => setTimeout(r, 1000));
      // Polar H10: enable accelerometer stream at 25 Hz
      await control.writeValue(
        new Uint8Array([
          0x02, 0x02, 0x00, 0x01, 0xC8, 0x00,
          0x01, 0x01, 0x10, 0x00, 0x02, 0x01, 0x08, 0x00,
        ]).buffer
      );

      data.oncharacteristicvaluechanged   = makeAccelHandler('idle', -1);
      hrChar.oncharacteristicvaluechanged = hrHandlerRef.current;
      await data.startNotifications();
      await hrChar.startNotifications();

      setBtState('CONNECTED');
    } catch (err) {
      console.error('BT connect:', err);
      setBtState('ERROR');
    }
  }, [makeAccelHandler]);

  // ── COM port connect ─────────────────────────────────────────────────────

  const connectCOM = useCallback(async () => {
    setComState('CONNECTING');
    try {
      const port = await navigator.serial.requestPort();
      // Close if already open (safety)
      if (port.readable || port.writable) {
        try { await port.close(); await new Promise(r => setTimeout(r, 100)); } catch {}
      }
      await port.open({ baudRate: 115200 });
      const enc = new TextEncoderStream();
      writableStreamClosedRef.current = enc.readable.pipeTo(port.writable);
      serialPortWriterRef.current     = enc.writable.getWriter();
      serialPortRef.current           = port;
      setComState('CONNECTED');
    } catch (err) {
      console.error('COM connect:', err);
      setComState('ERROR');
    }
  }, []);

  const sendTrigger = useCallback(async (value) => {
    try {
      await serialPortWriterRef.current?.write(`${value}\n`);
    } catch (err) {
      console.error('COM trigger error:', err);
    }
  }, []);

  // ── Calibration control ──────────────────────────────────────────────────

  const startCalibration = useCallback(() => {
    calibBufRef.current    = [];
    calibT0Ref.current     = Date.now();
    calibStateRef.current  = null;
    breathValueRef.current = 0;
    currentPhaseRef.current = 'calib_1';
    currentTrialRef.current = -1;
    if (readAccCharRef.current) {
      readAccCharRef.current.oncharacteristicvaluechanged = makeAccelHandler('calib_1', -1);
    }
    setCalibPhase('PHASE_1');
  }, [makeAccelHandler]);

  const redoPhase2 = useCallback(() => {
    breathValueRef.current  = 0;
    currentPhaseRef.current = 'calib_2';
    if (readAccCharRef.current) {
      readAccCharRef.current.oncharacteristicvaluechanged = makeAccelHandler('calib_2', -1);
    }
    setCalibPhase('PHASE_2');
  }, [makeAccelHandler]);

  const resetCalibration = useCallback(() => {
    calibBufRef.current    = [];
    calibT0Ref.current     = 0;
    calibStateRef.current  = null;
    breathValueRef.current = 0;
    currentPhaseRef.current = 'idle';
    if (readAccCharRef.current) {
      readAccCharRef.current.oncharacteristicvaluechanged = makeAccelHandler('idle', -1);
    }
    setCalibPhase('NONE');
  }, [makeAccelHandler]);

  const acceptCalibration = useCallback(() => {
    currentPhaseRef.current = 'idle';
    if (readAccCharRef.current) {
      readAccCharRef.current.oncharacteristicvaluechanged = makeAccelHandler('idle', -1);
    }
    setCalibPhase('COMPLETE');
  }, [makeAccelHandler]);

  // ── Cleanup ──────────────────────────────────────────────────────────────

  const stopNotifications = useCallback(async () => {
    try { await readAccCharRef.current?.stopNotifications(); }    catch {}
    try { await heartRateCharRef.current?.stopNotifications(); }  catch {}
    try {
      await serialPortWriterRef.current?.close();
      await writableStreamClosedRef.current;
    } catch {}
    try { await serialPortRef.current?.close(); } catch {}
  }, []);

  return {
    // state
    btState, comState, calibPhase,
    // refs
    breathValueRef, calibStateRef,
    rawAccelRowsRef, rawHRRowsRef,
    currentPhaseRef, currentTrialRef,
    // BT / COM
    connect, connectCOM, sendTrigger,
    // calibration
    startCalibration, redoPhase2, resetCalibration, acceptCalibration,
    // cleanup
    stopNotifications,
  };
}
