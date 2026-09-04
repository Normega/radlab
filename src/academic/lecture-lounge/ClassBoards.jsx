import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { normalizeCourseCode, loungePath } from '../courseRoutes'
import Nav from '../../components/Nav'
import RippleAvatar from '../../ripple/RippleAvatar'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Discussion boards: two per class (Content, Technical & evaluation).
// Students open threads; only class staff can reply — enforced by RLS on
// board_replies, the composer here is just honest about it. Reads follow the
// weekly wall's privacy architecture: get_board_threads / get_board_thread
// return anonymous avatars, a `mine` flag and a derived staff label, never
// author ids — so nothing on this page can connect a thread to a person.
export default function ClassBoards({ session }) {
  const { courseCode, slug: slugParam, threadId } = useParams()
  const slug = normalizeCourseCode(courseCode ?? slugParam)
  const userId = session?.user?.id

  const [cls, setCls] = useState(undefined) // undefined = loading, null = not found
  const [boards, setBoards] = useState(null)
  const [boardsError, setBoardsError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: c } = await supabase.from('classes').select('id, slug, name').eq('slug', slug).maybeSingle()
      if (cancelled) return
      setCls(c ?? null)
      if (!c) return
      const { data, error } = await supabase.rpc('get_class_boards', { p_class_id: c.id })
      if (cancelled) return
      if (error) { setBoardsError(error.message); setBoards([]); return }
      setBoards(data ?? [])
    })()
    return () => { cancelled = true }
  }, [slug])

  if (cls === undefined) return <Shell slug={slug} session={session}><p style={S.sub}>Loading…</p></Shell>
  if (cls === null) return <Shell slug={slug} session={session}><p style={S.sub}>No class here.</p></Shell>

  return (
    <Shell slug={slug} session={session} title={cls.name}>
      {boardsError && (
        <p style={S.sub}>
          {boardsError.includes('not a member')
            ? <>Boards are for class members — <Link to={loungePath(slug)} style={S.link}>join the class</Link> first.</>
            : boardsError}
        </p>
      )}
      {boards && !boardsError && (threadId
        ? <ThreadView threadId={threadId} slug={slug} userId={userId} />
        : <BoardsView boards={boards} slug={slug} userId={userId} />)}
    </Shell>
  )
}

function BoardsView({ boards, slug, userId }) {
  const [activeKey, setActiveKey] = useState('content')
  const board = boards.find((b) => b.key === activeKey) ?? boards[0]

  const [data, setData] = useState(undefined)
  const [listError, setListError] = useState(null)
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    if (!board) return
    const { data: d, error } = await supabase.rpc('get_board_threads', { p_board_id: board.id })
    if (error) { setListError(error.message); setData(null); return }
    setListError(null)
    setData(d)
  }, [board?.id])

  useEffect(() => { setData(undefined); load() }, [load])

  const submitThread = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    const { data: row, error } = await supabase
      .from('board_threads')
      .insert({ board_id: board.id, author_id: userId, title: title.trim(), body: body.trim() })
      .select('id')
      .single()
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    navigate(`${loungePath(slug)}/boards/${row.id}`)
  }

  if (!board) return <p style={S.sub}>This class has no discussion boards.</p>

  return (
    <>
      <div style={S.tabRow}>
        {boards.map((b) => (
          <button key={b.key} style={S.tab(b.key === board.key)} onClick={() => setActiveKey(b.key)}>
            {b.title}
            <span style={S.tabCount}>{b.threads}</span>
          </button>
        ))}
      </div>
      <p style={S.blurb}>{board.blurb}</p>
      <p style={S.staffNote}>Anyone in the class can ask; a TA or the instructor answers. Posts show your class avatar, not your name.</p>

      {!composing ? (
        <button style={S.primaryBtn} onClick={() => setComposing(true)}>Ask a question</button>
      ) : (
        <form onSubmit={submitThread} style={S.composeCard}>
          <input
            style={S.titleInput}
            placeholder="One-line question"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
          <textarea
            style={S.bodyInput}
            placeholder="The details — what you tried, where you're stuck, what the slide or page says…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
          />
          {saveError && <p style={S.error}>{saveError}</p>}
          <div style={S.composeRow}>
            <button type="submit" style={S.primaryBtn} disabled={saving || !title.trim() || !body.trim()}>
              {saving ? 'Posting…' : 'Post question'}
            </button>
            <button type="button" style={S.ghostBtn} onClick={() => setComposing(false)}>Cancel</button>
          </div>
        </form>
      )}

      {listError && <p style={S.error}>{listError}</p>}
      {data === undefined && <p style={S.sub}>Loading threads…</p>}
      {data && data.threads.length === 0 && (
        <p style={{ ...S.sub, marginTop: 18 }}>No questions yet — yours could be the first.</p>
      )}
      {data && data.threads.map((t) => (
        <Link key={t.id} to={`${loungePath(slug)}/boards/${t.id}`} style={S.threadCard(t.mine, t.removed)}>
          <div style={S.avatarSlot}>
            <RippleAvatar
              skinColor={t.avatar?.skin_color} eyeColor={t.avatar?.eye_color}
              species={t.avatar?.species ?? 'human'} hairStyle={t.avatar?.hair_style ?? 'none'}
              hairColor={t.avatar?.hair_color ?? '#784421'} size={34}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={S.threadTitle}>{t.pinned && <span style={S.pin}>pinned · </span>}{t.title}</p>
            <div style={S.metaRow}>
              {t.answered
                ? <span style={S.answeredChip}>answered</span>
                : <span style={S.openChip}>awaiting answer</span>}
              {t.staff && <span style={S.staffBadge}>{t.staff === 'instructor' ? 'Instructor' : 'TA'}</span>}
              {t.mine && <span style={S.mineBadge}>you</span>}
              {t.removed && <span style={S.removedBadge}>hidden from students</span>}
              {t.closed && <span style={S.closedBadge}>closed</span>}
              <span style={S.metaText}>{t.replies} {t.replies === 1 ? 'reply' : 'replies'}</span>
            </div>
          </div>
        </Link>
      ))}
    </>
  )
}

function ThreadView({ threadId, slug, userId }) {
  const [thread, setThread] = useState(undefined)
  const [err, setErr] = useState(null)
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_board_thread', { p_thread_id: threadId })
    if (error) { setErr(error.message); setThread(null); return }
    setErr(null)
    setThread(data)
  }, [threadId])

  useEffect(() => { load() }, [load])

  const submitReply = async (e) => {
    e.preventDefault()
    setSaving(true)
    setActionError(null)
    const { error } = await supabase
      .from('board_replies')
      .insert({ thread_id: threadId, author_id: userId, body: reply.trim() })
    setSaving(false)
    if (error) { setActionError(error.message); return }
    setReply('')
    load()
  }

  // Admin thread controls all go through the same direct-update path the RLS
  // "admins all" policy covers; each reloads so the RPC view stays canonical.
  const setThreadField = async (patch) => {
    setActionError(null)
    const { error } = await supabase.from('board_threads').update(patch).eq('id', threadId)
    if (error) { setActionError(error.message); return }
    load()
  }
  const setReplyRemoved = async (replyId, removed) => {
    setActionError(null)
    const { error } = await supabase.from('board_replies')
      .update({ removed_at: removed ? new Date().toISOString() : null }).eq('id', replyId)
    if (error) { setActionError(error.message); return }
    load()
  }

  if (thread === undefined) return <p style={S.sub}>Loading…</p>
  if (thread === null) return <p style={S.sub}>{err ?? 'Thread not found.'}</p>

  return (
    <>
      <p style={S.backRow}><Link to={`${loungePath(slug)}/boards`} style={S.link}>← All questions</Link></p>

      <div style={S.threadHead}>
        <div style={S.avatarSlot}>
          <RippleAvatar
            skinColor={thread.avatar?.skin_color} eyeColor={thread.avatar?.eye_color}
            species={thread.avatar?.species ?? 'human'} hairStyle={thread.avatar?.hair_style ?? 'none'}
            hairColor={thread.avatar?.hair_color ?? '#784421'} size={40}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={S.threadH1}>{thread.title}</h1>
          <p style={S.threadBody}>{thread.body}</p>
          <div style={S.metaRow}>
            {thread.staff && <span style={S.staffBadge}>{thread.staff === 'instructor' ? 'Instructor' : 'TA'}</span>}
            {thread.mine && <span style={S.mineBadge}>you</span>}
            {thread.removed && <span style={S.removedBadge}>hidden from students</span>}
            {thread.closed && <span style={S.closedBadge}>closed</span>}
            {thread.is_admin && (
              <>
                <button style={S.linkBtn} onClick={() => setThreadField({ pinned: !thread.pinned })}>
                  {thread.pinned ? 'Unpin' : 'Pin'}
                </button>
                <button style={S.linkBtn} onClick={() => setThreadField({ closed_at: thread.closed ? null : new Date().toISOString() })}>
                  {thread.closed ? 'Reopen' : 'Close'}
                </button>
                <button style={S.linkBtnDanger} onClick={() => setThreadField({ removed_at: thread.removed ? null : new Date().toISOString() })}>
                  {thread.removed ? 'Restore' : 'Remove'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {thread.replies.length === 0 && (
        <p style={{ ...S.sub, marginTop: 16 }}>No answer yet — a TA or the instructor will reply here.</p>
      )}
      {thread.replies.map((r) => (
        <div key={r.id} style={S.replyCard(r.removed)}>
          <div style={S.avatarSlot}>
            <RippleAvatar
              skinColor={r.avatar?.skin_color} eyeColor={r.avatar?.eye_color}
              species={r.avatar?.species ?? 'human'} hairStyle={r.avatar?.hair_style ?? 'none'}
              hairColor={r.avatar?.hair_color ?? '#784421'} size={34}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={S.replyBody}>{r.body}</p>
            <div style={S.metaRow}>
              <span style={S.staffBadge}>{r.staff === 'instructor' ? 'Instructor' : 'TA'}</span>
              {r.mine && <span style={S.mineBadge}>you</span>}
              {r.removed && <span style={S.removedBadge}>hidden from students</span>}
              {thread.is_admin && (
                <button style={S.linkBtnDanger} onClick={() => setReplyRemoved(r.id, !r.removed)}>
                  {r.removed ? 'Restore' : 'Remove'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {actionError && <p style={S.error}>{actionError}</p>}

      {thread.is_admin ? (
        <form onSubmit={submitReply} style={S.composeCard}>
          <textarea
            style={S.bodyInput}
            placeholder="Answer as course staff — your reply is badged, not named"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
          />
          <div style={S.composeRow}>
            <button type="submit" style={S.primaryBtn} disabled={saving || !reply.trim()}>
              {saving ? 'Posting…' : 'Post answer'}
            </button>
          </div>
        </form>
      ) : (
        <p style={S.staffNote}>Only the instructor and TAs can answer here. Something to add? Bring it to lecture or the question box.</p>
      )}
    </>
  )
}

function Shell({ slug, session, title, children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>
        <p style={S.eyebrow}>
          <Link to={loungePath(slug)} style={S.eyebrowLink}>Lecture Lounge</Link> · discussion boards
        </p>
        {title && <h1 style={S.h1}>{title}</h1>}
        {children}
      </div>
    </div>
  )
}

const S = {
  wrap: { maxWidth: 720, margin: '0 auto', padding: '28px 16px 70px' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  eyebrowLink: { color: 'var(--pk)', textDecoration: 'none' },
  h1: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', margin: '0 0 14px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6 },
  link: { color: 'var(--pk)', textDecoration: 'none' },
  error: { fontSize: 13, color: '#c04a4a', marginTop: 8 },

  tabRow: { display: 'flex', gap: 8, marginTop: 4 },
  tab: (active) => ({
    fontFamily: MONO, fontSize: 13, padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--pk)' : 'var(--bd)'}`,
    background: active ? 'var(--bgp)' : 'var(--bgc)', color: active ? 'var(--pkd)' : 'var(--tx2)',
  }),
  tabCount: { marginLeft: 8, opacity: 0.7 },
  blurb: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, marginTop: 12 },
  staffNote: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)', marginTop: 6, marginBottom: 14 },

  primaryBtn: {
    fontFamily: MONO, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
    border: '1px solid var(--pk)', background: 'var(--pk)', color: '#fff',
  },
  ghostBtn: {
    fontFamily: MONO, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
    border: '1px solid var(--bd)', background: 'transparent', color: 'var(--tx2)',
  },
  composeCard: {
    display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14,
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '14px 16px',
  },
  composeRow: { display: 'flex', gap: 8 },
  titleInput: { padding: '9px 12px', borderRadius: 8, border: '1px solid var(--bds)', fontSize: 14, fontFamily: 'inherit' },
  bodyInput: { padding: '9px 12px', borderRadius: 8, border: '1px solid var(--bds)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' },

  threadCard: (mine, removed) => ({
    display: 'flex', gap: 12, alignItems: 'flex-start', textDecoration: 'none', marginTop: 10,
    background: 'var(--bgc)', border: `1px solid ${mine ? 'var(--pkb)' : 'var(--bd)'}`,
    borderRadius: 12, padding: '12px 14px', opacity: removed ? 0.55 : 1,
  }),
  threadTitle: { fontSize: 15, color: 'var(--tx)', lineHeight: 1.4, overflowWrap: 'break-word' },
  pin: { fontFamily: MONO, fontSize: 11, color: 'var(--pk)', textTransform: 'uppercase', letterSpacing: 1 },
  metaRow: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  metaText: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)' },
  answeredChip: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#1a8a4a', background: '#e5f7ee', borderRadius: 8, padding: '1px 8px' },
  openChip: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#b8760f', background: '#fdf2e5', borderRadius: 8, padding: '1px 8px' },
  staffBadge: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pkd)', background: 'var(--pkb)', borderRadius: 8, padding: '1px 8px' },
  mineBadge: { fontFamily: MONO, fontSize: 12, color: 'var(--pk)' },
  removedBadge: { fontFamily: MONO, fontSize: 12, color: '#c04a4a' },
  closedBadge: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)' },
  linkBtn: { fontFamily: MONO, fontSize: 12, color: 'var(--pk)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  linkBtnDanger: { fontFamily: MONO, fontSize: 12, color: '#c04a4a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },

  backRow: { marginBottom: 12 },
  threadHead: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 18px',
  },
  threadH1: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', lineHeight: 1.3, margin: 0 },
  threadBody: { fontSize: 14.5, color: 'var(--tx)', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', marginTop: 8 },
  replyCard: (removed) => ({
    display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 10, marginLeft: 22,
    background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 12, padding: '12px 14px',
    opacity: removed ? 0.55 : 1,
  }),
  replyBody: { fontSize: 14.5, color: 'var(--tx)', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' },
  avatarSlot: { flexShrink: 0 },
}
