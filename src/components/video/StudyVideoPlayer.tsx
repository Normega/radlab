import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getVideoSignedUrl, createVideoSession, logVideoEvent } from '../../lib/video'
import './StudyVideoPlayer.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  storagePath:       string
  participantId?:    string
  videoId?:          string
  scheduleId?:       string
  requiredWatchPct?: number   // 0–1, default 0.9
  onComplete?:       (sessionId: string) => void
  preview?:          boolean  // skips all DB writes; for admin preview use only
  supabaseClient?:   typeof supabase | null  // participant-session client; falls back to global
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00 / 0:00'
  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }
  return fmt(secs)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudyVideoPlayer({
  storagePath,
  participantId,
  videoId,
  scheduleId,
  requiredWatchPct = 0.9,
  onComplete,
  preview = false,
  supabaseClient = null,
}: Props) {
  const db = supabaseClient ?? supabase
  // ── UI state ────────────────────────────────────────────────────────────────
  const [signedUrl,   setSignedUrl]   = useState<string | null>(null)
  const [isLoading,   setIsLoading]   = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [isFocusLost, setIsFocusLost] = useState(false)
  const [isComplete,  setIsComplete]  = useState(false)

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const videoRef              = useRef<HTMLVideoElement>(null)
  const progressFillRef       = useRef<HTMLDivElement>(null)
  const timeDisplayRef        = useRef<HTMLSpanElement>(null)

  const sessionIdRef          = useRef<string | null>(null)
  const lastValidTimeRef      = useRef(0)
  const watchedSecondsRef     = useRef<Set<number>>(new Set())

  // Focus tracking
  const focusLostAtRef        = useRef<number | null>(null)   // wall-clock ms
  const focusActiveRef        = useRef(false)                 // dedup guard
  const isPlayingBeforeFocusRef = useRef(false)
  const focusLossesRef        = useRef(0)
  const focusLossSecsRef      = useRef(0)

  // Completion guard
  const completedRef          = useRef(false)
  const startedLoggedRef      = useRef(false)

  // ── Init: signed URL + session ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const url = await getVideoSignedUrl(storagePath, db)
        if (cancelled) return
        if (!preview) {
          const session = await createVideoSession(participantId!, videoId!, scheduleId, db)
          if (cancelled) return
          sessionIdRef.current = session.id
        }
        setSignedUrl(url)
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message ?? 'Failed to load video')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [storagePath, participantId, videoId, scheduleId, preview])

  // ── Completion RPC ────────────────────────────────────────────────────────────
  const triggerComplete = useCallback(async () => {
    if (completedRef.current) return
    completedRef.current = true

    if (!preview) {
      const sessionId = sessionIdRef.current
      if (!sessionId) { setIsComplete(true); return }

      const vid = videoRef.current
      const duration = vid?.duration ?? 0
      const watchedSecs = watchedSecondsRef.current.size
      const watchPct = duration > 0 ? watchedSecs / duration : 0

      const payload = {
        p_session_id:      sessionId,
        p_seconds_watched: watchedSecs,
        p_watch_pct:       watchPct,
        p_focus_losses:    focusLossesRef.current,
        p_focus_loss_secs: Math.round(focusLossSecsRef.current),
      }

      let attempts = 0
      while (attempts < 2) {
        const { error: rpcErr } = await db.rpc('complete_video_session', payload)
        if (!rpcErr) break
        attempts++
        if (attempts >= 2) console.warn('complete_video_session RPC failed after retry:', rpcErr.message)
      }

      onComplete?.(sessionId)
    }

    setIsComplete(true)
    if (preview) onComplete?.('')
  }, [onComplete, preview, db])

  // ── timeupdate: seek prevention, watched tracking, progress bar ──────────────
  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current
    if (!vid) return

    const ct = vid.currentTime

    // Seek prevention: if user jumped forward more than 1.5s, snap back
    if (ct > lastValidTimeRef.current + 1.5) {
      vid.currentTime = lastValidTimeRef.current
      return
    }
    lastValidTimeRef.current = ct

    // Track watched seconds (integer buckets)
    watchedSecondsRef.current.add(Math.floor(ct))

    // DOM updates (no state, no re-render)
    const duration = vid.duration || 1
    const pct = Math.min(ct / duration, 1) * 100
    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${pct}%`
    }
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${fmtTime(ct)} / ${fmtTime(vid.duration)}`
    }

    // Check threshold
    if (!completedRef.current) {
      const watchedPct = watchedSecondsRef.current.size / (vid.duration || 1)
      if (watchedPct >= requiredWatchPct) {
        triggerComplete()
      }
    }
  }, [requiredWatchPct, triggerComplete])

  // ── Video events ──────────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    setIsPlaying(true)
    if (preview) return
    const vid = videoRef.current
    if (!vid || !sessionIdRef.current || startedLoggedRef.current) return
    startedLoggedRef.current = true
    logVideoEvent({
      sessionId:         sessionIdRef.current,
      eventType:         'started',
      videoPositionSecs: vid.currentTime,
    }, db)
  }, [preview, db])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    if (!completedRef.current) triggerComplete()
  }, [triggerComplete])

  // ── Focus monitoring ──────────────────────────────────────────────────────────
  const onFocusLost = useCallback(() => {
    if (focusActiveRef.current) return
    focusActiveRef.current = true
    focusLostAtRef.current = Date.now()
    focusLossesRef.current += 1
    setIsFocusLost(true)

    const vid = videoRef.current
    isPlayingBeforeFocusRef.current = !!vid && !vid.paused
    vid?.pause()

    if (!preview && sessionIdRef.current && vid) {
      logVideoEvent({
        sessionId:         sessionIdRef.current,
        eventType:         'focus_lost',
        videoPositionSecs: vid.currentTime,
      }, db)
    }
  }, [preview, db])

  const onFocusReturned = useCallback(() => {
    if (!focusActiveRef.current) return
    focusActiveRef.current = false

    if (focusLostAtRef.current !== null) {
      focusLossSecsRef.current += (Date.now() - focusLostAtRef.current) / 1000
      focusLostAtRef.current = null
    }
    setIsFocusLost(false)

    const vid = videoRef.current
    if (vid && isPlayingBeforeFocusRef.current && !completedRef.current) {
      vid.play().catch(() => {})
    }

    if (!preview && sessionIdRef.current && vid) {
      logVideoEvent({
        sessionId:         sessionIdRef.current,
        eventType:         'focus_returned',
        videoPositionSecs: vid.currentTime,
      }, db)
    }
  }, [preview, db])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) onFocusLost()
      else                 onFocusReturned()
    }
    const handleBlur  = () => onFocusLost()
    const handleFocus = () => onFocusReturned()

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur',  handleBlur)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur',  handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [onFocusLost, onFocusReturned])

  // ── Keyboard: block seek keys ─────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  // ── Play/pause toggle ─────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const vid = videoRef.current
    if (!vid) return
    if (vid.paused) vid.play().catch(() => {})
    else            vid.pause()
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="svp-wrapper" aria-label="Video player loading">
        <div className="svp-overlay-center">
          <div className="svp-spinner" />
          <span>Loading video…</span>
        </div>
      </div>
    )
  }

  if (error || !signedUrl) {
    return (
      <div className="svp-wrapper" aria-label="Video player error">
        <div className="svp-overlay-center">
          <span className="svp-error-msg">{error ?? 'Video unavailable'}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="svp-wrapper"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      aria-label="Study video player"
    >
      {/* Video */}
      <video
        ref={videoRef}
        className="svp-video"
        src={signedUrl}
        playsInline
        disablePictureInPicture
        controlsList="nodownload noremoteplayback"
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onContextMenu={e => e.preventDefault()}
      />

      {/* Focus-lost overlay */}
      {isFocusLost && (
        <div className="svp-focus-overlay" aria-live="assertive">
          <div className="svp-focus-icon">⏸</div>
          <p className="svp-focus-title">Video paused</p>
          <p className="svp-focus-sub">Return to this window to continue</p>
        </div>
      )}

      {/* Completion overlay */}
      {isComplete && (
        <div className="svp-complete-overlay">
          <div className="svp-complete-icon">✓</div>
          <p className="svp-complete-title">Video complete</p>
        </div>
      )}

      {/* Controls */}
      <div className="svp-controls">
        <button
          className="svp-play-btn"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          disabled={isComplete}
        >
          {isPlaying ? (
            /* Pause icon */
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="4" width="4" height="16" rx="1" />
              <rect x="15" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            /* Play icon */
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <div className="svp-progress-track" aria-hidden="true">
          <div ref={progressFillRef} className="svp-progress-fill" />
        </div>

        <span ref={timeDisplayRef} className="svp-time" aria-live="off">
          0:00 / 0:00
        </span>
      </div>
    </div>
  )
}
