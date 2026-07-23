// Original SVG + terminal graphics for the toni_july_2026 group-meeting deck
// ("From DICOMs to denoised fMRI — with an AI agent in the loop"). No paper
// figures — everything here is drawn fresh to tell the pipeline + agent story.
// Light slides carry dark terminal insets; RADlab pink (var(--pk) #f068a4) frames.

const PINK  = '#f068a4'
const PINKD = '#c04a82'
const BLUE  = '#4A90D9'
const INK   = '#1c1c1e'
const GREEN = '#2f9e5f'

// Terminal palette (dark inset on light slides)
const T = {
  bg:     '#14141b',
  bar:    '#20202b',
  text:   '#e5e7eb',
  dim:    '#8b8f9a',
  green:  '#4ade80',
  red:    '#f87171',
  amber:  '#fbbf24',
  blue:   '#60a5fa',
  cyan:   '#22d3ee',
  border: 'rgba(255,255,255,0.08)',
}

// ── Reusable on-slide terminal ──────────────────────────────────────────────
// lines: [{ k, t }] where k ∈ cmd | out | ok | bad | warn | dim | comment | blank
// `cmd` renders a green "$" prompt; `comment` renders a grey "#" line.
export function Terminal({ title = 'bash', lines = [], maxWidth = 860, prompt = '$' }) {
  return (
    <div style={{ ...TS.wrap, maxWidth }} onClick={e => e.stopPropagation()}>
      <div style={TS.bar}>
        <span style={{ ...TS.dot, background: '#ff5f57' }} />
        <span style={{ ...TS.dot, background: '#febc2e' }} />
        <span style={{ ...TS.dot, background: '#28c840' }} />
        <span style={TS.title}>{title}</span>
      </div>
      <div style={TS.body}>
        {lines.map((l, i) => {
          if (l.k === 'blank') return <div key={i} style={{ height: '0.62em' }} />
          if (l.k === 'cmd') {
            return (
              <div key={i} style={TS.line}>
                <span style={{ color: T.green, userSelect: 'none' }}>{prompt} </span>
                <span style={{ color: T.text }}>{l.t}</span>
              </div>
            )
          }
          if (l.k === 'comment') {
            return <div key={i} style={{ ...TS.line, color: T.dim }}># {l.t}</div>
          }
          const color =
            l.k === 'ok'   ? T.green :
            l.k === 'bad'  ? T.red   :
            l.k === 'warn' ? T.amber :
            l.k === 'dim'  ? T.dim   :
            l.k === 'blue' ? T.blue  :
            l.k === 'cyan' ? T.cyan  : T.text
          return <div key={i} style={{ ...TS.line, color }}>{l.t}</div>
        })}
      </div>
    </div>
  )
}

const TS = {
  wrap: {
    width: '100%', borderRadius: 12, overflow: 'hidden', background: T.bg,
    border: `1px solid ${T.border}`, boxShadow: '0 10px 34px rgba(0,0,0,0.22)',
    cursor: 'default', textAlign: 'left',
  },
  bar: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px',
    background: T.bar, borderBottom: `1px solid ${T.border}`,
  },
  dot: { width: 11, height: 11, borderRadius: '50%', display: 'inline-block' },
  title: {
    marginLeft: 8, fontFamily: '"Space Mono",monospace', fontSize: 12,
    color: T.dim, letterSpacing: '0.02em',
  },
  body: {
    padding: '16px 18px', fontFamily: '"Space Mono","SF Mono",Menlo,monospace',
    fontSize: 'clamp(11.5px, 1.35vw, 15px)', lineHeight: 1.62,
    overflowX: 'auto', whiteSpace: 'pre',
  },
  line: { whiteSpace: 'pre' },
}

// ── Pipeline diagram — the four stages ──────────────────────────────────────
export function PipelineDiagram() {
  const stages = [
    { n: '1', name: 'DICOM → BIDS',   tool: 'nifti_to_bids.py',   c: BLUE },
    { n: '2', name: 'Deface + T1w QC', tool: 'pydeface',           c: BLUE },
    { n: '3', name: 'MRIQC',           tool: 'image-quality',      c: '#7c6cd4' },
    { n: '4a', name: 'fMRIPrep 24.1.1', tool: 'recon-all · norm',  c: PINK },
    { n: '4b', name: 'fMRIPost-AROMA', tool: 'ICA denoising',      c: PINK },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
      {stages.map((s, i) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
            minWidth: 128, padding: '14px 14px', borderRadius: 12, background: '#fff',
            border: `1.5px solid ${s.c}33`, boxShadow: '0 3px 14px rgba(0,0,0,0.05)',
          }}>
            <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 12, fontWeight: 700, color: s.c }}>STAGE {s.n}</span>
            <span style={{ fontFamily: '"DM Sans",sans-serif', fontSize: 'clamp(13px,1.5vw,16px)', fontWeight: 600, color: INK, textAlign: 'center', lineHeight: 1.15 }}>{s.name}</span>
            <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: '#6b6c70', textAlign: 'center' }}>{s.tool}</span>
          </div>
          {i < stages.length - 1 && (
            <span style={{ color: '#c7b1bf', fontSize: 22, lineHeight: 1 }}>→</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Incident 1 — disk fills to 100%, then the wipe drops it to 69% ───────────
export function DiskTimeline() {
  const W = 760, H = 300, padL = 46, padR = 18, padT = 22, padB = 40
  const plotW = W - padL - padR, plotH = H - padT - padB
  const y = pct => padT + plotH * (1 - pct / 100)
  const x = t => padL + plotW * t

  // Rising curve to 100% (t 0 → 0.62), flat at 100% (crash), vertical wipe, flat at 69%.
  const climb = []
  for (let i = 0; i <= 30; i++) {
    const t = (i / 30) * 0.6
    const p = Math.min(100, 12 + (i / 30) * 92)
    climb.push([x(t), y(p)])
  }
  const crashX = x(0.62)
  const afterY = y(69)
  const linePts = climb.map(p => p.join(',')).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 780, background: '#fff', borderRadius: 12, border: '1px solid var(--bd)' }}>
      {/* gridlines */}
      {[0, 25, 50, 75, 100].map(p => (
        <g key={p}>
          <line x1={padL} y1={y(p)} x2={W - padR} y2={y(p)} stroke="#eee" strokeWidth="1" />
          <text x={padL - 8} y={y(p) + 4} textAnchor="end" fontFamily='"Space Mono",monospace' fontSize="11" fill="#abadb0">{p}%</text>
        </g>
      ))}
      {/* danger zone at 100 */}
      <line x1={padL} y1={y(100)} x2={W - padR} y2={y(100)} stroke={PINK} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

      {/* area under climb */}
      <polygon points={`${padL},${y(12)} ${linePts} ${crashX},${y(100)} ${crashX},${y(0)} ${padL},${y(0)}`} fill="rgba(248,113,113,0.08)" />
      {/* climb line */}
      <polyline points={linePts} fill="none" stroke="#f8717199" strokeWidth="2.5" />
      <polyline points={`${climb[climb.length - 1].join(',')} ${crashX},${y(100)}`} fill="none" stroke={T.red} strokeWidth="2.5" />

      {/* crash marker */}
      <circle cx={crashX} cy={y(100)} r="5.5" fill={T.red} />
      <text x={crashX + 10} y={y(100) - 8} fontFamily='"Space Mono",monospace' fontSize="12" fontWeight="700" fill={T.red}>df → 0 bytes free</text>
      <text x={crashX + 10} y={y(100) + 8} fontFamily='"Space Mono",monospace' fontSize="11" fill="#6b6c70">work/ scratch = 678 GB</text>

      {/* vertical wipe */}
      <line x1={crashX} y1={y(100)} x2={crashX} y2={afterY} stroke={GREEN} strokeWidth="2.5" strokeDasharray="5 3" />
      <polyline points={`${crashX},${afterY} ${W - padR},${afterY}`} fill="none" stroke={GREEN} strokeWidth="2.5" />
      <circle cx={crashX} cy={afterY} r="5.5" fill={GREEN} />
      <text x={crashX + 10} y={afterY + 20} fontFamily='"Space Mono",monospace' fontSize="12" fontWeight="700" fill={GREEN}>wipe scratch → 69%</text>
      <text x={crashX + 10} y={afterY + 36} fontFamily='"Space Mono",monospace' fontSize="11" fill="#6b6c70">recon-all preserved elsewhere</text>

      {/* axes labels */}
      <text x={padL} y={H - 10} fontFamily='"Space Mono",monospace' fontSize="11" fill="#abadb0">accumulating subjects · no auto-cleanup →</text>
      <text x={padL - 34} y={padT - 8} fontFamily='"Space Mono",monospace' fontSize="11" fill="#6b6c70">1.9 TB drive · % full</text>
    </svg>
  )
}

// ── Incident 2 — exit code lies; reality (log + report) tells the truth ──────
export function ExitCodeDiagram() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, maxWidth: 820, width: '100%' }}>
      {/* the process */}
      <div style={{ padding: '12px 22px', borderRadius: 12, background: '#fff', border: '1.5px solid var(--bd)', fontFamily: '"DM Sans",sans-serif', fontSize: 'clamp(15px,1.9vw,20px)', fontWeight: 600, color: INK }}>
        fMRIPost-AROMA · one subject
      </div>
      <div style={{ display: 'flex', gap: 34, flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* reality */}
        <Signal
          tone={GREEN}
          head="What it actually did"
          items={['prints “finished successfully”', 'writes every denoised run', 'renders sub-XXX.html report']}
          verdict="REALITY ✓"
        />
        {/* exit code */}
        <Signal
          tone={T.red}
          head="What it returned"
          items={['exit code ≠ 0', '(this build exits non-zero even on success)']}
          verdict="EXIT CODE ✗"
        />
      </div>
      {/* the launcher choosing wrong */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ color: '#c7b1bf', fontSize: 22 }}>↓</span>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 300px', maxWidth: 360, padding: '14px 18px', borderRadius: 12, background: 'rgba(248,113,113,0.07)', border: `1.5px solid ${T.red}44` }}>
          <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 12, fontWeight: 700, color: T.red, marginBottom: 6 }}>OLD LAUNCHER — judged by $?</div>
          <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 'clamp(12px,1.4vw,14px)', color: INK }}>… && echo OK || echo <b style={{ color: T.red }}>FAIL</b></div>
          <div style={{ fontSize: 13, color: '#6b6c70', marginTop: 8, fontFamily: '"DM Sans",sans-serif' }}>→ 36 good subjects mislabeled FAIL; scratch cleanup never fires</div>
        </div>
        <div style={{ flex: '1 1 300px', maxWidth: 360, padding: '14px 18px', borderRadius: 12, background: 'rgba(47,158,95,0.08)', border: `1.5px solid ${GREEN}55` }}>
          <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 6 }}>FIXED LAUNCHER — judged by reality</div>
          <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 'clamp(11px,1.3vw,13px)', color: INK }}>grep "finished successfully" <span style={{ color: '#6b6c70' }}>&&</span> [ -f report ]</div>
          <div style={{ fontSize: 13, color: '#6b6c70', marginTop: 8, fontFamily: '"DM Sans",sans-serif' }}>→ clean scratch only on real success</div>
        </div>
      </div>
    </div>
  )
}

function Signal({ tone, head, items, verdict }) {
  return (
    <div style={{ width: 300, padding: '14px 18px', borderRadius: 12, background: '#fff', border: `1.5px solid ${tone}44` }}>
      <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 12, letterSpacing: '0.04em', color: '#6b6c70', marginBottom: 8 }}>{head}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 14, color: INK, lineHeight: 1.35, fontFamily: '"DM Sans",sans-serif' }}>{it}</li>
        ))}
      </ul>
      <div style={{ marginTop: 10, fontFamily: '"Space Mono",monospace', fontSize: 13, fontWeight: 700, color: tone }}>{verdict}</div>
    </div>
  )
}

// ── Cold-open resume message (the session's first prompt) ────────────────────
export function ResumeChat() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, width: '100%' }} onClick={e => e.stopPropagation()}>
      <div style={{ alignSelf: 'flex-end', maxWidth: '90%', background: 'var(--pk)', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '14px 18px', fontSize: 'clamp(15px,1.9vw,19px)', lineHeight: 1.5, boxShadow: '0 4px 18px rgba(240,104,164,0.25)' }}>
        “our last session got interrupted, we were running fmriprep and ica aroma — can you remember and resume?”
        <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, opacity: 0.85, marginTop: 8 }}>norm · session opens cold</div>
      </div>
      <div style={{ alignSelf: 'flex-start', maxWidth: '90%', background: '#fff', color: 'var(--tx)', border: '1px solid var(--bd)', borderRadius: '16px 16px 16px 4px', padding: '14px 18px', fontSize: 'clamp(14px,1.7vw,17px)', lineHeight: 1.5 }}>
        <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--pkd)' }}>agent — from persistent memory</span>
        <div style={{ marginTop: 6 }}>Pulls study design + config prefs + “run batches autonomously, only interrupt on error.” Then goes to look at actual disk state.</div>
      </div>
    </div>
  )
}

// ── Multi-bubble chat thread (the design conversation) ──────────────────────
// messages: [{ who: 'norm' | 'agent', text, tag? }]. Norm = pink, right; agent
// = white, left — same visual language as ResumeChat, scaled for 2–3 turns.
export function ChatThread({ messages = [], maxWidth = 780 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11, maxWidth, width: '100%' }} onClick={e => e.stopPropagation()}>
      {messages.map((m, i) => {
        const isUser = m.who === 'norm'
        return (
          <div key={i} style={{
            alignSelf: isUser ? 'flex-end' : 'flex-start',
            maxWidth: '89%',
            background: isUser ? 'var(--pk)' : '#fff',
            color: isUser ? '#fff' : 'var(--tx)',
            border: isUser ? 'none' : '1px solid var(--bd)',
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            padding: '11px 16px',
            fontSize: 'clamp(13px, 1.6vw, 17px)',
            lineHeight: 1.48,
            boxShadow: isUser ? '0 4px 16px rgba(240,104,164,0.22)' : '0 2px 10px rgba(0,0,0,0.05)',
            textAlign: 'left',
          }}>
            {m.tag && (
              <div style={{
                fontFamily: '"Space Mono",monospace', fontSize: 11, marginBottom: 5,
                color: isUser ? 'rgba(255,255,255,0.85)' : 'var(--pkd)',
              }}>{m.tag}</div>
            )}
            <div>{m.text}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Results — three completion counters ─────────────────────────────────────
export function ResultsCounters() {
  const tiles = [
    { big: '53/53', label: 'fMRIPrep subjects', sub: '0 failures' },
    { big: '53/53', label: 'fMRIPost-AROMA subjects', sub: '0 failures' },
    { big: '251/251', label: 'BOLD runs denoised', sub: 'counts match each acquisition' },
  ]
  return (
    <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
      {tiles.map(t => (
        <div key={t.label} style={{
          minWidth: 210, padding: '22px 26px', borderRadius: 16, background: '#fff',
          border: '1px solid var(--bd)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(34px,5vw,52px)', color: 'var(--pkd)', lineHeight: 1 }}>{t.big}</span>
          <span style={{ fontSize: 'clamp(14px,1.7vw,18px)', color: INK, fontWeight: 600, textAlign: 'center' }}>{t.label}</span>
          <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 12, color: GREEN }}>✓ {t.sub}</span>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  DATASET 2 — downstream analysis (clinical sample). Blue accent (#4A90D9)
//  throughout to read as distinct from dataset 1's pink.
// ════════════════════════════════════════════════════════════════════════════

// Downstream analysis flow — deliberately starts FROM fMRIPrep output, to make
// the "we pick up where dataset 1 ended" point visually.
export function AnalysisPipeline() {
  const stages = [
    { name: 'fMRIPrep', tool: 'MNI152NLin2009cAsym', c: '#7c6cd4', start: true },
    { name: 'FSL FEAT', tool: 'first-level GLM', c: BLUE },
    { name: 'Fixed effects', tool: 'within-subject', c: BLUE },
    { name: 'randomise', tool: 'TFCE + permutation', c: BLUE },
    { name: 'Harvard–Oxford', tool: 'atlas labeling', c: BLUE },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
      {stages.map((s, i) => (
        <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', minWidth: 132, padding: '14px 14px', borderRadius: 12, background: '#fff', border: `1.5px solid ${s.c}${s.start ? '' : '33'}`, boxShadow: s.start ? `0 0 0 3px ${s.c}22` : '0 3px 14px rgba(0,0,0,0.05)', position: 'relative' }}>
            {s.start && <span style={{ position: 'absolute', top: -22, fontFamily: '"Space Mono",monospace', fontSize: 11, fontWeight: 700, color: s.c, whiteSpace: 'nowrap' }}>picks up here ↓</span>}
            <span style={{ fontFamily: '"DM Sans",sans-serif', fontSize: 'clamp(13px,1.5vw,16px)', fontWeight: 600, color: INK, textAlign: 'center', lineHeight: 1.15 }}>{s.name}</span>
            <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: '#6b6c70', textAlign: 'center' }}>{s.tool}</span>
          </div>
          {i < stages.length - 1 && <span style={{ color: '#b9c3d4', fontSize: 22, lineHeight: 1 }}>→</span>}
        </div>
      ))}
    </div>
  )
}

// Registered vs. what-the-code-did — the centerpiece methods slide. Separates
// the cosmetic engine swap from the substantive error-control deviation.
export function RegisteredVsActual() {
  const Row = ({ tone, tag, left, right, note }) => (
    <div style={{ padding: '14px 18px', borderRadius: 12, background: '#fff', border: `1.5px solid ${tone}44`, textAlign: 'left' }}>
      <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 12, fontWeight: 700, letterSpacing: '0.03em', color: tone, marginBottom: 8 }}>{tag}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: '"Space Mono",monospace', fontSize: 'clamp(12px,1.5vw,15px)', color: INK }}>
        <span style={{ padding: '4px 10px', borderRadius: 7, background: 'rgba(0,0,0,0.05)' }}>{left}</span>
        <span style={{ color: tone, fontSize: 18 }}>→</span>
        <span style={{ padding: '4px 10px', borderRadius: 7, background: `${tone}18`, color: tone === '#9aa0aa' ? INK : tone, fontWeight: 600 }}>{right}</span>
      </div>
      <div style={{ fontSize: 13.5, color: '#6b6c70', marginTop: 9, fontFamily: '"DM Sans",sans-serif', lineHeight: 1.4 }}>{note}</div>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 880, width: '100%' }}>
      <Row
        tone="#9aa0aa"
        tag="ENGINE SWAP — a documentable, minor deviation"
        left="SPM12" right="FSL FEAT"
        note="Both are mass-univariate GLM. Name it in the deviations log and move on — this is not the part that matters."
      />
      <Row
        tone={BLUE}
        tag="ERROR CONTROL — the deviation that actually matters"
        left="cluster p<.005 (~400 vox)" right="TFCE + permutation (randomise)"
        note="The convenient threshold was neither registered nor defensible post-Eklund, Nichols & Knutsson (2016). Moving to the registered TFCE/permutation is a genuine improvement, not just compliance."
      />
      <div style={{ padding: '11px 16px', borderRadius: 10, background: 'rgba(74,144,217,0.06)', border: '1px dashed rgba(74,144,217,0.35)', fontSize: 13.5, color: '#4b5563', textAlign: 'left', fontFamily: '"DM Sans",sans-serif', lineHeight: 1.45 }}>
        <b style={{ color: BLUE }}>Also reconciled:</b> the registered H1 group test + the H3 <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 12 }}>covariate × [Decentered − Analytic]</span> moderation contrast (both absent from the second level) · rumination coded as the registered RRS-10 <i>total</i>, not the single sub-scale the code used.
      </div>
    </div>
  )
}

// The compute-reality table — WSL-on-Windows failures and their fixes.
export function ComputeRealityTable() {
  const rows = [
    ['Batch dies at ~10 min', 'Agent background calls are time-capped', 'Run out-of-band (Task Scheduler)'],
    ['Dies again at ~15 min, every time', '8 workers copy 149 MB .feat dirs to the /mnt/g drvfs mount at once → WSL 9p server falls over', 'Compute + store on native ext4'],
    ['“Stalled!” alarms that weren’t', 'FILM jobs ran ~40 min each (virtual-disk I/O bound)', 'Process-aware thresholds'],
  ]
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 'clamp(11px, 1.35vw, 14px)', background: '#fff', borderRadius: 10, overflow: 'hidden', maxWidth: 900, tableLayout: 'fixed' }}>
      <thead>
        <tr>
          {['Symptom', 'Root cause', 'Fix'].map((h, i) => (
            <th key={h} style={{ fontFamily: '"Space Mono",monospace', fontSize: '0.85em', fontWeight: 700, color: BLUE, padding: '10px 14px', borderBottom: `2px solid ${BLUE}33`, textAlign: 'left', width: i === 1 ? '46%' : '27%' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            {r.map((cell, ci) => (
              <td key={ci} style={{ padding: '10px 14px', textAlign: 'left', color: ci === 0 ? INK : '#4b5563', borderBottom: '1px solid var(--bd)', verticalAlign: 'top', fontWeight: ci === 0 ? 600 : 400, lineHeight: 1.4 }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Synthesis — the two datasets rhyme. Pattern | Dataset 1 (pink) | Dataset 2 (blue).
export function ParallelPatterns() {
  const rows = [
    ['Plan before executing', 'Session-zero design conversation', 'Pre-registration reconciliation'],
    ['Lock the analytic forks', 'Garden of forking paths', 'Primary model locked before group maps'],
    ['The environment fights back', 'Scratch fills the disk to 0', 'WSL drvfs vs native ext4'],
    ['Idempotent resume', 'Crash → fix → relaunch, skip done', '98 runs travel & skip on the port'],
    ['Carry the context forward', 'Persistent memory across sessions', 'Travel bundle → a fresh Claude continues'],
    ['Verify, don’t trust', 'Exit code lies → check the log', 'Corrupt run-4 → fingerprint the identity'],
  ]
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 'clamp(11px, 1.35vw, 15px)', background: '#fff', borderRadius: 10, overflow: 'hidden', maxWidth: 1020 }}>
      <thead>
        <tr>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: '"Space Mono",monospace', fontSize: '0.82em', color: '#6b6c70', borderBottom: '2px solid var(--bd)' }}>Pattern</th>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: '"Space Mono",monospace', fontSize: '0.82em', color: PINKD, borderBottom: `2px solid ${PINK}44` }}>Dataset 1 · preprocessing</th>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: '"Space Mono",monospace', fontSize: '0.82em', color: BLUE, borderBottom: `2px solid ${BLUE}44` }}>Dataset 2 · analysis</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            <td style={{ padding: '9px 14px', textAlign: 'left', color: INK, fontWeight: 600, borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>{r[0]}</td>
            <td style={{ padding: '9px 14px', textAlign: 'left', color: '#4b5563', borderBottom: '1px solid var(--bd)' }}>{r[1]}</td>
            <td style={{ padding: '9px 14px', textAlign: 'left', color: '#4b5563', borderBottom: '1px solid var(--bd)' }}>{r[2]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Provenance of an AI answer — three sources, and how much each drove
//    slide 8's "where do we start?" advice. Backup / Q&A slide.
export function AdviceProvenance() {
  const cols = [
    { label: 'Field default', tag: 'the skeleton', sub: 'the standard 2026 pipeline — what I’d tell almost anyone', weight: 3, c: '#7c6cd4' },
    { label: 'Your brief, this session', tag: 'the specific forks', sub: 'the study you just described — surfaces + subcortical, wanting AROMA', weight: 3, c: BLUE },
    { label: 'Durable memory of you', tag: 'here: almost none', sub: 'preferences carried across sessions in explicit files', weight: 1, c: PINK },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 940, width: '100%' }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {cols.map(col => (
          <div key={col.label} style={{ flex: '1 1 240px', maxWidth: 300, padding: '16px 18px', borderRadius: 14, background: '#fff', border: `1.5px solid ${col.c}44`, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: '"DM Sans",sans-serif', fontSize: 'clamp(15px,1.8vw,18px)', fontWeight: 600, color: INK }}>{col.label}</div>
            <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 12, color: col.c }}>{col.tag}</div>
            <div style={{ fontSize: 13.5, color: '#6b6c70', lineHeight: 1.4, fontFamily: '"DM Sans",sans-serif' }}>{col.sub}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 10.5, color: '#9aa0aa', letterSpacing: '0.04em' }}>DROVE SLIDE 8</span>
              <span style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i < col.weight ? col.c : `${col.c}22`, display: 'inline-block' }} />
                ))}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 12.5, color: '#6b6c70', textAlign: 'center', lineHeight: 1.5 }}>
        I can point to a source when one exists — I can’t read off what caused what. Self-reports are inference, and can confabulate.
      </div>
    </div>
  )
}

// ── Small numeric stat tiles (reused on data / disk slides) ──────────────────
export function StatTiles({ items }) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
      {items.map(t => (
        <div key={t.label} style={{
          minWidth: 150, padding: '16px 20px', borderRadius: 14, background: '#fff',
          border: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(26px,3.6vw,40px)', color: t.c || 'var(--pkd)', lineHeight: 1 }}>{t.big}</span>
          <span style={{ fontSize: 13, color: '#6b6c70', textAlign: 'center', lineHeight: 1.3 }}>{t.label}</span>
        </div>
      ))}
    </div>
  )
}
