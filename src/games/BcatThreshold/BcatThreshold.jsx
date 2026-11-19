import { useEffect, useRef, useState } from 'react'
import './bcatThreshold.css'
import Circle from './Circle'
import { makeConfig } from './config.js'
import { buildTrialPlan } from './trialPlan.js'
import { createEngineClient } from './engineClient.js'
import { pickStore, StoreError } from './dbStore.js'
import { loadSession, planResume } from './resume.js'
import { supabase } from '../../lib/supabase'
import { createTrialSequence } from './sequence.js'
import { createCompliance } from './compliance.js'
import { createFullscreen, createReturnGate } from './fullscreen.js'
import { newSeed, newRunId, makeRunRecord, makeResultRecord } from './records.js'
import { runSession } from './session.js'
import { createLivePresenter, measureFramePeriod, nextPaint } from './presenter.js'
import { createSimulatedPresenter, SIM_SCENARIOS } from './simulate.js'
import { deviceProblem, readDeviceEnv } from './device.js'
import { initialChoice } from './options.js'
import { isDemoMode } from '../../lib/demoMode'
import {
  richParts, instructionPages, CONTINUE_HINT, CONTINUE, PRACTICE_INTRO, PRACTICE_FEEDBACK, READY, pacerReminder, ANSWER_QUESTION, ANSWER_LABELS,
  releaseKeysCue, complianceLine, armReminderPage, ANSWER_PICTURE_ALT, DONE, DEVICE, ERRORS, FULLSCREEN,
  BREAK, practiceRetryPage, PRACTICE_FAILED, TIME_LIMIT, ENGINE_CHANGED, RESTORING, SAVING, SAVE_FAILED,
} from './texts.js'

// BCAT threshold task (Stages B and C): the participant-facing screens of the adaptive breathing-pace threshold
// task (NextStudy/Thresholds/7_radlab_site_plan/PLAN.md). One study step: device check, the full-screen page, three
// instruction pages by arm, practice rounds with feedback in sets (touch and breath: the practice gate may ask for
// another set, after the arm's key instruction, or end the session), a "ready" page, the adaptive trials with one
// break at the midpoint, done. Past the time limit no new trial starts and the step ends on the time-limit page.
// A failed practice gate ends on its own page. Neither completes the step. Consent and debrief are separate steps.
//
//   study step (GameStepWrapper, studyMode): the arm is the assignment slot bcat_arm, nothing else; without
//     one the step shows an error and stops (options.js). Never demo, never simulated.
//   preview (TaskPreviewPlayer's no-save client, /admin/tasks/preview/bcat_threshold, /dev/bcat-threshold):
//     arm and version from the URL or a chooser; ends with a "Download data (JSON)" button.
//
// Data stay in memory in this stage (store.js); Stage C swaps the store for the database.
// The order of a run is session.js; one trial on screen is presenter.js and trialLoop.js; the interruption
// rule is sequence.js; the compliance reminders (the fixation line and the page) are compliance.js; full screen
// (entry, the page between trials, the windowed fallback) is fullscreen.js. This file is only the screens.
// The step renders in place on every route (study session, TaskPreviewPlayer, /dev/bcat-threshold), not in an
// iframe; were it ever framed without allow="fullscreen", fullscreen.js finds full screen not enabled and the
// task runs windowed, recorded on the run.

const DEFAULTS = makeConfig()
const KEYS = DEFAULTS.keys
const DISPLAY = DEFAULTS.display

function Rich({ text }) {
  return <>{richParts(text).map((p, i) => (typeof p === 'string' ? <span key={i}>{p}</span> : <kbd key={i} className="bt-key">{p.key}</kbd>))}</>
}

// The answer screen: our own icons (a speed dial low, an equals sign, a speed dial high), each over its arrow key.
function Dial({ fast }) {
  return (
    <svg className="bt-answer-icon" viewBox="0 0 48 32" aria-hidden="true">
      <path d="M6 28a18 18 0 0 1 36 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d={fast ? 'M24 28l12-11' : 'M24 28l-12-11'} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="24" cy="28" r="3" fill="currentColor" />
    </svg>
  )
}
function Equals() {
  return (
    <svg className="bt-answer-icon" viewBox="0 0 48 32" aria-hidden="true">
      <path d="M10 11h28M10 23h28" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
// The arrow on a key cap, drawn: the key-cap font (Space Mono) has no arrow glyphs, so ← → ↑ fell back to
// other fonts at different sizes.
function Arrow({ dir }) {
  const turn = { right: 0, left: 180, up: -90 }[dir]
  return (
    <svg className="bt-arrow" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform={`rotate(${turn} 8 8)`} />
    </svg>
  )
}
function AnswerPanel() {
  return (
    <div className="bt-answer" role="img" aria-label={ANSWER_PICTURE_ALT}>
      <p className="bt-answer-q">{ANSWER_QUESTION}</p>
      <div className="bt-answer-row">
        <div className="bt-answer-opt"><Dial /><kbd className="bt-key"><Arrow dir="left" /></kbd><span>{ANSWER_LABELS.slowed}</span></div>
        <div className="bt-answer-opt"><Equals /><kbd className="bt-key"><Arrow dir="up" /></kbd><span>{ANSWER_LABELS.same}</span></div>
        <div className="bt-answer-opt"><Dial fast /><kbd className="bt-key"><Arrow dir="right" /></kbd><span>{ANSWER_LABELS.sped_up}</span></div>
      </div>
    </div>
  )
}

function Page({ children }) {
  return <div className="bt"><main className="bt-wrap"><section className="bt-card">{children}</section></main></div>
}

function clientFacts(framePeriodMs) {
  return {
    user_agent: navigator.userAgent,
    screen_w: window.screen?.width ?? null,
    screen_h: window.screen?.height ?? null,
    window_w: window.innerWidth,
    window_h: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio || 1,
    refresh_hz_estimate: framePeriodMs ? 1000 / framePeriodMs : null,
  }
}

function fmt(v, d = 3) { return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '–' }

function sessionText(counts) {
  const s = counts.session || {}, p = s.practice, b = s.break, m = s.moving || {}
  return [
    `status: ${counts.status}; elapsed ${fmt((s.elapsedMs ?? 0) / 60000, 1)} of ${s.timeLimitMs ? fmt(s.timeLimitMs / 60000, 1) : '–'} min`,
    p ? `practice: sets ${p.sets_used}; ${p.gated ? `gate ${p.passed === true ? 'passed' : p.passed === false ? 'FAILED' : 'not decided'}; window means ${p.sets.map(x => fmt(x.mean, 2)).join(', ')}` : 'no gate (vision)'}` : 'practice: off',
    b ? `break: ${b.taken ? `after main ${b.after_main} (seq ${b.after_seq}), ${fmt(b.duration_ms / 1000, 1)} s${b.shown ? '' : ', not shown (simulated)'}` : `not reached (due after ${b.due_after_main})`}` : 'break: –',
    `moving window ${m.moving_window}: ${m.coverage_moving_avg_min !== null && m.coverage_moving_avg_min !== undefined ? `min coverage ${fmt(m.coverage_moving_avg_min, 2)}; exclusion flag ${m.exclusion_flag_coverage ? 'YES' : 'no'}`
      : m.ws_press_moving_share_max !== null && m.ws_press_moving_share_max !== undefined ? `max W/S share ${fmt(m.ws_press_moving_share_max, 2)}` : 'no full window'}`,
  ].join('\n')
}

function readoutText(readout, counts) {
  if (!readout) return `no readout\n${sessionText(counts)}`
  const c = readout.cells, f = readout.flags || {}
  const line = (name, x) => `${name}: d′=2 at ${fmt(x.threshold.x)} [${fmt(x.threshold.x_ci_low)}, ${fmt(x.threshold.x_ci_high)}] (${fmt(x.threshold_pct_pulse_change, 1)}% pulse)`
  return [
    readout.aborted ? 'ABORTED (time limit): the readout of what existed' : null,
    line('speeding', c.speeding), line('slowing ', c.slowing),
    `quality flag: ${f.quality_flag ? 'YES' : 'no'}; censored: speeding ${f.censored?.speeding ? 'YES' : 'no'}, slowing ${f.censored?.slowing ? 'YES' : 'no'}`,
    `engine trials ${readout.n_trials_total}; unanswered or withheld ${readout.n_missing_responses}; false alarms ${readout.false_alarms.n_false_alarms}/${readout.false_alarms.n_no_change}`,
    `rows ${counts.rows}; interrupted ${counts.interrupted}; repeats ${counts.repeats}; engine ${counts.engineMode}`,
    `non-compliant ${counts.noncompliant}; reminder lines ${counts.lines}; reminder pages ${counts.pages}`,
    `full screen: ${counts.fullscreen}`,
    sessionText(counts),
  ].filter(x => x !== null).join('\n')
}

export default function BcatThreshold({
  studyMode = false, userId = null, studyId = null, scheduleId = null, onSessionComplete = null,
  supabaseClient = null, isSimMode = false, assignments = null, mode = 'online', enrollmentId = null,
}) {
  const preview = !studyMode && !!supabaseClient?.isPreviewClient
  const [choice, setChoice] = useState(() => initialChoice({
    studyMode, preview, assignments, search: window.location.search, quickDemo: preview && isDemoMode(),
  }))
  const [view, setView] = useState({ kind: 'blank' })
  const [cue, setCue] = useState(null)
  const circleRef = useRef(null)
  const questionRef = useRef(null)
  const cueRef = useRef(null)
  const completedRef = useRef(false)

  // ── one run ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!choice?.arm) return
    const { arm } = choice
    const sim = !!choice.simulate && preview
    let cancelled = false
    const isCancelled = () => cancelled
    const show = v => { if (!cancelled) setView(v) }
    const cfg = makeConfig({ mode, demo: preview && choice.demo, practice: choice.practice !== false,
      ...(preview && choice.limitS ? { maxTotalMs: choice.limitS * 1000 } : {}) })
    // Where the rows go (dbStore.js, pickStore): a preview and every simulated run keep them in this tab; a real
    // study step writes them to the database and refuses to start without an enrollment or a client.
    const db = studyMode && !isSimMode ? (supabaseClient ?? supabase) : null
    const picked = pickStore({ studyMode, isSimMode, simulate: sim, db, userId, studyId, scheduleId, enrollmentId })
    if (picked.error) {
      console.error('bcat threshold: the step cannot save, so it does not start:', picked.error)
      setView({ kind: 'error', message: ERRORS.start })
      return
    }
    const store = picked.store
    const engine = createEngineClient()
    const rows = []
    const saveTrial = row => { rows.push(row); return store.saveTrial(row) }
    const runStart = performance.now()
    let framePeriod = 1000 / 60
    const onUi = preview ? ui => { window.__bcatThreshold = { ...(window.__bcatThreshold || {}), ui: { ...ui, at: performance.now() } } } : () => {}
    const fullscreen = createFullscreen({ enabled: cfg.fullscreen.enabled, simulated: sim })
    fullscreen.attach()
    const live = createLivePresenter({
      cfg, arm, runStart, onUi, isCancelled, fullscreen,
      els: () => ({ circle: circleRef.current, question: questionRef.current, cue: cueRef.current }),
      setCue: c => { if (!cancelled) setCue(c) },
      framePeriodMs: () => framePeriod,
    })
    live.attach()
    // spec.gesture: called inside the Continue click or space-bar press itself (full screen needs that)
    const page = ({ gesture, ...spec }) => new Promise(resolve => {
      if (cancelled) return
      onUi({ what: 'page', id: spec.id })
      let done = false
      const onContinue = () => { if (done) return; done = true; if (gesture) gesture(); resolve() }
      setView({ kind: 'page', shownAt: performance.now(), ...spec, onContinue })
    })
    const toTrialScreen = async () => { show({ kind: 'trial' }); await nextPaint() }
    // before each trial: the return-to-full-screen page while the participant is out of it (fullscreen.js)
    const returnGate = createReturnGate({ fullscreen, isCancelled,
      showPage: gesture => page({ id: 'fullscreen_return', paragraphs: [FULLSCREEN.return], hint: FULLSCREEN.hint, gesture }) })
    const gate = sim ? null : async () => { const shown = await returnGate(); if (shown && !cancelled) await toTrialScreen(); return shown }
    // the page reminder (compliance.js), then back to the trial screen; a simulated run shows nothing
    const compliance = createCompliance({ cfg, arm,
      showPage: sim ? null : async () => { await page({ id: 'compliance_reminder', ...armReminderPage(arm, cfg.keys) }); await toTrialScreen() } })
    // Saving until nothing is left unsaved: the "saving" screen, then, while rows stay unsaved, the retry screen.
    // A permanent failure stops the step (thrown). The participant is never told they are done before this returns.
    const saveUntilDone = async () => {
      show({ kind: 'saving' })
      for (;;) {
        const f = await store.flush()
        if (f.problem) throw f.problem
        if (!f.unsaved) return
        await new Promise(resolve => show({ kind: 'save_failed', onRetry: () => { show({ kind: 'saving' }); resolve() } }))
        if (cancelled) return
      }
    }
    // before every trial (review item 5): a failed save stops the step at once; a stalled queue is waited for
    const beforeTrial = picked.kind !== 'database' ? null : async () => {
      if (store.problem) throw store.problem
      if (store.stalled) { await saveUntilDone(); await toTrialScreen() }
    }
    const ended = async status => { await saveUntilDone(); if (cancelled) return; fullscreen.exit(); onUi({ what: 'done', status }); show({ kind: 'done', status, arm }) }

    ;(async () => {
      if (!sim) {
        const problem = deviceProblem(readDeviceEnv())
        if (problem) { onUi({ what: 'device', problem }); show({ kind: 'device', problem }); return }
      }
      // Resume (resume.js): what this participant already saved for this session. A failed read stops the step.
      let plan = { action: 'fresh' }, restored = null
      if (picked.kind === 'database') {
        show({ kind: 'blank' })
        const saved = await loadSession(db, { userId, studyId, scheduleId })
        if (cancelled) return
        plan = planResume({ ...saved, cfg, arm, nowMs: Date.now() })
        if (plan.action === 'complete') {
          // a finished session reopened: the step completes at once
          if (!completedRef.current) { completedRef.current = true; onSessionComplete?.({ run_id: plan.result.run_id, arm, status: 'completed', reopened: true }) }
          return
        }
        if (plan.action === 'ended') { show({ kind: 'done', status: plan.status, arm }); return }
        const chainRows = plan.rows || []
        if (plan.action === 'refuse') {
          console.error('bcat threshold: the saved run cannot be continued:', plan.reason)
          store.adoptSavedRun(plan.tip.id)
          await store.saveResult(makeResultRecord({ runId: plan.tip.id, trials: chainRows, readout: null, status: 'engine_changed', engineMode: null,
            nRuns: plan.chain.length, session: { elapsedMs: plan.elapsedMs ?? null, timeLimitMs: cfg.session.max_total_ms } }))
          await ended('engine_changed')
          return
        }
        if (plan.practiceCompleted && (plan.action === 'resume' || plan.engineTrials.length)) {
          onUi({ what: 'restoring' })
          show({ kind: 'restoring' })
          restored = await engine.call({ type: 'restore', cfg: cfg.engine, seed: Number(plan.tip.seed), trials: plan.engineTrials,
            expect: { engine_version: plan.tip.engine_version, config_hash: plan.tip.config_hash } })
          if (cancelled) return
        }
        if (plan.action === 'timed_out') {
          // past the time limit: cannot be resumed or completed. The chain is closed with what exists.
          const readout = restored ? (await engine.call({ type: 'abort' })).readout : null
          store.adoptSavedRun(plan.tip.id)
          await store.saveResult(makeResultRecord({ runId: plan.tip.id, trials: chainRows, readout, status: 'timed_out', engineMode: engine.mode,
            nRuns: plan.chain.length, session: { elapsedMs: plan.elapsedMs, timeLimitMs: cfg.session.max_total_ms } }))
          await ended('timed_out')
          return
        }
      }
      const resuming = plan.action === 'resume'
      const seed = resuming ? Number(plan.tip.seed) : newSeed()
      const runId = newRunId()
      const sequence = createTrialSequence(undefined, resuming ? { pending: plan.pending, repeated: plan.repeated } : null)
      if (preview) window.__bcatThreshold = { runId, ui: { what: 'start' }, snapshot: () => store.snapshot(runId) }
      const kind = studyMode ? 'study' : sim ? 'simulated' : cfg.demo ? 'demo' : 'preview'
      const simulated = sim ? createSimulatedPresenter({ cfg, arm, seed, ...(choice.sim ? SIM_SCENARIOS[choice.sim] : {}) }) : null
      const present = sim ? simulated : live.present
      if (fullscreen.wanted) {
        // the test build's page: Continue (or the space bar) switches to full screen; if refused, windowed
        let req = null
        await page({ id: 'fullscreen_enter', paragraphs: [FULLSCREEN.enter], hint: FULLSCREEN.hint, gesture: () => { req = fullscreen.enter() } })
        await req
        if (cancelled) return
      }
      onUi({ what: 'fullscreen', ...fullscreen.runFacts() })
      const framesP = sim ? Promise.resolve(null) : measureFramePeriod().then(p => { framePeriod = p; return p })
      if (!sim) {
        const st = cfg.engine.stimulus
        const pages = instructionPages(arm, Number(st.n_lead_in_pulses) + Number(st.n_pulses), cfg.keys)
        for (let i = 0; i < pages.length; i++) {
          await page({ id: `instructions_${i + 1}`, counter: `${i + 1} / ${pages.length}`, ...pages[i] })
        }
      }
      const measured = await framesP
      if (cancelled) return
      const plannedTrials = buildTrialPlan(cfg, seed).counts.total
      await store.saveRun(makeRunRecord({
        id: runId, arm, cfg, seed, kind, plannedTrials, policy: sequence.policy,
        engineMode: engine.mode, framePeriodMs: measured, client: clientFacts(measured), fullscreen: fullscreen.runFacts(),
        resumedFrom: resuming ? plan.tip.id : null,
        resumeState: resuming ? { from_run: plan.tip.id, chain_runs: plan.chain.length, n_saved_rows: plan.rows.length,
          n_replayed: plan.engineTrials.length, practice_completed: plan.practiceCompleted, lost_trial: !!(plan.lostTrial && restored && restored.trial),
          lost_trial_index: plan.lostTrial && restored && restored.trial ? restored.trial.trial_index : null, pending_repeats: plan.pending.length,
          break_taken: plan.breakTaken, elapsed_ms_at_resume: plan.elapsedMs, replay_ms: restored ? restored.replay_ms ?? null : null } : null,
      }))
      // In a simulated run nothing is shown: the practice pages and the break are skipped (the break is recorded
      // as not shown), and the rules run on the simulated presenter's clock.
      const pages = sim ? {
        beforeMain: async () => { onUi({ what: 'simulating' }); show({ kind: 'simulating' }) },
      } : {
        practiceIntro: () => page({ id: 'practice_intro', paragraphs: [PRACTICE_INTRO] }),
        practiceFeedback: spec => page({ id: 'practice_feedback', paragraphs: [PRACTICE_FEEDBACK[spec.cell]] }),
        practiceRetry: () => page({ id: 'practice_retry', ...practiceRetryPage(arm, cfg.keys) }),
        ready: () => page({ id: 'ready', paragraphs: [READY] }),
        beforeMain: toTrialScreen,
        breakPage: async () => { await page({ id: 'break', ...BREAK }); await toTrialScreen() },
      }
      const outcome = await runSession({
        cfg, arm, seed, engine, sequence, saveTrial, runId, isCancelled, compliance, gate, pages, plannedTrials, beforeTrial,
        present: sim ? present : async req => { await toTrialScreen(); return present(req) },
        clock: sim ? simulated.now : () => performance.now(),
        restore: resuming ? { ...plan, engineStart: restored ? async () => restored : null } : null,
      })
      if (outcome.cancelled) return
      const { status } = outcome
      // the readout: the engine's, complete; after the time limit, what existed (the engine's abort readout,
      // readout.aborted true); with no engine trials (practice failed, or timed out in practice), none
      const readout = status === 'completed' ? (await engine.call({ type: 'readout' })).readout
        : outcome.engineStarted ? (await engine.call({ type: 'abort' })).readout : null
      const fs = fullscreen.summary()
      // a resumed session's result counts the whole chain, as its readout does
      const chain = resuming ? [...plan.rows, ...rows] : rows
      await store.saveResult(makeResultRecord({ runId, trials: chain, readout, status, engineMode: engine.mode, fullscreen: fs, session: outcome,
        nRuns: resuming ? plan.chain.length + 1 : 1 }))
      await saveUntilDone()
      engine.terminate()
      if (cancelled) return
      fullscreen.exit()
      const counts = { rows: chain.length, interrupted: chain.filter(r => r.interrupted).length,
        repeats: chain.filter(r => r.phase === 'repeat').length, engineMode: engine.mode, unsaved: store.unsaved ?? 0,
        noncompliant: chain.filter(r => r.compliant === false).length, lines: chain.filter(r => r.reminder_shown).length,
        pages: chain.filter(r => r.reminder_page_shown).length,
        fullscreen: `${fs.windowed_reason ? `windowed (${fs.windowed_reason})` : 'asked'}; entered ${fs.entered ? 'yes' : 'no'}; exits ${fs.exits}; `
          + `return pages ${rows.filter(r => r.fullscreen_return_shown).length}; interrupted by an exit ${rows.filter(r => r.interruption_reasons?.includes('fullscreen_exit')).length}`,
        status, session: outcome }
      onUi({ what: 'done', status })
      setView({ kind: 'done', status, runId, arm, readout, counts, data: preview ? store.snapshot(runId) : null })
    })().catch(err => {
      if (cancelled) return
      console.error('bcat threshold: the run stopped', err)
      fullscreen.exit()
      onUi({ what: 'error', message: String(err && err.message) })
      const lookup = err instanceof StoreError && ['missing', 'lookup', 'no_context', 'no_run'].includes(err.kind)
      setView({ kind: 'error', message: lookup ? ERRORS.start : ERRORS.engine })
    })

    return () => { cancelled = true; live.detach(); fullscreen.exit(); fullscreen.detach(); engine.terminate() }
  }, [choice]) // eslint-disable-line react-hooks/exhaustive-deps -- one run per choice; the props are fixed for a step

  // ── the space bar continues a page ───────────────────────────────────────
  useEffect(() => {
    if (view.kind !== 'page') return
    const onKey = ev => {
      if (ev.code !== 'Space' && ev.key !== ' ') return
      ev.preventDefault()
      if (ev.repeat || performance.now() - view.shownAt < 250) return
      view.onContinue()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])

  const complete = () => {
    if (completedRef.current) return
    completedRef.current = true
    onSessionComplete?.({ run_id: view.runId, arm: view.arm, n_rows: view.counts?.rows ?? null, status: 'completed' })
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(view.data, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bcat_threshold_${view.data?.run?.kind ?? 'preview'}_${view.arm}_${String(view.runId).slice(0, 8)}.json`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  // ── screens ───────────────────────────────────────────────────────────────
  let screen = null
  if (choice?.error) {
    console.error('bcat threshold: no valid drawn value for assignment slot "bcat_arm"', assignments)
    screen = <Page><p className="bt-err" role="alert">{ERRORS.no_arm}</p></Page>
  } else if (choice?.chooser) {
    screen = <PreviewChooser initial={choice} onStart={c => setChoice(c)} />
  } else if (view.kind === 'device') {
    screen = <Page><p role="alert">{DEVICE[view.problem]}</p></Page>
  } else if (view.kind === 'error') {
    screen = <Page><p className="bt-err" role="alert">{view.message}</p></Page>
  } else if (view.kind === 'page') {
    screen = (
      <Page>
        {view.counter && <p className="bt-counter">{view.counter}</p>}
        {view.heading && <h2>{view.heading}</h2>}
        {view.paragraphs.map((p, i) => <p key={i}><Rich text={p} /></p>)}
        <div className="bt-actions">
          <button type="button" className="bt-btn" onClick={() => view.onContinue()}>{CONTINUE}</button>
          <p className="bt-hint"><Rich text={view.hint || CONTINUE_HINT} /></p>
        </div>
      </Page>
    )
  } else if (view.kind === 'restoring') {
    screen = <Page><p role="status">{RESTORING}</p></Page>
  } else if (view.kind === 'saving') {
    screen = <Page><p role="status">{SAVING}</p></Page>
  } else if (view.kind === 'save_failed') {
    screen = (
      <Page>
        <p className="bt-err" role="alert">{SAVE_FAILED.message}</p>
        <div className="bt-actions"><button type="button" className="bt-btn" onClick={() => view.onRetry()}>{SAVE_FAILED.retry}</button></div>
      </Page>
    )
  } else if (view.kind === 'simulating') {
    screen = <Page><p className="bt-counter">Preview</p><p>Simulated run under way: a simulated observer answers every trial, nothing is shown.</p></Page>
  } else if (view.kind === 'done') {
    // completed: the done page and Continue (the step completes). Practice failed or timed out: that page, and
    // no Continue: the step does not complete.
    const ended = view.status === 'practice_failed' ? PRACTICE_FAILED : view.status === 'timed_out' ? TIME_LIMIT
      : view.status === 'engine_changed' ? ENGINE_CHANGED : null
    screen = (
      <Page>
        {ended ? ended.paragraphs.map((p, i) => <p key={i} role={i === 0 ? 'alert' : undefined}>{p}</p>) : (
          <>
            <h2>{DONE.heading}</h2>
            {DONE.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </>
        )}
        {preview && view.counts ? (
          <>
            <h3>Preview only</h3>
            <pre className="bt-readout">{readoutText(view.readout, view.counts)}</pre>
            <div className="bt-actions">
              <button type="button" className="bt-btn" onClick={download}>Download data (JSON)</button>
              <button type="button" className="bt-btn quiet" onClick={() => window.location.reload()}>Start again</button>
            </div>
          </>
        ) : ended ? null : (
          <div className="bt-actions">
            <button type="button" className="bt-btn" onClick={complete}>{CONTINUE}</button>
          </div>
        )}
      </Page>
    )
  }

  const cueText = !cue || !choice?.arm ? ''
    : cue.kind === 'release' ? releaseKeysCue(KEYS)
      : cue.kind === 'compliance' ? complianceLine(choice.arm, KEYS)
        : cue.kind === 'practice' ? pacerReminder(choice.arm, KEYS) : ''
  return (
    <>
      {screen}
      <div className="bt bt-stage" hidden={view.kind !== 'trial'}>
        <p className="bt-cue" ref={cueRef} aria-live="polite">{cueText && <Rich text={cueText} />}</p>
        <Circle ref={circleRef} maxSize={DISPLAY.circle_max_size} minSize={DISPLAY.circle_min_size} />
        <div className="bt-question" ref={questionRef}>
          <AnswerPanel />
        </div>
      </div>
    </>
  )
}

const ARM_LABELS = { vision: 'Vision (watch)', touch: 'Touch (hold W / S)', breath: 'Breath (breathe, hold W / S)' }
const VERSIONS = [
  { id: 'full', label: 'Full session', demo: false, simulate: false },
  { id: 'demo', label: 'Short demo (about 9 trials)', demo: true, simulate: false },
  { id: 'sim', label: 'Simulated observer (no display)', demo: false, simulate: true },
]

// Preview only: pick the arm and the version. Never shown in a study run (options.js).
function PreviewChooser({ initial, onStart }) {
  const [arm, setArm] = useState(initial.arm || 'touch')
  const [version, setVersion] = useState(initial.simulate ? 'sim' : initial.demo ? 'demo' : 'full')
  const [practice, setPractice] = useState(initial.practice !== false)
  const v = VERSIONS.find(x => x.id === version)
  return (
    <Page>
      <p className="bt-counter">Preview · nothing is saved</p>
      <h2>BCAT threshold task</h2>
      <p>In a study the arm comes from the slot <code>bcat_arm</code>. Here, choose one.</p>
      <div className="bt-choice" role="group" aria-label="Arm">
        {Object.keys(ARM_LABELS).map(a => (
          <button key={a} type="button" className="bt-btn quiet" aria-pressed={arm === a} onClick={() => setArm(a)}>{ARM_LABELS[a]}</button>
        ))}
      </div>
      <div className="bt-choice" role="group" aria-label="Version">
        {VERSIONS.map(x => (
          <button key={x.id} type="button" className="bt-btn quiet" aria-pressed={version === x.id} onClick={() => setVersion(x.id)}>{x.label}</button>
        ))}
      </div>
      <div className="bt-choice">
        <button type="button" className="bt-btn quiet" aria-pressed={practice} onClick={() => setPractice(p => !p)}>Practice rounds: {practice ? 'on' : 'off'}</button>
      </div>
      <div className="bt-actions">
        <button type="button" className="bt-btn" onClick={() => onStart({ arm, demo: v.demo, simulate: v.simulate, practice })}>Start</button>
      </div>
    </Page>
  )
}
