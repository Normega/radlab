import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function useClasses() {
  return useQuery({
    queryKey: ['classes-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('id, name, slug, created_at').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

function useCreateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, slug }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('classes').insert({ name, slug, created_by: user?.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes-list'] }),
  })
}

function useDeleteClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('classes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes-list'] }),
  })
}

function useClassAdmins(classId, open) {
  return useQuery({
    queryKey: ['class-admins', classId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_class_admins', { p_class_id: classId })
      if (error) throw error
      return data
    },
    enabled: open,
  })
}

function useAddClassAdmin(classId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (email) => {
      const { data: userId, error: lookupErr } = await supabase.rpc('get_user_id_by_email', { lookup_email: email })
      if (lookupErr) throw lookupErr
      if (!userId) throw new Error('No radlab account found for that email.')
      const { error } = await supabase.from('class_admins').insert({ class_id: classId, user_id: userId })
      if (error) {
        if (error.code === '23505') throw new Error('Already an instructor on this class.')
        throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['class-admins', classId] }),
  })
}

function useRemoveClassAdmin(classId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (adminRowId) => {
      const { error } = await supabase.from('class_admins').delete().eq('id', adminRowId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['class-admins', classId] }),
  })
}

function ClassRow({ cls, expanded, onToggle, onDelete }) {
  const { data: admins, isLoading } = useClassAdmins(cls.id, expanded)
  const addAdmin = useAddClassAdmin(cls.id)
  const removeAdmin = useRemoveClassAdmin(cls.id)
  const [email, setEmail] = useState('')

  function submitAdd(e) {
    e.preventDefault()
    addAdmin.mutate(email, { onSuccess: () => setEmail('') })
  }

  return (
    <>
      <tr style={S.tr}>
        <td style={S.td}><span style={S.label}>{cls.name}</span></td>
        <td style={S.td}><span style={S.mono}>{cls.slug}</span></td>
        <td style={S.td}><span style={S.mono}>{new Date(cls.created_at).toLocaleDateString()}</span></td>
        <td style={S.td}>
          <div style={S.actions}>
            <button style={S.actionBtn} onClick={onToggle}>{expanded ? 'Hide instructors' : 'Instructors'}</button>
            <Link to={`/class/${cls.slug}/console`} style={S.actionBtn}>Console</Link>
            <Link to={`/class/${cls.slug}`} style={S.actionBtn}>Join page</Link>
            <button style={S.deleteBtn} onClick={() => onDelete(cls)}>Delete</button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} style={S.expandCell}>
            {isLoading ? (
              <p style={S.muted}>Loading…</p>
            ) : (
              <>
                {admins?.length ? (
                  <ul style={S.adminList}>
                    {admins.map((a) => (
                      <li key={a.id} style={S.adminItem}>
                        <span>{a.email}</span>
                        <button style={S.deleteBtn} onClick={() => removeAdmin.mutate(a.id)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={S.muted}>No explicit instructors — any lab account can still manage this class.</p>
                )}
                <form onSubmit={submitAdd} style={S.addForm}>
                  <input
                    type="email" required placeholder="instructor@utoronto.ca" value={email}
                    onChange={(e) => setEmail(e.target.value)} style={S.input}
                  />
                  <button type="submit" style={S.btnSmall} disabled={addAdmin.isPending}>
                    {addAdmin.isPending ? 'Adding…' : 'Add instructor'}
                  </button>
                </form>
                {addAdmin.isError && <p style={S.errorText}>{addAdmin.error.message}</p>}
              </>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// Own page chrome (Nav + wrap) — deliberately not AdminLayout. Lecture
// Lounge admin is a separate partition from research admin: own route,
// own bundle chunk, own layout, so a problem in one can't affect the other.
export default function LectureLoungeAdminPage({ session }) {
  const { data: classes, isLoading } = useClasses()
  const createClass = useCreateClass()
  const deleteClass = useDeleteClass()
  const [expandedId, setExpandedId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '' })

  function submitCreate(e) {
    e.preventDefault()
    createClass.mutate(form, {
      onSuccess: () => { setForm({ name: '', slug: '' }); setCreating(false) },
    })
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.page}>
        <div style={S.header}>
          <div>
            <p style={S.eyebrow}>Lecture Lounge admin</p>
            <h1 style={S.h1}>Classes</h1>
            <p style={S.sub}>Create classes and manage their instructors.</p>
          </div>
          <button style={S.btnPrimary} onClick={() => setCreating(true)}>+ New class</button>
        </div>

        {creating && (
          <form onSubmit={submitCreate} style={S.createForm}>
            <input
              type="text" required placeholder="Class name" value={form.name}
              onChange={(e) => setForm({ name: e.target.value, slug: form.slug || slugify(e.target.value) })}
              style={{ ...S.input, flex: 1 }}
            />
            <input
              type="text" required placeholder="url-slug" value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              style={S.input}
            />
            <button type="submit" style={S.btnSmall} disabled={createClass.isPending}>
              {createClass.isPending ? 'Creating…' : 'Create'}
            </button>
            <button type="button" style={S.cancelBtn} onClick={() => setCreating(false)}>Cancel</button>
          </form>
        )}
        {createClass.isError && <p style={S.errorText}>{createClass.error.message}</p>}

        {isLoading ? (
          <p style={S.muted}>Loading…</p>
        ) : !classes?.length ? (
          <div style={S.empty}>
            <p style={S.emptyText}>No classes yet.</p>
            <p style={S.emptyHint}>Create one, then add instructors below.</p>
          </div>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Class', 'Slug', 'Created', 'Actions'].map((h) => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <ClassRow
                    key={cls.id} cls={cls} expanded={expandedId === cls.id}
                    onToggle={() => setExpandedId(expandedId === cls.id ? null : cls.id)}
                    onDelete={setPendingDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pendingDelete && (
          <div style={S.overlay} onClick={() => setPendingDelete(null)}>
            <div style={S.dialog} onClick={(e) => e.stopPropagation()}>
              <h2 style={S.dialogTitle}>Delete class?</h2>
              <p style={S.dialogBody}>
                <strong>{pendingDelete.name}</strong> and all its lectures, check-ins, and responses will be permanently removed. This cannot be undone.
              </p>
              <div style={S.dialogActions}>
                <button style={S.cancelBtn} onClick={() => setPendingDelete(null)}>Cancel</button>
                <button
                  style={S.confirmDeleteBtn} disabled={deleteClass.isPending}
                  onClick={() => deleteClass.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })}
                >
                  {deleteClass.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
              {deleteClass.isError && <p style={S.dialogError}>{deleteClass.error.message}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const S = {
  page: { maxWidth: 900, margin: '0 auto', padding: '40px 24px' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  h1: { fontFamily: SERIF, fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '0 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', margin: 0 },
  muted: { fontSize: 14, color: 'var(--tx3)' },
  mono: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)' },
  label: { fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--tx)' },
  empty: { textAlign: 'center', padding: '48px 0' },
  emptyText: { fontFamily: SERIF, fontSize: 20, color: 'var(--tx)', margin: '0 0 8px' },
  emptyHint: { fontSize: 14, color: 'var(--tx2)', margin: 0 },
  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bgc)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tr: { borderBottom: '1px solid var(--bd)' },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  expandCell: { padding: '12px 16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--bd)' },
  actions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx2)', padding: 0, textDecoration: 'none', fontFamily: '"DM Sans",system-ui,sans-serif' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#c0392b', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnPrimary: { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
  btnSmall: { background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { background: 'none', border: '1px solid var(--bd)', borderRadius: 8, padding: '7px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--tx2)', fontFamily: 'inherit' },
  createForm: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  addForm: { display: 'flex', gap: 8, marginTop: 10 },
  input: { padding: '7px 10px', borderRadius: 7, border: '1px solid var(--bds)', fontSize: 13, fontFamily: 'inherit' },
  adminList: { listStyle: 'none', padding: 0, margin: 0 },
  adminItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13, color: 'var(--tx)', maxWidth: 340 },
  errorText: { fontSize: 13, color: '#c0392b', margin: '8px 0 0' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  dialog: { background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  dialogTitle: { fontFamily: SERIF, fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: '0 0 12px' },
  dialogBody: { fontSize: 14, color: 'var(--tx2)', margin: '0 0 24px', lineHeight: 1.6 },
  dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  confirmDeleteBtn: { background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', fontWeight: 500 },
  dialogError: { fontSize: 13, color: '#c0392b', margin: '12px 0 0', fontFamily: '"DM Sans",system-ui,sans-serif' },
}
