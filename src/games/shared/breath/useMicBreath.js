import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { createMicBreathDetector, frameFromSpectrum, MIC_DEFAULTS } from './micBreath'

// ── useMicBreath ────────────────────────────────────────────────────────────
// Microphone breath sensing, the hardware-free sibling of useBreathSignal.
// Opens the mic with the browser's voice processing OFF (noise suppression
// treats breath as noise and removes it; AGC pumps the floor), reads one
// spectrum every ~50 ms and runs it through micBreath.js.
//
//   const mic = useMicBreath()
//   mic.start(deviceId?)  — must be called from a click (mic permission + autoplay)
//   mic.signalRef.current = { t, act, inBurst, tonal, bpm, mode, acfBpm, acfStrength, ... }
//   mic.getHistory(ms)    → recent frames for drawing
//   mic.getBursts()       → completed bursts [{ t0, t1, peakDb, centroid, label }]
//   mic.setOptions({...}) → retune the detector live
//   mic.applied           → the constraints the browser actually honoured
//
// Nothing leaves the browser. Optional local recording (startRecording) keeps
// the raw audio in memory for download only, to tune the detector offline.

const HISTORY_MS = 60000
const SPEC_BINS  = 96        // spectrogram rows kept per frame (0–SPEC_MAX_HZ)
const SPEC_MAX_HZ = 4000

export function useMicBreath(initialOptions = {}) {
  const [status, setStatus] = useState('idle')   // idle | starting | running | error
  const [error, setError] = useState(null)
  const [applied, setApplied] = useState(null)
  const [devices, setDevices] = useState([])

  const ctxRef = useRef(null)
  const streamRef = useRef(null)
  const analyserRef = useRef(null)
  const timerRef = useRef(null)
  const detRef = useRef(null)
  if (detRef.current === null) detRef.current = createMicBreathDetector({ ...MIC_DEFAULTS, ...initialOptions })
  const histRef = useRef([])
  const logRef = useRef([])     // whole session, compact rows, for CSV export
  const signalRef = useRef(null)
  const listenersRef = useRef(new Set())
  const recRef = useRef(null)
  const chunksRef = useRef([])
  const [recording, setRecording] = useState(false)

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter(d => d.kind === 'audioinput'))
    } catch { /* labels need permission; harmless */ }
  }, [])

  const stop = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = null
    try { recRef.current?.state === 'recording' && recRef.current.stop() } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    analyserRef.current = null
    setStatus('idle')
  }, [])

  const start = useCallback(async (deviceId) => {
    stop()
    setStatus('starting'); setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
          channelCount: 1,
        },
      })
      streamRef.current = stream
      const track = stream.getAudioTracks()[0]
      const s = track.getSettings?.() || {}
      setApplied({
        label: track.label, sampleRate: s.sampleRate ?? null,
        echoCancellation: s.echoCancellation ?? null,
        noiseSuppression: s.noiseSuppression ?? null,
        autoGainControl: s.autoGainControl ?? null,
      })
      refreshDevices()

      const AC = window.AudioContext || window.webkitAudioContext
      const ctx = new AC()
      ctxRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()
      const src = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser()
      an.fftSize = 2048
      an.smoothingTimeConstant = 0
      src.connect(an)           // analyser only — never routed to the speakers
      analyserRef.current = an

      const db = new Float32Array(an.frequencyBinCount)
      const binHz = ctx.sampleRate / an.fftSize
      const specTop = Math.min(db.length, Math.ceil(SPEC_MAX_HZ / binHz))
      histRef.current = []
      logRef.current = []

      timerRef.current = setInterval(() => {
        const a = analyserRef.current
        if (!a) return
        a.getFloatFrequencyData(db)
        const t = performance.now()
        const frame = frameFromSpectrum(db, ctx.sampleRate, a.fftSize, detRef.current.options)
        const out = detRef.current.push(t, frame)
        // Downsampled column for the spectrogram strip.
        const spec = new Float32Array(SPEC_BINS)
        for (let k = 0; k < SPEC_BINS; k++) {
          const i0 = Math.floor(k * specTop / SPEC_BINS), i1 = Math.max(i0 + 1, Math.floor((k + 1) * specTop / SPEC_BINS))
          let m = -160
          for (let i = i0; i < i1; i++) if (db[i] > m) m = db[i]
          spec[k] = m
        }
        const h = histRef.current
        h.push({ ...frame, ...out, spec })
        while (h.length && t - h[0].t > HISTORY_MS) h.shift()
        logRef.current.push([t, frame.breathDb, frame.windDb, frame.flatness, frame.centroid,
          out.breathAct, out.windAct, out.act, out.inBurst ? 1 : 0, out.tonal ? 1 : 0])
        const est = detRef.current.estimate(t)
        signalRef.current = { ...out, ...est, breathDb: frame.breathDb, windDb: frame.windDb, flatness: frame.flatness }
        if (out.event) listenersRef.current.forEach(cb => { try { cb(out.event) } catch { /* listener bug */ } })
      }, MIC_DEFAULTS.frameMs)

      setStatus('running')
    } catch (e) {
      setError(e?.name === 'NotAllowedError' ? 'Microphone permission was denied.' : (e?.message || String(e)))
      stop()
      setStatus('error')
    }
  }, [stop, refreshDevices])

  useEffect(() => () => stop(), [stop])
  useEffect(() => { refreshDevices() }, [refreshDevices])

  const startRecording = useCallback(() => {
    if (!streamRef.current || typeof MediaRecorder === 'undefined') return false
    chunksRef.current = []
    const rec = new MediaRecorder(streamRef.current)
    rec.ondataavailable = e => e.data.size && chunksRef.current.push(e.data)
    rec.onstop = () => setRecording(false)
    rec.start(1000)
    recRef.current = rec
    setRecording(true)
    return true
  }, [])

  const stopRecording = useCallback(() => new Promise(resolve => {
    const rec = recRef.current
    if (!rec || rec.state !== 'recording') { resolve(null); return }
    rec.addEventListener('stop', () => resolve(new Blob(chunksRef.current, { type: rec.mimeType })), { once: true })
    rec.stop()
  }), [])

  // Ref-only accessors, stable for the hook's lifetime so a draw loop can
  // depend on them without restarting every render.
  const api = useMemo(() => ({
    getHistory: (ms = HISTORY_MS) => {
      const h = histRef.current
      if (!h.length) return []
      const cut = h[h.length - 1].t - ms
      let i = h.length - 1
      while (i > 0 && h[i - 1].t >= cut) i--
      return h.slice(i)
    },
    // CSV columns: t_ms, breath_db, wind_db, flatness, centroid_hz,
    // breath_act, wind_act, act, in_burst, tonal
    getLog: () => logRef.current,
    getBursts: () => detRef.current.bursts,
    setOptions: next => detRef.current.setOptions(next),
    getOptions: () => detRef.current.options,
    onBurst: cb => { listenersRef.current.add(cb); return () => listenersRef.current.delete(cb) },
  }), [])

  return {
    status, error, applied, devices, recording,
    start, stop, startRecording, stopRecording,
    signalRef, ...api,
  }
}
