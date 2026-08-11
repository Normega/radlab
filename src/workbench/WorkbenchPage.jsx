import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import SessionTranscript from './SessionTranscript'

// /workbench — what a lab member sees.
//
// There is no role filter anywhere in this file, and no "is this mine" check.
// Both queries are plain selects; RLS returns only sessions shared with the
// signed-in user (claude_session_shares, or a standing claude_project_shares rule
// covering the whole project). A member with nothing shared gets an empty array,
// not an error — the empty state below is the expected first experience, not a
// failure mode.
//
// Live updates are polling, not Realtime. The hook pushes at most every ~4s and a
// student reading a transcript is not watching a stopwatch; a 10s poll is within
// the noise, costs one indexed query, and cannot leave a stale socket holding a
// subscription open on a page someone left in a tab for three days.

const POLL_MS = 10_000

function useSharedSessions() {
  return useQuery({
    queryKey: ['workbench-sessions'],
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

function useSessionTurns(sessionId) {
  return useQuery({
    queryKey: ['workbench-turns', sessionId],
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

function relativeTime(iso) {
  if (!iso) return 'no activity yet'
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

function SessionCard({ session, active }) {
  const live = !session.ended_at
  return (
    <Link to={`/workbench/${session.id}`} style={{ ...S.card, ...(active ? S.cardActive : null) }}>
      <div style={S.cardTitle}>{session.title || 'Untitled session'}</div>
      <div style={S.cardMeta}>
        <span style={S.project}>{session.project_label || session.project_key}</span>
        {session.git_branch ? <span style={S.branch}>{session.git_branch}</span> : null}
      </div>
      <div style={S.cardMeta}>
        {live ? <span style={S.liveDot}>● live</span> : null}
        <span>{relativeTime(session.last_turn_at)}</span>
        <span>·</span>
        <span>{session.turn_count} steps</span>
      </div>
    </Link>
  )
}

export default function WorkbenchPage({ session: authSession }) {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { data: sessions, isLoading, error } = useSharedSessions()
  const { data: turns, isLoading: turnsLoading } = useSessionTurns(sessionId)

  // Land on the most recent session rather than an empty right-hand pane. Only
  // when nothing is selected — this must not fight a student who clicked away.
  useEffect(() => {
    if (!sessionId && sessions?.length) {
      navigate(`/workbench/${sessions[0].id}`, { replace: true })
    }
  }, [sessionId, sessions, navigate])

  const current = sessions?.find((s) => s.id === sessionId)

  return (
    <>
      <Nav session={authSession} />
      <main style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}>Workbench</h1>
          <p style={S.sub}>
            Sessions Norm has shared with you. These update while the work is happening —
            leave the page open and it will keep up.
          </p>
        </header>

        {error ? (
          <div style={S.errorBox}>Could not load sessions: {error.message}</div>
        ) : null}

        {isLoading ? <p style={S.loading}>Loading…</p> : null}

        {!isLoading && !sessions?.length ? (
          <div style={S.emptyShelf}>
            <p style={S.emptyTitle}>Nothing shared with you yet.</p>
            <p style={S.emptyBody}>
              When Norm shares a Claude Code session, it appears here — his prompts, what
              Claude worked through, and each step it took along the way. Nothing is shared
              by default.
            </p>
          </div>
        ) : null}

        {sessions?.length ? (
          <div style={S.split}>
            <nav style={S.list} aria-label="Shared sessions">
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} active={s.id === sessionId} />
              ))}
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
  page: { maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' },

  head: { marginBottom: 22 },
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
    maxWidth: 620,
    lineHeight: 1.6,
  },

  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 280px) 1fr',
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
  liveDot: { color: 'var(--pk)' },

  detail: { minWidth: 0 },
  detailHead: { marginBottom: 16 },
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
    maxWidth: 560,
  },
  emptyTitle: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 20,
    color: 'var(--tx)',
    margin: '0 0 8px',
  },
  emptyBody: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    color: 'var(--tx2)',
    margin: 0,
    lineHeight: 1.6,
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
