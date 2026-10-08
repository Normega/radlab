// /psy240trial: the PSY240 teaching trial's launch tracker (lab only, LabOnlyRoute).
// Content lives in ./content.js; this file is layout only.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UPDATED, ONBOARDING, REPO, SUMMARY, ARMS, MILESTONES, DECISIONS, CHECKLIST } from './content'

const daysUntil = iso => Math.ceil((new Date(iso) - new Date()) / 86400000)

export default function Psy240Trial() {
  const left = daysUntil(ONBOARDING)
  const all = CHECKLIST.flatMap(g => g.items)
  const done = all.filter(i => i.status === 'done').length
  const open = DECISIONS.filter(d => d.status === 'open').length
  return (
    <div style={S.page}>
      <div style={S.inner}>
        <header style={S.header}>
          <div>
            <div style={S.kicker}>PSY240 · teaching trial · updated {UPDATED}</div>
            <h1 style={S.h1}>Launch tracker</h1>
            {SUMMARY.map(p => <p key={p.slice(0, 20)} style={S.lead}>{p}</p>)}
          </div>
          <Link to="/dashboard" style={S.back}>← radlab.zone</Link>
        </header>

        <div style={S.facts}>
          <Fact big={left > 0 ? `${left} day${left === 1 ? '' : 's'}` : left === 0 ? 'Today' : 'Launched'} small="to onboarding, Wed Oct 14, 10:30" />
          <Fact big={`${done} of ${all.length}`} small="checklist items done" />
          <Fact big={String(open)} small={`decision${open === 1 ? '' : 's'} waiting on Norm`} />
        </div>

        <Section title="Milestones">
          <ol style={S.list}>
            {MILESTONES.map(m => (
              <li key={m.when + m.what} style={S.row}>
                <Chip status={m.status} />
                <span style={S.when}>{m.when}</span>
                <span style={S.what}>{m.what}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Decisions">
          <ol style={S.list}>
            {DECISIONS.map(d => (
              <li key={d.id} style={S.decision}>
                <div style={S.row}>
                  <Chip status={d.status === 'open' ? 'now' : 'done'} label={d.status === 'open' ? 'open' : 'decided'} />
                  <span style={S.mono}>{d.id}</span>
                  <span style={S.what}>{d.q}</span>
                </div>
                <p style={S.suggest}>{d.status === 'open' ? 'Suggested: ' : 'Decided: '}{d.decided ?? d.suggest}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="The three arms">
          <div style={S.arms}>
            {ARMS.map(a => <Arm key={a.name} arm={a} />)}
          </div>
        </Section>

        <Section title="Checklist">
          {CHECKLIST.map(g => (
            <div key={g.group} style={S.group}>
              <h3 style={S.h3}>{g.group}</h3>
              <ul style={S.list}>
                {g.items.map(i => (
                  <li key={i.what} style={S.row}><Chip status={i.status} /><span style={S.what}>{i.what}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </Section>

        <p style={S.note}>
          The plan of record is PLAN.md in the private repo <a href={REPO} style={S.link}>psy240internal2026</a>; this page mirrors it.
        </p>
      </div>
    </div>
  )
}

// a day picker per arm, so every day can be previewed in a click
function Arm({ arm }) {
  const [day, setDay] = useState(1)
  const href = arm.preview + day
  const external = href.startsWith('http')
  return (
    <div style={S.arm}>
      <h3 style={S.h3}>{arm.name}</h3>
      <p style={S.pSmall}>{arm.what}</p>
      <p style={S.note}>{arm.state}</p>
      <div style={S.days} role="group" aria-label={`Preview a day of ${arm.name}`}>
        {Array.from({ length: arm.days }, (_, i) => i + 1).map(n => (
          <button key={n} type="button" onClick={() => setDay(n)} aria-pressed={n === day}
            style={{ ...S.day, ...(n === day ? S.dayOn : null) }}>{n}</button>
        ))}
      </div>
      {external
        ? <a href={href} target="_blank" rel="noreferrer" style={S.btn}>Preview day {day} ↗</a>
        : <Link to={href} target="_blank" style={S.btn}>Preview day {day} ↗</Link>}
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

function Fact({ big, small }) {
  return <div style={S.fact}><span style={S.factBig}>{big}</span><span style={S.factSmall}>{small}</span></div>
}

const CHIP = { done: 'done', now: 'now', next: 'next', blocked: 'blocked' }
function Chip({ status, label }) {
  const style = status === 'done' ? S.chipDone : status === 'blocked' ? S.chipBlocked : status === 'now' ? S.chipNow : S.chip
  return <span style={style}>{label ?? CHIP[status] ?? status}</span>
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)', padding: '40px 16px 64px' },
  inner: { maxWidth: 960, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  kicker: { fontFamily: '"Space Mono",monospace', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pkd)' },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 36, margin: '8px 0 16px', lineHeight: 1.1 },
  lead: { fontSize: 16, color: 'var(--tx2)', margin: '0 0 8px', maxWidth: 680, lineHeight: 1.5 },
  back: { fontFamily: '"Space Mono",monospace', fontSize: 14, color: 'var(--tx2)', textDecoration: 'none', border: '1px solid var(--bd)', borderRadius: 24, padding: '8px 16px', background: 'var(--bgc)', whiteSpace: 'nowrap' },
  facts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 },
  fact: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 },
  factBig: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 28, color: 'var(--pkd)' },
  factSmall: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.4 },
  section: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, marginBottom: 16 },
  h2: { fontFamily: '"DM Serif Display",Georgia,serif', fontWeight: 400, fontSize: 20, margin: '0 0 16px' },
  h3: { fontSize: 16, fontWeight: 600, margin: '0 0 8px' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' },
  decision: { display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8, borderBottom: '1px solid var(--bd)' },
  when: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)', minWidth: 96 },
  what: { fontSize: 14, lineHeight: 1.5, flex: '1 1 240px' },
  suggest: { fontSize: 14, color: 'var(--tx2)', margin: '0 0 0 64px', lineHeight: 1.5 },
  mono: { fontFamily: '"Space Mono",monospace', fontWeight: 700, color: 'var(--pkd)', fontSize: 14 },
  arms: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 },
  arm: { border: '1px solid var(--bd)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  pSmall: { fontSize: 14, lineHeight: 1.5, color: 'var(--tx)', margin: 0 },
  note: { fontSize: 12, color: 'var(--tx2)', margin: 0, lineHeight: 1.5 },
  days: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  day: { width: 32, height: 32, borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx2)', fontSize: 12, cursor: 'pointer', padding: 0 },
  dayOn: { borderColor: 'var(--pkd)', color: 'var(--pkd)', fontWeight: 700 },
  btn: { alignSelf: 'flex-start', background: 'var(--pkd)', color: 'var(--bgc)', borderRadius: 24, padding: '8px 16px', textDecoration: 'none', fontWeight: 600, fontSize: 14 },
  group: { marginBottom: 16 },
  chip: { flex: '0 0 auto', fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)', background: 'var(--bd)', borderRadius: 24, padding: '0 8px' },
  chipNow: { flex: '0 0 auto', fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--pkd)', background: 'var(--pkb)', borderRadius: 24, padding: '0 8px' },
  chipDone: { flex: '0 0 auto', fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--bgc)', background: 'var(--pkd)', borderRadius: 24, padding: '0 8px' },
  chipBlocked: { flex: '0 0 auto', fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--bgc)', background: 'var(--tx2)', borderRadius: 24, padding: '0 8px' },
  link: { color: 'var(--pkd)' },
}
