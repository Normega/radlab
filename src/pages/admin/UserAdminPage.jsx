import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── UserAdminPage ─────────────────────────────────────────────────────────────
// Route: /admin/users — SUPER ADMINS ONLY. The sidebar link is hidden for
// non-supers, but the real gate is server-side: all three RPCs
// (admin_list_users / admin_set_user_role / admin_delete_user,
// 20260712_admin_user_management.sql) raise 'forbidden' unless
// is_super_admin(). Role toggling is lab↔public only; super admins can never
// be modified or deleted here, and there is no elevation path.

export default function UserAdminPage() {
  const queryClient = useQueryClient()
  const [search,        setSearch]        = useState('')
  const [deleteTarget,  setDeleteTarget]  = useState(null)   // user object
  const [actionError,   setActionError]   = useState(null)

  const { data: users = [], isLoading, error: loadError } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users')
      if (error) throw error
      return data ?? []
    },
    retry: false,
  })

  const setRole = useMutation({
    mutationFn: async ({ id, role }) => {
      const { error } = await supabase.rpc('admin_set_user_role', { p_target: id, p_new_role: role })
      if (error) throw error
    },
    onSuccess: () => { setActionError(null); queryClient.invalidateQueries({ queryKey: ['admin_users'] }) },
    onError:   e  => setActionError(e.message),
  })

  const deleteUser = useMutation({
    mutationFn: async id => {
      const { error } = await supabase.rpc('admin_delete_user', { p_target: id })
      if (error) throw error
    },
    onSuccess: () => { setActionError(null); setDeleteTarget(null); queryClient.invalidateQueries({ queryKey: ['admin_users'] }) },
    onError:   e  => setActionError(e.message),
  })

  if (isLoading) return <p style={S.muted}>Loading…</p>

  // Non-supers who navigate here directly get the RPC's forbidden error
  if (loadError) {
    return (
      <div>
        <h1 style={S.h1}>Users</h1>
        <p style={S.errBox}>
          {String(loadError.message).includes('forbidden')
            ? 'This page is available to super admins only.'
            : `Could not load users — has 20260712_admin_user_management.sql been applied? (${loadError.message})`}
        </p>
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? users.filter(u =>
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.display_name ?? '').toLowerCase().includes(q) ||
        (u.role ?? '').toLowerCase().includes(q))
    : users

  const ROLE_ORDER = ['lab', 'public', 'participant']
  const ROLE_LABELS = { lab: 'Lab', public: 'Public', participant: 'Participants' }
  const grouped = ROLE_ORDER
    .map(role => ({ role, label: ROLE_LABELS[role], users: filtered.filter(u => u.role === role) }))
    .concat((() => {
      const other = filtered.filter(u => !ROLE_ORDER.includes(u.role))
      return other.length ? [{ role: 'other', label: 'Other', users: other }] : []
    })())
    .filter(g => g.users.length > 0)

  const busy = setRole.isPending || deleteUser.isPending

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={S.h1}>Users</h1>
        <p style={S.sub}>
          {users.length} account{users.length === 1 ? '' : 's'}. Toggle roles between lab and public,
          or delete test accounts. Super admins and participant accounts can't be modified here.
        </p>
      </div>

      <input
        type="search"
        placeholder="Filter by email, name, or role…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={S.search}
      />

      {actionError && <p style={S.errBox}>{actionError}</p>}

      {grouped.length === 0 && <p style={S.muted}>No matching users.</p>}

      {grouped.map(g => (
        <RoleSection
          key={g.role}
          role={g.role}
          label={g.label}
          users={g.users}
          onSetRole={(id, role) => setRole.mutate({ id, role })}
          onDelete={u => { setActionError(null); setDeleteTarget(u) }}
          busy={busy}
        />
      ))}

      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          busy={deleteUser.isPending}
          error={actionError}
          onCancel={() => { setDeleteTarget(null); setActionError(null) }}
          onConfirm={() => deleteUser.mutate(deleteTarget.id)}
        />
      )}
    </div>
  )
}

function RoleSection({ role, label, users, onSetRole, onDelete, busy }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ marginBottom: 24 }}>
      <button style={S.sectionHeader} onClick={() => setOpen(o => !o)}>
        <span style={{ ...S.roleBadge, ...(ROLE_COLORS[role] ?? S.roleBadgeFallback) }}>{label}</span>
        <span style={S.sectionCount}>{users.length} user{users.length === 1 ? '' : 's'}</span>
        <span style={S.chevron}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Email', 'Display name', 'Confirmed', 'Created', 'Last sign-in', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  onSetRole={r => onSetRole(u.id, r)}
                  onDelete={() => onDelete(u)}
                  busy={busy}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function UserRow({ user: u, onSetRole, onDelete, busy }) {
  const [confirmingRole, setConfirmingRole] = useState(false)
  const toggleable = !u.super_admin && (u.role === 'lab' || u.role === 'public')
  const nextRole   = u.role === 'lab' ? 'public' : 'lab'

  function handleRoleClick() {
    if (!confirmingRole) { setConfirmingRole(true); setTimeout(() => setConfirmingRole(false), 4000); return }
    setConfirmingRole(false)
    onSetRole(nextRole)
  }

  return (
    <tr>
      <td style={S.td}>
        {u.email}
        {u.super_admin && <span style={S.superBadge}>super</span>}
      </td>
      <td style={S.td}>{u.display_name ?? <span style={S.muted}>—</span>}</td>
      <td style={S.td}>{u.email_confirmed_at ? '✓' : <span style={{ color: '#c60' }}>pending</span>}</td>
      <td style={S.td}>{fmtDate(u.created_at)}</td>
      <td style={S.td}>{u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : <span style={S.muted}>never</span>}</td>
      <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {toggleable && (
          <button style={S.smallBtn} disabled={busy} onClick={handleRoleClick}>
            {confirmingRole ? `Confirm → ${nextRole}?` : `→ ${nextRole}`}
          </button>
        )}
        {!u.super_admin && (
          <button style={{ ...S.dangerBtn, marginLeft: 8 }} disabled={busy} onClick={onDelete}>Delete</button>
        )}
      </td>
    </tr>
  )
}

// Type-the-email confirmation — deletion is transactional but irrevocable.
function DeleteModal({ user, busy, error, onCancel, onConfirm }) {
  const [typed, setTyped] = useState('')
  const match = typed.trim().toLowerCase() === (user.email ?? '').toLowerCase()

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.modalTitle}>Delete {user.email}?</h2>
        <p style={S.modalBody}>
          This permanently deletes the account <strong>and all of its data</strong> —
          game sessions, check-ins, questionnaire responses, consents, everything.
          There is no undo.
        </p>
        <p style={S.modalBody}>Type the account's email to confirm:</p>
        <input
          type="text"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={user.email}
          style={S.modalInput}
          autoFocus
        />
        {error && <p style={S.errBox}>{error}</p>}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button style={S.smallBtn} onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            style={{ ...S.dangerBtn, opacity: match && !busy ? 1 : 0.4 }}
            disabled={!match || busy}
            onClick={onConfirm}
          >
            {busy ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </div>
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const MONO = '"Space Mono", monospace'

const ROLE_COLORS = {
  lab:         { background: '#EAF2FC', color: '#1C5FA0', borderColor: '#BDD7F0' },
  public:      { background: '#EDF7EE', color: '#2D6A4F', borderColor: '#BFE3C6' },
  participant: { background: '#F6EFFB', color: '#7B4FCF', borderColor: '#E0CDF2' },
}

const S = {
  h1:    { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 28, color: 'var(--tx)', margin: 0 },
  sub:   { fontSize: 14, color: 'var(--tx2)', marginTop: 6 },
  muted: { fontSize: 13, color: 'var(--tx3)' },

  search: {
    width: '100%', maxWidth: 420, padding: '10px 14px', borderRadius: 10,
    border: '1px solid var(--bds)', background: 'var(--bgp)', fontSize: 14,
    color: 'var(--tx)', marginBottom: 20, fontFamily: 'inherit',
  },

  tableWrap: { border: '1px solid var(--bds)', borderRadius: 12, overflowX: 'auto', background: 'var(--bgc)' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 14px', fontFamily: MONO, fontSize: 11,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx3)',
    borderBottom: '1px solid var(--bds)', whiteSpace: 'nowrap',
  },
  td: { padding: '10px 14px', borderBottom: '1px solid var(--bds)', color: 'var(--tx)', whiteSpace: 'nowrap' },

  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: 10, background: 'none',
    border: 'none', padding: '6px 0', cursor: 'pointer', marginBottom: 8, width: '100%',
  },
  sectionCount: { fontSize: 13, color: 'var(--tx3)', fontFamily: MONO },
  chevron: { fontSize: 14, color: 'var(--tx3)', marginLeft: 'auto' },

  roleBadge: {
    display: 'inline-block', padding: '3px 12px', borderRadius: 999,
    fontFamily: MONO, fontSize: 12, fontWeight: 600, border: '1px solid transparent',
  },
  roleBadgeFallback: { background: 'var(--bgp)', color: 'var(--tx2)', borderColor: 'var(--bds)' },
  superBadge: {
    marginLeft: 8, padding: '1px 8px', borderRadius: 999, fontFamily: MONO,
    fontSize: 10, background: '#FFF4D6', color: '#8A6D00', border: '1px solid #EDD98F',
  },

  smallBtn: {
    marginLeft: 10, padding: '3px 10px', borderRadius: 8, fontSize: 12,
    border: '1px solid var(--bds)', background: 'var(--bgp)', color: 'var(--tx2)',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  dangerBtn: {
    padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    border: '1px solid #F09595', background: '#FCEBEB', color: '#A32D2D',
    cursor: 'pointer', fontFamily: 'inherit',
  },

  errBox: {
    fontSize: 13, color: '#A32D2D', background: '#FCEBEB',
    border: '1px solid #F09595', borderRadius: 8, padding: '10px 14px',
    margin: '0 0 16px',
  },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: 'var(--bgc, #fff)', borderRadius: 16, padding: '28px 32px',
    maxWidth: 460, width: '90%', display: 'flex', flexDirection: 'column', gap: 14,
    border: '1px solid var(--bds)',
  },
  modalTitle: { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 22, color: 'var(--tx)', margin: 0 },
  modalBody:  { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, margin: 0 },
  modalInput: {
    padding: '10px 14px', borderRadius: 10, border: '1px solid var(--bds)',
    fontSize: 14, fontFamily: MONO, color: 'var(--tx)', background: 'var(--bgp)',
  },
}
