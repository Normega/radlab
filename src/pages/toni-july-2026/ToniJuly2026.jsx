// toni_july_2026 group-meeting deck — "From DICOMs to denoised fMRI, with an
// AI agent in the loop." Single-page click-through (replaces Keynote/PowerPoint)
// and a permanent read-later resource on radlab.zone, mirroring /keynote's shell:
// click / → / Space advance, ← back, N toggles speaker notes, two density modes
// (Minimal for the room, Reading for the hosted page). Source: GROUP_MEETING_DEMO.md.
//
// The 🖥️ SHOW LIVE commands run on the imaging cluster, not this host, so they
// appear as on-slide styled <Terminal> blocks (real commands + expected output),
// not executed live.
import { useState, useEffect, useCallback } from 'react'
import {
  Terminal, PipelineDiagram, DiskTimeline, ExitCodeDiagram,
  ResumeChat, ChatThread, ResultsCounters, StatTiles,
  AnalysisPipeline, RegisteredVsActual, ComputeRealityTable, ParallelPatterns,
  AdviceProvenance, DocExcerpt,
} from './graphics'

export default function ToniJuly2026() {
  const [i, setI] = useState(0)
  const [density, setDensity] = useState(() => {
    try { return localStorage.getItem('toniDensity') || 'minimal' } catch { return 'minimal' }
  })
  const [showNotes, setShowNotes] = useState(false)

  const slides = SLIDES
  const total  = slides.length
  const go = useCallback((d) => setI(v => Math.min(total - 1, Math.max(0, v + d))), [total])

  const setDens = useCallback((d) => {
    setDensity(d)
    try { localStorage.setItem('toniDensity', d) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp')                { e.preventDefault(); go(-1) }
      else if (e.key === 'n' || e.key === 'N')                             { setShowNotes(s => !s) }
      else if (e.key === 'Home')                                          { setI(0) }
      else if (e.key === 'End')                                           { setI(total - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, total])

  const slide = slides[i]

  return (
    <div style={K.stage} data-toni onClick={() => go(1)}>
      <div style={K.controls} onClick={e => e.stopPropagation()}>
        <div style={K.toggle}>
          {['minimal', 'reading'].map(d => (
            <button key={d} onClick={() => setDens(d)} style={{ ...K.toggleBtn, ...(density === d ? K.toggleOn : {}) }}>
              {d === 'minimal' ? 'Minimal' : 'Reading'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNotes(s => !s)} style={{ ...K.notesBtn, ...(showNotes ? K.toggleOn : {}) }} title="Speaker notes (N)">
          Notes
        </button>
      </div>

      <div style={K.slideArea}>
        {slide.render(density)}
      </div>

      <div style={K.bottom} onClick={e => e.stopPropagation()}>
        <button onClick={() => go(-1)} style={{ ...K.navArrow, visibility: i === 0 ? 'hidden' : 'visible' }} aria-label="Previous">‹</button>
        <span style={K.counter}>{i + 1} / {total}</span>
        <button onClick={() => go(1)} style={{ ...K.navArrow, visibility: i === total - 1 ? 'hidden' : 'visible' }} aria-label="Next">›</button>
      </div>

      {i === 0 && <div style={K.clickHint}>click anywhere to advance · N for notes</div>}

      {showNotes && slide.note && (
        <div style={K.noteOverlay} onClick={e => e.stopPropagation()}>
          <span style={K.noteLabel}>Speaker note</span>
          <div style={K.noteBody}>{slide.note}</div>
        </div>
      )}
    </div>
  )
}

// ── Layout + content helpers ────────────────────────────────────────────────

function Frame({ kicker, children, wide }) {
  return (
    <div style={{ ...K.frame, ...(wide ? K.frameWide : {}) }}>
      {kicker && <div style={K.kicker}>{kicker}</div>}
      {children}
    </div>
  )
}
const H    = ({ children }) => <h1 style={K.h}>{children}</h1>
const H2   = ({ children }) => <h2 style={K.h2}>{children}</h2>
const Lead = ({ children }) => <p style={K.lead}>{children}</p>
function Bullets({ items }) {
  return (
    <ul style={K.ul}>
      {items.map((t, i) => <li key={i} style={K.li}>{t}</li>)}
    </ul>
  )
}
function Detail({ density, children }) {
  if (density !== 'reading') return null
  return <p style={K.detail}>{children}</p>
}

// Act divider — pink for dataset 1, blue for dataset 2.
function DatasetDivider({ n, tone, title, sub, points }) {
  return (
    <Frame>
      <div style={{ ...K.datasetBadge, color: tone, borderColor: `${tone}55`, background: `${tone}12` }}>DATASET {n}</div>
      <h1 style={{ ...K.title, marginTop: 6 }}>{title}</h1>
      <p style={{ ...K.subtitle, color: tone }}>{sub}</p>
      {points && (
        <div style={K.dividerPoints}>
          {points.map((p, i) => <span key={i} style={{ ...K.dividerChip, borderColor: `${tone}44` }}>{p}</span>)}
        </div>
      )}
    </Frame>
  )
}

// ── Slides ──────────────────────────────────────────────────────────────────

const SLIDES = [
  // 1 — Title
  {
    render: () => (
      <Frame wide>
        <div style={K.titleRow}>
          <img
            src="/toni-july-2026/chatwithAI.gif"
            alt="A researcher and an AI agent working together at a laptop"
            style={K.heroImg}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
          <div style={K.titleText}>
            <div style={{ ...K.crests, marginBottom: 10 }}>
              <img src="/RADlab_Logo_light.svg" alt="RADlab" style={{ height: 48 }} onError={e => { e.currentTarget.style.display = 'none' }} />
              <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 48 }} onError={e => { e.currentTarget.style.display = 'none' }} />
            </div>
            <h1 style={{ ...K.title, textAlign: 'left' }}>From DICOMs to denoised fMRI</h1>
            <p style={{ ...K.subtitle, textAlign: 'left' }}>— with an AI agent in the loop</p>
            <div style={{ height: 12 }} />
            <p style={{ ...K.author, textAlign: 'left' }}>intero2024 · interoception fMRI · 53 subjects</p>
            <p style={{ ...K.affil, textAlign: 'left' }}>BIDS → MRIQC → fMRIPrep → ICA-AROMA</p>
            <p style={{ ...K.event, textAlign: 'left' }}>ToNI Users Meeting · July 2026</p>
            <p style={K.facility}>Toronto Neuroimaging Facility · University of Toronto</p>
          </div>
        </div>
      </Frame>
    ),
    note: 'Two stories at once: how we preprocessed the interoception dataset, and what it was like to run that pipeline with an AI coding agent doing the driving and debugging.',
  },

  // 2 — The maze of analytic choices (motivation)
  {
    note: 'The “garden of forking paths”: every preprocessing step has several defensible options, and the combinations explode. The point isn’t that one path is objectively right — it’s that you have to choose deliberately and make the choice reproducible. This motivates the design conversation a few slides on.',
    render: (d) => (
      <Frame wide kicker="Why this is hard">
        <div style={K.splitRow}>
          <div style={K.splitText}>
            <H2>fMRI preprocessing is a maze of choices</H2>
            <Bullets items={[
              'Every step forks: which template? recon-all on? which output spaces? distortion correction? which denoising strategy? how much smoothing?',
              'Each fork is defensible on its own — and each one moves the results.',
              'The combinations explode far faster than anyone can eyeball.',
            ]} />
            <Lead>The goal isn’t to find the one “true” path — it’s to choose deliberately, and make the path reproducible.</Lead>
            <Detail density={d}>
              This is the “garden of forking paths” — researcher degrees of freedom at every stage. It’s exactly
              why the next few slides are a design conversation: deciding the path on purpose, then locking it in.
            </Detail>
          </div>
          <img
            src="/toni-july-2026/nerdchoices.png"
            alt="A person standing on a single lit path through a vast dark maze of options"
            style={K.splitImg}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        </div>
      </Frame>
    ),
  },

  // 3 — Why a replay
  {
    note: 'Everything shown is from the actual run. The agent had the full session in memory, so the transcript is faithful, not dramatized.',
    render: (d) => (
      <Frame kicker="Ground rules">
        <H2>You’re seeing a replay, not a live run</H2>
        <Bullets items={[
          'The real pipeline ran ~4 days of wall-clock compute across 53 subjects.',
          'recon-all alone is ~6–10 h/subject — nobody wants to watch that.',
          'So we replay the interactions, and show the fast read-only checks as real terminal output.',
        ]} />
        <Detail density={d}>
          None of the commands on these slides execute here — they ran on the imaging box. They’re shown
          verbatim with their real output so the artifacts are inspectable, without a multi-day live run.
        </Detail>
      </Frame>
    ),
  },

  // 3 — Roadmap
  {
    render: () => (
      <Frame kicker="Roadmap">
        <H2>Two datasets, two phases of the pipeline</H2>
        <Bullets items={[
          'Dataset 1 — healthy-control breath study: getting preprocessing right (Parts A–D below).',
          'Dataset 2 — a clinical sample: picking up after fMRIPrep for pre-registered functional analysis.',
          'Throughout: the same collaboration with an AI coding agent — and the patterns that recur.',
        ]} />
        <Detail density="reading">
          Part A the study &amp; data · Part B deciding + running the pipeline · Part C two real incidents ·
          Part D autonomy &amp; results — all dataset 1; then the dataset-2 analysis act, then a synthesis.
        </Detail>
      </Frame>
    ),
  },

  // 3b — Dataset 1 divider (light retro-label)
  {
    render: () => (
      <DatasetDivider
        n="1"
        tone="#f068a4"
        title="Healthy-control breath study"
        sub="getting preprocessing right"
        points={['intero2024 · 53 subjects', 'DICOM → BIDS → fMRIPrep → AROMA', 'the pipeline & the agent incidents']}
      />
    ),
    note: 'Dataset 1 is the preprocessing story: healthy controls, the breath-monitoring study, and the agent driving the pipeline. Dataset 2 later picks up downstream, in a clinical sample.',
  },

  // 4 — intero2024 in one slide
  {
    note: 'Interoception implicates insula, brainstem, thalamus — that drove a couple of config choices later (surface + subcortical together).',
    render: (d) => (
      <Frame wide kicker="Part A · the study">
        <H2>intero2024 in one slide</H2>
        <p style={K.provenance}>Acquired on the Siemens Prisma 3T · ToNI</p>
        <StatTiles items={[
          { big: '53', label: 'subjects · single session' },
          { big: '251', label: 'BOLD runs total' },
          { big: '3', label: 'tasks per subject' },
          { big: '1', label: 'T1w MPRAGE / subject' },
        ]} />
        <Bullets items={[
          'localizer run-1/run-2 (~196 vols, matched pair)',
          'breathing run-1/run-2 (~242 vols, matched pair)',
          'authenticity (~172 vols, single run)',
        ]} />
        <Detail density={d}>
          Interoception implicates insula, brainstem, and thalamus — which is why the fMRIPrep config later
          asks for surface and subcortical outputs together (CIFTI grayordinates).
        </Detail>
      </Frame>
    ),
  },

  // 5 — Messy reality
  {
    note: 'None of this is in the textbook. Handling per-subject exceptions reproducibly is most of the real work — a place the agent helped by encoding decisions in code, not by hand.',
    render: (d) => (
      <Frame kicker="Part A · the data">
        <H2>The messy reality of real scanner data</H2>
        <Bullets items={[
          'Aborted + restarted runs → keep the full one, drop the fragments.',
          'Missing runs on short sessions (sub-065 / 083 localizer-only; sub-080 no auth).',
          'Two T1w on some subjects → pick the sharper scan by a quantitative check.',
          'A few runs with no PA fieldmap → no susceptibility distortion correction for those.',
        ]} />
        <Lead>The principle throughout: process everything, exclude later — never silently delete data.</Lead>
        <Detail density={d}>
          Every exception was encoded in code, not fixed by hand, so a re-run reproduces the same choices.
        </Detail>
      </Frame>
    ),
  },

  // Setup 1 — kickoff + recon-all
  {
    note: 'Reconstructed design conversation — the decisions shown (recon-all on, the output-space set, a separate AROMA step, nonaggr denoising, containers) are the real ones, from the run’s records and memory; the wording is representative. Worth being honest about *why* the agent answers so fast: it isn’t assuming — it’s (a) proposing the field-standard pipeline it would suggest to almost anyone, and (b) carrying memory of prior preferences from earlier sessions, so it doesn’t re-litigate the basics. Little of “where do we start?” is bespoke recall; most is field default + the study you just described. (See the “what does the advice depend on?” backup slide.)',
    render: (d) => (
      <Frame wide kicker="Part B · deciding the pipeline">
        <H2>Session zero: what do we even run?</H2>
        <ChatThread messages={[
          { who: 'norm', tag: 'norm', text: 'intero2024 — 53 subjects, interoception fMRI, raw DICOMs off the scanner. I want a clean, reproducible preprocessing pipeline. Where do we start?' },
          { who: 'agent', tag: 'agent — proposing the standard route', text: 'BIDS-format first, then fMRIPrep for registration, recon-all, and normalization — field standard, containerizes cleanly. First fork: full FreeSurfer surfaces (recon-all) on? It’s 6–10 h/subject.' },
          { who: 'norm', tag: 'norm — owns the science', text: 'On. Interoception lives in insula, brainstem, thalamus — I want surfaces and subcortical together.' },
        ]} />
        <p style={K.aside}>
          It skips the basics because prior sessions are in its memory — remembering, not assuming. But most of this
          answer is the field-standard pipeline it’d propose to anyone, plus what you just described.
        </p>
        <Detail density={d}>
          The human makes the scientific call; the agent surfaces the cost (6–10 h/subject) and the options.
          That single “surfaces + subcortical” decision is what later forces the CIFTI 91k grayordinate output.
        </Detail>
      </Frame>
    ),
  },

  // Setup 2 — output spaces + the AROMA dependency
  {
    note: 'This is the foreshadow. NLin6Asym is chosen here, in the design conversation, specifically because AROMA can’t run without it — the payoff lands on the Stage 4a and 4b slides.',
    render: (d) => (
      <Frame wide kicker="Part B · deciding the pipeline">
        <H2>The choice that quietly runs everything: output spaces</H2>
        <ChatThread messages={[
          { who: 'agent', tag: 'agent — flagging a dependency', text: 'Output spaces drive everything downstream. NLin2009cAsym for reporting. But if you want ICA-AROMA denoising, we also need NLin6Asym — AROMA only runs in that space.' },
          { who: 'norm', tag: 'norm', text: 'Yes to AROMA. Add both, plus T1w, fsnative, fsaverage5, and CIFTI 91k.' },
          { who: 'agent', tag: 'agent — making the dependency explicit', text: 'Then NLin6Asym is load-bearing. I’ll note it as a hard prerequisite in the runbook so a future edit doesn’t quietly drop it and silently break AROMA.' },
        ]} />
        <Detail density={d}>
          NLin6Asym isn’t cosmetic — it’s the prerequisite that makes Stage 4b possible at all. Deciding it
          here, on purpose, is why it didn’t become an incident later.
        </Detail>
      </Frame>
    ),
  },

  // Setup 3 — AROMA is separate + reproducibility (chat + scaffolding terminal)
  {
    note: 'A common misconception is that fMRIPrep still does AROMA. It doesn’t — removed in v21.0. Settling that here (separate BIDS-App) is what shapes the whole two-container design.',
    render: (d) => (
      <Frame wide kicker="Part B · deciding the pipeline">
        <H2>One surprise, then lock in reproducibility</H2>
        <ChatThread messages={[
          { who: 'norm', tag: 'norm', text: 'Just run AROMA inside fMRIPrep?' },
          { who: 'agent', tag: 'agent', text: 'Can’t — ICA-AROMA was pulled from fMRIPrep core in v21.0. We run the standalone fMRIPost-AROMA on the derivatives, non-aggressive denoising. I’ll pin every stage to an Apptainer container and wrap each in a resumable launcher.' },
        ]} />
        <Lead>“It can run for a week — that’s fine. Don’t cut corners for speed.”</Lead>
        <Terminal
          title="agent — scaffolding the pipeline"
          maxWidth={720}
          lines={[
            { k: 'cmd', t: 'apptainer pull containers/fmriprep-24.1.1.sif docker://nipreps/fmriprep:24.1.1' },
            { k: 'dim', t: 'Getting image source signatures … Writing manifest … done' },
            { k: 'cmd', t: 'ls code/' },
            { k: 'out', t: 'nifti_to_bids.py  deface_t1w.sh  run_mriqc.sh  run_fmriprep.sh  run_fmripost_aroma.sh' },
            { k: 'comment', t: 'every stage = one pinned container + one resumable launcher' },
          ]}
        />
        <Detail density={d}>
          With the science and the reproducibility contract settled, everything after this is execution —
          which is exactly where the two incidents come from.
        </Detail>
      </Frame>
    ),
  },

  // 6 — Four stages (pipeline diagram + terminal)
  {
    note: 'Each stage is a script + a container. That matters for the agent story: reproducible, resumable units it could run, monitor, and fix independently.',
    render: (d) => (
      <Frame wide kicker="Part B · the pipeline">
        <H2>Four stages, each a script + a container</H2>
        <PipelineDiagram />
        <Terminal
          title="intero2024 — reproducible units"
          maxWidth={720}
          lines={[
            { k: 'cmd', t: 'ls code/*.sh' },
            { k: 'out', t: 'nifti_to_bids.py  deface_t1w.sh  run_mriqc.sh  run_fmriprep.sh  run_fmripost_aroma.sh' },
            { k: 'cmd', t: 'ls containers/*.sif' },
            { k: 'out', t: 'fmriprep-24.1.1.sif  fmripost-aroma-main.sif  mriqc.sif  pydeface.sif' },
          ]}
        />
        <Detail density={d}>
          Everything containerized with Apptainer and wrapped in reproducible launchers — the safe, resumable
          units the agent drove.
        </Detail>
      </Frame>
    ),
  },

  // 7 — Stage 1–2
  {
    note: 'The T1w QC choice between duplicate scans is encoded in code so a re-run reproduces the same choice — not a manual pick.',
    render: (d) => (
      <Frame kicker="Stages 1–2 · BIDS + defacing">
        <H2>Convert, deface, QC — on copies, never the source</H2>
        <Bullets items={[
          'pepolar (PA blip) susceptibility correction chosen over GRE fieldmaps.',
          'T1w defaced for privacy — but on copies; source untouched.',
          'T1w QC: EFC + sharpness metrics pick the better of duplicate scans, encoded in code.',
          'Result: bids-validator EXIT=0; custom audit clean.',
        ]} />
        <Detail density={d}>
          Defacing and duplicate-scan selection are the first places a reproducible, code-encoded decision
          beats a one-off manual judgement call.
        </Detail>
      </Frame>
    ),
  },

  // 8 — Stage 3 MRIQC (terminal)
  {
    note: 'Motion exclusion is an analysis-stage decision. Every run still went through fMRIPrep.',
    render: (d) => (
      <Frame wide kicker="Stage 3 · MRIQC">
        <H2>Automated image-quality metrics — all 53, 0 failures</H2>
        <Bullets items={[
          'Anatomicals all usable; worst functional = motion on the breathing task (people move when they breathe to instruction).',
          'Outputs a per-run flag table → feeds downstream exclusion, not deletion.',
        ]} />
        <Terminal
          title="derivatives/qc_flags.tsv"
          maxWidth={720}
          lines={[
            { k: 'cmd', t: 'head derivatives/qc_flags.tsv' },
            { k: 'dim', t: 'subject  task          fd_mean  flag' },
            { k: 'out', t: 'sub-001  localizer      0.12     ok' },
            { k: 'out', t: 'sub-001  breathing      0.31     review' },
            { k: 'out', t: 'sub-002  authenticity   0.09     ok' },
            { k: 'dim', t: '…  (flags feed analysis-stage exclusion — no run is deleted)' },
          ]}
        />
        <Detail density={d}>
          The flag table is advisory. Exclusion happens later, in analysis — every run still went through
          fMRIPrep regardless of its motion flag.
        </Detail>
      </Frame>
    ),
  },

  // 9 — Stage 4a fMRIPrep config
  {
    note: 'The NLin6Asym choice is a foreshadow — it is a hard prerequisite for the next stage (ICA-AROMA).',
    render: (d) => (
      <Frame wide kicker="Stage 4a · fMRIPrep 24.1.1">
        <H2>The heavy lifting — and one load-bearing config choice</H2>
        <Bullets items={[
          'FreeSurfer recon-all ON (full surfaces).',
          'Output spaces: MNI152NLin6Asym + MNI152NLin2009cAsym + T1w + fsnative + fsaverage5, plus CIFTI 91k.',
          'NLin2009c = reporting standard · NLin6Asym = required so ICA-AROMA can run · CIFTI = surface + subcortical together.',
          '“Can run for a week, that’s fine” → no corners cut for speed.',
        ]} />
        <Detail density={d}>
          NLin6Asym isn’t optional cosmetics — it’s a hard prerequisite for the standalone AROMA step two
          slides from now. Choosing it here is what makes that step possible at all.
        </Detail>
      </Frame>
    ),
  },

  // 10 — Stage 4b why separate AROMA
  {
    note: 'A common misconception is that fMRIPrep still does AROMA. It doesn’t — removed in v21.0. This trips people up, and it tripped up the first version of our launcher.',
    render: (d) => (
      <Frame kicker="Stage 4b · fMRIPost-AROMA">
        <H2>Why a separate AROMA step at all</H2>
        <Bullets items={[
          'ICA-AROMA was removed from fMRIPrep core in v21.0 — not available in 24.1.1.',
          'So: run the standalone fMRIPost-AROMA BIDS-App on the fMRIPrep derivatives.',
          'Non-aggressive denoising (--denoising-method nonaggr) → desc-nonaggrDenoised_bold.',
          'fMRIPrep still emits aCompCor / tCompCor / motion / FD confounds for alternative strategies.',
        ]} />
        <Detail density={d}>
          The misconception that fMRIPrep still runs AROMA is exactly what tripped up the first version of
          our launcher — the setup for Incident 2.
        </Detail>
      </Frame>
    ),
  },

  // 11 — Collaboration model (resume chat)
  {
    note: 'No re-briefing. It pulled its own memory of the project and went to look at actual disk state — which is where story #1 starts.',
    render: (d) => (
      <Frame kicker="Part C · the agent story">
        <H2>The collaboration model</H2>
        <ResumeChat />
        <Detail density={d}>
          The agent runs in the terminal — reads files, runs commands, edits scripts — and carries persistent
          memory across sessions: study design, config prefs, and the standing rule “run batches autonomously,
          only interrupt on error.”
        </Detail>
      </Frame>
    ),
  },

  // 12 — Incident 1: it stopped (terminal df)
  {
    note: 'The obvious read was “the process died, restart it.” The non-obvious truth was a resource exhaustion the restart would have hit again in hours.',
    render: (d) => (
      <Frame wide kicker="Incident 1">
        <H2>“It stopped” — but why?</H2>
        <Terminal
          title="normega@imaging — diagnosing the halt"
          maxWidth={760}
          lines={[
            { k: 'cmd', t: 'pgrep -fa fmriprep' },
            { k: 'dim', t: '(nothing — no processes running)' },
            { k: 'cmd', t: 'df -h /media/normega/FB_Cluster_Data | tail -1' },
            { k: 'bad', t: '/dev/sdb1  1.9T  1.9T  0  100%  /media/normega/FB_Cluster_Data' },
            { k: 'cmd', t: 'du -sh work/' },
            { k: 'bad', t: '678G   work/' },
          ]}
        />
        <Lead>The 1.9 TB drive was 100% full. fMRIPrep’s <code>work/</code> scratch had ballooned to 678 GB.</Lead>
        <Detail density={d}>
          The agent didn’t stop at “process not running.” It checked the disk — and found resource exhaustion
          a naïve restart would have re-hit within hours.
        </Detail>
      </Frame>
    ),
  },

  // 13 — Incident 1: root cause (disk timeline)
  {
    note: 'It verified before deleting anything — checked that recon-all.done existed for the in-flight subjects. Measure twice, cut once.',
    render: (d) => (
      <Frame wide kicker="Incident 1 · root cause">
        <H2>Scratch grows unbounded and is never auto-cleaned</H2>
        <DiskTimeline />
        <Bullets items={[
          'fMRIPrep work scratch ≈ 20–25 GB per subject, never auto-cleaned → 53 subjects ≈ ~1 TB.',
          'Key safety insight: recon-all output lives OUTSIDE work/ (in derivatives/…/freesurfer/).',
          'So wiping scratch loses intermediate files only — the 6–10 h/subject recon is preserved.',
        ]} />
        <Detail density={d}>
          Before deleting anything, the agent confirmed recon-all.done existed for the in-flight subjects —
          verifying the expensive work was safe elsewhere. Measure twice, cut once.
        </Detail>
      </Frame>
    ),
  },

  // 14 — Incident 1: the fix (terminal)
  {
    note: 'One root-cause fix turned a recurring crash into a clean multi-day run.',
    render: (d) => (
      <Frame wide kicker="Incident 1 · the fix">
        <H2>Free the disk, then stop it happening again</H2>
        <Bullets items={[
          'Wiped scratch → freed 678 GB instantly (drive 100% → 69%).',
          'Patched the launcher to delete each subject’s scratch on success → peak ≈ 4×23 GB, not unbounded.',
          'Cleared stale recon-all crash locks so interrupted subjects could resume.',
          'Relaunched; idempotent design skipped the 26 already-done subjects.',
        ]} />
        <Terminal
          title="df -h — healthy now"
          maxWidth={720}
          lines={[
            { k: 'cmd', t: 'df -h /media/normega/FB_Cluster_Data | tail -1' },
            { k: 'ok',  t: '/dev/sdb1  1.9T  1.3T  0.6T  69%  /media/normega/FB_Cluster_Data' },
          ]}
        />
        <Detail density={d}>
          The fix was to the script, not just the running job — so the cleanup is permanent, and the recurring
          overflow can’t come back on the next launch.
        </Detail>
      </Frame>
    ),
  },

  // 15 — Incident 2: everything failed (terminal)
  {
    note: '36 subjects had literally printed “finished successfully” — yet were logged as FAIL. Something didn’t add up. Note: this grep is an incident-time snapshot — the launcher truncates its log on each new batch, so on today’s log (the clean re-run) the same command returns 17, not 36. Present the 36 as “what we saw during the broken batch,” not a live check.',
    render: (d) => (
      <Frame wide kicker="Incident 2">
        <H2>“Everything failed” — it didn’t</H2>
        <Bullets items={[
          'AROMA launched over 53 subjects. Next check: 40 lines saying FAIL, 0 OK.',
          'AND the disk dropping fast again (392 GB → 116 GB).',
          'First action: stop the batch to protect the disk, then diagnose calmly.',
        ]} />
        <Terminal
          title="the punchline check · captured during the broken batch"
          maxWidth={740}
          lines={[
            { k: 'comment', t: 'mid-incident — the launcher truncates this log on each new batch' },
            { k: 'cmd', t: 'grep -c "finished successfully" code/fmripost_aroma_log.txt' },
            { k: 'ok',  t: '36' },
            { k: 'comment', t: '…yet all 36 were logged FAIL. (The later clean re-run overwrote this log → it now reads 17.)' },
          ]}
        />
        <Detail density={d}>
          36 subjects had literally printed “finished successfully” while being logged as failures. The science
          was fine; the way we detected success was not.
        </Detail>
      </Frame>
    ),
  },

  // 16 — Incident 2: the real bug (exit-code diagram)
  {
    note: 'The failure wasn’t in the science — it was in how we detected success. A classic exit-code-vs-reality mismatch.',
    render: (d) => (
      <Frame wide kicker="Incident 2 · the real bug">
        <H2>The exit code lied</H2>
        <ExitCodeDiagram />
        <Detail density={d}>
          Every subject was verified genuinely complete — the right number of denoised runs for its acquisition
          (5 normally; 1 for localizer-only; 3 for partial). The only thing wrong was trusting $? over reality.
        </Detail>
      </Frame>
    ),
  },

  // 17 — Incident 2: the fix + honest miss (terminal)
  {
    note: 'Including the miss on purpose. The value isn’t that the agent is infallible — it’s that it caught the problem within one monitoring cycle and recovered without data loss.',
    render: (d) => (
      <Frame wide kicker="Incident 2 · the fix (+ an honest miss)">
        <H2>Judge success by reality, not by $?</H2>
        <Terminal
          title="run_fmripost_aroma.sh — success detection"
          maxWidth={760}
          lines={[
            { k: 'comment', t: 'WRONG: trusts the exit code (this build returns non-zero on success)' },
            { k: 'bad', t: 'apptainer run ... && echo OK || echo FAIL' },
            { k: 'blank' },
            { k: 'comment', t: 'RIGHT: trust the log message + the report file' },
            { k: 'out', t: 'apptainer run ... >"$slog" 2>&1 || true' },
            { k: 'ok',  t: 'if grep -q "fMRIPost-AROMA finished successfully" "$slog" \\' },
            { k: 'ok',  t: '   && [ -f "$OUT/$sub.html" ]; then echo OK; rm -rf "$scratch"' },
            { k: 'ok',  t: 'else echo FAIL; fi' },
          ]}
        />
        <Bullets items={[
          'Re-ran only the 17 unfinished subjects (36 valid ones skipped) → 17 OK, 0 FAIL.',
          '🟡 Honest miss: the smoke-test only ran far enough to confirm argument parsing, not to the exit — so the exit-code quirk slipped to the batch. Smoke-test must reach the exit.',
        ]} />
        <Detail density={d}>
          Caught within one monitoring cycle and recovered with no data loss — but the lesson stands: a smoke
          test that stops at “it started” can’t catch a bug that only shows up at “it finished.”
        </Detail>
      </Frame>
    ),
  },

  // 18 — Idempotency + markers
  {
    note: 'This is the unsung hero. Because every unit was idempotent, “crash, fix, relaunch” was always safe — we never reprocessed good data or lost work.',
    render: (d) => (
      <Frame kicker="Why nothing got lost">
        <H2>Idempotency + completion markers</H2>
        <Bullets items={[
          'Each stage writes a completion marker (top-level sub-XXX.html).',
          'Re-running “all” skips finished subjects → interruptions and re-launches are safe.',
          'Killed-mid-run subjects have a partial dir but no marker → they re-run cleanly.',
        ]} />
        <Detail density={d}>
          Both incidents ended in “crash, fix, relaunch” — and that was safe every time only because each unit
          was idempotent with an explicit done-marker. No good data was ever reprocessed or lost.
        </Detail>
      </Frame>
    ),
  },

  // 19 — Autonomous monitoring
  {
    note: 'It behaved like a careful labmate watching a long run overnight — pinging me only when it mattered.',
    render: (d) => (
      <Frame wide kicker="Part D · autonomy">
        <H2>Autonomous monitoring over days</H2>
        <Bullets items={[
          'Standing instruction (from memory): run long batches autonomously; only interrupt on error or completion.',
          'Scheduled hourly self-wakeups: check disk, count completions, confirm jobs alive — and stayed silent when all was well.',
          'Auto-advanced fMRIPrep → AROMA without being asked: pulled the container, verified the CLI, launched the next stage.',
        ]} />
        <Terminal
          title="hourly self-check (silent unless something is wrong)"
          maxWidth={720}
          lines={[
            { k: 'dim', t: '03:00  disk 71%  · fmriprep 41/53 · job alive        → quiet' },
            { k: 'dim', t: '04:00  disk 73%  · fmriprep 44/53 · job alive        → quiet' },
            { k: 'warn', t: '05:00  disk 71%  · fmriprep 53/53 DONE              → advance to AROMA' },
          ]}
        />
        <Detail density={d}>
          The autonomy contract — “only interrupt on error or completion” — is what made a multi-day run
          tolerable: no noise when healthy, a ping when it mattered.
        </Detail>
      </Frame>
    ),
  },

  // 20 — Results (counters + terminal)
  {
    note: 'Open one subject’s fMRIPrep or AROMA HTML report here if you want to show real QC (public/... or on the box).',
    render: (d) => (
      <Frame wide kicker="Part D · results">
        <H2>Complete coverage, disk stable</H2>
        <ResultsCounters />
        <Terminal
          title="real, current state"
          maxWidth={720}
          lines={[
            { k: 'cmd', t: 'ls derivatives/fmriprep/sub-*.html | wc -l' },
            { k: 'ok',  t: '53' },
            { k: 'cmd', t: 'ls derivatives/fmripost_aroma/sub-*.html | wc -l' },
            { k: 'ok',  t: '53' },
            { k: 'cmd', t: "find derivatives/fmripost_aroma -name '*nonaggrDenoised_bold.nii.gz' | wc -l" },
            { k: 'ok',  t: '251' },
          ]}
        />
        <Detail density={d}>
          Reproducible scripts + pinned containers + in-repo process docs; the counts match each acquisition
          exactly. Every artifact above is inspectable on the box.
        </Detail>
      </Frame>
    ),
  },

  // T1 — the decision record ships with the code
  {
    note: 'These are the real in-repo docs (code/*.md on the imaging box), not mockups. The point: every non-obvious choice is written down next to the scripts that run it, so a labmate, a reviewer, or a fresh agent can see what was done and why. The §3 decision list shown is verbatim from BIDS_CONVERSION_PROCESS.md.',
    render: (d) => (
      <Frame wide kicker="Dataset 1 · traceability & reproducibility">
        <H2>The choices live in the repo, not in someone’s head</H2>
        <Terminal
          title="the decision record ships with the code"
          maxWidth={760}
          lines={[
            { k: 'cmd', t: 'ls code/*.md' },
            { k: 'out', t: 'BIDS_CONVERSION_PROCESS.md   FMRIPREP_AROMA_RUNBOOK.md   MRIQC_QC_SUMMARY.md' },
            { k: 'comment', t: 'every non-obvious choice → written down, beside the scripts that run it' },
          ]}
        />
        <DocExcerpt
          file="code/BIDS_CONVERSION_PROCESS.md"
          section="§3 Decisions (confirmed with PI)"
          maxWidth={760}
          lines={[
            { k: 'li', t: 'SDC: PA pepolar (complete per-run coverage; GRE maps excluded to avoid ambiguity).' },
            { k: 'li', t: 'Task labels: localizer / breathing / authenticity.' },
            { k: 'li', t: 'Aborted fragments excluded from BIDS (kept in Nifti/); complete restart kept.' },
            { k: 'li', t: 'Defacing: yes (containerized pydeface, on copies).' },
            { k: 'li', t: 'fMRIPrep engine: Apptainer/Singularity.' },
          ]}
        />
        <Lead>A labmate, a reviewer, or a fresh agent can open these and see exactly what was done and why — and a re-run reproduces the same decisions.</Lead>
        <Detail density={d}>
          The three docs cover conversion (what/why for every sequence + the SDC choice), the fMRIPrep/AROMA
          config with its failure modes and recovery, and per-run QC with exclusion rationale. Nothing lives
          only in a chat log or someone’s memory.
        </Detail>
      </Frame>
    ),
  },

  // T2 — one decision traced end to end (doc → code → command)
  {
    note: 'Traceability made concrete: the same decision appears as prose rationale in the runbook, as the exact code that implements it, and as a re-runnable command. A reviewer can follow the whole chain. The code shown is verbatim from run_fmripost_aroma.sh (verified against the box).',
    render: (d) => (
      <Frame wide kicker="Dataset 1 · traceability & reproducibility">
        <H2>One decision, traced end to end</H2>
        <DocExcerpt
          file="code/FMRIPREP_AROMA_RUNBOOK.md"
          section="§3 — the exit-code gotcha"
          maxWidth={780}
          lines={[
            { k: 'p', t: 'This build prints “finished successfully!”, writes every output, then exits non-zero.' },
            { k: 'li', t: 'Declare OK iff the log says so AND the report file exists — not by $?.' },
            { k: 'li', t: 'Clean scratch only on that real-success signal.' },
          ]}
        />
        <div style={K.traceLink}>↓ &nbsp;documented decision, implemented verbatim</div>
        <Terminal
          title="run_fmripost_aroma.sh:58 — the code, then the re-runnable command"
          maxWidth={780}
          lines={[
            { k: 'out', t: 'if grep -q "fMRIPost-AROMA finished successfully" "$slog" \\' },
            { k: 'ok',  t: '   && [ -f "$OUT/${sub}.html" ]; then echo OK; rm -rf "$WORK/.../sub_${label}_wf"' },
            { k: 'out', t: 'else echo FAIL; fi' },
            { k: 'blank' },
            { k: 'cmd', t: './run_fmripost_aroma.sh all 4' },
            { k: 'comment', t: 'idempotent — skips finished subjects, re-runs only the rest' },
          ]}
        />
        <Lead>The prose says <i>why</i>; the script does exactly that; the command re-runs it. A reviewer can follow the whole chain — traceability, not a claim.</Lead>
        <Detail density={d}>
          This is the same discipline dataset 2 applies to its pre-registration — decisions captured, locked,
          and reproducible — just upstream, in the preprocessing rather than the analysis.
        </Detail>
      </Frame>
    ),
  },

  // ════ DATASET 2 — downstream analysis, clinical sample (blue accent) ════

  // D2-1 — Dataset 2 divider + ethics/pre-reg framing (public methods-only)
  {
    render: () => (
      <DatasetDivider
        n="2"
        tone="#4A90D9"
        title="Downstream analysis, a clinical sample"
        sub="picking up after fMRIPrep"
        points={['Pre-registered · OSF xctf6', 'Consented clinical sample', 'Methods only · no participant data shown']}
      />
    ),
    note: 'Deliberate framing: this is a clinical suicidal-ideation study, pre-registered (OSF xctf6) and consented. Nothing participant-level appears anywhere in this act — the focus is neuroimaging methods and how the AI collaboration worked. Not results; those aren’t in yet.',
  },

  // D2-2 — study & registered plan (starts from fMRIPrep)
  {
    note: 'The PI flagged the pre-registration PDF as authoritative. Registered: fMRIPrep → FSL FEAT → TFCE/permutation, FDR q<.001 as the registered fallback; ROI claims via whole-brain correction then Harvard–Oxford labeling; networks via the CAREN atlas.',
    render: (d) => (
      <Frame wide kicker="Dataset 2 · the study & the registered plan">
        <H2>A 2×2 imagery study, pre-registered end to end</H2>
        <StatTiles items={[
          { big: '56', label: 'participants · clinical sample', c: '#4A90D9' },
          { big: '2×2', label: 'Imagery × Processing mode', c: '#4A90D9' },
          { big: '5', label: 'pre-registered hypotheses', c: '#4A90D9' },
        ]} />
        <AnalysisPipeline />
        <Detail density={d}>
          Imagery content (Suicidal vs Neutral) × processing mode (Decentered “Sense” vs Analytic “Judge”),
          ~60 s imagery blocks. Registered analysis: fMRIPrep → FSL FEAT → TFCE + permutation (randomise), with
          FDR q&lt;.001 as the registered fallback; ROI claims adjudicated by whole-brain correction then
          Harvard–Oxford labeling.
        </Detail>
      </Frame>
    ),
  },

  // D2-3 — the brief / planning partnership
  {
    note: 'That last clause — “please ask me instead of making assumptions” — set the tone: a planning partnership, not autopilot. Nearly every consequential fork was surfaced as a question.',
    render: (d) => (
      <Frame wide kicker="Dataset 2 · the collaboration">
        <H2>“Please ask me instead of making assumptions”</H2>
        <ChatThread messages={[
          { who: 'norm', tag: 'the brief', text: 'Review the current scripts, re-run the R to confirm reproducibility, and discuss improvements. Especially review how we honour the pre-registration — the PDF is authoritative. Please ask me instead of making assumptions.' },
          { who: 'agent', tag: 'agent — planning partner, not autopilot', text: 'Understood. I’ll reproduce the behavioural pipeline first, then surface every gap between what’s registered and what the code actually does — as questions, not silent choices.' },
        ]} />
        <Detail density={d}>
          Reproducing the R behavioural pipeline was the easy part — bit-for-bit on a pinned R version. The
          substance was the gap between the registration and the code, and that gap got worked as a conversation.
        </Detail>
      </Frame>
    ),
  },

  // D2-4 — honouring the pre-registration (centerpiece)
  {
    note: 'The heart of the methods story. Separate two things easy to conflate: the engine swap (SPM↔FSL, minor) vs the error-control method (cluster p<.005 → TFCE/permutation, the substantive fix, post-Eklund, Nichols & Knutsson 2016). Forks were locked before any group map was seen.',
    render: (d) => (
      <Frame wide kicker="Dataset 2 · honouring the pre-registration">
        <H2>Registered vs. what the code actually did</H2>
        <RegisteredVsActual />
        <Lead>The discipline that mattered: the primary “imagery reactivity” model (Maintenance-only) was locked <i>before</i> looking at any group map — so the analysis isn’t selected on significance.</Lead>
        <Detail density={d}>
          The other estimate (Generation + Maintenance combined) is reported as a pre-specified sensitivity
          analysis — the same garden-of-forking-paths problem as dataset 1, handled by committing before seeing results.
        </Detail>
      </Frame>
    ),
  },

  // D2-5 — let cheap data decide expensive choices
  {
    note: 'A 30-minute behavioural check pre-emptively justified a first-level modelling choice that would otherwise be an arbitrary fork. Values are analysis-in-progress, shown to make the methods point — not confirmatory results.',
    render: (d) => (
      <Frame wide kicker="Dataset 2 · let cheap data decide">
        <H2>A behavioural check settled a modelling fork</H2>
        <ChatThread messages={[
          { who: 'norm', tag: 'the PI’s question', text: 'I believe Sense leads to faster flanker processing than Judge — maybe worth exploring flanker brain activity too?' },
          { who: 'agent', tag: 'agent — let the behaviour decide (3,058 trials, mixed models)', text: 'Decentered → ~53 ms faster flanker RT (p<.001) — your intuition holds. But interference × mode is flat (p=.93): a uniform carry-over of the preceding mode, not a change in conflict control.' },
        ]} />
        <Bullets items={[
          'Suicidal images took ~0.9 s longer to generate (p=.010) → Generation is a condition-differential construction process — kept out of the reactivity estimate. That’s the empirical argument for the Maintenance-only primary model.',
          'Flanker stays split by mode as a labelled exploratory analysis.',
        ]} />
        <Detail density={d}>
          Cheap behavioural data justified an expensive first-level parameterisation — turning an arbitrary
          fork into a defensible, pre-specified choice.
        </Detail>
      </Frame>
    ),
  },

  // D2-6 — the compute reality
  {
    note: 'The part a facility recognises: the science was settled; the environment fought back. Nearly every failure was a WSL-on-Windows artifact — drvfs vs native ext4 was the single biggest throughput determinant.',
    render: (d) => (
      <Frame wide kicker="Dataset 2 · the compute reality">
        <H2>Your filesystem is a methods decision</H2>
        <ComputeRealityTable />
        <Lead>~40 min/job on the WSL virtual disk vs ~5–10 min expected on real hardware. The fix wasn’t the model — it was where the .feat directories get staged.</Lead>
        <Detail density={d}>
          The pivot: “I have a real Linux box — port over, or be patient?” → port. The pipeline was already
          idempotent, so the ~98 computed runs travelled along and were skipped on resume — the Windows effort
          became the first partition of the job, not wasted work.
        </Detail>
      </Frame>
    ),
  },

  // D2-7 — the handoff
  {
    note: 'Because the agent could only operate the Windows machine, the port was packaged as a self-contained travel bundle so a fresh Claude on the Linux box could continue seamlessly. The corrupt run-4 cameo: mean-image fingerprint 0.97–0.98 within-subject vs ~0.64 across — suggestive identity evidence (the rigorous check is sform/qform + dims).',
    render: (d) => (
      <Frame wide kicker="Dataset 2 · the handoff">
        <H2>A travel bundle a fresh Claude could pick up</H2>
        <Terminal
          title="USB 3 travel bundle — packaged for the Linux box"
          maxWidth={780}
          lines={[
            { k: 'cmd', t: 'ls $MINDLOCK_ROOT/' },
            { k: 'out', t: 'derivatives/  ev_confounds/  firstlevel_98_done/  scripts_linux/  HANDOFF.md  memory/' },
            { k: 'comment', t: '235 GB fMRIPrep derivatives · path-configurable scripts (one MINDLOCK_ROOT var)' },
            { k: 'comment', t: '98 salvaged first-levels skip on resume · memory/ = every locked decision' },
            { k: 'ok',  t: 'HANDOFF.md + memory/ → a fresh Claude reads it and continues, no re-litigation' },
          ]}
        />
        <Bullets items={[
          'Everyday-neuroimaging cameo: a corrupt run-4 volume, caught before handoff.',
          'Mean-image “fingerprint”: 0.97–0.98 vs the subject’s own runs, ~0.64 vs anyone else’s → right subject, valid replacement.',
        ]} />
        <Detail density={d}>
          Idempotent ≠ automatically safe to double up: two workers on a shared store can still race the same
          not-yet-done job — so the clean patterns are partition (Variant A/B per box) or separate stores + merge.
        </Detail>
      </Frame>
    ),
  },

  // D2-8 — synthesis: the two datasets rhyme
  {
    note: 'The payoff: the same collaboration patterns show up whether you’re getting preprocessing right (dataset 1) or getting a pre-registered analysis off the ground (dataset 2).',
    render: (d) => (
      <Frame wide kicker="Two datasets, one collaboration">
        <H2>The same patterns, upstream and downstream</H2>
        <ParallelPatterns />
        <Detail density={d}>
          Neither column is agent-specific magic — it’s engineering + methods hygiene. The agent just makes the
          discipline cheaper to keep: forks locked, environments tamed, context carried, success verified.
        </Detail>
      </Frame>
    ),
  },

  // 21 — What worked / what to watch
  {
    note: 'Treat it as a strong, tireless operator that still needs a scientist’s judgment on the science.',
    render: (d) => (
      <Frame wide kicker="Honest assessment">
        <H2>What worked / what to watch</H2>
        <div style={K.twoCol}>
          <div style={K.col}>
            <div style={K.colHead('#2f9e5f')}>Worked</div>
            <Bullets items={[
              'Root-caused beyond the obvious symptom.',
              'Safe destructive ops — verified before deleting.',
              'Reproducible fixes — edited the script, not just the run.',
              'Persistent project memory, no re-briefing.',
            ]} />
          </div>
          <div style={K.col}>
            <div style={K.colHead('#c04a82')}>Watch</div>
            <Bullets items={[
              'AI can introduce and fix bugs — smoke tests must be complete.',
              'A human should own scientific config choices.',
              'Verify before trusting “success.”',
            ]} />
          </div>
        </div>
        <Lead>Net: faster iteration, fewer dropped balls on long runs, decisions captured as code + docs.</Lead>
        <Detail density={d}>
          The agent is a strong, tireless operator — but the exit-code miss is the reminder that a scientist
          still owns success-criteria and the science itself.
        </Detail>
      </Frame>
    ),
  },

  // 22 — Takeaways
  {
    note: 'Most of these are good engineering hygiene that pay off whether or not you use an agent. The agent just makes the payoff bigger.',
    render: (d) => (
      <Frame kicker="Takeaways">
        <H2>Adopting agentic tools</H2>
        <Bullets items={[
          'Containerize + script every stage → safe, reproducible units to drive.',
          'Build idempotency + completion markers in → “crash/fix/resume” becomes trivial.',
          'Give it persistent project memory → no re-briefing, consistent decisions.',
          'Define an autonomy contract (“only interrupt on error”) → works over multi-day runs.',
          'Keep a human on success-criteria and science → exit codes lie; results don’t.',
        ]} />
        <Detail density={d}>
          None of these are agent-specific magic — they’re engineering hygiene that pays off either way. The
          agent just makes the payoff bigger.
        </Detail>
      </Frame>
    ),
  },

  // 23 — Thanks / Q&A
  {
    render: () => (
      <Frame>
        <h1 style={K.title}>Thank you</h1>
        <Lead>Questions — and happy to share any of this</Lead>
        <div style={{ maxWidth: 680 }}>
          <Bullets items={[
            'The scripts + Apptainer containers are reusable on any ToNI Prisma 3T dataset — ask me for the runbook.',
            'Docs: code/BIDS_CONVERSION_PROCESS.md · code/MRIQC_QC_SUMMARY.md · code/FMRIPREP_AROMA_RUNBOOK.md',
          ]} />
        </div>
        <div style={{ height: 8 }} />
        <div style={K.crests}>
          <img src="/RADlab_Logo_light.svg" alt="RADlab" style={{ height: 46 }} onError={e => { e.currentTarget.style.display = 'none' }} />
          <img src="/UofT_Logo.svg" alt="University of Toronto" style={{ height: 46 }} onError={e => { e.currentTarget.style.display = 'none' }} />
        </div>
      </Frame>
    ),
    note: 'Appendix slide follows — pull it up on demand for the exact invocations.',
  },

  // 24 — Appendix (exact invocations)
  {
    note: 'Backup for Q&A. Note the AROMA call has NO fs-license-file, and uses the :main container tag — pin a versioned release for true reproducibility.',
    render: (d) => (
      <Frame wide kicker="Appendix · exact invocations">
        <H2>The two heavy calls</H2>
        <Terminal
          title="fMRIPrep 24.1.1"
          maxWidth={880}
          lines={[
            { k: 'out', t: 'apptainer run --cleanenv -B bids:/data:ro -B derivatives/fmriprep:/out -B work:/work \\' },
            { k: 'out', t: '  -B ~/freesurfer/license.txt:/opt/freesurfer/license.txt:ro \\' },
            { k: 'out', t: '  containers/fmriprep-24.1.1.sif /data /out participant --participant-label NNN \\' },
            { k: 'out', t: '  --output-spaces MNI152NLin6Asym:res-2 MNI152NLin2009cAsym:res-2 T1w fsnative fsaverage5 \\' },
            { k: 'out', t: '  --cifti-output 91k --nthreads 6 --omp-nthreads 6 --mem-mb 13000 --notrack -w /work' },
          ]}
        />
        <Terminal
          title="fMRIPost-AROMA  (note: NO fs-license-file)"
          maxWidth={880}
          lines={[
            { k: 'out', t: 'apptainer run --cleanenv -B bids:/data:ro -B derivatives/fmriprep:/fmriprep:ro \\' },
            { k: 'out', t: '  -B derivatives/fmripost_aroma:/out -B work:/work \\' },
            { k: 'out', t: '  containers/fmripost-aroma-main.sif /data /out participant --participant-label NNN \\' },
            { k: 'out', t: '  -d fmriprep=/fmriprep --denoising-method nonaggr --nthreads 6 --mem 12000 -w /work' },
          ]}
        />
        <Detail density={d}>
          Reproducibility caveat: the AROMA container is the :main tag — pin a versioned release for a truly
          frozen pipeline.
        </Detail>
      </Frame>
    ),
  },

  // 25 — Backup / Q&A: provenance of the AI's advice
  {
    note: 'Backup for Q&A — pull up if someone asks how much of the agent’s advice is personalized vs generic, or whether the model can tell. Honest answer: it can reason about its sources but can’t read them off, so self-reports are inference (and can confabulate). For slide 8 specifically, most of “where do we start?” was field-standard pipeline + the study just described — very little was durable memory of the PI, because this session carried no fMRIPrep preferences in memory. The reproducibility point: pin the model version + the brief + the memory files and the advice is reproducible — same provenance discipline as the pipeline.',
    render: (d) => (
      <Frame wide kicker="Backup · working with AI">
        <H2>Can the AI tell what its advice depends on?</H2>
        <Lead>Partly — it can reason about its sources, but it can’t read them off. So “why did you suggest that?” is an <i>inference</i>, and can be confabulated.</Lead>
        <AdviceProvenance />
        <Detail density={d}>
          The reproducibility angle: “personalization” mostly comes from the brief in front of the model plus
          field defaults — not hidden recall. Pin the model version, the task brief, and the memory files, and
          the advice is reproducible — the same provenance discipline the whole pipeline runs on.
        </Detail>
      </Frame>
    ),
  },
]

// ── Styles (RADlab pink frame, matching /keynote) ────────────────────────────

const K = {
  stage: {
    position: 'fixed', inset: 0, background: 'var(--bg, #FCF0F5)',
    fontFamily: '"DM Sans",system-ui,sans-serif', color: 'var(--tx)',
    cursor: 'pointer', overflow: 'hidden',
  },
  controls: { position: 'absolute', top: 16, right: 18, zIndex: 5, display: 'flex', gap: 8, cursor: 'default' },
  toggle: { display: 'flex', background: '#fff', border: '1px solid var(--bd)', borderRadius: 999, padding: 2 },
  toggleBtn: { border: 'none', background: 'none', borderRadius: 999, padding: '5px 12px', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  toggleOn: { background: 'var(--pk)', color: '#fff' },
  notesBtn: { border: '1px solid var(--bd)', background: '#fff', borderRadius: 999, padding: '5px 14px', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },

  slideArea: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '52px 40px 56px', overflowY: 'auto' },
  frame: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', maxWidth: 1000, width: '100%' },
  frameWide: { maxWidth: 'min(1180px, 95vw)' },
  kicker: { fontFamily: '"Space Mono",monospace', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pkd)' },

  title:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(34px, 6vw, 64px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.05 },
  subtitle: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(19px, 3vw, 32px)', fontWeight: 400, color: 'var(--pkd)', margin: 0, fontStyle: 'italic' },
  author:   { fontSize: 'clamp(16px, 2.1vw, 21px)', color: 'var(--tx)', margin: 0, fontWeight: 600 },
  affil:    { fontSize: 'clamp(13px, 1.6vw, 16px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, fontFamily: '"Space Mono",monospace' },
  event:    { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--tx3)', margin: '10px 0 0', letterSpacing: '0.06em' },
  facility: { fontFamily: '"Space Mono",monospace', fontSize: 11.5, color: 'var(--tx3)', margin: '3px 0 0', letterSpacing: '0.04em', textAlign: 'left', opacity: 0.9 },
  provenance: { fontFamily: '"Space Mono",monospace', fontSize: 'clamp(12px, 1.5vw, 15px)', color: 'var(--tx2)', margin: 0, letterSpacing: '0.03em' },
  aside: { fontSize: 'clamp(13px, 1.55vw, 16px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, maxWidth: 780, textAlign: 'left', borderLeft: '3px solid var(--pkbs, rgba(240,104,164,0.35))', padding: '2px 0 2px 16px', fontStyle: 'italic' },
  traceLink: { fontFamily: '"Space Mono",monospace', fontSize: 12.5, color: 'var(--pkd)', letterSpacing: '0.02em' },

  datasetBadge: { fontFamily: '"Space Mono",monospace', fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', padding: '7px 18px', borderRadius: 999, border: '1.5px solid', display: 'inline-block' },
  dividerPoints: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 },
  dividerChip: { fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--tx2)', background: '#fff', border: '1px solid', borderRadius: 999, padding: '6px 14px' },
  crests:   { display: 'flex', gap: 32, alignItems: 'center', marginBottom: 6 },

  titleRow:  { display: 'flex', gap: 48, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  titleText: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', maxWidth: 560 },
  heroImg:   { width: 'min(340px, 66vw)', borderRadius: 20, boxShadow: '0 10px 40px rgba(74,144,217,0.18)', flexShrink: 0, background: '#fff' },

  splitRow:  { display: 'flex', gap: 44, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  splitText: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: 15, maxWidth: 560, flex: '1 1 380px' },
  splitImg:  { width: 'min(400px, 70vw)', borderRadius: 16, boxShadow: '0 10px 40px rgba(28,28,40,0.28)', flexShrink: 0 },

  h:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(28px, 4.6vw, 50px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.1 },
  h2:   { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 'clamp(24px, 3.6vw, 40px)', fontWeight: 400, color: 'var(--tx)', margin: 0, lineHeight: 1.12 },
  lead: { fontSize: 'clamp(16px, 2vw, 23px)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5, maxWidth: 820 },
  ul:   { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 860 },
  li:   { fontSize: 'clamp(15px, 1.9vw, 21px)', color: 'var(--tx)', lineHeight: 1.45, position: 'relative', paddingLeft: 24, textAlign: 'left' },
  detail: { fontSize: 'clamp(13px, 1.5vw, 16px)', color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 760, margin: 0, borderTop: '1px solid var(--bd)', paddingTop: 14 },

  twoCol: { display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  col: { flex: '1 1 320px', maxWidth: 420, textAlign: 'left' },
  colHead: (c) => ({ fontFamily: '"Space Mono",monospace', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: c, marginBottom: 10 }),

  bottom: { position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, cursor: 'default' },
  navArrow: { border: 'none', background: 'none', color: 'var(--tx3)', fontSize: 30, lineHeight: 1, cursor: 'pointer', padding: '0 6px' },
  counter: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx3)' },
  clickHint: { position: 'absolute', bottom: 44, left: 0, right: 0, textAlign: 'center', fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', opacity: 0.7, pointerEvents: 'none' },

  noteOverlay: { position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 90vw)', background: 'rgba(28,28,30,0.94)', color: '#fff', borderRadius: 12, padding: '14px 20px', cursor: 'default', zIndex: 6 },
  noteLabel: { fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ff9ec9' },
  noteBody: { fontSize: 14, lineHeight: 1.5, marginTop: 6 },
}

// Bullet markers (pink dot) — injected once.
if (typeof document !== 'undefined' && !document.getElementById('toni-bullets')) {
  const s = document.createElement('style')
  s.id = 'toni-bullets'
  s.textContent = `[data-toni] li::before{content:'';position:absolute;left:4px;top:.62em;width:7px;height:7px;border-radius:50%;background:#f068a4}`
  document.head.appendChild(s)
}
