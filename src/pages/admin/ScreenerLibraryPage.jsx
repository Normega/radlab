import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import ScreenerPage from '../../components/ScreenerPage'

export default function ScreenerLibraryPage() {
  const [previewScreener, setPreviewScreener] = useState(null)
  const [expandedId,      setExpandedId]      = useState(null)

  const { data: screeners = [], isLoading } = useQuery({
    queryKey: ['screeners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screeners')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  if (isLoading) return <p style={S.muted}>Loading…</p>

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={S.h1}>Screeners</h1>
        <p style={S.sub}>Pre-consent eligibility gates that can be attached to studies. Definitions are seeded via database migrations.</p>
      </div>

      {screeners.length === 0 ? (
        <div style={S.empty}>
          <p style={S.emptyText}>No screeners yet</p>
          <p style={S.emptyHint}>Screener definitions are added by running a database migration.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {screeners.map(s => (
            <ScreenerCard
              key={s.id}
              screener={s}
              jsonExpanded={expandedId === s.id}
              onToggleJson={() => setExpandedId(prev => prev === s.id ? null : s.id)}
              onPreview={() => setPreviewScreener(s)}
            />
          ))}
        </div>
      )}

      {previewScreener && (
        <div style={S.previewOverlay}>
          <div style={S.previewBar}>
            <div style={S.previewBadge}>
              <span style={S.previewDot} />
              Preview: {previewScreener.name}
            </div>
            <button style={S.closeBtn} onClick={() => setPreviewScreener(null)}>Close ✕</button>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', background: '#FCF0F5' }}>
            <ScreenerPage
              study={{ id: 'preview', screener: previewScreener.definition }}
              participant={{ id: 'preview' }}
              supabaseClient={supabase}
              previewMode={true}
              onPass={() => setPreviewScreener(null)}
              onFail={() => setPreviewScreener(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ScreenerCard({ screener, jsonExpanded, onToggleJson, onPreview }) {
  const phase1Count = screener.definition?.phase1?.items?.length ?? 0
  const phase2Qs    = (screener.definition?.phase2?.questionnaires ?? [])
    .map(q => q.questionnaire_slug)
    .join(', ') || '—'

  return (
    <div style={S.card}>
      <div style={S.cardBody}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.cardName}>{screener.name}</div>
          <div style={S.cardMeta}>
            <span style={S.slug}>{screener.slug}</span>
            <span style={S.sep}>·</span>
            <span style={S.metaText}>{phase1Count} eligibility {phase1Count === 1 ? 'item' : 'items'}</span>
            <span style={S.sep}>·</span>
            <span style={S.metaText}>Phase 2: {phase2Qs}</span>
          </div>
          {screener.description && (
            <p style={S.cardDesc}>{screener.description}</p>
          )}
        </div>
        <div style={S.cardActions}>
          <button style={S.actionBtn} onClick={onToggleJson}>
            {jsonExpanded ? 'Hide JSON' : 'View JSON'}
          </button>
          <button style={S.btnPreview} onClick={onPreview}>
            Preview →
          </button>
        </div>
      </div>
      {jsonExpanded && (
        <div style={S.jsonWrap}>
          <pre style={S.jsonPre}>{JSON.stringify(screener.definition, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

const S = {
  h1:           { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  sub:          { fontSize: 14, color: 'var(--tx2)', margin: 0, fontFamily: '"DM Sans",system-ui,sans-serif', lineHeight: 1.5 },
  muted:        { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  empty:        { textAlign: 'center', padding: '60px 0' },
  emptyText:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 18, color: 'var(--tx)', margin: '0 0 6px' },
  emptyHint:    { fontSize: 13, color: 'var(--tx2)', margin: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
  card:         { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' },
  cardBody:     { padding: '18px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  cardName:     { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 },
  cardMeta:     { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  cardDesc:     { fontSize: 13, color: 'var(--tx2)', margin: '8px 0 0', lineHeight: 1.5, fontFamily: '"DM Sans",system-ui,sans-serif' },
  slug:         { fontFamily: '"Space Mono",monospace', fontSize: 11, background: 'var(--pkb)', color: 'var(--pk)', borderRadius: 6, padding: '2px 7px' },
  sep:          { color: 'var(--tx3)', fontSize: 12 },
  metaText:     { fontSize: 13, color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  cardActions:  { display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 },
  actionBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  btnPreview:   { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  jsonWrap:     { borderTop: '1px solid var(--bd)', background: '#f8f6f2' },
  jsonPre:      { margin: 0, padding: '16px 20px', fontSize: 12, lineHeight: 1.6, color: '#2c2c2a', fontFamily: '"Space Mono",monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  previewOverlay: { position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  previewBar:   { background: '#f0ede8', borderBottom: '1px solid #e0ddd8', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 201 },
  previewBadge: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: '#5f5e5a', display: 'flex', alignItems: 'center', gap: 6 },
  previewDot:   { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#639922' },
  closeBtn:     { background: 'none', border: '1px solid #d0cdc8', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', color: '#5f5e5a' },
}
