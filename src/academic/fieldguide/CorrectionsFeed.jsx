import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useWikiBase, useCoursePaths } from './wiki/useWikiBase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The audit feed that auto-apply corrections are traded against (WP6 Phase D).
// Every staff edit is a job-less accepted version carrying a required note;
// this page is that trail, newest first. Revert is deliberate work, not a
// button: open the page's history, re-save the prior body — a revert is itself
// a correction and gets its own note.
export default function CorrectionsFeed() {
  const WIKI_BASE = useWikiBase()
  const paths = useCoursePaths()
  const { courseClient } = useOutletContext()
  const [rows, setRows] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let live = true
    courseClient.from('corrections_feed').select('*').limit(200)
      .then(({ data, error }) => {
        if (!live) return
        if (error) { setNotice(error.message); setRows([]); return }
        setRows(data ?? [])
      })
    return () => { live = false }
  }, [courseClient])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <p style={S.eyebrow}><Link to={paths.home} style={S.eyebrowLink}>Field Guide</Link></p>
        <h1 style={S.title}>Corrections</h1>
        <p style={S.sub}>
          Every staff edit, newest first: who, what page, which version, and the required note saying
          why. Corrections apply immediately; this feed is the review. A numeric change past the
          tripwire carries its <em>verified against source</em> statement in the note.
        </p>

        {rows === null && <p style={{ ...S.sub, marginTop: 20 }}>Loading…</p>}
        {rows !== null && rows.length === 0 && (
          <p style={{ ...S.sub, marginTop: 24 }}>No corrections recorded yet.</p>
        )}

        {rows?.map(r => (
          <article key={r.version_id} style={S.card}>
            <div style={S.head}>
              <Link to={`${WIKI_BASE}/${r.slug}`} style={S.slug}>{r.slug}</Link>
              <span style={S.meta}>
                v{r.version} · {r.editor} · {new Date(r.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <p style={S.note}>{r.note}</p>
          </article>
        ))}

        {notice && <p style={S.notice}>{notice}</p>}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  eyebrowLink: { color: 'inherit', textDecoration: 'none' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 680 },
  notice: { color: 'var(--pk)', marginTop: 14, fontFamily: MONO, fontSize: 14 },

  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 14px', marginTop: 10 },
  head: { display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' },
  slug: { fontFamily: MONO, fontSize: 14, color: 'var(--pk)', textDecoration: 'none' },
  meta: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', marginLeft: 'auto' },
  note: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.55, margin: '6px 0 0', whiteSpace: 'pre-wrap' },
}
