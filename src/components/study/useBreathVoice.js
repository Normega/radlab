import { useState, useEffect, useRef, useCallback } from 'react'

// Voice-over playback for BreathPracticeBlock.
//
// Clips and their manifest are rendered by scripts/tts/breath_sensation.py.
// Everything is fetched up front, then decoded into one Web Audio context that
// is created inside the participant's first tap (`unlock`) — a phone will not
// start audio any other way, and with Web Audio one tap covers every later clip,
// where separate <audio> elements would each need their own.
//
// The context is suspended while the page is hidden, matching the block's
// timers, so voice and practice pause and resume together.
//
// `play(key, text)` plays only if the clip's recorded text matches `text`, the
// caption actually on screen: an edited script with stale audio stays silent
// rather than speaking words the participant cannot see.

const norm = t => (t ?? '').replace(/\s+/g, ' ').trim()

export default function useBreathVoice(base) {
  const [available, setAvailable] = useState(false)
  const [off, setOff] = useState(false)

  const offRef      = useRef(false)
  const ctxRef      = useRef(null)
  const manifestRef = useRef(null)
  const rawRef      = useRef({})     // key → ArrayBuffer, until decoded
  const bufRef      = useRef({})     // key → AudioBuffer
  const srcRef      = useRef(null)
  const currentRef  = useRef(null)   // { key, since, seconds } of the clip requested last
  const pendingRef  = useRef(null)   // key waiting on its decode

  const stop = useCallback(() => {
    pendingRef.current = null
    currentRef.current = null
    const src = srcRef.current
    srcRef.current = null
    if (src) { src.onended = null; try { src.stop() } catch { /* already stopped */ } }
  }, [])

  const start = useCallback(key => {
    const ctx = ctxRef.current
    const buf = bufRef.current[key]
    if (!ctx || !buf) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.onended = () => {
      if (srcRef.current === src) { srcRef.current = null; currentRef.current = null }
    }
    src.start()
    srcRef.current = src
  }, [])

  const decodeAll = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    for (const [key, raw] of Object.entries(rawRef.current)) {
      delete rawRef.current[key]
      ctx.decodeAudioData(raw).then(buf => {
        bufRef.current[key] = buf
        if (pendingRef.current === key) { pendingRef.current = null; start(key) }
      }).catch(() => {
        if (pendingRef.current === key) stop()
      })
    }
  }, [start, stop])

  // Fetch manifest + clips as soon as the block mounts (the intro screen).
  useEffect(() => {
    if (!base) return
    let dead = false
    ;(async () => {
      try {
        const res = await fetch(`${base}manifest.json`)
        if (!res.ok) return
        const manifest = await res.json()
        await Promise.all(Object.keys(manifest.clips).map(async key => {
          const r = await fetch(`${base}${key}.mp3`)
          if (r.ok) rawRef.current[key] = await r.arrayBuffer()
        }))
        if (dead) return
        manifestRef.current = manifest
        setAvailable(true)
        decodeAll()   // no-op until unlock() has made the context
      } catch {
        // No voice is a supported state: captions carry the whole practice.
      }
    })()
    return () => {
      dead = true
      stop()
      ctxRef.current?.close()
      ctxRef.current = null
    }
  }, [base]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onVis = () => {
      const ctx = ctxRef.current
      if (!ctx || ctx.state === 'closed') return
      if (document.hidden) ctx.suspend()
      else ctx.resume()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  /** Call from inside a user gesture. */
  const unlock = useCallback(() => {
    if (!base || ctxRef.current) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctxRef.current = new AC()
    ctxRef.current.resume()
    decodeAll()
  }, [base, decodeAll])

  const play = useCallback((key, text) => {
    const clip = manifestRef.current?.clips?.[key]
    if (!clip) return
    if (norm(clip.text) !== norm(text)) {
      console.warn(`[breath voice] "${key}" audio is for different text — re-run scripts/tts/breath_sensation.py`)
      return
    }
    if (offRef.current || !ctxRef.current) return
    stop()
    currentRef.current = { key, since: performance.now(), seconds: clip.seconds }
    if (bufRef.current[key]) start(key)
    else pendingRef.current = key
  }, [start, stop])

  /**
   * Whether `key` is still being spoken. Bounded by the clip's recorded length
   * (plus slack), so a context the browser never let start cannot hold the
   * practice forever.
   */
  const speaking = useCallback(key => {
    const cur = currentRef.current
    if (!cur || cur.key !== key) return false
    const ctx = ctxRef.current
    if (!ctx || ctx.state === 'closed') return false
    if (ctx.state === 'suspended' && !document.hidden) return false
    return performance.now() - cur.since < (cur.seconds + 1.5) * 1000 || document.hidden
  }, [])

  const toggle = useCallback(() => {
    offRef.current = !offRef.current
    setOff(offRef.current)
    if (offRef.current) stop()
  }, [stop])

  return { available, off, offRef, unlock, play, speaking, toggle }
}
