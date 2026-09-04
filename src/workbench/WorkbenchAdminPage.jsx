import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import SessionTranscript from './SessionTranscript'

// /workbench/admin — Norm's association console.
//
// Every captured session appears here whether or not it is shared; that is the
// point of capturing unconditionally. Sharing is one click, and the transcript
// shown below the share controls is rendered by the same component the student
// sees, so "preview" means preview and not "approximately what they get".
//
// Two share units, matching how the work actually happens:
//  · this session → these people
//  · everything in this project directory → these people (past sessions included)
//
// The project rule is live, not a snapshot: removing it removes access to the
// whole project at once. A rule that only covered sessions existing at the moment
// it was created would be a trap — it reads as "standing" and would silently stop
// covering tomorrow's work.

const POLL_MS = 15_000

function useAllSessions() {
  return useQuery({
    queryKey: ['wb-admin-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claude_sessions')
        .select('id, title, project_label, project_key, git_branch, turn_count, started_at, last_turn_at, ended_at')
        .order('last_turn_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
    refetchInterval: POLL_MS,
  })
}

function useMembers() {
  return useQuery({
    queryKey: ['wb-members'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('workbench_shareable_members')
      if (error) throw error
      return data ?? []
    },
  })
}

function useSessionShares() {
  return useQuery({
    queryKey: ['wb-session-shares'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claude_session_shares')
        .select('session_id, profile_id')
      if (error) throw error
      return data ?? []
    },
  })
}

function useProjectShares() {
  return useQuery({
    queryKey: ['wb-project-shares'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claude_project_shares')
        .select('project_key, profile_id')
      if (error) throw error
      return data ?? []
    },
  })
}

function useTurns(sessionId) {
  return useQuery({
    queryKey: ['wb-admin-turns', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claude_session_turns')
        .select('seq, role, body, tools, at')
        .eq('session_id', sessionId)
        .order('seq', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    refetchInterval: POLL_MS,
  })
}

function useToggleShare(table, keyName, queryKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ keyValue, profileId, on }) => {
      if (on) {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase
          .from(table)
          .insert({ [keyName]: keyValue, profile_id: profileId, shared_by: user?.id })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq(keyName, keyValue)
          .eq('profile_id', profileId)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  })
}

function relativeTime(iso) {
  if (!iso) return 'no activity'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

function ShareChips({ members, activeIds, inheritedIds, onToggle, pending }) {
  return (
    <div style={S.chips}>
      {members.map((m) => {
        const inherited = inheritedIds.has(m.id)
        const on = activeIds.has(m.id)
        return (
          <button
            key={m.id}
            type="button"
            disabled={pending || inherited}
            onClick={() => onToggle(m.id, !on)}
            title={inherited ? 'Already covered by a standing project rule' : undefined}
            style={{
              ...S.chip,
              ...(on ? S.chipOn : null),
              ...(inherited ? S.chipInherited : null),
            }}
          >
            {m.display_name || 'unnamed'}
            {inherited ? ' · project' : ''}
          </button>
        )
      })}
    </div>
  )
}

export default function WorkbenchAdminPage({ session: authSession }) {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [showProjects, setShowProjects] = useState(false)

  const { data: sessions, isLoading, error } = useAllSessions()
  const { data: members, error: membersError } = useMembers()
  const { data: sessionShares } = useSessionShares()
  const { data: projectShares } = useProjectShares()
  const { data: turns, isLoading: turnsLoading } = useTurns(sessionId)

  const toggleSessionShare = useToggleShare('claude_session_shares', 'session_id', 'wb-session-shares')
  const toggleProjectShare = useToggleShare('claude_project_shares', 'project_key', 'wb-project-shares')

  useEffect(() => {
    if (!sessionId && sessions?.length) {
      navigate(`/workbench/admin/${sessions[0].id}`, { replace: true })
    }
  }, [sessionId, sessions, navigate])

  const current = sessions?.find((s) => s.id === sessionId)

  const sharesBySession = useMemo(() => {
    const map = new Map()
    for (const row of sessionShares ?? []) {
      if (!map.has(row.session_id)) map.set(row.session_id, new Set())
      map.get(row.session_id).add(row.profile_id)
    }
    return map
  }, [sessionShares])

  const sharesByProject = useMemo(() => {
    const map = new Map()
    for (const row of projectShares ?? []) {
      if (!map.has(row.project_key)) map.set(row.project_key, new Set())
      map.get(row.project_key).add(row.profile_id)
    }
    return map
  }, [projectShares])

  const projects = useMemo(() => {
    const set = new Map()
    for (const s of sessions ?? []) {
      if (!set.has(s.project_key)) set.set(s.project_key, s.project_label || s.project_key)
    }
    for (const key of sharesByProject.keys()) if (!set.has(key)) set.set(key, key)
    return [...set.entries()].map(([key, label]) => ({ key, label }))
  }, [sessions, sharesByProject])

  const memberName = (id) => members?.find((m) => m.id === id)?.display_name || 'someone'

  // Who can see a given session, counting both routes in.
  const audienceFor = (s) => {
    const direct = sharesBySession.get(s.id) ?? new Set()
    const viaProject = sharesByProject.get(s.project_key) ?? new Set()
    return new Set([...direct, ...viaProject])
  }

  return (
    <>
      <Nav session={authSession} />
      <main style={S.page}>
        <header style={S.head}>
          <div>
            <h1 style={S.h1}>Workbench console</h1>
            <p style={S.sub}>
              Everything captured, shared or not. Nothing below is visible to anyone else
              until you name them.
            </p>
          </div>
          <Link to="/workbench" style={S.linkBtn}>Member view →</Link>
        </header>

        {membersError ? (
          <div style={S.errorBox}>Could not load the member roster: {membersError.message}</div>
        ) : null}
        {error ? <div style={S.errorBox}>Could not load sessions: {error.message}</div> : null}

        <section style={S.projectPanel}>
          <button type="button" onClick={() => setShowProjects((v) => !v)} style={S.disclosure}>
            {showProjects ? '▾' : '▸'} Standing project rules
            <span style={S.disclosureNote}>
              {sharesByProject.size
                ? `${sharesByProject.size} project${sharesByProject.size === 1 ? '' : 's'} with a rule`
                : 'none set'}
            </span>
          </button>

          {showProjects ? (
            <div style={S.projectBody}>
              <p style={S.projectHint}>
                Everything in a project directory, past and future, goes to the people named
                here. Removing a name removes access to every session in that project.
              </p>
              {projects.map((p) => (
                <div key={p.key} style={S.projectRow}>
                  <div>
                    <div style={S.projectLabel}>{p.label}</div>
                    <div style={S.projectKey}>{p.key}</div>
                  </div>
                  <ShareChips
                    members={members ?? []}
                    activeIds={sharesByProject.get(p.key) ?? new Set()}
                    inheritedIds={new Set()}
                    pending={toggleProjectShare.isPending}
                    onToggle={(profileId, on) =>
                      toggleProjectShare.mutate({ keyValue: p.key, profileId, on })
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {isLoading ? <p style={S.loading}>Loading…</p> : null}

        {!isLoading && !sessions?.length ? (
          <div style={S.emptyShelf}>
            <p style={S.emptyTitle}>No sessions captured yet.</p>
            <p style={S.emptyBody}>
              Capture starts once <code style={S.code}>~/.claude/workbench.json</code> exists on
              the machine you work from and the repo carries the hook in{' '}
              <code style={S.code}>.claude/settings.json</code>. Finish a turn in a hooked repo
              and it will appear here.
            </p>
          </div>
        ) : null}

        {sessions?.length ? (
          <div style={S.split}>
            <nav style={S.list} aria-label="All sessions">
              {sessions.map((s) => {
                const audience = audienceFor(s)
                return (
                  <Link
                    key={s.id}
                    to={`/workbench/admin/${s.id}`}
                    style={{ ...S.card, ...(s.id === sessionId ? S.cardActive : null) }}
                  >
                    <div style={S.cardTitle}>{s.title || 'Untitled session'}</div>
                    <div style={S.cardMeta}>
                      <span style={S.project}>{s.project_label}</span>
                      <span>{relativeTime(s.last_turn_at)}</span>
                    </div>
                    <div style={S.cardMeta}>
                      {audience.size ? (
                        <span style={S.sharedTag}>
                          shared · {[...audience].map(memberName).join(', ')}
                        </span>
                      ) : (
                        <span style={S.privateTag}>private</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </nav>

            <section style={S.detail}>
              {current ? (
                <>
                  <div style={S.detailHead}>
                    <h2 style={S.h2}>{current.title || 'Untitled session'}</h2>
                    <div style={S.detailMeta}>
                      <span style={S.project}>{current.project_label}</span>
                      {current.git_branch ? <span style={S.branch}>{current.git_branch}</span> : null}
                      <span>{current.turn_count} steps</span>
                      <span>{current.ended_at ? 'finished' : 'in progress'}</span>
                    </div>
                  </div>

                  <div style={S.shareBar}>
                    <div style={S.shareLabel}>Share with</div>
                    <ShareChips
                      members={members ?? []}
                      activeIds={sharesBySession.get(current.id) ?? new Set()}
                      inheritedIds={sharesByProject.get(current.project_key) ?? new Set()}
                      pending={toggleSessionShare.isPending}
                      onToggle={(profileId, on) =>
                        toggleSessionShare.mutate({ keyValue: current.id, profileId, on })
                      }
                    />
                  </div>

                  <p style={S.previewNote}>
                    This is exactly what a shared member sees — same component, same data.
                  </p>

                  {turnsLoading && !turns?.length ? (
                    <p style={S.loading}>Loading transcript…</p>
                  ) : (
                    <SessionTranscript turns={turns} />
                  )}
                </>
              ) : (
                <p style={S.loading}>Select a session.</p>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </>
  )
}

const S = {
  page: { maxWidth: 1140, margin: '0 auto', padding: '28px 20px 80px' },

  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 20,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  h1: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 36,
    color: 'var(--tx)',
    margin: '0 0 6px',
  },
  sub: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body)',
    color: 'var(--tx2)',
    margin: 0,
    maxWidth: 560,
    lineHeight: 1.6,
  },
  linkBtn: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    fontWeight: 600,
    color: 'var(--pkd)',
    textDecoration: 'none',
    border: '1px solid var(--pkb)',
    borderRadius: 24,
    padding: '8px 16px',
    whiteSpace: 'nowrap',
  },

  projectPanel: {
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    marginBottom: 20,
  },
  disclosure: {
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '12px 16px',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    fontWeight: 600,
    color: 'var(--tx)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  disclosureNote: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    fontWeight: 400,
    color: 'var(--gy)',
  },
  projectBody: { padding: '0 16px 14px', borderTop: '1px solid var(--bd)' },
  projectHint: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    color: 'var(--tx2)',
    lineHeight: 1.6,
    margin: '12px 0 14px',
    maxWidth: 620,
  },
  projectRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    padding: '10px 0',
    borderTop: '1px solid var(--bd)',
  },
  projectLabel: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    fontWeight: 600,
    color: 'var(--tx)',
  },
  projectKey: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    color: 'var(--gy)',
    overflowWrap: 'anywhere',
  },

  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    padding: '6px 12px',
    borderRadius: 24,
    border: '1px solid var(--bd)',
    background: '#fff',
    color: 'var(--tx2)',
    cursor: 'pointer',
  },
  chipOn: {
    background: 'var(--pk)',
    borderColor: 'var(--pk)',
    color: '#fff',
    fontWeight: 600,
  },
  chipInherited: {
    background: 'var(--bgp)',
    borderColor: 'var(--pkb)',
    color: 'var(--pkd)',
    cursor: 'not-allowed',
  },

  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(240px, 300px) 1fr',
    gap: 24,
    alignItems: 'start',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', top: 20 },

  card: {
    display: 'block',
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: '12px 14px',
    textDecoration: 'none',
  },
  cardActive: { borderColor: 'var(--pkbs)', background: 'var(--bgp)' },
  cardTitle: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    fontWeight: 600,
    color: 'var(--tx)',
    marginBottom: 6,
    lineHeight: 1.4,
  },
  cardMeta: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    color: 'var(--gy)',
    marginTop: 2,
  },
  project: { color: 'var(--tx2)' },
  branch: { color: 'var(--pkd)' },
  sharedTag: { color: 'var(--pkd)' },
  privateTag: { color: 'var(--gy)' },

  detail: { minWidth: 0 },
  detailHead: { marginBottom: 12 },
  h2: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 28,
    color: 'var(--tx)',
    margin: '0 0 6px',
    lineHeight: 1.25,
  },
  detailMeta: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    color: 'var(--gy)',
  },

  shareBar: {
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 10,
    display: 'flex',
    gap: 14,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  shareLabel: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--tx2)',
  },
  previewNote: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    color: 'var(--gy)',
    margin: '0 0 14px',
  },

  loading: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    color: 'var(--tx2)',
  },

  emptyShelf: {
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: '28px 24px',
    maxWidth: 620,
  },
  emptyTitle: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 28,
    color: 'var(--tx)',
    margin: '0 0 8px',
  },
  emptyBody: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    color: 'var(--tx2)',
    margin: 0,
    lineHeight: 1.7,
  },
  code: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    background: 'var(--bgp)',
    padding: '1px 5px',
    borderRadius: 4,
  },

  errorBox: {
    background: 'var(--err-bg)',
    border: '1px solid var(--err-bd)',
    color: 'var(--err-tx)',
    borderRadius: 12,
    padding: '12px 16px',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    marginBottom: 16,
  },
}
