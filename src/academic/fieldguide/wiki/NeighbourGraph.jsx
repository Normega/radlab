import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { visitBand, wrapLabel } from './readingGraph'

const MONO = '"Space Mono", "Courier New", monospace'

// One hop around the page being read (Norm, 2026-09-22): the page in the
// middle, its strongest neighbours on a ring, arrows for which way the link
// runs, and each neighbour filled by how often THIS reader has opened it.
//
// A star, deliberately — not a force layout and not neighbour-to-neighbour
// edges. The question it answers is "what is this page connected to, and have
// I been there?", and a star answers it at a glance on a phone; a hairball of
// the busiest pages (35 in, 29 out) answers nothing. The full lists stay below
// under Related and Referenced by; the graph is the way in, not the record.
//
// Plain SVG laid out in pixels from the measured width, not a scaled viewBox:
// scaling a desktop layout down to 360px would shrink 12px labels to 6px.
export default function NeighbourGraph({ title, neighbours, base, tracked, selfVisits }) {
  // A callback ref (element in state) rather than useRef: the canvas mounts
  // only once neighbours have loaded, after the first render.
  const [el, setEl] = useState(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])

  if (!neighbours.length) return null

  const narrow = width < 560
  const max = narrow ? 6 : 10
  const chars = narrow ? 14 : 18
  const labelW = chars * 6.8
  const H = narrow ? 300 : 340
  const cx = width / 2
  const cy = H / 2
  const rx = Math.max(60, width / 2 - labelW / 2 - 6)
  const ry = H / 2 - 52
  const shown = neighbours.slice(0, max)
  const unopened = tracked ? neighbours.filter(n => n.visits === 0) : []

  const nodes = shown.map((n, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / shown.length
    const x = cx + rx * Math.cos(a)
    const y = cy + ry * Math.sin(a)
    return { ...n, x, y, above: Math.sin(a) < -0.01, lines: wrapLabel(n.title, chars) }
  })

  const R0 = 15 // this page
  const R = 8   // a neighbour

  return (
    <section id="connections" style={S.section}>
      <h2 style={S.h}>How this page connects</h2>
      <div ref={setEl} style={S.canvas}>
        <svg width={width} height={H} role="group" aria-label={`${title} and ${shown.length} connected pages`}
             style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            {['base', 'hot'].map(k => (
              <marker key={k} id={`nb-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5"
                      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" style={{ fill: k === 'hot' ? 'var(--pk)' : 'var(--tx3)' }} />
              </marker>
            ))}
          </defs>

          {nodes.map(n => {
            // Trim each edge to the two circles so arrowheads land on the rim.
            const dx = n.x - cx, dy = n.y - cy
            const len = Math.hypot(dx, dy) || 1
            const ux = dx / len, uy = dy / len
            const x1 = cx + ux * (R0 + 3), y1 = cy + uy * (R0 + 3)
            const x2 = n.x - ux * (R + 3), y2 = n.y - uy * (R + 3)
            const hot = hover === n.id
            const m = `url(#nb-arrow-${hot ? 'hot' : 'base'})`
            return (
              <line key={`e-${n.id}`} x1={x1} y1={y1} x2={x2} y2={y2}
                    markerEnd={n.kind === 'out' || n.kind === 'both' ? m : undefined}
                    markerStart={n.kind === 'in' || n.kind === 'both' ? m : undefined}
                    style={{
                      stroke: hot ? 'var(--pk)' : 'var(--tx3)',
                      strokeWidth: n.kind === 'both' ? 1.8 : 1.2,
                      strokeDasharray: n.kind === 'related' ? '4 4' : undefined,
                      opacity: hover && !hot ? 0.35 : 0.9,
                    }} />
            )
          })}

          <circle cx={cx} cy={cy} r={R0} style={{ fill: 'var(--bgp)', stroke: 'var(--pk)', strokeWidth: 2.5 }} />
          {wrapLabel(title, chars + 4).map((line, i) => (
            <text key={i} x={cx} y={cy + R0 + 16 + i * 15} textAnchor="middle"
                  style={{ ...S.label, fontWeight: 700, fill: 'var(--tx)' }}>{line}</text>
          ))}

          {nodes.map(n => {
            const band = tracked ? visitBand(n.visits) : 'untracked'
            const hot = hover === n.id
            const lineY = (i) => n.above
              ? n.y - R - 8 - (n.lines.length - 1 - i) * 14
              : n.y + R + 16 + i * 14
            const tip = `${n.title} — ${KIND_TIP[n.kind]}` +
              (tracked ? ` · ${n.visits ? `you've opened it ${n.visits === 1 ? 'once' : `${n.visits} times`}` : 'not opened yet'}` : '') +
              (n.status && n.status !== 'published' ? ' · draft' : '')
            const href = `${base}/${n.slug}`
            return (
              <a key={n.id} href={href} aria-label={tip}
                 onClick={e => {
                   if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                   e.preventDefault()
                   navigate(href)
                 }}
                 onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                 onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
                 style={{ cursor: 'pointer', outline: 'none' }}>
                <title>{tip}</title>
                {/* generous invisible hit area — an 8px dot is not a tap target */}
                <circle cx={n.x} cy={n.y} r={22} style={{ fill: 'transparent' }} />
                <circle cx={n.x} cy={n.y} r={hot ? R + 2 : R} style={NODE[band]} />
                {n.lines.map((line, i) => (
                  <text key={i} x={n.x} y={lineY(i)} textAnchor="middle"
                        style={{ ...S.label, fill: hot ? 'var(--pk)' : 'var(--tx2)', fontWeight: hot ? 700 : 400 }}>
                    {line}
                  </text>
                ))}
              </a>
            )
          })}
        </svg>
      </div>

      <div style={S.legend}>
        <span style={S.item}><Arrow /> this page links there</span>
        <span style={S.item}><Arrow flip /> links here</span>
        <span style={S.item}><Arrow both /> both ways</span>
        <span style={S.item}><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" style={{ stroke: 'var(--tx3)', strokeDasharray: '4 4' }} /></svg> related</span>
        {tracked && <>
          <span style={{ ...S.item, ...S.legendGap }}><VisitDot band="none" /> not opened yet</span>
          <span style={S.item}><VisitDot band="some" /> opened once or twice</span>
          <span style={S.item}><VisitDot band="often" /> opened 3+ times</span>
        </>}
      </div>

      <p style={S.note}>
        {neighbours.length > shown.length
          ? <>Showing the {shown.length} closest of {neighbours.length} connected pages — two-way links and pages from the same lecture first. The full lists are under Related and Referenced by.</>
          : <>{neighbours.length} connected page{neighbours.length === 1 ? '' : 's'}.</>}
        {tracked && selfVisits > 0 && <> You&rsquo;ve opened this page {selfVisits === 1 ? 'once' : `${selfVisits} times`}.</>}
        {tracked && <> Only you can see your reading history.</>}
      </p>

      {unopened.length > 0 && (
        <p style={S.note}>
          <span style={S.nudgeLabel}>Nearby, not opened yet</span>{' '}
          {unopened.slice(0, 4).map((n, i) => (
            <span key={n.id}>{i > 0 && ' · '}<Link to={`${base}/${n.slug}`} style={S.link}>{n.title}</Link></span>
          ))}
          {unopened.length > 4 && <span style={{ color: 'var(--tx3)' }}> · +{unopened.length - 4} more</span>}
        </p>
      )}
    </section>
  )
}

const KIND_TIP = {
  out: 'this page links to it',
  in: 'it links to this page',
  both: 'linked both ways',
  related: 'listed as related',
}

// Outlined for "not yet", tinted for "some", solid for "often". The outline is
// dashed so "not opened" doesn't depend on telling two pinks apart.
const NODE = {
  none:      { fill: 'var(--bg)',  stroke: 'var(--tx3)', strokeWidth: 1.5, strokeDasharray: '2 2' },
  some:      { fill: 'var(--pk)', fillOpacity: 0.35, stroke: 'var(--pk)', strokeWidth: 1.5 },
  often:     { fill: 'var(--pk)',  stroke: 'var(--pk)',  strokeWidth: 1.5 },
  untracked: { fill: 'var(--bgc)', stroke: 'var(--tx3)', strokeWidth: 1.5 },
}

// Also the key on the chapter map, so a dot means the same thing everywhere.
export function VisitDot({ band, size = 14 }) {
  const r = size / 2
  return (
    <svg width={size} height={size} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-2px', flexShrink: 0 }}>
      <circle cx={r} cy={r} r={r - 2} style={NODE[band]} />
    </svg>
  )
}

function Arrow({ flip, both }) {
  return (
    <svg width="22" height="10" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-1px' }}>
      <line x1="2" y1="5" x2="20" y2="5" style={{ stroke: 'var(--tx3)', strokeWidth: both ? 1.8 : 1.2 }} />
      {(!flip || both) && <path d="M15,1.5 L21,5 L15,8.5 z" style={{ fill: 'var(--tx3)' }} />}
      {(flip || both) && <path d="M7,1.5 L1,5 L7,8.5 z" style={{ fill: 'var(--tx3)' }} />}
    </svg>
  )
}

const S = {
  section: { marginTop: 30, paddingTop: 18, borderTop: '1px solid var(--bd)', scrollMarginTop: 20 },
  h: { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 18, color: 'var(--tx)', margin: '0 0 8px' },
  canvas: { width: '100%', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '10px 0' },
  // The halo (a stroke in the canvas colour painted under the fill) lets an
  // edge pass behind a label instead of striking through it.
  label: { fontSize: 12, fontFamily: 'inherit', paintOrder: 'stroke', stroke: 'var(--bgc)', strokeWidth: 4, strokeLinejoin: 'round' },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px', whiteSpace: 'nowrap', marginTop: 10, fontFamily: MONO, fontSize: 11, color: 'var(--tx2)', alignItems: 'center' },
  legendGap: { marginLeft: 6 },
  item: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  note: { fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.55, margin: '8px 0 0' },
  nudgeLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pk)' },
  link: { color: 'var(--pk)', textDecoration: 'none' },
}
