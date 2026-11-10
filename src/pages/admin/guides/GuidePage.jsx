import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DisplayMarkdown from '../../../components/study/DisplayMarkdown'
import { findGuide } from './guides'

const FONT = '"DM Sans",system-ui,sans-serif'
const FIGURE_LINE = /^::figure ([a-z0-9-]+)::$/

// A guide's markdown, split at its `::figure name::` lines into prose and figures.
function toBlocks(text) {
  const blocks = []
  let prose = []
  for (const line of text.split('\n')) {
    const m = line.trim().match(FIGURE_LINE)
    if (!m) { prose.push(line); continue }
    if (prose.join('').trim()) blocks.push({ md: prose.join('\n') })
    blocks.push({ figure: m[1] })
    prose = []
  }
  if (prose.join('').trim()) blocks.push({ md: prose.join('\n') })
  return blocks
}

export default function GuidePage() {
  const { slug } = useParams()
  const guide = findGuide(slug)
  const [state, setState] = useState({ blocks: null, figures: {}, error: false })

  useEffect(() => {
    if (!guide) return
    let live = true
    Promise.all([guide.load(), guide.figures ? guide.figures() : {}])
      .then(([text, figures]) => { if (live) setState({ blocks: toBlocks(text), figures, error: false }) })
      .catch(() => { if (live) setState({ blocks: null, figures: {}, error: true }) })
    return () => { live = false }
  }, [guide])

  if (!guide) {
    return (
      <div>
        <p style={S.muted}>There is no guide at this address.</p>
        <Link to="/admin/guides" style={S.back}>← All guides</Link>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <Link to="/admin/guides" style={S.back}>← All guides</Link>
      <h1 style={S.h1}>{guide.title}</h1>
      <p style={S.meta}>Updated {guide.updated}</p>
      {state.error && <p style={S.error}>Couldn’t load this guide. Reload the page to try again.</p>}
      {!state.blocks && !state.error && <p style={S.muted}>Loading…</p>}
      {state.blocks?.map((b, i) => {
        if (b.md) return <div key={i} className="guide-md"><DisplayMarkdown text={b.md} /></div>
        const Figure = state.figures[b.figure]
        return Figure ? <Figure key={i} /> : null
      })}
    </div>
  )
}

const S = {
  page: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 },
  back: { fontFamily: FONT, fontSize: 14, color: 'var(--tx2)', textDecoration: 'none' },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '8px 0 0' },
  meta: { fontFamily: FONT, fontSize: 12, color: 'var(--tx3)', margin: 0 },
  muted: { fontFamily: FONT, fontSize: 14, color: 'var(--tx2)' },
  error: { fontFamily: FONT, fontSize: 14, color: 'var(--pkd)', margin: 0 },
}
