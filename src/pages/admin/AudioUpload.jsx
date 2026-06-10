import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── helpers ───────────────────────────────────────────────────────────────────

const BITRATE_WARN_KBPS = 96

function fmtSize(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function folderSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'general'
}

function generateAudioPath(folder, filename) {
  const slug = folderSlug(folder)
  const dot  = filename.lastIndexOf('.')
  const base = filename.slice(0, dot !== -1 ? dot : undefined).replace(/[^a-z0-9]+/gi, '_').toLowerCase()
  const uid  = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  return `audio/${slug}/${uid}_${base}.mp3`
}

function readAudioMetadata(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const aud = document.createElement('audio')
    aud.preload = 'metadata'
    aud.onloadedmetadata = () => {
      resolve({ duration: Math.round(aud.duration) })
      URL.revokeObjectURL(url)
    }
    aud.onerror = () => {
      resolve({ duration: null })
      URL.revokeObjectURL(url)
    }
    aud.src = url
  })
}

function titleFromFilename(filename) {
  const dot  = filename.lastIndexOf('.')
  const base = dot !== -1 ? filename.slice(0, dot) : filename
  return base.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
}

function runCheck(file, meta) {
  const { duration } = meta
  let bitrateKbps = null
  let bitrateOk   = true
  if (duration && duration > 0) {
    bitrateKbps = (file.size * 8) / (duration * 1000)
    bitrateOk   = bitrateKbps >= BITRATE_WARN_KBPS
  }
  return { bitrateKbps, bitrateOk }
}

// ── AudioUpload ───────────────────────────────────────────────────────────────

export default function AudioUpload() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  const [file,          setFile]          = useState(null)
  const [meta,          setMeta]          = useState(null)
  const [check,         setCheck]         = useState(null)
  const [title,         setTitle]         = useState('')
  const [folder,        setFolder]        = useState('General')
  const [isNewFolder,   setIsNewFolder]   = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const [dragging,   setDragging]   = useState(false)
  const [progress,   setProgress]   = useState(0)
  const [uploading,  setUploading]  = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const [error,      setError]      = useState(null)

  const { data: existingFolders = [] } = useQuery({
    queryKey: ['audio-library-folders'],
    queryFn: async () => {
      const { data } = await supabase
        .from('study_audios')
        .select('folder')
        .order('folder')
      const unique = [...new Set(['General', ...(data ?? []).map(r => r.folder)])].sort()
      return unique
    },
  })

  // ── File selection ────────────────────────────────────────────────────────

  const applyFile = useCallback(async (f) => {
    if (!f.name.toLowerCase().endsWith('.mp3')) {
      setError('Please choose an .mp3 file.')
      return
    }
    setError(null)
    setFile(f)
    setTitle(titleFromFilename(f.name))

    const m = await readAudioMetadata(f)
    setMeta(m)
    setCheck(runCheck(f, m))
  }, [])

  function handleFileInput(e) {
    const f = e.target.files?.[0]
    if (f) applyFile(f)
  }

  function handleDragOver(e)  { e.preventDefault(); setDragging(true) }
  function handleDragLeave(e) { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }
  function handleDrop(e) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) applyFile(f)
  }

  // ── Folder selection ──────────────────────────────────────────────────────

  function handleFolderChange(e) {
    const val = e.target.value
    if (val === '__new__') { setIsNewFolder(true); setFolder('') }
    else                   { setIsNewFolder(false); setFolder(val) }
  }

  const effectiveFolder = isNewFolder ? (newFolderName.trim() || 'General') : folder

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!file || !title.trim()) return
    setError(null)
    setUploading(true)
    setProgress(0)

    try {
      const storagePath = generateAudioPath(effectiveFolder, file.name)

      const { error: storageErr } = await supabase.storage
        .from('videos')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: ({ loaded, total }) => {
            setProgress(Math.round((loaded / total) * 100))
          },
        })

      if (storageErr) throw storageErr

      const { error: dbErr } = await supabase.from('study_audios').insert({
        title:            title.trim(),
        folder:           effectiveFolder,
        storage_path:     storagePath,
        file_name:        file.name,
        file_size_bytes:  file.size,
        duration_seconds: meta?.duration ?? null,
      })

      if (dbErr) {
        await supabase.storage.from('videos').remove([storagePath])
        throw dbErr
      }

      setUploadDone(true)
      queryClient.invalidateQueries({ queryKey: ['audio-library'] })
      queryClient.invalidateQueries({ queryKey: ['audio-library-folders'] })
      setTimeout(() => navigate('/admin/audio'), 900)

    } catch (err) {
      setError(err.message ?? 'Upload failed')
      setUploading(false)
    }
  }

  const canSubmit = file && title.trim() && !uploading

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => navigate('/admin/audio')} style={S.backBtn}>← Back</button>
        <h1 style={S.h1}>Upload audio</h1>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
        style={{
          ...S.dropZone,
          borderColor: dragging ? 'var(--pk)' : file ? 'var(--pkbs)' : 'var(--bds)',
          background:  dragging ? 'var(--bgp)' : file ? 'var(--bgp)' : 'var(--bgc)',
          cursor:      file ? 'default' : 'pointer',
        }}
      >
        <input ref={fileInputRef} type="file" accept=".mp3,audio/mpeg" onChange={handleFileInput} style={{ display: 'none' }} />

        {file ? (
          <div style={{ textAlign: 'center' }}>
            <div style={S.fileIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--pk)" strokeWidth="1.8">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <p style={{ fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600, color: 'var(--tx)', margin: '0 0 4px' }}>
              {file.name}
            </p>
            <p style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--tx3)', margin: '0 0 8px' }}>
              {fmtSize(file.size)}
              {meta?.duration != null && ` · ${Math.floor(meta.duration / 60)}:${(meta.duration % 60).toString().padStart(2, '0')}`}
            </p>
            <button onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }} style={S.changeBtn}>
              Change file
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={S.uploadIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={dragging ? 'var(--pk)' : 'var(--gy)'} strokeWidth="1.6">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p style={{ fontFamily: 'DM Sans', fontSize: 15, color: 'var(--tx2)', margin: '8px 0 4px' }}>
              Drag & drop an audio file here
            </p>
            <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: 'var(--tx3)', margin: 0 }}>
              or click to browse · mp3 only
            </p>
          </div>
        )}
      </div>

      {/* Pre-flight check */}
      {check && <PreflightPanel check={check} />}

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>

        <label style={S.fieldWrap}>
          <span style={S.label}>Title <span style={{ color: 'var(--pk)' }}>*</span></span>
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Untitled audio" style={S.input}
          />
        </label>

        <div style={S.fieldWrap}>
          <span style={S.label}>Folder</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              value={isNewFolder ? '__new__' : folder}
              onChange={handleFolderChange}
              style={{ ...S.input, flex: 'none', width: 'auto', minWidth: 180 }}
            >
              {existingFolders.map(f => <option key={f} value={f}>{f}</option>)}
              <option value="__new__">+ New folder…</option>
            </select>
            {isNewFolder && (
              <input
                type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                placeholder="Folder name" style={{ ...S.input, flex: 1 }} autoFocus
              />
            )}
          </div>
          {effectiveFolder && (
            <p style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--tx3)', margin: '4px 0 0' }}>
              Storage path prefix: audio/{folderSlug(effectiveFolder)}/
            </p>
          )}
        </div>

      </div>

      {/* Progress */}
      {uploading && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
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
              transition: 'width 0.2s, background 0.3s',
            }} />
          </div>
        </div>
      )}

      {error && <div style={{ ...S.errorBox, marginTop: 16 }}>{error}</div>}

      <div style={{ marginTop: 24 }}>
        <button
          onClick={handleUpload}
          disabled={!canSubmit}
          style={{ ...S.primaryBtn, opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'default' }}
        >
          {uploading ? (uploadDone ? '✓ Done' : 'Uploading…') : 'Upload audio'}
        </button>
      </div>
    </div>
  )
}

// ── PreflightPanel ────────────────────────────────────────────────────────────

function PreflightPanel({ check }) {
  const { bitrateKbps, bitrateOk } = check
  const allPass = bitrateOk

  return (
    <div style={{
      marginTop: 16,
      background: allPass ? '#f0faf5' : '#fffbf0',
      border: `1px solid ${allPass ? '#1EA878' : '#f0c040'}`,
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      <p style={{
        fontFamily: 'Space Mono', fontSize: 11,
        color: allPass ? '#1EA878' : '#8b6000',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        margin: '0 0 10px',
      }}>
        {allPass ? '✓ Encoding check passed' : 'Encoding check'}
      </p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{
          fontFamily: 'Space Mono', fontSize: 10,
          color: bitrateOk ? '#1EA878' : '#b07800',
          width: 14, flexShrink: 0, textAlign: 'center',
        }}>
          {bitrateOk ? '✓' : '⚠'}
        </span>
        <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: 'var(--tx2)', width: 110, flexShrink: 0 }}>
          Approx. bitrate
        </span>
        <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: bitrateOk ? 'var(--tx2)' : '#8b6000' }}>
          {bitrateKbps != null
            ? `${Math.round(bitrateKbps)}kbps${bitrateOk ? ' ✓' : ' — consider re-encoding at 128kbps'}`
            : 'Could not read duration'}
        </span>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  h1: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 24, fontWeight: 400, color: 'var(--tx)', margin: 0,
  },
  backBtn: {
    background: 'var(--bgc)', border: '1px solid var(--bd)',
    borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
    fontFamily: 'DM Sans', fontSize: 13, color: 'var(--tx2)',
  },
  dropZone: {
    border: '2px dashed', borderRadius: 14, padding: '36px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'border-color 0.15s, background 0.15s', minHeight: 160,
  },
  fileIcon: {
    width: 48, height: 48, borderRadius: 10,
    background: 'var(--bgc)', border: '1px solid var(--pkb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 10px',
  },
  uploadIcon: {
    width: 52, height: 52, borderRadius: 12,
    background: 'var(--bg)', border: '1px solid var(--bd)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 4px',
  },
  changeBtn: {
    background: 'var(--bgc)', border: '1px solid var(--bd)',
    borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
    fontFamily: 'DM Sans', fontSize: 12, color: 'var(--tx2)',
  },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontFamily: 'Space Mono', fontSize: 11,
    color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  input: {
    fontFamily: 'DM Sans', fontSize: 14, color: 'var(--tx)',
    background: 'var(--bgc)', border: '1px solid var(--bd)',
    borderRadius: 10, padding: '10px 14px',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  progressTrack: { height: 6, borderRadius: 3, background: 'var(--bg)', border: '1px solid var(--bd)', overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3 },
  errorBox: {
    background: '#fff5f0', border: '1px solid #e67e22',
    borderRadius: 10, padding: '12px 16px',
    fontFamily: 'DM Sans', fontSize: 13, color: '#8b4513',
  },
  primaryBtn: {
    background: 'var(--pk)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '12px 28px',
    fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600,
  },
}
