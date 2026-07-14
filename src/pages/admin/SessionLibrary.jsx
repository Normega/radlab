import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import SessionDemoModal from '../../components/study/SessionDemoModal'

function useSessions() {
  return useQuery({
    queryKey: ['session-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_templates')
        .select(`
          id, label, description, folder, created_at, cloned_from,
          session_template_nodes(
            id,
            activities(estimated_minutes)
          )
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map(t => ({
        ...t,
        nodeCount: t.session_template_nodes?.length ?? 0,
        totalMinutes: t.session_template_nodes?.reduce(
          (sum, n) => sum + (n.activities?.estimated_minutes ?? 0), 0
        ) ?? 0,
      }))
    },
  })
}

export default function SessionLibrary() {
  const { data: sessions, isLoading } = useSessions()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteBlocked, setDeleteBlocked] = useState(null)
  const [demoSession,   setDemoSession]   = useState(null)
  const [collapsed, setCollapsed] = useState(new Set())
  const initialized = useRef(false)

  // On first load, collapse all named folders (Uncategorized stays open)
  useEffect(() => {
    if (!sessions || initialized.current) return
    initialized.current = true
    const named = [...new Set(sessions.map(s => s.folder?.trim()).filter(Boolean))]
    if (named.length) setCollapsed(new Set(named))
  }, [sessions])

  const [extraFolders, setExtraFolders] = useState([])
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderInput, setNewFolderInput] = useState('')

  // All known folder names: from DB sessions + any created this session (before a session is moved in)
  const dbFolders = useMemo(() =>
    [...new Set(sessions?.map(s => s.folder).filter(Boolean) ?? [])].sort(),
    [sessions]
  )
  const knownFolders = useMemo(() =>
    [...new Set([...dbFolders, ...extraFolders])].sort(),
    [dbFolders, extraFolders]
  )

  function addFolder() {
    const name = newFolderInput.trim()
    if (!name || knownFolders.includes(name)) return
    setExtraFolders(prev => [...prev, name])
    setCollapsed(prev => { const n = new Set(prev); n.delete(name); return n })
    setNewFolderInput('')
    setShowNewFolder(false)
  }

  function toggleFolder(key) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Group sessions by folder; seed with extraFolders so empty new folders appear
  const grouped = useMemo(() => {
    const map = new Map()
    extraFolders.forEach(f => { if (!map.has(f)) map.set(f, []) })
    ;(sessions ?? []).forEach(s => {
      const key = s.folder?.trim() || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    })
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (a === '') return 1
        if (b === '') return -1
        return a.localeCompare(b)
      })
      .map(([folder, items]) => ({ folder, items }))
  }, [sessions, extraFolders])

  const moveSession = useMutation({
    mutationFn: async ({ id, folder }) => {
      const { error } = await supabase
        .from('session_templates')
        .update({ folder: folder || null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session-templates'] }),
  })

  async function openDeleteDialog(s) {
    setConfirmDelete(s)
    setDeleteBlocked(null)
    const { data } = await supabase
      .from('study_sessions')
      .select('studies(name)')
      .eq('session_template_id', s.id)
    const labels = [...new Set((data ?? []).map(r => r.studies?.name).filter(Boolean))]
    setDeleteBlocked(labels)
  }

  function closeDeleteDialog() {
    setConfirmDelete(null)
    setDeleteBlocked(null)
  }

  const deleteSession = useMutation({
    mutationFn: async (id) => {
      const { error: nodesErr } = await supabase.from('session_template_nodes').delete().eq('session_template_id', id)
      if (nodesErr) throw nodesErr
      const { error } = await supabase.from('session_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['session-templates'] }); closeDeleteDialog() },
  })

  const cloneSession = useMutation({
    mutationFn: async (original) => {
      const { data: clone, error: cloneErr } = await supabase
        .from('session_templates')
        .insert({ label: `${original.label} (copy)`, cloned_from: original.id, folder: original.folder ?? null })
        .select('id')
        .single()
      if (cloneErr) throw cloneErr

      const { data: fullNodes } = await supabase
        .from('session_template_nodes')
        .select('order_index, activity_id, label')
        .eq('session_template_id', original.id)
      const finalNodes = (fullNodes ?? []).map(n => ({
        session_template_id: clone.id,
        order_index: n.order_index,
        activity_id: n.activity_id,
        label: n.label,
      }))
      if (finalNodes.length) {
        const { error: nodesErr } = await supabase.from('session_template_nodes').insert(finalNodes)
        if (nodesErr) throw nodesErr
      }
      return clone.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['session-templates'] })
      navigate(`/admin/sessions/${id}`)
    },
  })

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Session Templates</h1>
          <p style={S.sub}>Ordered activity sequences delivered in one sitting.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {showNewFolder ? (
            <>
              <input
                style={S.folderInput}
                value={newFolderInput}
                onChange={e => setNewFolderInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addFolder()
                  if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderInput('') }
                }}
                placeholder="Folder name…"
                autoFocus
              />
              <button style={S.btnPrimary} onClick={addFolder} disabled={!newFolderInput.trim()}>Add</button>
              <button style={S.btnGhost} onClick={() => { setShowNewFolder(false); setNewFolderInput('') }}>Cancel</button>
            </>
          ) : (
            <button style={S.btnGhost} onClick={() => setShowNewFolder(true)}>+ New Folder</button>
          )}
          <Link to="/admin/sessions/new" style={S.btnPrimary}>+ New Session</Link>
        </div>
      </div>

      {isLoading ? (
        <p style={S.muted}>Loading…</p>
      ) : !sessions?.length && extraFolders.length === 0 ? (
        <div style={S.empty}>
          <p style={S.emptyText}>No session templates yet.</p>
          <p style={S.emptyHint}>A session is an ordered sequence of activities delivered in one sitting.</p>
          <Link to="/admin/sessions/new" style={S.btnPrimary}>Build your first one →</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grouped.map(({ folder, items }) => {
            const key  = folder || '__none__'
            const open = !collapsed.has(key)
            return (
              <div key={key} style={S.folderBlock}>
                <button style={S.folderHeader} onClick={() => toggleFolder(key)}>
                  <span style={S.folderChevron}>{open ? '▼' : '▶'}</span>
                  <span style={S.folderName}>{folder || 'Uncategorized'}</span>
                  <span style={S.folderCount}>{items.length}</span>
                </button>
                {open && (
                  <div style={S.tableWrap}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          {['Label', 'Activities', 'Est. duration', 'Created', 'Actions'].map(h => (
                            <th key={h} style={S.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ ...S.td, color: 'var(--tx3)', fontStyle: 'italic', textAlign: 'center', padding: '20px 16px' }}>
                              Empty folder — use the Move dropdown on a session to place it here.
                            </td>
                          </tr>
                        ) : items.map(s => (
                          <tr key={s.id} style={S.tr}>
                            <td style={S.td}><span style={S.label}>{s.label}</span></td>
                            <td style={S.td}><Chip>{s.nodeCount}</Chip></td>
                            <td style={S.td}>
                              {s.totalMinutes ? <Chip>{s.totalMinutes} min</Chip> : <span style={S.muted}>—</span>}
                            </td>
                            <td style={S.td}><span style={S.mono}>{fmtDate(s.created_at)}</span></td>
                            <td style={S.td}>
                              <div style={S.actions}>
                                <button style={{ ...S.actionBtn, color: 'var(--pk)' }} onClick={() => setDemoSession(s)}>▶ Demo</button>
                                <Link to={`/admin/sessions/${s.id}`} style={S.actionBtn}>Edit</Link>
                                <select
                                  style={S.moveSelect}
                                  value={s.folder || ''}
                                  onChange={e => moveSession.mutate({ id: s.id, folder: e.target.value })}
                                  title="Move to folder"
                                >
                                  <option value="">Uncategorized</option>
                                  {knownFolders.map(f => (
                                    <option key={f} value={f}>{f}</option>
                                  ))}
                                </select>
                                <button style={S.actionBtn} onClick={() => cloneSession.mutate(s)}>Clone</button>
                                <button style={{ ...S.actionBtn, color: '#e04' }} onClick={() => openDeleteDialog(s)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {demoSession && (
        <SessionDemoModal
          templateId={demoSession.id}
          label={demoSession.label}
          onClose={() => setDemoSession(null)}
        />
      )}

      {confirmDelete && (
        <div style={S.overlay} onClick={closeDeleteDialog}>
          <div style={S.dialog} onClick={e => e.stopPropagation()}>
            <h2 style={S.dialogTitle}>Delete "{confirmDelete.label}"?</h2>
            {deleteBlocked === null ? (
              <p style={S.dialogBody}>Checking for dependencies…</p>
            ) : deleteBlocked.length > 0 ? (
              <>
                <p style={S.dialogBody}>
                  This session is used by {deleteBlocked.length === 1 ? 'a study' : `${deleteBlocked.length} studies`} and can't be deleted yet:
                </p>
                <ul style={S.blockList}>
                  {deleteBlocked.map(l => <li key={l} style={S.blockItem}>{l}</li>)}
                </ul>
                <p style={S.dialogBody}>Remove it from {deleteBlocked.length === 1 ? 'that study' : 'those studies'} first, then delete.</p>
                <div style={S.dialogActions}>
                  <button style={S.btnGhost} onClick={closeDeleteDialog}>Close</button>
                </div>
              </>
            ) : (
              <>
                <p style={S.dialogBody}>This removes the template and all its activity nodes. It can't be undone.</p>
                <div style={S.dialogActions}>
                  <button style={S.btnGhost} onClick={closeDeleteDialog}>Cancel</button>
                  <button style={S.btnDanger} onClick={() => deleteSession.mutate(confirmDelete.id)} disabled={deleteSession.isPending}>
                    {deleteSession.isPending ? 'Deleting…' : 'Yes, delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ children }) {
  return <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, background: 'var(--pkb)', color: 'var(--pk)', borderRadius: 6, padding: '2px 7px' }}>{children}</span>
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const S = {
  header:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  h1:        { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 4px' },
  sub:       { fontSize: 14, color: 'var(--tx2)', margin: 0 },
  muted:     { fontSize: 14, color: 'var(--tx3)' },
  mono:      { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
  label:     { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--tx)' },
  empty:     { textAlign: 'center', padding: '48px 0' },
  emptyText: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, color: 'var(--tx)', margin: '0 0 8px' },
  emptyHint: { fontSize: 14, color: 'var(--tx2)', margin: '0 0 24px' },
  folderBlock:   { borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' },
  folderHeader:  { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--bgp)', border: 'none', cursor: 'pointer', textAlign: 'left' },
  folderChevron: { fontFamily: '"Space Mono",monospace', fontSize: 10, color: 'var(--tx3)', width: 12, flexShrink: 0 },
  folderName:    { fontFamily: '"Space Mono",monospace', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx)', fontWeight: 700, flex: 1 },
  folderCount:   { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)' },
  folderInput:   { padding: '7px 12px', borderRadius: 8, border: '1px solid var(--bds)', background: 'var(--bgc)', fontSize: 14, color: 'var(--tx)', outline: 'none', fontFamily: '"DM Sans",system-ui,sans-serif', width: 180 },
  tableWrap: { overflowX: 'auto', background: '#fff' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr:        { borderBottom: '1px solid var(--bd)' },
  td:        { padding: '12px 16px', verticalAlign: 'middle' },
  actions:   { display: 'flex', gap: 10, alignItems: 'center' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, textDecoration: 'none', fontFamily: '"DM Sans",system-ui,sans-serif' },
  moveSelect:{ fontSize: 13, color: 'var(--pk)', background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnPrimary:{ display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  btnGhost:  { background: 'none', border: '1px solid var(--bds)', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', color: 'var(--tx2)', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  btnDanger: { background: '#e04', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dialog:    { background: '#fff', borderRadius: 14, padding: '28px 28px 24px', maxWidth: 400, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' },
  dialogTitle:  { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, margin: '0 0 10px', color: 'var(--tx)' },
  dialogBody:   { fontSize: 14, color: 'var(--tx2)', margin: '0 0 24px', lineHeight: 1.6 },
  dialogActions:{ display: 'flex', gap: 10, justifyContent: 'flex-end' },
  blockList:    { margin: '0 0 16px', paddingLeft: 20 },
  blockItem:    { fontSize: 14, color: 'var(--tx)', marginBottom: 4, fontFamily: '"DM Sans",system-ui,sans-serif' },
}
