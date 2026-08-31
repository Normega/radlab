import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { normalizeCourseCode, loungePath } from '../courseRoutes'
import Nav from '../../components/Nav'
import RippleAvatar from '../../ripple/RippleAvatar'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Question of the Week wall. Everything sensitive is decided server-side by
// get_weekly_wall(): while the check-in is open, `responses` comes back null
// until the caller's own answer is in (answer-first — prevents anchoring);
// after close the wall is archive-open to all class members. Students never
// read checkin_responses directly, and avatar payloads carry no stable ids,
// so nothing on this page can connect a response to a person — or one
// person's responses to each other across weeks.
export default function WeeklyWall({ session }) {
  const { courseCode, slug: slugParam, checkinId } = useParams()
  const slug = normalizeCourseCode(courseCode ?? slugParam)
  const userId = session?.user?.id

  const [wall, setWall] = useState(undefined)      // undefined = loading
  const [wallError, setWallError] = useState(null)
  const [draft, setDraft] = useState('')
  const [draftSeeded, setDraftSeeded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [editing, setEditing] = useState(false)

  const fetchWall = useCallback(async () => {
    // .rpc() reports failure in `error`, it does not throw — check it.
    const { data, error } = await supabase.rpc('get_weekly_wall', { p_checkin_id: checkinId })
    if (error) { setWallError(error.message); setWall(null); return }
    setWallError(null)
    setWall(data)
  }, [checkinId])

  useEffect(() => { fetchWall() }, [fetchWall])

  // Seed the compose box with the existing answer exactly once — not on
  // every refetch, or a background refresh would clobber an edit in progress.
  useEffect(() => {
    if (wall && !draftSeeded) {
      setDraft(wall.my_response ?? '')
      setDraftSeeded(true)
    }
  }, [wall, draftSeeded])

  async function submit(e) {
    e.preventDefault()
    if (!draft.trim() || saving) return
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase
      .from('checkin_responses')
      .upsert({
        checkin_id: checkinId,
        profile_id: userId,
        prompt_response: draft.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'checkin_id,profile_id' })
    if (error) { setSaving(false); setSaveError(error.message); return }
    await supabase.rpc('award_checkin_points', { p_checkin_id: checkinId })
    setSaving(false)
    setEditing(false)
    fetchWall()
  }

  async function moderate(responseId, restore) {
    const { error } = await supabase.rpc('remove_wall_response', {
      p_response_id: responseId, p_restore: restore,
    })
    if (error) { setWallError(error.message); return }
    fetchWall()
  }

  if (wall === undefined) {
    return <Shell slug={slug} session={session}><p style={S.sub}>Loading…</p></Shell>
  }
  if (wall === null) {
    return (
      <Shell slug={slug} session={session}>
        <h1 style={S.title}>This wall isn't available.</h1>
        <p style={S.sub}>{wallError ?? 'It may not have opened yet.'}</p>
      </Shell>
    )
  }

  const open = wall.status === 'open'
  const answered = !!(wall.my_response && wall.my_response.trim())
  const showCompose = open && (!answered || editing)

  return (
    <Shell slug={slug} session={session}>
      <p style={S.eyebrow}>Question of the week</p>
      <h1 style={S.title}>{wall.prompt_text || 'This week’s question'}</h1>
      <p style={S.sub}>
        {open
          ? 'Open all week — answers are anonymous to everyone in the class.'
          : 'This week’s wall is closed, but stays here to look back on.'}
      </p>

      {showCompose && (
        <form onSubmit={submit} style={S.composeCard}>
          {!answered && wall.count > 0 && (
            <p style={S.gateNote}>
              {wall.count} {wall.count === 1 ? 'answer is' : 'answers are'} on the wall — add
              yours to see them.
            </p>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Your answer…"
            style={S.textarea}
            rows={4}
          />
          {saveError && <p style={S.error}>{saveError}</p>}
          <div style={S.composeRow}>
            <button type="submit" style={S.primaryBtn} disabled={saving || !draft.trim()}>
              {saving ? 'Posting…' : answered ? 'Update answer' : 'Post to the wall'}
            </button>
            {editing && (
              <button type="button" style={S.ghostBtn} onClick={() => { setEditing(false); setDraft(wall.my_response ?? '') }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {answered && open && !editing && (
        <p style={S.mineNote}>
          Your answer is on the wall.{' '}
          <button style={S.linkBtn} onClick={() => setEditing(true)}>Edit it</button>
          {' '}any time before the question closes.
        </p>
      )}

      {wall.responses === null ? (
        <div style={S.lockedCard}>
          <p style={S.lockedCount}>{wall.count}</p>
          <p style={S.sub}>
            {wall.count === 1 ? 'answer waiting' : 'answers waiting'} — post yours to unlock the wall.
          </p>
        </div>
      ) : (
        <div style={S.wallList}>
          {wall.responses.length === 0 && (
            <p style={S.sub}>No answers yet — yours could be the first.</p>
          )}
          {wall.responses.map((r) => (
            <div key={r.id} style={S.responseCard(r.mine, r.removed)}>
              <div style={S.avatarSlot}>
                <RippleAvatar
                  skinColor={r.avatar?.skin_color} eyeColor={r.avatar?.eye_color}
                  species={r.avatar?.species ?? 'human'} hairStyle={r.avatar?.hair_style ?? 'none'}
                  hairColor={r.avatar?.hair_color ?? '#784421'} size={40}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={S.responseText}>{r.text}</p>
                <div style={S.responseMetaRow}>
                  {r.mine && <span style={S.mineBadge}>you</span>}
                  {r.removed && <span style={S.removedBadge}>hidden from students</span>}
                  {wall.is_admin && (
                    <button style={S.linkBtnDanger} onClick={() => moderate(r.id, r.removed)}>
                      {r.removed ? 'Restore' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}

function Shell({ slug, session, children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={S.wrap}>
        <Link to={loungePath(slug)} style={S.backLink}>← back to class</Link>
        {children}
      </div>
    </div>
  )
}

const S = {
  wrap: { maxWidth: 560, margin: '0 auto', padding: '32px 20px 60px' },
  backLink: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 18 },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', marginBottom: 8, lineHeight: 1.25 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  composeCard: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 14, padding: '18px 18px', margin: '18px 0' },
  gateNote: { fontFamily: MONO, fontSize: 12, color: 'var(--pk)', marginBottom: 10 },
  textarea: {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
    border: '1px solid var(--bds)', fontSize: 15, fontFamily: 'inherit', resize: 'vertical',
  },
  composeRow: { display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' },
  primaryBtn: {
    padding: '10px 22px', borderRadius: 10, border: 'none', background: 'var(--pk)',
    color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  ghostBtn: {
    padding: '10px 16px', borderRadius: 10, border: '1px solid var(--bds)', background: 'transparent',
    color: 'var(--tx2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
  },
  linkBtn: { border: 'none', background: 'none', color: 'var(--pk)', fontSize: 14, cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' },
  linkBtnDanger: { border: 'none', background: 'none', color: '#c04a4a', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: MONO },
  mineNote: { fontSize: 14, color: 'var(--tx2)', margin: '14px 0' },
  lockedCard: {
    background: 'var(--bgc)', border: '1px dashed var(--bds)', borderRadius: 14,
    padding: '28px 20px', textAlign: 'center', marginTop: 18,
  },
  lockedCount: { fontFamily: SERIF, fontSize: 40, color: 'var(--pk)', marginBottom: 4 },
  wallList: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 },
  responseCard: (mine, removed) => ({
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: 'var(--bgc)', border: `1px solid ${mine ? 'var(--pkb)' : 'var(--bd)'}`,
    borderRadius: 12, padding: '12px 14px', opacity: removed ? 0.45 : 1,
  }),
  avatarSlot: { flexShrink: 0 },
  responseText: { fontSize: 14.5, color: 'var(--tx)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' },
  responseMetaRow: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 },
  mineBadge: { fontFamily: MONO, fontSize: 12, color: 'var(--pk)' },
  removedBadge: { fontFamily: MONO, fontSize: 12, color: '#c04a4a' },
  error: { fontSize: 14, color: '#c04a4a', marginTop: 8 },
}
