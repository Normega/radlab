import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import StudyAudioPlayer from '../../components/audio/StudyAudioPlayer'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(secs) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function readAudioMetadata(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const aud = document.createElement('audio')
    aud.preload = 'metadata'
    aud.onloadedmetadata = () => {
      resolve(Math.round(aud.duration))
      URL.revokeObjectURL(url)
    }
    aud.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(url)
    }
    aud.src = url
  })
}

// ── AudioAdmin ────────────────────────────────────────────────────────────────

export default function AudioAdmin() {
  const queryClient  = useQueryClient()
  const [showUpload, setShowUpload]   = useState(false)
  const [previewAudio, setPreviewAudio] = useState(null) // audio row

  const { data: audios = [], isLoading, isError } = useQuery({
    queryKey: ['study-audios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_audios')
        .select('id, title, duration_seconds, created_at, study_task_id, study_tasks(label)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (audio) => {
      await supabase.storage.from('study-media').remove([audio.storage_path])
      const { error } = await supabase.from('study_audios').delete().eq('id', audio.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-audios'] })
    },
  })

  return (
    <div style={{ maxWidth: 840 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={S.h1}>Audio</h1>
          <p style={S.sub}>Upload and manage audio files for use in study sessions.</p>
        </div>
        <button
          onClick={() => setShowUpload(v => !v)}
          style={showUpload ? S.ghostBtn : S.primaryBtn}
        >
          {showUpload ? '✕ Cancel' : '+ Upload audio'}
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <div style={{ marginBottom: 32 }}>
          <UploadForm
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['study-audios'] })
              setShowUpload(false)
            }}
          />
        </div>
      )}

      {/* States */}
      {isLoading && <p style={S.meta}>Loading…</p>}

      {isError && (
        <div style={S.errorBox}>Failed to load audio library.</div>
      )}

      {!isLoading && !isError && audios.length === 0 && !showUpload && (
        <div style={S.emptyBox}>
          <p style={{ margin: '0 0 12px', fontFamily: 'DM Sans', color: 'var(--tx2)', fontSize: 15 }}>
            No audio files uploaded yet.
          </p>
          <button onClick={() => setShowUpload(true)} style={S.primaryBtn}>
            Upload your first audio file
          </button>
        </div>
      )}

      {/* Audio list */}
      {!isLoading && audios.length > 0 && (
        <div style={S.list}>
          {audios.map(a => (
            <AudioRow
              key={a.id}
              audio={a}
              onDelete={() => deleteMutation.mutate(a)}
              deleting={deleteMutation.isPending}
              onPreview={() => setPreviewAudio(a)}
            />
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewAudio && (
        <PreviewModal audio={previewAudio} onClose={() => setPreviewAudio(null)} />
      )}
    </div>
  )
}

// ── UploadForm ────────────────────────────────────────────────────────────────

function UploadForm({ onSuccess }) {
  const fileInputRef = useRef(null)

  const [file,        setFile]        = useState(null)
  const [duration,    setDuration]    = useState(null)
  const [bitrateWarn, setBitrateWarn] = useState(null)
  const [title,       setTitle]       = useState('')
  const [taskId,      setTaskId]      = useState('')

  const [progress,   setProgress]   = useState(0)
  const [uploading,  setUploading]  = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const [error,      setError]      = useState(null)

  const { data: audioTasks = [] } = useQuery({
    queryKey: ['audio-tasks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('study_tasks')
        .select('id, label')
        .eq('task_type', 'audio')
        .order('label')
      return data ?? []
    },
  })

  async function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.mp3')) {
      setError('Please choose an .mp3 file.')
      return
    }
    setError(null)
    setFile(f)
    setTitle(f.name.replace(/\.mp3$/i, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim())

    const dur = await readAudioMetadata(f)
    setDuration(dur)

    if (dur && dur > 0) {
      const kbps = (f.size * 8) / (dur * 1000)
      setBitrateWarn(kbps < 96 ? Math.round(kbps) : null)
    }
  }

  async function handleUpload() {
    if (!file || !title.trim()) return
    setError(null)
    setUploading(true)
    setProgress(0)

    try {
      const storagePath = `audio/${crypto.randomUUID()}.mp3`

      const { error: storageErr } = await supabase.storage
        .from('study-media')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: ({ loaded, total }) => {
            setProgress(Math.round((loaded / total) * 100))
          },
        })

      if (storageErr) throw storageErr

      const { error: dbErr } = await supabase.from('study_audios').insert({
        storage_path:     storagePath,
        duration_seconds: duration ?? null,
        title:            title.trim(),
        study_task_id:    taskId || null,
      })

      if (dbErr) {
        await supabase.storage.from('study-media').remove([storagePath])
        throw dbErr
      }

      setUploadDone(true)
      setTimeout(onSuccess, 700)
    } catch (err) {
      setError(err.message ?? 'Upload failed')
      setUploading(false)
    }
  }

  const canSubmit = file && title.trim() && !uploading

  return (
    <div style={{
      background: 'var(--bgc)', border: '1px solid var(--bd)',
      borderRadius: 14, padding: '20px 24px',
    }}>
      <p style={{ ...S.sectionHead, marginBottom: 16 }}>Upload audio</p>

      {/* File input */}
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>File (.mp3) <span style={{ color: 'var(--pk)' }}>*</span></label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,audio/mpeg"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={S.fileBtn}
          >
            {file ? '↺ Change file' : 'Choose .mp3'}
          </button>
          {file && (
            <span style={{ fontFamily: 'DM Sans', fontSize: 13, color: 'var(--tx2)' }}>
              {file.name}
              {duration != null && ` · ${fmtDuration(duration)}`}
            </span>
          )}
        </div>

        {bitrateWarn != null && (
          <div style={S.warnBox}>
            ⚠ This file may be low quality (est. ~{bitrateWarn}kbps). Consider re-encoding at 128kbps before uploading.
          </div>
        )}
      </div>

      {/* Title */}
      <label style={{ ...S.fieldWrap, marginBottom: 12 }}>
        <span style={S.label}>Title <span style={{ color: 'var(--pk)' }}>*</span></span>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Audio title"
          style={S.input}
        />
      </label>

      {/* Task dropdown */}
      <label style={{ ...S.fieldWrap, marginBottom: 20 }}>
        <span style={S.label}>Study task <span style={{ color: 'var(--tx3)' }}>(optional)</span></span>
        <select
          value={taskId}
          onChange={e => setTaskId(e.target.value)}
          style={S.input}
        >
          <option value="">— Not linked to a task —</option>
          {audioTasks.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>

      {/* Progress bar */}
      {uploading && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: 'DM Sans', fontSize: 13, color: 'var(--tx2)' }}>
              {uploadDone ? 'Complete' : 'Uploading…'}
            </span>
            <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--tx3)' }}>{progress}%</span>
          </div>
          <div style={S.progressTrack}>
            <div style={{
              ...S.progressFill,
              width: `${progress}%`,
              background: uploadDone ? '#1EA878' : 'var(--pk)',
            }} />
          </div>
        </div>
      )}

      {error && <div style={{ ...S.errorBox, marginBottom: 16 }}>{error}</div>}

      <button
        onClick={handleUpload}
        disabled={!canSubmit}
        style={{ ...S.primaryBtn, opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'default' }}
      >
        {uploading ? (uploadDone ? '✓ Done' : 'Uploading…') : 'Upload audio'}
      </button>
    </div>
  )
}

// ── AudioRow ──────────────────────────────────────────────────────────────────

function AudioRow({ audio, onDelete, deleting, onPreview }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div style={S.row}>
      {/* Icon */}
      <div style={S.audioIcon}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--pk)" strokeWidth="1.8">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={S.audioTitle}>{audio.title}</p>
        <p style={S.audioMeta}>
          {fmtDuration(audio.duration_seconds)}
          {' · '}{fmtDate(audio.created_at)}
          {audio.study_tasks?.label && <> · <span style={{ color: 'var(--pkd)' }}>{audio.study_tasks.label}</span></>}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {!confirming ? (
          <>
            <button onClick={onPreview} style={S.previewBtn}>▶ Preview</button>
            <button onClick={() => setConfirming(true)} style={S.deleteBtn}>Delete</button>
          </>
        ) : (
          <>
            <span style={{ fontFamily: 'DM Sans', fontSize: 13, color: 'var(--tx2)' }}>Delete?</span>
            <button onClick={() => setConfirming(false)} style={S.ghostBtn}>Cancel</button>
            <button
              onClick={onDelete}
              disabled={deleting}
              style={{ ...S.deleteBtn, background: '#c0392b', color: '#fff', border: 'none' }}
            >
              {deleting ? '…' : 'Confirm'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── PreviewModal ──────────────────────────────────────────────────────────────

function PreviewModal({ audio, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 580 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ fontFamily: 'DM Sans', fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 2px' }}>
              {audio.title}
            </p>
            <p style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
              Preview — no session data recorded
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
              fontFamily: 'DM Sans', fontSize: 13, color: '#fff',
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Player */}
        <StudyAudioPlayer
          audioId={audio.id}
          onComplete={onClose}
          preview
        />
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  h1: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 28, fontWeight: 400,
    color: 'var(--tx)', margin: '0 0 4px',
  },
  sub: {
    fontFamily: 'DM Sans', fontSize: 13,
    color: 'var(--tx3)', margin: 0,
  },
  meta: {
    fontFamily: 'Space Mono', fontSize: 12,
    color: 'var(--tx3)', margin: 0,
  },
  sectionHead: {
    fontFamily: 'Space Mono', fontSize: 11,
    color: 'var(--tx2)', textTransform: 'uppercase',
    letterSpacing: '0.06em', margin: 0,
  },
  primaryBtn: {
    background: 'var(--pk)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '10px 20px',
    fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  ghostBtn: {
    background: 'var(--bgc)', border: '1px solid var(--bd)',
    borderRadius: 7, padding: '5px 10px',
    fontFamily: 'DM Sans', fontSize: 12,
    color: 'var(--tx2)', cursor: 'pointer',
  },
  fileBtn: {
    background: 'var(--bgc)', border: '1px solid var(--bd)',
    borderRadius: 8, padding: '8px 16px',
    fontFamily: 'DM Sans', fontSize: 13,
    color: 'var(--tx2)', cursor: 'pointer',
  },
  errorBox: {
    background: '#fff5f0', border: '1px solid #e67e22',
    borderRadius: 10, padding: '12px 16px',
    fontFamily: 'DM Sans', fontSize: 13, color: '#8b4513',
  },
  warnBox: {
    marginTop: 8,
    background: '#fffbf0', border: '1px solid #f0c040',
    borderRadius: 8, padding: '8px 12px',
    fontFamily: 'DM Sans', fontSize: 12, color: '#8b6000',
  },
  emptyBox: {
    background: 'var(--bgc)', border: '1px dashed var(--bds)',
    borderRadius: 14, padding: 40,
    textAlign: 'center',
  },
  list: {
    display: 'flex', flexDirection: 'column', gap: 1,
    border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'var(--bgc)',
    padding: '12px 16px',
    borderBottom: '1px solid var(--bd)',
  },
  audioIcon: {
    width: 34, height: 34, borderRadius: 8,
    background: 'var(--bgp)', border: '1px solid var(--pkb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  audioTitle: {
    fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600,
    color: 'var(--tx)', margin: '0 0 2px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  audioMeta: {
    fontFamily: 'DM Sans', fontSize: 12,
    color: 'var(--tx2)', margin: 0,
  },
  previewBtn: {
    background: 'var(--bgp)', border: '1px solid var(--pkb)',
    borderRadius: 7, padding: '5px 10px',
    fontFamily: 'DM Sans', fontSize: 12,
    color: 'var(--pkd)', cursor: 'pointer',
  },
  deleteBtn: {
    background: 'var(--bgc)', border: '1px solid #e0b0b0',
    borderRadius: 7, padding: '5px 10px',
    fontFamily: 'DM Sans', fontSize: 12,
    color: '#c0392b', cursor: 'pointer',
  },
  fieldWrap:     { display: 'flex', flexDirection: 'column', gap: 5 },
  label: {
    fontFamily: 'Space Mono', fontSize: 11,
    color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  input: {
    fontFamily: 'DM Sans', fontSize: 14, color: 'var(--tx)',
    background: 'var(--bgc)', border: '1px solid var(--bd)',
    borderRadius: 10, padding: '9px 14px',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  progressTrack: { height: 5, borderRadius: 3, background: 'var(--bg)', border: '1px solid var(--bd)', overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3, transition: 'width 0.2s, background 0.3s' },
}
