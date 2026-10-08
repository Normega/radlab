import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import PrimaryCTA from '../../components/ui/PrimaryCTA'
import SecondaryCTA from '../../components/ui/SecondaryCTA'
import { taskInfo, PREVIEWABLE_SLUGS } from '../../components/tasks/taskRegistry'
import { DEMO_SECS } from '../../lib/demoMode'

// Task Library — /admin/tasks (website.md §25a). The game tasks the session
// builder offers (activities.category = 'game', read the same way), each with a
// no-save preview where one exists, the live game, and share links for people
// outside the lab. Share links live in task_preview_links; /preview/:token
// plays them.

const EXPIRY_DAYS = [7, 14, 30, 90]

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function linkUrl(token) {
  return `${window.location.origin}/preview/${token}`
}

function linkStatus(l) {
  if (l.revoked_at) return 'revoked'
  if (new Date(l.expires_at) <= new Date()) return 'expired'
  return 'active'
}

export default function TaskLibrary() {
  const queryClient = useQueryClient()
  const formRef = useRef(null)

  const [formSlug, setFormSlug]       = useState(PREVIEWABLE_SLUGS[0])
  const [recipient, setRecipient]     = useState('')
  const [days, setDays]               = useState(14)
  const [quickDemo, setQuickDemo]     = useState(false)
  const [fresh, setFresh]             = useState(null)   // the link just created
  const [copied, setCopied]           = useState(null)   // token last copied
  const [confirmRevoke, setConfirmRevoke] = useState(null)

  const { data: tasks = [], isLoading, isError } = useQuery({
    queryKey: ['task-library-games'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, label, subcategory, estimated_minutes')
        .eq('category', 'game')
        .order('label')
      if (error) throw error
      return data
    },
  })

  // How many session templates place each task — a task in no template is
  // safe to change; one in several is not.
  const { data: usage = {} } = useQuery({
    queryKey: ['task-library-usage', tasks.map(t => t.id)],
    enabled: tasks.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_template_nodes')
        .select('activity_id, session_template_id')
        .in('activity_id', tasks.map(t => t.id))
      if (error) throw error
      const sets = {}
      for (const n of data) (sets[n.activity_id] ??= new Set()).add(n.session_template_id)
      return Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.size]))
    },
  })

  const { data: links = [] } = useQuery({
    queryKey: ['task-preview-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_preview_links')
        .select('id, token, game_slug, recipient, quick_demo, created_at, expires_at, revoked_at, open_count, last_opened_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const labelFor = useMemo(() => {
    const m = Object.fromEntries(tasks.map(t => [t.subcategory, t.label]))
    return slug => m[slug] ?? taskInfo(slug).name ?? slug
  }, [tasks])

  const createLink = useMutation({
    mutationFn: async () => {
      const expires = new Date(Date.now() + days * 86400000).toISOString()
      const { data, error } = await supabase
        .from('task_preview_links')
        .insert({
          game_slug:  formSlug,
          recipient:  recipient.trim() || null,
          quick_demo: quickDemo && !!taskInfo(formSlug).timed,
          expires_at: expires,
        })
        .select('id, token')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (row) => {
      setFresh(row)
      setRecipient('')
      queryClient.invalidateQueries({ queryKey: ['task-preview-links'] })
    },
  })

  const revokeLink = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('task_preview_links')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setConfirmRevoke(null)
      queryClient.invalidateQueries({ queryKey: ['task-preview-links'] })
    },
  })

  async function copy(token) {
    try {
      await navigator.clipboard.writeText(linkUrl(token))
      setCopied(token)
    } catch {
      setCopied(null)
    }
  }

  function startShare(slug) {
    setFormSlug(slug)
    setFresh(null)
    createLink.reset()
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      <h1 style={S.h1}>Task Library</h1>
      <p style={S.sub}>
        The game tasks the session builder offers. Preview runs a task with nothing saved.
        Open game plays the live version, which saves to your account. A share link gives
        someone outside the lab the preview, with no account needed.
      </p>

      {isLoading && <p style={S.muted}>Loading…</p>}
      {isError && <p style={S.error}>Couldn’t load the tasks. Reload the page to try again.</p>}

      <div style={S.grid}>
        {tasks.map(t => {
          const info  = taskInfo(t.subcategory)
          const count = usage[t.id] ?? 0
          return (
            <div key={t.id} style={S.card}>
              <div style={S.cardBody}>
                <span style={S.slug}>{t.subcategory}</span>
                <h3 style={S.name}>{t.label}</h3>
                <p style={S.meta}>
                  {t.estimated_minutes ? `${t.estimated_minutes} min · ` : ''}
                  {count === 1 ? 'In 1 session template' : `In ${count} session templates`}
                </p>
                {info.note && <p style={S.meta}>{info.note}</p>}
                {!info.runsInSessions && (
                  <p style={S.warn}>
                    The session builder lists this task, but a study session can’t run it yet.
                  </p>
                )}
              </div>
              <div style={S.actions}>
                {info.previewable && (
                  <PrimaryCTA href={`/admin/tasks/preview/${t.subcategory}`} style={S.btn}>Preview</PrimaryCTA>
                )}
                {info.route && (
                  <SecondaryCTA href={info.route} style={S.btn}>Open game</SecondaryCTA>
                )}
                {info.previewable && (
                  <SecondaryCTA onClick={() => startShare(t.subcategory)} style={S.btn}>Share link</SecondaryCTA>
                )}
              </div>
              {!info.previewable && (
                <p style={S.noPreview}>No no-save preview yet, so this task can’t be shared.</p>
              )}
            </div>
          )
        })}
      </div>

      <h2 ref={formRef} style={S.h2}>Share a preview</h2>
      <div style={S.panel}>
        <div style={S.formRow}>
          <label style={S.field}>
            <span style={S.label}>Task</span>
            <select value={formSlug} onChange={e => { setFormSlug(e.target.value); setFresh(null) }} style={S.input}>
              {PREVIEWABLE_SLUGS.map(s => <option key={s} value={s}>{labelFor(s)}</option>)}
            </select>
          </label>
          <label style={{ ...S.field, flex: 2 }}>
            <span style={S.label}>Sent to (for your records)</span>
            <input
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              maxLength={200}
              placeholder="e.g. Reviewer 2, Dr. Lee at McGill"
              style={S.input}
            />
          </label>
          <label style={S.field}>
            <span style={S.label}>Expires after</span>
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={S.input}>
              {EXPIRY_DAYS.map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
        </div>
        {taskInfo(formSlug).timed && (
          <label style={S.check}>
            <input type="checkbox" checked={quickDemo} onChange={e => setQuickDemo(e.target.checked)} />
            Short timer: cut the session to {DEMO_SECS} seconds
          </label>
        )}
        <div style={S.formRow}>
          <PrimaryCTA onClick={() => createLink.mutate()} disabled={createLink.isPending}>
            {createLink.isPending ? 'Creating…' : 'Create link'}
          </PrimaryCTA>
        </div>
        {createLink.isError && <p style={S.error}>The link wasn’t created. Try again.</p>}
        {fresh && (
          <div style={S.fresh}>
            <code style={S.url}>{linkUrl(fresh.token)}</code>
            <SecondaryCTA onClick={() => copy(fresh.token)} style={S.btn}>
              {copied === fresh.token ? 'Copied' : 'Copy link'}
            </SecondaryCTA>
          </div>
        )}
      </div>

      <h2 style={S.h2}>Links issued</h2>
      {links.length === 0 ? (
        <p style={S.muted}>No preview links yet.</p>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Task', 'Sent to', 'Created', 'Expires', 'Opens', 'Status', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map(l => {
                const status = linkStatus(l)
                const live = status === 'active'
                return (
                  <tr key={l.id} style={live ? undefined : S.deadRow}>
                    <td style={S.td}>
                      {labelFor(l.game_slug)}
                      {l.quick_demo && <span style={S.chip}>{DEMO_SECS} s</span>}
                    </td>
                    <td style={S.td}>{l.recipient ?? ''}</td>
                    <td style={S.td}>{fmtDate(l.created_at)}</td>
                    <td style={S.td}>{fmtDate(l.expires_at)}</td>
                    <td style={S.td} title={l.last_opened_at ? `Last opened ${fmtDate(l.last_opened_at)}` : undefined}>
                      {l.open_count}
                    </td>
                    <td style={S.td}>{status === 'active' ? 'Active' : status === 'expired' ? 'Expired' : 'Revoked'}</td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                      {live && (
                        <>
                          <button type="button" style={S.rowBtn} onClick={() => copy(l.token)}>
                            {copied === l.token ? 'Copied' : 'Copy'}
                          </button>
                          {confirmRevoke === l.id ? (
                            <>
                              <button type="button" style={{ ...S.rowBtn, ...S.rowBtnDanger }}
                                onClick={() => revokeLink.mutate(l.id)} disabled={revokeLink.isPending}>
                                Confirm revoke
                              </button>
                              <button type="button" style={S.rowBtn} onClick={() => setConfirmRevoke(null)}>Keep</button>
                            </>
                          ) : (
                            <button type="button" style={S.rowBtn} onClick={() => setConfirmRevoke(l.id)}>Revoke</button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={S.footnote}>
        Opens counts every load of the link, including mail scanners that open links before
        the recipient does. Read it as an upper bound, not a headcount.
      </p>
    </div>
  )
}

const FONT = '"DM Sans",system-ui,sans-serif'
const MONO = '"Space Mono",monospace'

const S = {
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 8px' },
  h2: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: '40px 0 16px' },
  sub: { fontFamily: FONT, fontSize: 14, lineHeight: 1.5, color: 'var(--tx2)', margin: '0 0 32px', maxWidth: 720 },
  muted: { fontFamily: FONT, fontSize: 14, color: 'var(--tx2)' },
  error: { fontFamily: FONT, fontSize: 14, color: 'var(--pkd)', margin: '8px 0 0' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 },
  card: {
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  cardBody: { padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 },
  slug: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', letterSpacing: '0.04em' },
  name: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  meta: { fontFamily: FONT, fontSize: 12, color: 'var(--tx2)', margin: 0, lineHeight: 1.4 },
  warn: { fontFamily: FONT, fontSize: 12, color: 'var(--pkd)', margin: 0, lineHeight: 1.4 },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px 16px' },
  btn: { fontSize: 14, padding: '4px 16px' },
  noPreview: {
    fontFamily: FONT, fontSize: 12, color: 'var(--tx2)', margin: 0,
    padding: '8px 16px', background: 'var(--bgp)', borderTop: '1px solid var(--pkb)',
  },

  panel: {
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12,
    padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 880,
  },
  formRow: { display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 },
  label: { fontFamily: FONT, fontSize: 12, fontWeight: 600, color: 'var(--tx2)' },
  input: {
    fontFamily: FONT, fontSize: 16, padding: '8px 16px', minHeight: 40,
    border: '1px solid var(--bds)', borderRadius: 12, background: 'var(--bgc)', color: 'var(--tx)',
  },
  check: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT, fontSize: 14, color: 'var(--tx)' },
  fresh: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16,
    padding: 16, background: 'var(--bgp)', borderRadius: 12,
  },
  url: { fontFamily: MONO, fontSize: 14, color: 'var(--tx)', wordBreak: 'break-all', flex: 1, minWidth: 0 },

  tableWrap: { overflowX: 'auto', border: '1px solid var(--bd)', borderRadius: 12, background: 'var(--bgc)' },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: 14 },
  th: {
    textAlign: 'left', padding: '8px 16px', borderBottom: '1px solid var(--bd)',
    fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--tx2)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  td: { padding: '8px 16px', borderBottom: '1px solid var(--bd)', color: 'var(--tx)', verticalAlign: 'middle' },
  deadRow: { opacity: 0.5 },
  chip: {
    marginLeft: 8, padding: '0 8px', borderRadius: 12, background: 'var(--bgp)',
    fontFamily: MONO, fontSize: 12, color: 'var(--pkd)',
  },
  rowBtn: {
    marginRight: 8, padding: '4px 16px', borderRadius: 24,
    border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)',
    fontFamily: FONT, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  rowBtnDanger: { borderColor: 'var(--pkd)', color: 'var(--pkd)' },
  footnote: { fontFamily: FONT, fontSize: 12, color: 'var(--tx2)', margin: '16px 0 0', maxWidth: 720 },
}
