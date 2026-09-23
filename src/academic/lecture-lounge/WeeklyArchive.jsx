import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { normalizeCourseCode, loungePath } from '../courseRoutes'
import { courseFeatures } from '../courseFeatures'
import { AcademicShell } from '../AcademicChrome'
import AvatarMenu from '../fieldguide/AvatarMenu'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Every Question of the Week, and every weekly quiz — one component, two
// modes (Norm, 2026-09-13).
//
// The lounge cards each surface ONE item, which is right for a lobby and
// wrong for a term: the moment week 2 opens, week 1 vanishes from the
// interface while staying answerable in the database until the midterm. The
// syllabus promises a grace week and a 75% late tier, and 131 of 212 students
// had not finished Quiz 1 when this was written — so the policy was real and
// the interface was about to start contradicting it. This page is where the
// promise becomes visible.
//
// Both modes share a shell and a tile because the difference between them is
// four lines of copy; splitting them would mean fixing the same layout twice.
export default function WeeklyArchive({ session, mode }) {
  const { courseCode, slug: slugParam } = useParams()
  const slug = normalizeCourseCode(courseCode ?? slugParam)
  const isQuiz = mode === 'quiz'
  const graded = courseFeatures(slug).quizGraded

  const [rows, setRows] = useState(undefined)   // undefined = loading
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: cls } = await supabase.rpc('class_public_info', { p_slug: slug })
      if (cancelled) return
      if (!cls?.id) { setError('No class at this address.'); setRows([]); return }
      // .rpc reports failure in `error`, it does not throw — check it.
      const { data, error: rpcErr } = await supabase.rpc(
        isQuiz ? 'get_weekly_quizzes' : 'get_weekly_walls', { p_class_id: cls.id })
      if (cancelled) return
      if (rpcErr) { setError(rpcErr.message); setRows([]); return }
      setRows(data ?? [])
    })()
    return () => { cancelled = true }
  }, [slug, isQuiz])

  const title = isQuiz ? (graded ? 'Weekly quizzes' : 'Practice quizzes') : 'Questions of the week'
  const blurb = isQuiz && !graded
    ? 'Every practice quiz that has opened. They are not graded — they are there to rehearse for the term test, and each stays open until the test.'
    : isQuiz
    ? 'Every quiz that has opened. They stay answerable long after their due date — full credit for a further week, then 75% until the midterm — so a week you missed is still worth doing.'
    : 'Every question the class has been asked. Answer one and you see the whole class’s wall; earlier weeks stay open to read even after they close.'

  return (
    <AcademicShell courseCode={slug} homeTo={loungePath(slug)}
                   menu={session ? <AvatarMenu email={session.user.email} courseCode={slug} /> : null}>
      <div style={S.wrap}>
        <Link to={loungePath(slug)} style={S.backLink}>← back to class</Link>
        <p style={S.eyebrow}>{isQuiz ? 'Quizzes' : 'Question of the week'}</p>
        <h1 style={S.title}>{title}</h1>
        <p style={S.sub}>{blurb}</p>

        {rows === undefined && <p style={{ ...S.sub, marginTop: 22 }}>Loading…</p>}
        {error && <p style={S.error}>{error}</p>}

        {rows && rows.length === 0 && !error && (
          <p style={{ ...S.sub, marginTop: 22 }}>
            {isQuiz ? 'No quiz has opened yet.' : 'No question has been posted yet.'}{' '}
            They appear here after each lecture.
          </p>
        )}

        <div style={S.grid}>
          {(rows ?? []).map(r => (isQuiz ? <QuizTile key={r.id} q={r} slug={slug} graded={graded} />
                                         : <WallTile key={r.id} w={r} slug={slug} />))}
        </div>
      </div>
    </AcademicShell>
  )
}

function QuizTile({ q, slug, graded }) {
  const now = Date.now()
  const due = new Date(q.due_at).getTime()
  const grace = due + 7 * 86400_000
  const close = new Date(q.hard_close_at).getTime()
  const done = !!q.completed_at

  // The state a student needs is "can I still get full marks", not a date.
  let status, tone
  if (done) { status = `Completed ${fmt(q.completed_at)}`; tone = S.done }
  else if (now > close) { status = 'Closed'; tone = S.shut }
  else if (!graded) { status = `Practice · open until ${fmt(q.hard_close_at)}`; tone = S.live }
  else if (now <= due) { status = `Due ${fmt(q.due_at)}`; tone = S.live }
  else if (now <= grace) { status = `Grace week — still full credit until ${fmtMs(grace)}`; tone = S.live }
  else { status = `Late — 75% credit until ${fmt(q.hard_close_at)}`; tone = S.late }

  const progress = done ? `${q.total} of ${q.total}` : `${q.answered} of ${q.total} answered`
  const shut = now > close && !done

  const body = (
    <>
      <p style={S.tileEyebrow}>Week {q.week_no}</p>
      <p style={S.tileTitle}>{q.title}</p>
      <p style={tone}>{status}</p>
      <p style={S.tileMeta}>{progress}</p>
    </>
  )
  return shut ? <div style={{ ...S.tile, opacity: 0.6 }}>{body}</div>
              : <Link to={`${loungePath(slug)}/quiz/${q.id}`} style={S.tile}>{body}</Link>
}

function WallTile({ w, slug }) {
  const open = w.status === 'open'
  const meta = w.answered
    ? `You answered · ${w.count} on the wall`
    : open
      ? (w.count ? `${w.count} answered — add yours to see them` : 'Be the first to answer')
      : `${w.count} answered — read the wall`
  return (
    <Link to={`${loungePath(slug)}/wall/${w.id}`} style={S.tile}>
      <p style={S.tileEyebrow}>{fmt(w.opened_at)}{open ? ' · open' : ''}</p>
      <p style={S.tileTitle}>{w.prompt || 'This week’s question'}</p>
      <p style={w.answered ? S.done : open ? S.live : S.tileMeta}>{meta}</p>
    </Link>
  )
}

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-CA',
  { month: 'short', day: 'numeric', timeZone: 'America/Toronto' }) : ''
const fmtMs = (ms) => fmt(new Date(ms).toISOString())

const S = {
  wrap: { maxWidth: 760, margin: '0 auto', padding: '32px 20px 60px' },
  backLink: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 18 },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', marginBottom: 8, lineHeight: 1.25 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.55, maxWidth: '62ch' },
  error: { color: '#c04a4a', fontSize: 14, marginTop: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12, marginTop: 22 },
  tile: {
    display: 'block', textDecoration: 'none', textAlign: 'left',
    background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 14, padding: '15px 18px',
  },
  tileEyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  tileTitle: { fontFamily: SERIF, fontSize: 17, color: 'var(--tx)', lineHeight: 1.35, marginBottom: 8 },
  tileMeta: { fontFamily: MONO, fontSize: 11.5, color: 'var(--tx2)' },
  live: { fontFamily: MONO, fontSize: 11.5, color: 'var(--pk)' },
  done: { fontFamily: MONO, fontSize: 11.5, color: '#2e7d32' },
  late: { fontFamily: MONO, fontSize: 11.5, color: '#b8860b' },
  shut: { fontFamily: MONO, fontSize: 11.5, color: 'var(--tx3)' },
}
