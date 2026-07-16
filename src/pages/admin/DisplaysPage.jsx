// v1 — display element library: list, create link, delete.
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export default function DisplaysPage() {
  const qc = useQueryClient()

  const { data: displays, isLoading } = useQuery({
    queryKey: ['displays-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('displays')
        .select('id, slug, name, blocks, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const del = useMutation({
    mutationFn: async (display) => {
      const { error } = await supabase.from('displays').delete().eq('id', display.id)
      if (error) throw error
      await supabase.from('activities').delete()
        .eq('category', 'display')
        .eq('subcategory', display.slug)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['displays-list'] })
      qc.invalidateQueries({ queryKey: ['activities'] })
    },
  })

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Displays</h1>
          <p style={S.sub}>Text pages shown to participants mid-session — instructions, condition-specific content, performance feedback.</p>
        </div>
        <Link to="/admin/displays/new" style={S.btnPrimary}>+ New display</Link>
      </div>

      {isLoading && <p style={S.sub}>Loading…</p>}

      {!isLoading && (displays ?? []).length === 0 && (
        <p style={S.sub}>No displays yet. Create one, then add it to a session in the Session Builder.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(displays ?? []).map(d => (
          <div key={d.id} style={S.row}>
            <div style={{ minWidth: 0 }}>
              <div style={S.rowName}>{d.name}</div>
              <div style={S.rowMeta}>
                <span style={S.mono}>{d.slug}</span>
                {' · '}{(d.blocks ?? []).length} block{(d.blocks ?? []).length === 1 ? '' : 's'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
              <Link to={`/admin/displays/${d.id}`} style={S.link}>Edit</Link>
              <button
                style={S.deleteBtn}
                onClick={() => {
                  if (window.confirm(`Delete display "${d.name}"? Sessions using it will show an error step.`)) {
                    del.mutate(d)
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const S = {
  header:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  h1:        { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 6px' },
  sub:       { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: 0, maxWidth: 520 },
  btnPrimary:{ display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', textDecoration: 'none', whiteSpace: 'nowrap' },
  row:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: '14px 18px' },
  rowName:   { fontSize: 15, fontWeight: 600, color: 'var(--tx)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  rowMeta:   { fontSize: 12, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', marginTop: 2 },
  mono:      { fontFamily: '"Space Mono",monospace' },
  link:      { fontSize: 13, color: 'var(--pkd)', fontFamily: '"DM Sans",system-ui,sans-serif' },
  deleteBtn: { fontSize: 13, color: '#e04', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
}
