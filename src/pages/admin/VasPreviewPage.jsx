import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import VasRenderer from '../../components/vas/VasRenderer'

export default function VasPreviewPage() {
  const { slug }    = useParams()
  const navigate    = useNavigate()
  const qc          = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const { data: scale, isLoading, error } = useQuery({
    queryKey: ['vas-scale', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vas_scales')
        .select('*')
        .eq('slug', slug)
        .single()
      if (error) throw error
      return data
    },
  })

  const del = useMutation({
    mutationFn: async () => {
      await supabase.from('activities').delete()
        .eq('category', 'vas').eq('subcategory', `vas_${slug}`)
      const { error } = await supabase.from('vas_scales').delete().eq('slug', slug)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vas-scales'] })
      navigate('/admin/vas')
    },
  })

  if (isLoading) return <p style={S.muted}>Loading…</p>
  if (error)     return <p style={S.err}>Could not load scale "{slug}": {error.message}</p>
  if (!scale)    return <p style={S.err}>Scale "{slug}" not found.</p>

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>{scale.slug}</h1>
          <p style={S.sub}>{scale.question}</p>
        </div>
        <div style={S.headerActions}>
          <button style={S.backBtn} onClick={() => navigate('/admin/vas')}>← Library</button>
        </div>
      </div>

      {/* Metadata */}
      <div style={S.meta}>
        <MetaItem label="Type"    value={scale.scale_type} />
        <MetaItem label="Anchors" value={`${scale.anchors?.length ?? 0} levels`} />
        <MetaItem label="Created" value={new Date(scale.created_at).toLocaleDateString()} />
      </div>

      {/* Actions */}
      <div style={S.actions}>
        <button style={S.previewBtn} onClick={() => setPreviewing(true)}>
          ▶ Preview scale
        </button>
        {confirming ? (
          <>
            <span style={S.confirmMsg}>Delete this scale permanently?</span>
            <button style={S.deleteConfirmBtn} onClick={() => del.mutate()} disabled={del.isPending}>
              {del.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button style={S.cancelBtn} onClick={() => setConfirming(false)}>Cancel</button>
          </>
        ) : (
          <button style={S.deleteBtn} onClick={() => setConfirming(true)}>Delete scale</button>
        )}
      </div>

      {/* Anchor list */}
      <div style={S.anchorGrid}>
        {(scale.anchors ?? []).map(a => (
          <div key={a.value} style={S.anchorCard}>
            <img src={a.emoji_url} alt={a.label} style={S.anchorImg} />
            <span style={S.anchorVal}>{a.value}</span>
            <span style={S.anchorLabel}>{a.label}</span>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {previewing && (
        <div style={S.overlay} onClick={() => setPreviewing(false)}>
          <div style={S.modalWrap} onClick={e => e.stopPropagation()}>
            <button style={S.closeBtn} onClick={() => setPreviewing(false)}>✕</button>
            <VasRenderer
              scale={scale}
              previewMode
              onComplete={() => setPreviewing(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function MetaItem({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, color: 'var(--tx)' }}>{value}</span>
    </div>
  )
}

const S = {
  muted: { fontSize: 14, color: 'var(--tx3)', margin: '8px 0' },
  err:   { fontSize: 14, color: '#e04', padding: 40, textAlign: 'center' },

  header:        { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  h1:            { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 4px' },
  sub:           { fontSize: 14, color: 'var(--tx2)', margin: 0 },
  headerActions: { display: 'flex', gap: 10 },
  backBtn:       { background: 'none', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },

  meta:    { display: 'flex', gap: 32, background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 20px', marginBottom: 16 },

  actions:          { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 },
  previewBtn:       { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  deleteBtn:        { background: 'none', border: '1px solid var(--bd)', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: '#e04', fontFamily: '"DM Sans",system-ui,sans-serif' },
  deleteConfirmBtn: { background: '#e04', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  cancelBtn:        { background: 'none', border: '1px solid var(--bd)', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  confirmMsg:       { fontSize: 13, color: '#e04', fontFamily: '"DM Sans",system-ui,sans-serif' },

  anchorGrid:  { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 },
  anchorCard:  { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  anchorImg:   { width: 64, height: 64, objectFit: 'contain' },
  anchorVal:   { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--pk)', fontWeight: 700 },
  anchorLabel: { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 12, color: 'var(--tx2)', textAlign: 'center', lineHeight: 1.3 },

  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' },
  modalWrap: { position: 'relative', width: '100%', maxWidth: 720 },
  closeBtn:  { position: 'fixed', top: 16, right: 20, background: '#fff', border: '1px solid var(--bd)', borderRadius: '50%', width: 36, height: 36, fontSize: 16, cursor: 'pointer', color: 'var(--tx2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101 },
}
