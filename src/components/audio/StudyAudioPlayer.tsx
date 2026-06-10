import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getAudioSignedUrl, createAudioSession, logAudioEvent, completeAudioSession } from '../../lib/audio'
import './StudyAudioPlayer.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  audioId:    string
  onComplete: () => void
  preview?:   boolean  // skips all DB writes; for admin preview use only
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudyAudioPlayer({ audioId, onComplete, preview = false }: Props) {
  // ── UI state ────────────────────────────────────────────────────────────────
  const [signedUrl,   setSignedUrl]   = useState<string | null>(null)
  const [isLoading,   setIsLoading]   = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [isFocusLost, setIsFocusLost] = useState(false)
  const [isComplete,  setIsComplete]  = useState(false)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const audioRef          = useRef<HTMLAudioElement>(null)
  const progressFillRef   = useRef<HTMLDivElement>(null)
  const elapsedRef        = useRef<HTMLSpanElement>(null)
  const remainingRef      = useRef<HTMLSpanElement>(null)

  const sessionIdRef      = useRef<string | null>(null)
  const lastValidTimeRef  = useRef(0)
  const listenedSecsRef   = useRef<Set<number>>(new Set())
  const requiredPctRef    = useRef(0.9)

  const focusLostAtRef        = useRef<number | null>(null)
  const focusActiveRef        = useRef(false)
  const isPlayingBeforeFocusRef = useRef(false)
  const focusLossCountRef     = useRef(0)

  const completedRef      = useRef(false)
  const startedLoggedRef  = useRef(false)

  // ── Init: fetch audio row, signed URL, create session ────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('study_audios')
          .select('storage_path, required_listen_pct')
          .eq('id', audioId)
          .single()

        if (fetchErr || !data) throw new Error(fetchErr?.message ?? 'Audio not found')

        requiredPctRef.current = data.required_listen_pct ?? 0.9

        const url = await getAudioSignedUrl(data.storage_path)
        if (cancelled) return

        if (!preview) {
          const sessionId = await createAudioSession(audioId)
          if (cancelled) return
          sessionIdRef.current = sessionId
        }

        setSignedUrl(url)
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message ?? 'Failed to load audio')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [audioId, preview])

  // ── Completion ────────────────────────────────────────────────────────────
  const triggerComplete = useCallback(async () => {
    if (completedRef.current) return
    completedRef.current = true

    if (!preview) {
      const sessionId = sessionIdRef.current
      if (sessionId) {
        const duration = audioRef.current?.duration ?? 0
        const listened = listenedSecsRef.current.size
        const pct      = duration > 0 ? listened / duration : 1

        let attempts = 0
        while (attempts < 2) {
          try {
            await completeAudioSession(sessionId, listened, pct)
            break
          } catch {
            attempts++
            if (attempts >= 2) console.warn('complete_audio_session RPC failed after retry')
          }
        }
      }
    }

    setIsComplete(true)
    onComplete()
  }, [onComplete, preview])

  // ── timeupdate: seek prevention, listened tracking, DOM updates ──────────
  const handleTimeUpdate = useCallback(() => {
    const aud = audioRef.current
    if (!aud) return

    const ct = aud.currentTime

    // Seek prevention
    if (ct > lastValidTimeRef.current + 1.5) {
      aud.currentTime = lastValidTimeRef.current
      return
    }
    lastValidTimeRef.current = ct

    // Track listened seconds
    listenedSecsRef.current.add(Math.floor(ct))

    // DOM updates (no re-render)
    const duration = aud.duration || 1
    const pct = Math.min(ct / duration, 1) * 100
    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${pct}%`
    }
    if (elapsedRef.current) {
      elapsedRef.current.textContent = fmtTime(ct)
    }
    if (remainingRef.current) {
      remainingRef.current.textContent = `-${fmtTime(Math.max(0, aud.duration - ct))}`
    }

    // Completion check
    if (!completedRef.current) {
      const listenedPct = listenedSecsRef.current.size / (aud.duration || 1)
      if (listenedPct >= requiredPctRef.current) {
        triggerComplete()
      }
    }
  }, [triggerComplete])

  // ── Audio events ──────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    setIsPlaying(true)
    if (preview) return
    const aud = audioRef.current
    if (!aud || !sessionIdRef.current || startedLoggedRef.current) return
    startedLoggedRef.current = true
    logAudioEvent(sessionIdRef.current, 'started', aud.currentTime)
  }, [preview])

  const handlePause = useCallback(() => setIsPlaying(false), [])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    if (!completedRef.current) triggerComplete()
  }, [triggerComplete])

  // ── Focus monitoring ──────────────────────────────────────────────────────
  const onFocusLost = useCallback(() => {
    if (focusActiveRef.current) return
    focusActiveRef.current = true
    focusLostAtRef.current = Date.now()
    focusLossCountRef.current += 1
    setIsFocusLost(true)

    const aud = audioRef.current
    isPlayingBeforeFocusRef.current = !!aud && !aud.paused
    aud?.pause()

    if (!preview && sessionIdRef.current && aud) {
      logAudioEvent(sessionIdRef.current, 'focus_lost', aud.currentTime)
    }
  }, [preview])

  const onFocusReturned = useCallback(() => {
    if (!focusActiveRef.current) return
    focusActiveRef.current = false
    focusLostAtRef.current = null
    setIsFocusLost(false)

    const aud = audioRef.current
    if (aud && isPlayingBeforeFocusRef.current && !completedRef.current) {
      aud.play().catch(() => {})
    }

    if (!preview && sessionIdRef.current && aud) {
      logAudioEvent(sessionIdRef.current, 'focus_returned', aud.currentTime)
    }
  }, [preview])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) onFocusLost()
      else                 onFocusReturned()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur',  onFocusLost)
    window.addEventListener('focus', onFocusReturned)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur',  onFocusLost)
      window.removeEventListener('focus', onFocusReturned)
    }
  }, [onFocusLost, onFocusReturned])

  // ── Play/pause toggle ─────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const aud = audioRef.current
    if (!aud) return
    if (aud.paused) aud.play().catch(() => {})
    else            aud.pause()
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="sap-wrapper" aria-label="Audio player loading">
        <div className="sap-state-center">
          <div className="sap-spinner" />
          <span>Loading audio…</span>
        </div>
      </div>
    )
  }

  if (error || !signedUrl) {
    return (
      <div className="sap-wrapper" aria-label="Audio player error">
        <div className="sap-state-center">
          <span className="sap-error-msg">{error ?? 'Audio unavailable'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="sap-wrapper" aria-label="Study audio player">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={signedUrl}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        preload="auto"
      />

      {/* Focus-lost overlay */}
      {isFocusLost && (
        <div className="sap-focus-overlay" aria-live="polite">
          <div className="sap-focus-icon">⏸</div>
          <p className="sap-focus-title">Audio paused</p>
          <p className="sap-focus-sub">Return to continue listening</p>
        </div>
      )}

      {/* Completion overlay */}
      {isComplete && (
        <div className="sap-complete-overlay">
          <div className="sap-complete-icon">✓</div>
          <p className="sap-complete-title">Listening complete</p>
        </div>
      )}

      {/* Controls */}
      <div className="sap-controls">
        <button
          className="sap-play-btn"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          disabled={isComplete}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="4" width="4" height="16" rx="1" />
              <rect x="15" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          )}
        </button>

        <div className="sap-progress-track" aria-hidden="true">
          <div ref={progressFillRef} className="sap-progress-fill" />
        </div>

        <div className="sap-times" aria-live="off">
          <span ref={elapsedRef} className="sap-time">0:00</span>
          <span className="sap-time-sep">/</span>
          <span ref={remainingRef} className="sap-time sap-time-remaining">-0:00</span>
        </div>
      </div>
    </div>
  )
}
