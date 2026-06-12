import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import StudyAudioPlayer from '../../components/audio/StudyAudioPlayer'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtSize(bytes) {
  if (bytes == null) return '—'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function fmtDuration(secs) {
  if (!secs) return null
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── AudioAdmin ────────────────────────────────────────────────────────────────

export default function AudioAdmin() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const [activeFolder,  setActiveFolder]  = useState('__all__')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [copied,        setCopied]        = useState(null)
  const [previewAudio,  setPreviewAudio]  = useState(null)

  const { data: audios = [], isLoading, isError } = useQuery({
    queryKey: ['audio-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_audios')
        .select('id, title, folder, storage_path, file_name, file_size_bytes, duration_seconds, created_at')
        .order('folder')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (audio) => {
      await supabase.storage.from('audios').remove([audio.storage_path])
      const { error } = await supabase.from('study_audios').delete().eq('id', audio.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audio-library'] })
      setConfirmDelete(null)
    },
  })

  const folders = [...new Set(audios.map(a => a.folder))].sort()

  const visible = activeFolder === '__all__'
    ? audios
    : audios.filter(a => a.folder === activeFolder)

  const groups = visible.reduce((acc, a) => {
    if (!acc[a.folder]) acc[a.folder] = []
    acc[a.folder].push(a)
    return acc
  }, {})

  function handleCopyPath(audio) {
    navigator.clipboard.writeText(audio.storage_path)
    setCopied(audio.id)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div style={{ maxWidth: 840 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={S.h1}>Audio</h1>
          <p style={S.sub}>Upload and organise audio files for use in study sessions.</p>
        </div>
        <button onClick={() => navigate('/admin/audio/new')} style={S.primaryBtn}>
          + Upload audio
        </button>
      </div>

      {/* Folder tabs */}
      {folders.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <FolderTab
            label="All"
            count={audios.length}
            active={activeFolder === '__all__'}
            onClick={() => setActiveFolder('__all__')}
          />
          {folders.map(f => (
            <FolderTab
              key={f}
              label={f}
              count={audios.filter(a => a.folder === f).length}
              active={activeFolder === f}
              onClick={() => setActiveFolder(f)}
            />
          ))}
        </div>
      )}

      {isLoading && <p style={S.meta}>Loading…</p>}

      {isError && <div style={S.errorBox}>Failed to load audio library.</div>}

      {!isLoading && !isError && audios.length === 0 && (
        <div style={S.emptyBox}>
          <p style={{ margin: '0 0 12px', fontFamily: 'DM Sans', color: 'var(--tx2)', fontSize: 15 }}>
            No audio files uploaded yet.
          </p>
          <button onClick={() => navigate('/admin/audio/new')} style={S.primaryBtn}>
            Upload your first audio file
          </button>
        </div>
      )}

      {/* Audio list */}
      {!isLoading && visible.length > 0 && (
        activeFolder === '__all__' ? (
          Object.entries(groups).map(([folder, items]) => (
            <div key={folder} style={{ marginBottom: 32 }}>
              <p style={S.folderHeading}>{folder}</p>
              <div style={S.list}>
                {items.map(a => (
                  <AudioRow
                    key={a.id}
                    audio={a}
                    confirmDelete={confirmDelete}
                    onConfirmDelete={setConfirmDelete}
                    onDelete={() => deleteMutation.mutate(a)}
                    deleting={deleteMutation.isPending && confirmDelete === a.id}
                    onCopyPath={() => handleCopyPath(a)}
                    copied={copied === a.id}
                    onPreview={() => setPreviewAudio(a)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={S.list}>
            {visible.map(a => (
              <AudioRow
                key={a.id}
                audio={a}
                confirmDelete={confirmDelete}
                onConfirmDelete={setConfirmDelete}
                onDelete={() => deleteMutation.mutate(a)}
                deleting={deleteMutation.isPending && confirmDelete === a.id}
                onCopyPath={() => handleCopyPath(a)}
                copied={copied === a.id}
                onPreview={() => setPreviewAudio(a)}
              />
            ))}
          </div>
        )
      )}

      {previewAudio && (
        <PreviewModal audio={previewAudio} onClose={() => setPreviewAudio(null)} />
      )}
    </div>
  )
}

// ── FolderTab ─────────────────────────────────────────────────────────────────

function FolderTab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--pkb)' : 'var(--bgc)',
        border: `1px solid ${active ? 'var(--pkbs)' : 'var(--bd)'}`,
        borderRadius: 20, padding: '5px 14px', cursor: 'pointer',
        fontFamily: 'DM Sans', fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--pkd)' : 'var(--tx2)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      {label}
      <span style={{
        background: active ? 'var(--pk)' : 'var(--bg)',
        color: active ? '#fff' : 'var(--tx3)',
        borderRadius: 10, padding: '1px 7px',
        fontSize: 11, fontFamily: 'Space Mono',
      }}>
        {count}
      </span>
    </button>
  )
}

// ── AudioRow ──────────────────────────────────────────────────────────────────

function AudioRow({ audio, confirmDelete, onConfirmDelete, onDelete, deleting, onCopyPath, copied, onPreview }) {
  const isConfirming = confirmDelete === audio.id
  const duration     = fmtDuration(audio.duration_seconds)

  return (
    <div style={S.row}>
      <div style={S.audioIcon}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--pk)" strokeWidth="1.8">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={S.audioTitle}>{audio.title}</p>
        <p style={S.audioMeta}>
          {audio.folder}
          {duration && <> · {duration}</>}
          {audio.file_size_bytes && <> · {fmtSize(audio.file_size_bytes)}</>}
          {' · '}{fmtDate(audio.created_at)}
        </p>
        <p style={S.storagePath}>{audio.storage_path}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {!isConfirming ? (
          <>
            <button onClick={onPreview} style={S.previewBtn} title="Preview in player">
              ▶ Preview
            </button>
            <button onClick={onCopyPath} style={S.ghostBtn} title="Copy storage path">
              {copied ? '✓ Copied' : 'Copy path'}
            </button>
            <button onClick={() => onConfirmDelete(audio.id)} style={S.deleteBtn} title="Delete audio">
              Delete
            </button>
          </>
        ) : (
          <>
            <span style={{ fontFamily: 'DM Sans', fontSize: 13, color: 'var(--tx2)' }}>Delete?</span>
            <button onClick={() => onConfirmDelete(null)} style={S.ghostBtn}>Cancel</button>
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
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}
      onClick={onClose}
    >
      <div style={{ width: '100%', maxWidth: 580 }} onClick={e => e.stopPropagation()}>
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
        <StudyAudioPlayer audioId={audio.id} onComplete={onClose} preview />
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
  primaryBtn: {
    background: 'var(--pk)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '10px 20px',
    fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  errorBox: {
    background: '#fff5f0', border: '1px solid #e67e22',
    borderRadius: 12, padding: '16px 20px',
    fontFamily: 'DM Sans', fontSize: 14, color: '#8b4513',
  },
  emptyBox: {
    background: 'var(--bgc)', border: '1px dashed var(--bds)',
    borderRadius: 14, padding: 40, textAlign: 'center',
  },
  folderHeading: {
    fontFamily: 'Space Mono', fontSize: 11,
    color: 'var(--tx3)', textTransform: 'uppercase',
    letterSpacing: '0.06em', margin: '0 0 8px',
  },
  list: {
    display: 'flex', flexDirection: 'column', gap: 1,
    border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden',
  },
  row: {
    display: 'flex', alignItems: 'flex-start', gap: 14,
    background: 'var(--bgc)', padding: '14px 16px',
    borderBottom: '1px solid var(--bd)',
  },
  audioIcon: {
    width: 36, height: 36, borderRadius: 8,
    background: 'var(--bgp)', border: '1px solid var(--pkb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  },
  audioTitle: {
    fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600,
    color: 'var(--tx)', margin: '0 0 3px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  audioMeta: {
    fontFamily: 'DM Sans', fontSize: 12,
    color: 'var(--tx2)', margin: '0 0 2px',
  },
  storagePath: {
    fontFamily: 'Space Mono', fontSize: 11,
    color: 'var(--gy)', margin: '4px 0 0',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  previewBtn: {
    background: 'var(--bgp)', border: '1px solid var(--pkb)',
    borderRadius: 7, padding: '5px 10px',
    fontFamily: 'DM Sans', fontSize: 12,
    color: 'var(--pkd)', cursor: 'pointer',
  },
  ghostBtn: {
    background: 'var(--bgc)', border: '1px solid var(--bd)',
    borderRadius: 7, padding: '5px 10px',
    fontFamily: 'DM Sans', fontSize: 12,
    color: 'var(--tx2)', cursor: 'pointer',
  },
  deleteBtn: {
    background: 'var(--bgc)', border: '1px solid #e0b0b0',
    borderRadius: 7, padding: '5px 10px',
    fontFamily: 'DM Sans', fontSize: 12,
    color: '#c0392b', cursor: 'pointer',
  },
}
