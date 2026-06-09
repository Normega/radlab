import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import StudyVideoPlayer from '../../components/video/StudyVideoPlayer'

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

// ── VideoLibrary ──────────────────────────────────────────────────────────────

export default function VideoLibrary() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()
  const [activeFolder, setActiveFolder] = useState('__all__')
  const [confirmDelete, setConfirmDelete] = useState(null) // video id
  const [copied,        setCopied]        = useState(null) // video id
  const [previewVideo,  setPreviewVideo]  = useState(null) // video row

  const { data: videos = [], isLoading, isError } = useQuery({
    queryKey: ['video-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_library')
        .select('id, title, description, folder, storage_path, file_name, duration_secs, file_size_bytes, mime_type, created_at')
        .order('folder')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (video) => {
      // Remove from storage
      await supabase.storage.from('videos').remove([video.storage_path])
      // Remove from DB
      const { error } = await supabase.from('video_library').delete().eq('id', video.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-library'] })
      setConfirmDelete(null)
    },
  })

  const folders = [...new Set(videos.map(v => v.folder))].sort()

  const visible = activeFolder === '__all__'
    ? videos
    : videos.filter(v => v.folder === activeFolder)

  // Group for "All" view
  const groups = visible.reduce((acc, v) => {
    if (!acc[v.folder]) acc[v.folder] = []
    acc[v.folder].push(v)
    return acc
  }, {})

  function handleCopyPath(video) {
    navigator.clipboard.writeText(video.storage_path)
    setCopied(video.id)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div style={{ maxWidth: 840 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={S.h1}>Videos</h1>
          <p style={S.sub}>Upload and organise video files for use in study sessions.</p>
        </div>
        <button onClick={() => navigate('/admin/videos/new')} style={S.primaryBtn}>
          + Upload video
        </button>
      </div>

      {/* Folder tabs */}
      {folders.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <FolderTab
            label="All"
            count={videos.length}
            active={activeFolder === '__all__'}
            onClick={() => setActiveFolder('__all__')}
          />
          {folders.map(f => (
            <FolderTab
              key={f}
              label={f}
              count={videos.filter(v => v.folder === f).length}
              active={activeFolder === f}
              onClick={() => setActiveFolder(f)}
            />
          ))}
        </div>
      )}

      {/* States */}
      {isLoading && <p style={S.meta}>Loading…</p>}

      {isError && (
        <div style={S.errorBox}>
          Failed to load video library.
        </div>
      )}

      {!isLoading && !isError && videos.length === 0 && (
        <div style={S.emptyBox}>
          <p style={{ margin: '0 0 12px', fontFamily: 'DM Sans', color: 'var(--tx2)', fontSize: 15 }}>
            No videos uploaded yet.
          </p>
          <button onClick={() => navigate('/admin/videos/new')} style={S.primaryBtn}>
            Upload your first video
          </button>
        </div>
      )}

      {/* Video list */}
      {!isLoading && visible.length > 0 && (
        activeFolder === '__all__' ? (
          Object.entries(groups).map(([folder, vids]) => (
            <div key={folder} style={{ marginBottom: 32 }}>
              <p style={S.folderHeading}>{folder}</p>
              <div style={S.list}>
                {vids.map(v => (
                  <VideoRow
                    key={v.id}
                    video={v}
                    confirmDelete={confirmDelete}
                    onConfirmDelete={setConfirmDelete}
                    onDelete={() => deleteMutation.mutate(v)}
                    deleting={deleteMutation.isPending && confirmDelete === v.id}
                    onCopyPath={() => handleCopyPath(v)}
                    copied={copied === v.id}
                    onPreview={() => setPreviewVideo(v)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={S.list}>
            {visible.map(v => (
              <VideoRow
                key={v.id}
                video={v}
                confirmDelete={confirmDelete}
                onConfirmDelete={setConfirmDelete}
                onDelete={() => deleteMutation.mutate(v)}
                deleting={deleteMutation.isPending && confirmDelete === v.id}
                onCopyPath={() => handleCopyPath(v)}
                copied={copied === v.id}
                onPreview={() => setPreviewVideo(v)}
              />
            ))}
          </div>
        )
      )}

      {/* Preview modal */}
      {previewVideo && (
        <PreviewModal video={previewVideo} onClose={() => setPreviewVideo(null)} />
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
        borderRadius: 20,
        padding: '5px 14px',
        cursor: 'pointer',
        fontFamily: 'DM Sans',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--pkd)' : 'var(--tx2)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      {label}
      <span style={{
        background: active ? 'var(--pk)' : 'var(--bg)',
        color: active ? '#fff' : 'var(--tx3)',
        borderRadius: 10,
        padding: '1px 7px',
        fontSize: 11,
        fontFamily: 'Space Mono',
      }}>
        {count}
      </span>
    </button>
  )
}

// ── VideoRow ──────────────────────────────────────────────────────────────────

function VideoRow({ video, confirmDelete, onConfirmDelete, onDelete, deleting, onCopyPath, copied, onPreview }) {
  const isConfirming = confirmDelete === video.id
  const duration = fmtDuration(video.duration_secs)

  return (
    <div style={S.row}>
      {/* Icon */}
      <div style={S.videoIcon}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--pk)" strokeWidth="1.8">
          <rect x="2" y="4" width="15" height="16" rx="2" />
          <path d="M17 8l5-3v14l-5-3V8z" />
        </svg>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={S.videoTitle}>{video.title}</p>
        <p style={S.videoMeta}>
          {video.folder}
          {duration && <> · {duration}</>}
          {video.file_size_bytes && <> · {fmtSize(video.file_size_bytes)}</>}
          {' · '}{fmtDate(video.created_at)}
        </p>
        {video.description && (
          <p style={S.videoDesc}>{video.description}</p>
        )}
        <p style={S.storagePath}>{video.storage_path}</p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {!isConfirming ? (
          <>
            <button onClick={onPreview} style={S.previewBtn} title="Preview in player">
              ▶ Preview
            </button>
            <button onClick={onCopyPath} style={S.ghostBtn} title="Copy storage path">
              {copied ? '✓ Copied' : 'Copy path'}
            </button>
            <button
              onClick={() => onConfirmDelete(video.id)}
              style={S.deleteBtn}
              title="Delete video"
            >
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

function PreviewModal({ video, onClose }) {
  // Close on Escape
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
      <div
        style={{ width: '100%', maxWidth: 940 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 12,
        }}>
          <div>
            <p style={{
              fontFamily: 'DM Sans', fontSize: 15, fontWeight: 600,
              color: '#fff', margin: '0 0 2px',
            }}>
              {video.title}
            </p>
            <p style={{
              fontFamily: 'Space Mono', fontSize: 11,
              color: 'rgba(255,255,255,0.45)', margin: 0,
            }}>
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
        <StudyVideoPlayer
          storagePath={video.storage_path}
          preview
          requiredWatchPct={0.9}
          onComplete={onClose}
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
    borderRadius: 14, padding: 40,
    textAlign: 'center',
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
    background: 'var(--bgc)',
    padding: '14px 16px',
    borderBottom: '1px solid var(--bd)',
  },
  videoIcon: {
    width: 36, height: 36, borderRadius: 8,
    background: 'var(--bgp)', border: '1px solid var(--pkb)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  },
  videoTitle: {
    fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600,
    color: 'var(--tx)', margin: '0 0 3px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  videoMeta: {
    fontFamily: 'DM Sans', fontSize: 12,
    color: 'var(--tx2)', margin: '0 0 2px',
  },
  videoDesc: {
    fontFamily: 'DM Sans', fontSize: 12,
    color: 'var(--tx3)', margin: '2px 0',
    fontStyle: 'italic',
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
