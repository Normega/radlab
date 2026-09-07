import { useEffect, useState } from 'react'
import { useOutletContext, useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AcademicShell } from '../AcademicChrome'
import AvatarMenu from '../fieldguide/AvatarMenu'
import { loungePath } from '../courseRoutes'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const ACT = { mood: 'Mood', pacing: 'Pacing', prompt: 'Prompt', quiz: 'Quiz', question_box: 'Question box' }

// Study 5 prototype — "instrument a lecture from its own slides".
//
// A PARALLEL surface, deliberately: it reads a deck, proposes a run of show,
// and shows it beside whatever is already planned for that lecture. It saves
// nothing. Norm's real L1 run of show is live and Wednesday is a real
// lecture; a prototype that could touch it would be a liability, not a demo.
// If the shape proves out, per-item "add to planner" is the next increment.
export default function RunOfShowProposal() {
  const classInfo = useOutletContext()
  const { courseCode } = useParams()
  const slug = String(courseCode ?? '').toLowerCase()

  const [deck, setDeck] = useState('L1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [existing, setExisting] = useState([])
  const [session, setSession] = useState(null)

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)) }, [])

  // What is already planned for the lecture whose number matches this deck —
  // the comparison is the whole point of the exercise.
  useEffect(() => {
    if (!classInfo) return
    const n = Number(deck.replace(/\D/g, ''))
    let cancelled = false
    ;(async () => {
      const { data: lectures } = await supabase
        .from('lectures').select('id, number, title, checkins(position, kind, status, config)')
        .eq('class_id', classInfo.id)
      const lec = (lectures ?? []).find(l => Number(l.number) === n)
        ?? (lectures ?? []).sort((a, b) => (a.number ?? 0) - (b.number ?? 0))[n - 1]
      if (!cancelled) {
        setExisting([...(lec?.checkins ?? [])].sort((a, b) => a.position - b.position))
      }
    })()
    return () => { cancelled = true }
  }, [classInfo?.id, deck]) // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setBusy(true); setError(null); setResult(null)
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const rsp = await fetch('/api/lounge-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token ?? ''}` },
        body: JSON.stringify({ action: 'propose', slug, deck }),
      })
      const out = await rsp.json().catch(() => ({}))
      if (!rsp.ok) { setError(out.error ?? 'Could not generate a proposal.'); setBusy(false); return }
      setResult(out)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const decks = ['L1','L2','L3','L4','L5','L6','L7','L8','L9','L10','L11','L12']

  return (
    <AcademicShell courseCode={slug} homeTo={loungePath(slug)} area="Lecture Lounge"
      menu={session ? <AvatarMenu email={session.user.email} courseCode={slug} /> : null}>
      <div style={S.wrap}>
        <p style={S.eyebrow}>Prototype · run of show from a deck</p>
        <h1 style={S.h1}>Instrument a lecture from its own slides</h1>
        <p style={S.sub}>
          Reads the deck, proposes where the check-ins go and what they ask. <strong>Nothing is
          saved</strong> — this page cannot change your planned check-ins. It exists to be
          compared against what you built by hand.
        </p>

        <div style={S.controls}>
          <select value={deck} onChange={e => setDeck(e.target.value)} style={S.select}>
            {decks.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button style={S.btn} onClick={generate} disabled={busy}>
            {busy ? 'Reading the deck…' : 'Propose a run of show'}
          </button>
          <Link to={`${loungePath(slug)}/console`} style={S.back}>← console</Link>
        </div>
        {error && <p style={S.error}>{error}</p>}

        <div style={S.cols}>
          <div style={S.col}>
            <p style={S.colHead}>Proposed</p>
            {!result ? (
              <p style={S.hint}>{busy ? 'Thinking…' : 'Pick a deck and press the button.'}</p>
            ) : (
              <>
                <p style={S.reading}>{result.proposal.reading}</p>
                <p style={S.meta}>{result.slides} slides read</p>
                {result.proposal.items.map((it, i) => (
                  <div key={i} style={S.card}>
                    <div style={S.cardTop}>
                      <span style={S.pos}>#{it.position}</span>
                      <span style={S.acts}>{(it.activities ?? []).map(a => ACT[a] ?? a).join(' → ')}</span>
                    </div>
                    <p style={S.after}>after slide {it.after_slide} · {it.slide_title}</p>
                    {it.prompt_text && <p style={S.prompt}>“{it.prompt_text}”</p>}
                    {(it.quiz_items ?? []).map((q, j) => (
                      <div key={j} style={S.quiz}>
                        <p style={S.quizQ}>{q.text}</p>
                        <p style={S.quizO}>{(q.options ?? []).join(' · ')}</p>
                        {!q.has_right_answer && <p style={S.noKey}>no right answer — the split is the point</p>}
                      </div>
                    ))}
                    <p style={S.why}>{it.rationale}</p>
                  </div>
                ))}
                {result.proposal.weekly && (
                  <div style={{ ...S.card, borderColor: 'var(--pk)' }}>
                    <div style={S.cardTop}><span style={S.pos}>wall</span><span style={S.acts}>Question of the week</span></div>
                    <p style={S.prompt}>“{result.proposal.weekly.prompt_text}”</p>
                    <p style={S.why}>{result.proposal.weekly.rationale}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={S.col}>
            <p style={S.colHead}>Already planned ({deck})</p>
            {!existing.length ? (
              <p style={S.hint}>Nothing planned for this lecture.</p>
            ) : existing.map((c, i) => (
              <div key={i} style={{ ...S.card, background: 'var(--bg)' }}>
                <div style={S.cardTop}>
                  <span style={S.pos}>{c.kind === 'weekly' ? 'wall' : `#${c.position}`}</span>
                  <span style={S.acts}>{(c.config?.activities ?? []).map(a => ACT[a] ?? a).join(' → ')}</span>
                  <span style={S.status}>{c.status}</span>
                </div>
                {c.config?.prompt_text && <p style={S.prompt}>“{c.config.prompt_text}”</p>}
                {(c.config?.quiz_items ?? []).map((q, j) => <p key={j} style={S.quizQ}>{q.text}</p>)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AcademicShell>
  )
}

const S = {
  wrap: { maxWidth: 980, margin: '0 auto', padding: '4px 4px 60px' },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--pk)' },
  h1: { fontFamily: SERIF, fontSize: 27, color: 'var(--tx)', margin: '4px 0 8px' },
  sub: { fontSize: 14.5, color: 'var(--tx2)', lineHeight: 1.55, maxWidth: '62ch' },
  controls: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '18px 0 6px' },
  select: { fontSize: 15, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)' },
  btn: { fontSize: 15, fontWeight: 600, padding: '10px 20px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  back: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', textDecoration: 'none' },
  error: { fontSize: 14, color: '#c04a4a', background: '#fdecec', border: '1px solid #f3b8b8', borderRadius: 10, padding: '10px 14px', margin: '10px 0' },
  cols: { display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 18, alignItems: 'flex-start' },
  col: { flex: '1 1 380px', minWidth: 300 },
  colHead: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--bd)' },
  hint: { fontSize: 14, color: 'var(--tx3)', padding: '16px 0' },
  reading: { fontSize: 14.5, color: 'var(--tx)', lineHeight: 1.5, fontStyle: 'italic', marginBottom: 6 },
  meta: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', marginBottom: 10 },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 },
  cardTop: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  pos: { fontFamily: MONO, fontSize: 11, color: 'var(--pk)', fontWeight: 700 },
  acts: { fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' },
  status: { fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', color: 'var(--tx3)' },
  after: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', margin: '0 0 6px' },
  prompt: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.45, margin: '4px 0' },
  quiz: { borderLeft: '2px solid var(--bd)', paddingLeft: 10, margin: '8px 0' },
  quizQ: { fontSize: 13.5, color: 'var(--tx)', lineHeight: 1.4, margin: '0 0 2px' },
  quizO: { fontFamily: MONO, fontSize: 11.5, color: 'var(--tx2)', margin: 0 },
  noKey: { fontFamily: MONO, fontSize: 10.5, color: 'var(--pk)', margin: '2px 0 0' },
  why: { fontSize: 12.5, color: 'var(--tx2)', fontStyle: 'italic', lineHeight: 1.4, marginTop: 6 },
}
