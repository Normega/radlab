import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import VasRenderer from '../../components/vas/VasRenderer'

// ── Data hooks ────────────────────────────────────────────────────────────────

function useScales() {
  return useQuery({
    queryKey: ['vas-scales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vas_scales')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

function usePackages() {
  return useQuery({
    queryKey: ['vas-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vas_packages')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

// ── VasLibraryPage ────────────────────────────────────────────────────────────

export default function VasLibraryPage() {
  const { data: scales   = [], isLoading: loadingScales }   = useScales()
  const { data: packages = [], isLoading: loadingPackages } = usePackages()
  const [previewScale, setPreviewScale] = useState(null)   // single vas_scale row
  const [previewPkg,   setPreviewPkg]   = useState(null)   // { pkg, scales[] }
  const [pkgPreviewIdx, setPkgPreviewIdx] = useState(0)

  return (
    <div>
      <h1 style={S.h1}>Rating Scales</h1>
      <p style={S.sub}>Individual VAS scales and bundled packages.</p>

      {/* ── Individual Scales ─────────────────────────────────────────── */}
      <Section
        title="Individual Scales"
        action={<Link to="/admin/vas/new" style={S.newBtn}>+ New Scale</Link>}
      >
        {loadingScales && <p style={S.muted}>Loading…</p>}
        {!loadingScales && scales.length === 0 && (
          <p style={S.empty}>No scales yet. Upload your first one.</p>
        )}
        {scales.map(scale => (
          <ScaleRow
            key={scale.id}
            scale={scale}
            packages={packages}
            onPreview={() => setPreviewScale(scale)}
          />
        ))}
      </Section>

      {/* ── Packages ──────────────────────────────────────────────────── */}
      <Section
        title="Packages"
        action={<Link to="/admin/vas/packages/new" style={S.newBtn}>+ New Package</Link>}
      >
        {loadingPackages && <p style={S.muted}>Loading…</p>}
        {!loadingPackages && packages.length === 0 && (
          <p style={S.empty}>No packages yet. Bundle scales into a package.</p>
        )}
        {packages.map(pkg => (
          <PackageRow
            key={pkg.id}
            pkg={pkg}
            scales={scales}
            onPreview={() => {
              const pkgScales = (pkg.scale_ids ?? [])
                .map(id => scales.find(s => s.id === id))
                .filter(Boolean)
              setPkgPreviewIdx(0)
              setPreviewPkg({ pkg, scales: pkgScales })
            }}
          />
        ))}
      </Section>

      {/* ── Single scale preview modal ────────────────────────────────── */}
      {previewScale && (
        <Modal onClose={() => setPreviewScale(null)}>
          <VasRenderer
            scale={previewScale}
            previewMode
            onComplete={() => setPreviewScale(null)}
          />
        </Modal>
      )}

      {/* ── Package preview modal ─────────────────────────────────────── */}
      {previewPkg && (
        <Modal onClose={() => setPreviewPkg(null)}>
          {previewPkg.scales.length === 0 ? (
            <div style={S.modalMsg}>This package has no scales configured.</div>
          ) : (
            <VasRenderer
              key={previewPkg.scales[pkgPreviewIdx]?.id}
              scale={previewPkg.scales[pkgPreviewIdx]}
              previewMode
              partNumber={pkgPreviewIdx + 1}
              totalParts={previewPkg.scales.length}
              onComplete={() => {
                const next = pkgPreviewIdx + 1
                if (next >= previewPkg.scales.length) setPreviewPkg(null)
                else setPkgPreviewIdx(next)
              }}
            />
          )}
        </Modal>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, action, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>
        <h2 style={S.sectionTitle}>{title}</h2>
        {action}
      </div>
      <div style={S.table}>{children}</div>
    </div>
  )
}

// ── Scale row ─────────────────────────────────────────────────────────────────

function ScaleRow({ scale, packages, onPreview }) {
  const [confirming, setConfirming] = useState(false)
  const qc = useQueryClient()

  const usedInPkg = packages.some(p =>
    (p.scale_ids ?? []).includes(scale.id)
  )

  const del = useMutation({
    mutationFn: async () => {
      await supabase.from('activities').delete()
        .eq('category', 'vas').eq('subcategory', `vas_${scale.slug}`)
      const { error } = await supabase.from('vas_scales').delete().eq('id', scale.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vas-scales'] })
      setConfirming(false)
    },
  })

  const date = new Date(scale.created_at).toLocaleDateString()

  return (
    <div style={S.row}>
      <div style={S.rowMain}>
        <span style={S.chip}>{scale.slug}</span>
        <span style={S.badge}>{scale.scale_type}</span>
      </div>
      <p style={S.rowQuestion}>{scale.question}</p>
      <div style={S.rowMeta}>
        <span style={S.metaText}>{date}</span>
        <div style={S.rowActions}>
          <button style={S.previewBtn} onClick={onPreview}>▶ Preview</button>
          {usedInPkg ? (
            <span style={S.lockedMsg}>Used in package</span>
          ) : confirming ? (
            <>
              <span style={S.confirmMsg}>Delete scale?</span>
              <button style={S.deleteConfirmBtn} onClick={() => del.mutate()} disabled={del.isPending}>
                {del.isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button style={S.cancelBtn} onClick={() => setConfirming(false)}>Cancel</button>
            </>
          ) : (
            <button style={S.deleteBtn} onClick={() => setConfirming(true)}>Delete</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Package row ───────────────────────────────────────────────────────────────

function PackageRow({ pkg, scales, onPreview }) {
  const [confirming, setConfirming] = useState(false)
  const qc = useQueryClient()

  const pkgScales = (pkg.scale_ids ?? [])
    .map(id => scales.find(s => s.id === id))
    .filter(Boolean)

  const del = useMutation({
    mutationFn: async () => {
      await supabase.from('activities').delete()
        .eq('category', 'vas').eq('subcategory', `vas_pkg_${pkg.slug}`)
      const { error } = await supabase.from('vas_packages').delete().eq('id', pkg.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vas-packages'] })
      setConfirming(false)
    },
  })

  const date = new Date(pkg.created_at).toLocaleDateString()

  return (
    <div style={S.row}>
      <div style={S.rowMain}>
        <span style={S.chip}>{pkg.slug}</span>
        <span style={S.badge}>{pkgScales.length} scale{pkgScales.length !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0' }}>
        {pkgScales.map(s => (
          <span key={s.id} style={S.scaleChip}>{s.slug}</span>
        ))}
      </div>
      <div style={S.rowMeta}>
        <span style={S.metaText}>{date}</span>
        <div style={S.rowActions}>
          <button style={S.previewBtn} onClick={onPreview}>▶ Preview</button>
          {confirming ? (
            <>
              <span style={S.confirmMsg}>Delete package?</span>
              <button style={S.deleteConfirmBtn} onClick={() => del.mutate()} disabled={del.isPending}>
                {del.isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button style={S.cancelBtn} onClick={() => setConfirming(false)}>Cancel</button>
            </>
          ) : (
            <button style={S.deleteBtn} onClick={() => setConfirming(true)}>Delete</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ onClose, children }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modalWrap} onClick={e => e.stopPropagation()}>
        <button style={S.closeBtn} onClick={onClose}>✕</button>
        {children}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  h1:      { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  sub:     { fontSize: 14, color: 'var(--tx2)', margin: '0 0 36px' },
  muted:   { fontSize: 14, color: 'var(--tx3)', margin: '8px 0' },
  empty:   { fontSize: 14, color: 'var(--tx3)', margin: '24px 0', textAlign: 'center' },

  section:       { marginBottom: 40 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:  { fontFamily: '"Space Mono",monospace', fontSize: 11, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 },
  newBtn:        { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', textDecoration: 'none', display: 'inline-block' },
  table:         { background: '#fff', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' },

  row:      { padding: '14px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', gap: 6 },
  rowMain:  { display: 'flex', alignItems: 'center', gap: 8 },
  rowQuestion: { fontSize: 13, color: 'var(--tx2)', margin: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
  rowMeta:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowActions: { display: 'flex', alignItems: 'center', gap: 8 },
  metaText: { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)' },

  chip:      { fontFamily: '"Space Mono",monospace', fontSize: 11, background: 'var(--bgp)', color: 'var(--pk)', border: '1px solid var(--pkb)', borderRadius: 5, padding: '2px 7px' },
  scaleChip: { fontFamily: '"Space Mono",monospace', fontSize: 10, background: 'var(--bg)', color: 'var(--tx3)', border: '1px solid var(--bd)', borderRadius: 4, padding: '1px 6px' },
  badge:     { fontFamily: '"Space Mono",monospace', fontSize: 10, background: 'var(--bg)', color: 'var(--tx3)', border: '1px solid var(--bd)', borderRadius: 4, padding: '2px 6px' },

  previewBtn:     { background: 'none', border: '1px solid var(--bd)', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  deleteBtn:      { background: 'none', border: 'none', padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  deleteConfirmBtn: { background: '#e04', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  cancelBtn:      { background: 'none', border: '1px solid var(--bd)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  confirmMsg:     { fontSize: 12, color: '#e04', fontFamily: '"DM Sans",system-ui,sans-serif' },
  lockedMsg:      { fontSize: 11, color: 'var(--tx3)', fontFamily: '"Space Mono",monospace' },

  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' },
  modalWrap: { position: 'relative', width: '100%', maxWidth: 720 },
  closeBtn:  { position: 'fixed', top: 16, right: 20, background: '#fff', border: '1px solid var(--bd)', borderRadius: '50%', width: 36, height: 36, fontSize: 16, cursor: 'pointer', color: 'var(--tx2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101 },
  modalMsg:  { padding: 40, textAlign: 'center', color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14 },
}
