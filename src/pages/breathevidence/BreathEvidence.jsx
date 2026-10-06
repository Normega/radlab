// /breathevidence: the BCAT-DDM planning page, shared with Nansi (BreathEvidenceRoute).
// Content lives in ./content.js; this file is layout only. The design schematic is drawn
// from the real schedule generator, so it always shows the design the simulations evaluated.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { buildSchedule, DEFAULTS } from '../../games/BcatDdm/schedule'
import {
  UPDATED, STAGE, QUESTION, PARAMETERS, DESIGN, ROUNDS, COMPARISON, DECISIONS, NEXT, LINKS,
} from './content'

export default function BreathEvidence() {
  const open = DECISIONS.filter(d => d.status === 'open')
  return (
    <div style={S.page}>
      <div style={S.inner}>
        <header style={S.header}>
          <div>
            <div style={S.kicker}>BCAT-DDM · planning · updated {UPDATED}</div>
            <h1 style={S.h1}>Breath evidence</h1>
            <p style={S.lead}>How does evidence that breathing has changed build up into noticing it? This page tracks the design of the study that asks.</p>
          </div>
          <Link to="/dashboard" style={S.back}>← radlab.zone</Link>
        </header>

        <ol style={S.stages} aria-label="Project stages">
          {STAGE.map(s => (
            <li key={s.label} style={{ ...S.stage, ...(s.state === 'now' ? S.stageNow : null) }}>
              <span style={{ ...S.dot, background: s.state === 'next' ? 'var(--bds)' : 'var(--pkd)' }} />
              <span style={S.stageLabel}>{s.label}</span>
              <span style={S.stageNote}>{s.note}</span>
            </li>
          ))}
        </ol>

        <Section title="The question">
          {QUESTION.map(p => <p key={p.slice(0, 20)} style={S.p}>{p}</p>)}
        </Section>

        <Section title="The model">
          <p style={S.p}>
            Each participant is modelled as one evidence accumulator that runs for the whole session.
            Evidence that the breathing has changed pushes it up; a steady criterion pulls it back down.
            When it reaches a boundary, the participant presses. There are two kinds of evidence:
            how far the current breath is from the recent baseline (total change), and how different
            it is from the breath before (breath-to-breath change).
          </p>
          <div style={S.scroll}>
            <table style={S.table}>
              <thead><tr><th style={S.th}>Parameter</th><th style={S.th}>Name</th><th style={S.th}>What it means</th></tr></thead>
              <tbody>
                {PARAMETERS.map(([sym, name, what]) => (
                  <tr key={sym}><td style={{ ...S.td, ...S.mono }}>{sym}</td><td style={S.td}>{name}</td><td style={S.td}>{what}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title={`Recommended design: ${DESIGN.name}`}>
          <p style={S.p}>{DESIGN.summary}</p>
          <Schematic />
          <div style={S.facts}>
            {DESIGN.facts.map(([big, small]) => (
              <div key={small} style={S.fact}><b style={S.factBig}>{big}</b><span style={S.factSmall}>{small}</span></div>
            ))}
          </div>
          <a href="/prototypes/bcat-ddm.html" style={S.btn}>Try it in the prototype</a>
        </Section>

        <Section title="What the simulations found">
          <div style={S.rounds}>
            {ROUNDS.map(r => (
              <div key={r.title} style={S.round}>
                <h3 style={S.h3}>{r.title}</h3>
                <p style={S.pSmall}>{r.finding}</p>
              </div>
            ))}
          </div>
          <div style={S.scroll}>
            <table style={S.table}>
              <thead><tr>{COMPARISON.columns.map(c => <th key={c} style={S.th}>{c}</th>)}</tr></thead>
              <tbody>
                {COMPARISON.rows.map(r => (
                  <tr key={r[0]}>{r.map((c, i) => <td key={i} style={i === 0 ? S.td : { ...S.td, ...S.num }}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={S.note}>{COMPARISON.note}</p>
        </Section>

        <Section title={`Decisions to make (${open.length} open)`}>
          <ul style={S.list}>
            {DECISIONS.map(d => (
              <li key={d.q} style={S.decision}>
                <span style={{ ...S.chip, ...(d.status === 'open' ? null : S.chipDone) }}>{d.status === 'open' ? d.area : 'decided'}</span>
                <span style={S.dq}>{d.q}{d.answer ? <b style={S.answer}> {d.answer}</b> : null}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Next">
          <ol style={S.ol}>{NEXT.map(n => <li key={n} style={S.li}>{n}</li>)}</ol>
        </Section>

        <Section title="Links">
          <ul style={S.list}>
            {LINKS.map(l => (
              <li key={l.href} style={S.linkRow}>
                <a href={l.href} style={S.link} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{l.label}</a>
                <span style={S.pSmall}>{l.note}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={S.section}>
      <h2 style={S.h2}>{title}</h2>
      {children}
    </section>
  )
}

// Breath period over a 40-minute session of the recommended design, from the real generator.
function Schematic() {
  const sch = useMemo(() => buildSchedule('roving_ramp', { minutes: 40, m50Hat: 0.2, seed: 3 }), [])
  const W = 720, H = 160, pad = 8
  const B = DEFAULTS.basePeriodMs, lo = B * 0.55, hi = B * 1.8
  const X = ms => pad + (W - 2 * pad) * ms / sch.durationMs
  const Y = p => pad + (H - 2 * pad - 16) * (1 - (p - lo) / (hi - lo))
  // one staircase line: each breath a horizontal run, joined vertically to the next breath
  // unless a pause (probe, inter-trial break) separates them
  let d = ''
  sch.breaths.forEach((b, i) => {
    const prev = sch.breaths[i - 1]
    const joined = prev && prev.startMs + prev.periodMs === b.startMs
    d += joined ? `V${Y(b.periodMs).toFixed(1)}` : `M${X(b.startMs).toFixed(1)},${Y(b.periodMs).toFixed(1)}`
    d += `H${X(b.startMs + b.periodMs).toFixed(1)}`
  })
  const firstRamp = sch.events.find(e => e.type === 'ramp')
  return (
    <figure style={S.figure}>
      <svg viewBox={`0 0 ${W} ${H}`} style={S.svg} role="img" aria-label="Breath period across a 40-minute session: steps for 30 minutes, then ramps">
        {firstRamp && <rect x={X(firstRamp.onsetMs) - 4} y={pad} width={W - pad - X(firstRamp.onsetMs) + 4} height={H - 2 * pad - 16} style={{ fill: 'var(--pkb)' }} />}
        <line x1={pad} x2={W - pad} y1={Y(B)} y2={Y(B)} style={{ stroke: 'var(--bds)', strokeDasharray: '4 4' }} />
        <path d={d} style={{ stroke: 'var(--pkd)', strokeWidth: 2, fill: 'none' }} />
        <text x={pad} y={H - 4} style={S.svgText}>0 min</text>
        <text x={W - pad} y={H - 4} textAnchor="end" style={S.svgText}>40 min</text>
        {firstRamp && <text x={X(firstRamp.onsetMs)} y={H - 4} style={S.svgText}>ramp block</text>}
      </svg>
      <figcaption style={S.note}>Each line is one breath: higher is slower. The dashed line is the starting pace (4 s per breath).</figcaption>
    </figure>
  )
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)', padding: '40px 16px 64px' },
  inner: { maxWidth: 880, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 },
  kicker: { fontFamily: '"Space Mono",monospace', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pkd)' },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 36, fontWeight: 400, margin: '8px 0', lineHeight: 1.1 },
  lead: { fontSize: 16, color: 'var(--tx2)', margin: 0, maxWidth: 640, lineHeight: 1.5 },
  back: { fontFamily: '"Space Mono",monospace', fontSize: 14, color: 'var(--tx2)', textDecoration: 'none', border: '1px solid var(--bd)', borderRadius: 24, padding: '8px 16px', background: 'var(--bgc)', whiteSpace: 'nowrap' },

  stages: { listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 },
  stage: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 },
  stageNow: { borderColor: 'var(--pkd)', boxShadow: '0 0 0 1px var(--pkd)' },
  dot: { width: 8, height: 8, borderRadius: '50%' },
  stageLabel: { fontWeight: 600, fontSize: 14 },
  stageNote: { fontSize: 12, color: 'var(--tx2)' },

  section: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, marginBottom: 16 },
  h2: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 28, margin: '0 0 16px', lineHeight: 1.15 },
  h3: { fontSize: 16, fontWeight: 600, margin: '0 0 4px' },
  p: { fontSize: 16, lineHeight: 1.6, color: 'var(--tx)', margin: '0 0 16px' },
  pSmall: { fontSize: 14, lineHeight: 1.5, color: 'var(--tx2)', margin: 0 },
  note: { fontSize: 12, color: 'var(--tx2)', margin: '8px 0 0', lineHeight: 1.5 },

  scroll: { overflowX: 'auto' },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 14 },
  th: { textAlign: 'left', fontWeight: 600, color: 'var(--tx2)', fontSize: 12, padding: '8px', borderBottom: '1px solid var(--bds)', verticalAlign: 'bottom' },
  td: { padding: '8px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top', lineHeight: 1.5 },
  num: { fontFamily: '"Space Mono",monospace', whiteSpace: 'nowrap' },
  mono: { fontFamily: '"Space Mono",monospace', fontWeight: 700, color: 'var(--pkd)' },

  figure: { margin: '0 0 16px' },
  svg: { width: '100%', height: 'auto', display: 'block', background: 'var(--bg)', borderRadius: 12 },
  svgText: { fontFamily: '"Space Mono",monospace', fontSize: 12, fill: 'var(--tx2)' },

  facts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, margin: '0 0 24px' },
  fact: { border: '1px solid var(--bd)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 },
  factBig: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 28, color: 'var(--pkd)' },
  factSmall: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.4 },
  btn: { display: 'inline-block', background: 'var(--pkd)', color: 'var(--bgc)', borderRadius: 24, padding: '8px 24px', textDecoration: 'none', fontWeight: 600, fontSize: 16 },

  rounds: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, margin: '0 0 24px' },
  round: { borderLeft: '4px solid var(--pkb)', paddingLeft: 16 },

  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  decision: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 16, lineHeight: 1.5 },
  chip: { flex: '0 0 auto', fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--pkd)', background: 'var(--pkb)', borderRadius: 24, padding: '0 8px', marginTop: 4 },
  chipDone: { color: 'var(--tx2)', background: 'var(--bd)' },
  dq: { color: 'var(--tx)' },
  answer: { color: 'var(--pkd)' },
  ol: { margin: 0, paddingLeft: 24 },
  li: { fontSize: 16, lineHeight: 1.6, marginBottom: 4 },
  linkRow: { display: 'flex', flexDirection: 'column', gap: 4 },
  link: { color: 'var(--pkd)', fontWeight: 600, fontSize: 16 },
}
