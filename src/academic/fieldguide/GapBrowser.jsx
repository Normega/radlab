import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Student gap browser (WP6 Phase B). The planning surface: where the Field
// Guide is thin, organized the way students think — by lecture week — so a
// research assignment can be scoped against what the course is actually doing.
//
// Everything comes from one rpc, gap_board(): a SECURITY DEFINER function,
// because "remaining capacity" counts every student's active claims and RLS
// (correctly) lets a student read only their own. The function returns counts,
// never names.
//
// Deliberate display decisions, each argued in the run plan (§38):
//   * remaining capacity, not capacity — a board that shows raw capacity looks
//     open when it is full.
//   * red gaps are DIMMED, not hidden — the map is honest about why a student
//     cannot take them (clinical instruction / legal standards are staff work),
//     and precheck blocks them server-side anyway.
//   * green is labelled as the first-assignment tier, claimable from ANY
//     lecture — pre-midterm weeks hold only 38 greens for ~200 students, so
//     steering students to "taught so far" would starve the board.
const DIFF = {
  green: { colour: '#2e7d32', label: 'green', hint: 'scaffolded — good first gap' },
  amber: { colour: '#b8860b', label: 'amber', hint: 'standard' },
  red:   { colour: '#c0392b', label: 'red',   hint: 'staff only' },
}

const fmtDate = d => d
  ? new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  : ''

export default function GapBrowser() {
  const { courseClient } = useOutletContext()
  const [rows, setRows] = useState(null)        // null = loading
  const [notice, setNotice] = useState(null)
  const [diff, setDiff] = useState('all')       // all | green | amber
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(() => new Set())

  useEffect(() => {
    let live = true
    courseClient.rpc('gap_board').then(({ data, error }) => {
      if (!live) return
      if (error) { setNotice(error.message); setRows([]); return }
      setRows(data ?? [])
    })
    return () => { live = false }
  }, [courseClient])

  const needle = q.trim().toLowerCase()

  const lectures = useMemo(() => {
    if (!rows) return []
    const filtered = rows.filter(r => {
      if (diff === 'green' && r.difficulty !== 'green') return false
      if (diff === 'amber' && r.difficulty !== 'amber') return false
      if (!needle) return true
      return (r.ask + ' ' + r.slug + ' ' + (r.page_title ?? '')).toLowerCase().includes(needle)
    })
    const byLecture = new Map()
    for (const r of filtered) {
      if (!byLecture.has(r.lecture_no)) {
        byLecture.set(r.lecture_no, {
          lecture_no: r.lecture_no, meeting_date: r.meeting_date,
          lecture_title: r.lecture_title, items: [],
        })
      }
      byLecture.get(r.lecture_no).items.push(r)
    }
    return [...byLecture.values()].sort((a, b) => a.lecture_no - b.lecture_no)
  }, [rows, diff, needle])

  const totals = useMemo(() => {
    if (!rows) return null
    const claimable = rows.filter(r => r.difficulty !== 'red')
    return {
      gaps: rows.length,
      slotsOpen: claimable.reduce((n, r) => n + r.remaining, 0),
      greenOpen: claimable.filter(r => r.difficulty === 'green').reduce((n, r) => n + r.remaining, 0),
    }
  }, [rows])

  // Search or a difficulty filter means the student is hunting, not browsing —
  // auto-expand whatever survives the filter so matches are visible.
  const hunting = needle.length > 0 || diff !== 'all'
  const isOpen = l => hunting || open.has(l.lecture_no)
  const toggle = n => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(n)) next.delete(n); else next.add(n)
    return next
  })

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <p style={S.eyebrow}>Field Guide</p>
        <h1 style={S.title}>Research gaps</h1>
        <p style={S.sub}>
          Every gap below is a place the Field Guide names its own missing evidence. Your assignment
          fills them: find a peer-reviewed source that answers the ask, report what it found — and
          what it <em>cannot</em> tell us. Start with a <strong style={{ color: DIFF.green.colour }}>green</strong> gap
          (due <strong>Oct 7</strong> — claim from <em>any</em> lecture, not just material covered so
          far). Amber submissions are due <strong>Nov 11</strong> and <strong>Nov 27</strong>.{' '}
          <span style={{ color: DIFF.red.colour }}>Red</span> gaps are staff-written — clinical or
          legal content — and shown so the map is complete, not because you can take them.
        </p>

        {totals && (
          <p style={{ ...S.sub, fontFamily: MONO, fontSize: 12 }}>
            {totals.gaps} gaps · {totals.slotsOpen} slots open · {totals.greenOpen} green slots open
          </p>
        )}

        <div style={S.controls}>
          {['all', 'green', 'amber'].map(k => (
            <button key={k} onClick={() => setDiff(k)}
                    style={{ ...S.pill, ...(diff === k ? S.pillOn : null) }}>
              {k}
            </button>
          ))}
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search asks, pages…" style={S.search}
          />
        </div>

        {rows === null && <p style={{ ...S.sub, marginTop: 20 }}>Loading…</p>}
        {rows !== null && lectures.length === 0 && (
          <p style={{ ...S.sub, marginTop: 24 }}>Nothing matches that filter.</p>
        )}

        {lectures.map(l => {
          const greens = l.items.filter(r => r.difficulty === 'green').length
          const slots = l.items.filter(r => r.difficulty !== 'red').reduce((n, r) => n + r.remaining, 0)
          return (
            <section key={l.lecture_no}>
              <button style={S.lectureHead} onClick={() => toggle(l.lecture_no)}>
                <span style={{ textAlign: 'left' }}>
                  <span style={S.lectureTitle}>
                    L{l.lecture_no} · {l.lecture_title}
                  </span>
                  <span style={S.metaLine}>
                    {fmtDate(l.meeting_date)} · {l.items.length} gaps · {slots} slots open
                    {greens > 0 ? ` · ${greens} green` : ''}
                  </span>
                </span>
                <span style={S.chev}>{isOpen(l) ? '▾' : '▸'}</span>
              </button>

              {isOpen(l) && l.items.map(r => {
                const d = DIFF[r.difficulty] ?? DIFF.amber
                const red = r.difficulty === 'red'
                const full = !red && r.remaining === 0
                return (
                  <article key={r.gap_id}
                           style={{ ...S.gap, opacity: red ? 0.55 : full ? 0.65 : 1 }}>
                    <div style={S.gapTop}>
                      <span style={{ ...S.badge, color: d.colour, border: `1px solid ${d.colour}` }}>
                        {d.label}
                      </span>
                      <a href={`/academic/fieldguide/wiki/${r.slug}${r.section ? `#${r.section}` : ''}`}
                         target="_blank" rel="noopener noreferrer" style={S.pageLink}>
                        {r.page_title ?? r.slug}{r.section ? ` › ${r.section}` : ''} ↗
                      </a>
                      <span style={S.capacity}>
                        {red ? 'staff only'
                          : full ? 'full'
                          : `${r.remaining} of ${r.capacity} open`}
                        {r.my_status ? ` · yours (${r.my_status})` : ''}
                      </span>
                    </div>
                    <p style={S.ask}>{r.ask}</p>
                  </article>
                )
              })}
            </section>
          )
        })}

        {rows !== null && (
          <p style={{ ...S.sub, marginTop: 28, fontSize: 13 }}>
            Claiming opens with the submission form. Until then, use this board to shortlist gaps and
            read the pages they sit on — the ask only makes sense in its section&apos;s context.
          </p>
        )}

        {notice && <p style={S.notice}>{notice}</p>}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6 },
  notice: { color: 'var(--pk)', marginTop: 14, fontFamily: MONO, fontSize: 13 },

  controls: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '14px 0 6px' },
  pill: { fontFamily: MONO, fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx2)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 },
  pillOn: { borderColor: 'var(--pk)', color: 'var(--pk)' },
  search: { flex: '1 1 200px', minWidth: 160, fontSize: 14, padding: '7px 12px', borderRadius: 20, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)' },

  lectureHead: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '14px 2px 6px', background: 'none', border: 'none', borderBottom: '1px solid var(--bd)', cursor: 'pointer', marginTop: 18 },
  lectureTitle: { display: 'block', fontFamily: SERIF, fontSize: 19, color: 'var(--tx)', textAlign: 'left' },
  metaLine: { display: 'block', fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', marginTop: 2, textAlign: 'left' },
  chev: { color: 'var(--tx2)', fontSize: 13, flexShrink: 0 },

  gap: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 14px', marginTop: 8 },
  gapTop: { display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' },
  badge: { fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, flexShrink: 0 },
  pageLink: { fontFamily: MONO, fontSize: 13, color: 'var(--pk)', overflowWrap: 'anywhere', textDecoration: 'none' },
  capacity: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', marginLeft: 'auto', flexShrink: 0 },
  ask: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.55, margin: '7px 0 0' },
}
