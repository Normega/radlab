import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DEMO_SECS, isDemoMode } from '../../lib/demoMode'
import { useScrollToTopOn } from '../../lib/scrollToTop'
import SaveRetryBanner from '../../components/study/SaveRetryBanner'
import NoDefaultSlider from '../../components/study/NoDefaultSlider'
import { ReviewIcon, ReviewCross } from './ReviewIcons'
import { FIXED_PICTURES, mulberry32, shuffle, f1, getScene, sceneSVG, foundOverlay, reviewOverlay, answerOverlay } from './scenes'
import { CORE, VALLEY, MOVE_ON_QUESTION, MOVE_ON_REASONS, ESTIMATE_QUESTION } from './items'
import './FoggyValleys.css'

// ── Foggy Valleys ─────────────────────────────────────────────────────────────
//
// Spot the difference as patch foraging, for Sandy's Study 4. Pairs of pictures
// arrive covered in fog; the participant searches a pair for as long as they
// like and presses Next picture to move on, paying the fog again. Two valleys
// differ only in how long the fog takes to clear (light mist ~3 s, heavy fog
// ~12 s, each picture ±25%), so foraging theory predicts longer stays in heavy
// fog. Ported from foggy_valleys_prototype_v0.3; the behaviour is unchanged.
//
// Two ways to run it:
//   preview (studyMode false): the whole sequence, both valleys, with the
//     researcher settings, the in-game ratings, the results screen and the
//     gallery of all 15 pictures. Played through TaskPreviewPlayer, whose stub
//     client saves nothing.
//   study step (studyMode true): no settings, no ratings, no researcher views.
//     `config` picks the valleys this step runs, so each valley can be its own
//     session step with the platform's rating steps between them:
//       { valleys: ['thick'], valleyOffset: 1, totalValleys: 2, deckStart: 6 }
//     The picture deck comes from a seed fixed per participant and study, so a
//     second step continues the same deck from `deckStart`. In a session this
//     runs through FoggyValleysStep.jsx (game steps foggy_valleys_1 and _2),
//     which reads the fog from the assignment slot valley_order and the deck
//     position from the pictures already saved.
//
// After each picture (setting pictureQuestions, on by default; Sandy Study 4
// decisions D3, D4 and D7, 2026-11-05) the valley clock stops. The participant
// says why they moved on (only if they pressed Next picture) and estimates the
// share of that picture's differences they found. Only after they submit does
// a feedback screen show the true share, with the found and missed differences
// and the wrong clicks marked. The clock runs again with the next picture, so
// each valley still has its full search time. A picture the clock ended while
// still in fog is not asked about. Each valley ends with a summary of the
// pictures searched, the differences in them and the differences found.
//
// Saving (append-only; no row is ever updated):
//   foggy_valleys_runs             one row when a valley starts (client-made id)
//   foggy_valleys_pictures         one row as each picture ends
//   foggy_valleys_picture_ratings  one row as each picture's questions are submitted
// A run insert that fails keeps the valley from starting; a picture or rating
// insert that fails is retried at the end of the valley, and Continue waits
// until every one has saved (SaveRetryBanner).

const GAME_VERSION = 'foggy_valleys_v0.4'   // v0.4: 3 s pause after a wrong click (was 5), Norm 2026-11-05
const DEFAULTS = { minutes: 4, thin: 3, thick: 12, order: 'random', lockout: 3, free: 1, fogCount: true, clock: false, warn: 30, debug: false, ratings: true, pictureQuestions: true }
// Quick demo (?demo=1 or a quick-demo preview link): short valleys and fog
const QUICK = { minutes: DEMO_SECS / 60, thin: 2, thick: 5, warn: 10 }
const TOL = 6   // extra click margin around each difference, in picture units
const EXTRA_PICTURES = 120

const fmtMin = m => m < 1 ? `${Math.round(m * 60)} seconds` : `${m} minute${m === 1 ? '' : 's'}`
const fmtClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const fmtS = ms => ms == null ? '–' : (ms / 1000).toFixed(1) + ' s'
const fogName = t => t === 'thick' ? 'Heavy fog' : 'Light mist'
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`

// "In this valley you searched N pictures…": pictures still in fog when the
// clock ended were never searched, so they are left out
function valleySummary(pics) {
  const searched = pics.filter(p => p.fogCleared)
  if (!searched.length) return 'No picture cleared before the time ran out in this valley.'
  const diffs = searched.reduce((n, p) => n + p.totalDifferences, 0), found = searched.reduce((n, p) => n + p.found, 0)
  return `In this valley you searched ${plural(searched.length, 'picture')}. There were ${plural(diffs, 'difference')} in them, and you found ${found}.`
}

function freeText(cfg) {
  const pause = `pauses both pictures for ${cfg.lockout} seconds`
  return cfg.free > 0
    ? `Your first ${cfg.free === 1 ? 'wrong click' : cfg.free + ' wrong clicks'} in each picture ${cfg.free === 1 ? 'is' : 'are'} free. After that, each wrong click ${pause}.`
    : `Each wrong click ${pause}.`
}

// FNV-1a, so a participant's deck is the same in every step of a study
function hashSeed(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

function buildDeck(seed) {
  return [...shuffle(mulberry32(seed), [...Array(FIXED_PICTURES).keys()]), ...Array.from({ length: EXTRA_PICTURES }, (_, i) => FIXED_PICTURES + i)]
}

// ── the game ──────────────────────────────────────────────────────────────────

export default function FoggyValleys({
  studyMode = false, userId = null, studyId = null, scheduleId = null,
  onSessionComplete = null, supabaseClient = null, isSimMode = false, config = null,
}) {
  const db = supabaseClient ?? supabase
  const [cfg, setCfg] = useState(() => {
    const base = { ...DEFAULTS, ...(!studyMode && isDemoMode() ? QUICK : {}), ...(config ?? {}) }
    // A study asks its ratings with the platform's own rating steps
    return studyMode ? { ...base, ratings: false, debug: false } : base
  })
  const [view, setView] = useState({ name: 'intro' })
  const [startSave, setStartSave] = useState({ busy: false, error: null })
  const [endSave, setEndSave] = useState({ busy: false, error: null })
  const [meta, setMeta] = useState(null)   // what the screens show of the session
  const S = useRef(null)          // the session: deck, pictures, ratings, score
  const lock = useRef(false)      // a double click must not start or end twice
  useScrollToTopOn(view.name + (view.i ?? '') + (view.point ?? ''))

  const valleyOffset = config?.valleyOffset ?? 0

  function startSession() {
    const order = studyMode
      ? (config?.valleys ?? ['thin', 'thick'])
      : cfg.order === 'thin' ? ['thin', 'thick'] : cfg.order === 'thick' ? ['thick', 'thin'] : (Math.random() < 0.5 ? ['thin', 'thick'] : ['thick', 'thin'])
    const deckSeed = config?.deckSeed ?? (studyMode ? hashSeed(`${userId}|${studyId}`) : Math.floor(Math.random() * 4294967296))
    const deckStart = config?.deckStart ?? 0
    S.current = {
      order, deckSeed, deckStart, deck: buildDeck(deckSeed), deckPos: deckStart,
      totalValleys: config?.totalValleys ?? valleyOffset + order.length,
      pics: [], ratings: [], answers: {}, score: 0, runs: [], jobs: [],
      startedAt: new Date().toISOString(), settings: { ...cfg },
    }
    setMeta({ order, totalValleys: S.current.totalValleys, settings: S.current.settings })
    if (cfg.ratings) {
      setView({ name: 'ratings', point: 'before_valleys', eyebrow: 'Before you start', title: 'How are you feeling?', lead: '', groups: [{ title: 'Right now', items: CORE }], then: () => setView({ name: 'valleyIntro', i: 0 }) })
    } else {
      setView({ name: 'valleyIntro', i: 0 })
    }
  }

  function recordRatings(point, vals, rtMs) {
    S.current.ratings.push({ timepoint: point, rtMs, ...vals })
  }

  // ── saving ──
  async function enterValley(i) {
    if (lock.current) return
    lock.current = true
    setStartSave({ busy: true, error: null })
    const s = S.current, type = s.order[i]
    const run = {
      id: crypto.randomUUID(),
      user_id: userId, study_id: studyId, schedule_id: scheduleId, is_test: !!isSimMode,
      game_version: GAME_VERSION,
      valley_number: valleyOffset + i + 1, fog: type,
      mean_fog_ms: (type === 'thick' ? s.settings.thick : s.settings.thin) * 1000,
      valley_ms: s.settings.minutes * 60000,
      deck_seed: s.deckSeed, deck_start: s.deckPos,
      settings: s.settings, started_at: new Date().toISOString(),
    }
    let error = null
    try {
      const res = await db.from('foggy_valleys_runs').insert(run).select('id').single()
      if (res.error && res.error.code !== '23505') error = res.error   // 23505: a retry of a run that did save
    } catch (e) { error = e }
    lock.current = false
    if (error) {
      // Nothing would be recorded, so the valley does not start.
      console.warn('foggy_valleys_runs insert failed', error)
      setStartSave({ busy: false, error })
      return
    }
    s.runs[i] = { id: run.id, valley: run.valley_number, fog: type, startedAt: run.started_at }
    setStartSave({ busy: false, error: null })
    setView({ name: 'play', i, startScore: s.score })
  }

  function send(job) {
    job.p = Promise.resolve()
      .then(() => db.from(job.table).insert(job.row))
      .then(res => {
        job.done = !res?.error || res.error.code === '23505'   // unique (run_id, picture_number): already saved
        if (!job.done) console.warn(`${job.table} insert failed`, res.error)
      }, e => { job.done = false; console.warn(`${job.table} insert failed`, e) })
  }

  function queue(table, row) {
    const job = { table, row, done: false }
    S.current.jobs.push(job)
    send(job)
  }

  function onPicture(i, rec) {
    const s = S.current
    s.pics.push(rec)
    s.score += rec.found
    queue('foggy_valleys_pictures', {
      run_id: s.runs[i].id, user_id: userId, study_id: studyId, schedule_id: scheduleId, is_test: !!isSimMode,
      picture_number: rec.picture, valley_number: rec.valley, fog: rec.fog,
      scene: rec.scene, extra_scene: rec.extraScene, total_differences: rec.totalDifferences, found: rec.found,
      fog_ms: rec.fogMs, fog_cleared: rec.fogCleared, search_ms: rec.searchMs, time_after_last_find_ms: rec.timeAfterLastFindMs,
      wrong_clicks: rec.wrongClicks, ended_by: rec.endedBy, ended_after_warning: rec.endedAfterWarning,
      record: rec,
    })
  }

  function onAnswer(i, rec, ans) {
    const s = S.current
    s.answers[rec.picture] = ans
    queue('foggy_valleys_picture_ratings', {
      run_id: s.runs[i].id, user_id: userId, study_id: studyId, schedule_id: scheduleId, is_test: !!isSimMode,
      picture_number: rec.picture, valley_number: rec.valley,
      move_on_reason: ans.reason, estimated_found_pct: ans.estimate,
      found: rec.found, total_differences: rec.totalDifferences,
      answer_ms: ans.answerMs, shown_at: ans.shownAt, submitted_at: ans.submittedAt,
      record: { ...ans, endedBy: rec.endedBy },
    })
  }

  // Every picture saved, retrying the ones that failed once
  async function flush() {
    const jobs = S.current.jobs
    await Promise.all(jobs.map(j => j.p))
    const failed = jobs.filter(j => !j.done)
    failed.forEach(send)
    await Promise.all(failed.map(j => j.p))
    return jobs.every(j => j.done)
  }

  async function finishValley(i) {
    setEndSave({ busy: true, error: null })
    const ok = await flush()
    setEndSave({ busy: false, error: ok ? null : new Error('pictures not saved') })
    const s = S.current, last = i === s.order.length - 1
    const summary = valleySummary(s.pics.filter(p => p.valley === valleyOffset + i + 1))
    const points = studyMode ? summary : `${summary} You have ${plural(s.score, 'point')} so far.`
    if (cfg.ratings) {
      setView({
        name: 'ratings', point: `after_valley_${valleyOffset + i + 1}`,
        eyebrow: `Valley ${valleyOffset + i + 1} of ${s.totalValleys}: ${fogName(s.order[i]).toLowerCase()}`,
        title: 'Time is up in this valley', lead: `${points} Before you go on, a few questions.`,
        groups: [{ title: 'Right now', items: CORE }, { title: 'About this valley', items: VALLEY }],
        gated: true, then: () => afterValley(i, last),
      })
    } else {
      setView({ name: 'timeUp', i, last, points })
    }
  }

  async function retryEnd() {
    setEndSave({ busy: true, error: null })
    const ok = await flush()
    setEndSave({ busy: false, error: ok ? null : new Error('pictures not saved') })
  }

  function afterValley(i, last) {
    if (!last) { setView({ name: 'valleyIntro', i: i + 1 }); return }
    const s = S.current
    if (studyMode) {
      if (lock.current) return
      lock.current = true
      // found / differences / pictures are this step's, for a display step's variables
      onSessionComplete?.({
        game_version: GAME_VERSION, points: s.score, pictures: s.pics.length,
        found: s.pics.reduce((n, p) => n + p.found, 0),
        differences: s.pics.reduce((n, p) => n + p.totalDifferences, 0),
        valleys: s.order, run_ids: s.runs.map(r => r.id), deck_seed: s.deckSeed, deck_next: s.deckPos,
      })
      return
    }
    setView({ name: 'results', snap: snapshot() })
  }

  function snapshot() {
    const s = S.current
    return {
      order: s.order, pics: s.pics.slice(), ratings: s.ratings.slice(), answers: { ...s.answers }, score: s.score, minutes: s.settings.minutes,
      data: { version: `${GAME_VERSION} (not piloted)`, startedAt: s.startedAt, endedAt: new Date().toISOString(), settings: s.settings, valleyOrder: s.order, deckSeed: s.deckSeed, points: s.score, ratings: s.ratings, pictureAnswers: s.answers, pictures: s.pics },
    }
  }

  function drawScene() {
    const s = S.current
    const idx = s.deck[s.deckPos] ?? s.deckPos
    s.deckPos++
    return { idx, n: s.deckPos }   // numbered across steps when deckStart carries on
  }

  // ── screens ──
  const header = !studyMode && (
    <header className="fv-top"><div className="fv-wrap fv-top-in">
      <div><div className="fv-brand">Foggy Valleys</div><div className="fv-sub">Spot-the-difference foraging for Study 4 · not piloted</div></div>
      <nav className="fv-nav">
        <button type="button" className="fv-btn ghost" onClick={() => setView({ name: 'intro' })}>Play</button>
        <button type="button" className="fv-btn ghost" onClick={() => setView({ name: 'gallery' })}>All 15 pictures</button>
      </nav>
    </div></header>
  )

  let body = null
  if (view.name === 'intro') {
    body = <Intro cfg={cfg} setCfg={setCfg} studyMode={studyMode} showRules={!studyMode || valleyOffset === 0} onStart={startSession} />
  } else if (view.name === 'ratings') {
    body = (
      <Ratings
        key={view.point} eyebrow={view.eyebrow} title={view.title} lead={view.lead} groups={view.groups}
        blocked={view.gated && (endSave.busy || !!endSave.error)}
        onDone={(vals, rtMs) => { recordRatings(view.point, vals, rtMs); view.then() }}
      />
    )
  } else if (view.name === 'valleyIntro') {
    const set = meta.settings, thick = meta.order[view.i] === 'thick'
    body = (
      <section className="fv-card fv-intro">
        <p className="fv-eyebrow">Valley {valleyOffset + view.i + 1} of {meta.totalValleys}</p>
        <h1>{fogName(meta.order[view.i])}</h1>
        <div className="fv-prose">
          <p>{thick ? 'The fog in this valley is thick. Each new picture takes a while to clear.' : 'The fog in this valley is thin. Each new picture clears in a few seconds.'}</p>
          <p>You have {fmtMin(set.minutes)} here. Find as many differences as you can.{set.clock || !set.warn ? '' : ` You will see a notice when ${set.warn} seconds are left.`}</p>
        </div>
        <div className="fv-actions">
          <button type="button" className="fv-btn" disabled={startSave.busy} onClick={() => enterValley(view.i)}>
            {startSave.busy ? 'Starting…' : 'Enter the valley'}
          </button>
          {startSave.error && <span className="fv-err" role="alert">The valley could not start. Check your connection and try again.</span>}
        </div>
      </section>
    )
  } else if (view.name === 'play') {
    body = (
      <Valley
        key={view.i} cfg={meta.settings} type={meta.order[view.i]}
        valleyNumber={valleyOffset + view.i + 1} totalValleys={meta.totalValleys} startScore={view.startScore}
        drawScene={drawScene} onPicture={rec => onPicture(view.i, rec)} onTimeUp={() => finishValley(view.i)}
        onAnswer={meta.settings.pictureQuestions ? (rec, ans) => onAnswer(view.i, rec, ans) : null}
      />
    )
  } else if (view.name === 'timeUp') {
    body = (
      <section className="fv-card fv-intro">
        <p className="fv-eyebrow">Valley {valleyOffset + view.i + 1} of {meta.totalValleys}</p>
        <h1>Time is up in this valley</h1>
        <div className="fv-prose"><p>{view.points}</p></div>
        <div className="fv-actions">
          <button type="button" className="fv-btn" disabled={endSave.busy || !!endSave.error} onClick={() => afterValley(view.i, view.last)}>
            {view.last ? (studyMode ? 'Continue' : 'See the results') : 'Go to the next valley'}
          </button>
        </div>
      </section>
    )
  } else if (view.name === 'results') {
    body = <Results snap={view.snap} onAgain={() => setView({ name: 'intro' })} onGallery={() => setView({ name: 'gallery' })} />
  } else if (view.name === 'gallery') {
    body = <Gallery />
  }

  return (
    <div className="fv">
      {header}
      <main className="fv-wrap fv-main">{body}</main>
      {endSave.error && <SaveRetryBanner busy={endSave.busy} onRetry={retryEnd} />}
    </div>
  )
}

// ── participant instructions, with the researcher settings in a preview ──────

function Intro({ cfg, setCfg, studyMode, showRules, onStart }) {
  const num = key => e => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v >= 0) setCfg(c => ({ ...c, [key]: v })) }
  const flag = key => e => { const on = e.target.checked; setCfg(c => ({ ...c, [key]: on })) }
  return (
    <>
      <section className="fv-card fv-intro">
        {!studyMode && <p className="fv-eyebrow">What participants see</p>}
        <h1>Spot the difference in the fog</h1>
        {showRules && (
          <div className="fv-prose">
            <p>You will see pairs of pictures that are almost the same. Click anywhere the two pictures differ. You can click on either picture. Some differences are easy to see, and some are very small, such as a colour that is only slightly different.</p>
            <p>Each new pair arrives covered in fog, which clears after a while. There are two valleys. In one the fog is thin and clears in a few seconds. In the other it is thick and takes much longer. Even within a valley, some pictures clear faster than others.</p>
            <p>You have <b>{fmtMin(cfg.minutes)}</b> in each valley. Every difference you find is worth one point. Some pictures have fewer differences and some have more, and you will not be told how many.</p>
            {!cfg.clock && <p>There is no clock on the screen.{cfg.warn > 0 ? ` A notice will tell you when ${cfg.warn} seconds are left.` : ''}</p>}
            <p>You can move on to a new picture at any time by pressing <b>Next picture</b>. The new picture has to clear before you can search it.</p>
            {cfg.pictureQuestions && <p>After each picture you will answer two short questions about it, and then see what you found and what you missed. The clock stops while you do.</p>}
            <p>{freeText(cfg)}</p>
          </div>
        )}
        <div className="fv-actions"><button type="button" className="fv-btn" onClick={onStart}>Begin</button></div>
      </section>
      {!studyMode && (
        <details className="fv-card fv-settings">
          <summary>Researcher settings</summary>
          <div className="fv-sgrid">
            <label>Minutes in each valley<input type="number" min="0.25" max="15" step="0.25" defaultValue={cfg.minutes} onChange={num('minutes')} /></label>
            <label>Light mist: average fog, seconds<input type="number" min="0" max="60" step="0.5" defaultValue={cfg.thin} onChange={num('thin')} /></label>
            <label>Heavy fog: average fog, seconds<input type="number" min="0" max="60" step="0.5" defaultValue={cfg.thick} onChange={num('thick')} /></label>
            <label>Valley order<select defaultValue={cfg.order} onChange={e => { const v = e.target.value; setCfg(c => ({ ...c, order: v })) }}>
              <option value="random">Random</option>
              <option value="thin">Light mist first</option>
              <option value="thick">Heavy fog first</option>
            </select></label>
            <label>Pause after a wrong click, seconds<input type="number" min="0" max="20" step="1" defaultValue={cfg.lockout} onChange={num('lockout')} /></label>
            <label>Free wrong clicks per picture<input type="number" min="0" max="10" step="1" defaultValue={cfg.free} onChange={num('free')} /></label>
            <label>Warning before time is up, seconds (0 = none)<input type="number" min="0" max="120" step="5" defaultValue={cfg.warn} onChange={num('warn')} /></label>
            <label className="check"><input type="checkbox" defaultChecked={cfg.fogCount} onChange={flag('fogCount')} /> Count down while the fog clears</label>
            <label className="check"><input type="checkbox" defaultChecked={cfg.clock} onChange={flag('clock')} /> Show the valley clock</label>
            <label className="check"><input type="checkbox" defaultChecked={cfg.ratings} onChange={flag('ratings')} /> Ask the ratings</label>
            <label className="check"><input type="checkbox" defaultChecked={cfg.pictureQuestions} onChange={flag('pictureQuestions')} /> Ask about each picture, then show what was missed</label>
            <label className="check"><input type="checkbox" defaultChecked={cfg.debug} onChange={flag('debug')} /> Show where the differences are</label>
          </div>
          <p className="fv-note">Each picture’s fog lasts the valley’s average plus or minus 25%, drawn at random. For a quick look, set the minutes to 1, the fog to 1 and 4 seconds, and turn off the ratings. Nothing is saved in a preview.</p>
        </details>
      )}
    </>
  )
}

// ── one valley ───────────────────────────────────────────────────────────────
//
// The frame loop writes the fog, the countdowns and the clock straight to the
// DOM through refs (60 updates a second would be 60 renders); React renders
// the pictures, the score and the buttons. The first picture is dealt in the
// first animation frame, so StrictMode's dev-only double mount (cleaned up
// before any frame runs) does not use up a picture.
//
// With onAnswer set, each picture that cleared is followed by its questions and
// feedback (PictureQuestions, PictureFeedback). The clock stops while they are
// on screen: the valley's start and end move later by the time spent. The
// pictures stay mounted underneath, hidden, so the frame loop's refs survive.

function Valley({ cfg, type, valleyNumber, totalValleys, startScore, drawScene, onPicture, onTimeUp, onAnswer = null }) {
  const [score, setScore] = useState(startScore)
  const [here, setHere] = useState(0)
  const [art, setArt] = useState({ A: '', B: '' })
  const [fogged, setFogged] = useState(true)
  const [warned, setWarned] = useState(false)
  const [ask, setAsk] = useState(null)   // { rec, then: 'deal' | 'end', stage: 'questions' | 'feedback' }
  const el = useRef({})     // DOM nodes, set by callback refs
  const G = useRef(null)    // the running valley

  const panels = () => ['A', 'B'].map(w => el.current[w])

  function paint() {
    const p = G.current.pic, ov = foundOverlay(p.sc, p.found, cfg.debug)
    setArt({ A: sceneSVG(p.sc, 'A', ov), B: sceneSVG(p.sc, 'B', ov) })
  }

  function deal() {
    const g = G.current, { idx, n } = drawScene(), sc = getScene(idx)
    g.pic = {
      n, valley: valleyNumber, fog: g.block.type, idx, sc, fogMs: Math.round(g.block.meanFog * (0.75 + 0.5 * Math.random())),
      dealtAt: new Date().toISOString(), tDealAbs: performance.now(), tClearAbs: null, found: [], finds: [], wrong: 0, blocked: 0, repeat: 0, fogClicks: 0, clicks: [], misses: [], lockUntil: 0,
    }
    paint(); setHere(0); setFogged(true)
    for (const p of panels()) {
      if (!p) continue
      p.fog.style.opacity = 1
      p.art.style.filter = 'blur(16px)'
      p.fogText.textContent = cfg.fogCount ? `Clears in ${Math.ceil(g.pic.fogMs / 1000)}` : 'The fog is clearing'
    }
    if (g.pic.fogMs <= 0) clearFog(performance.now())
  }

  function clearFog(t) {
    G.current.pic.tClearAbs = t
    setFogged(false)
    for (const p of panels()) { if (!p) continue; p.fog.style.opacity = 0; p.art.style.filter = 'none' }
  }

  function endPicture(how) {
    const g = G.current, p = g.pic
    if (!p) return
    g.pic = null
    const t = performance.now(), cleared = p.tClearAbs !== null, searchMs = cleared ? Math.round(t - p.tClearAbs) : 0
    const last = p.finds.length ? p.finds[p.finds.length - 1].t : null
    const rec = {
      picture: p.n, valley: p.valley, fog: p.fog, scene: p.idx + 1, extraScene: p.idx >= FIXED_PICTURES, theme: p.sc.themeName, totalDifferences: p.sc.diffs.length, dealtAt: p.dealtAt,
      found: p.found.length, foundIds: p.found.slice(), finds: p.finds, fogMs: p.fogMs, fogCleared: cleared, searchMs, lastFindMs: last,
      timeAfterLastFindMs: cleared ? searchMs - (last || 0) : null, wrongClicks: p.wrong, blockedClicks: p.blocked, repeatClicks: p.repeat, fogClicks: p.fogClicks,
      misses: p.misses, clicks: p.clicks, endedBy: how, endedAfterWarning: !!g.block.warned,
    }
    onPicture(rec)
    return rec
  }

  // Questions and feedback stop the clock: the valley's start and end move on by the pause
  function pause() { const b = G.current.block; if (b.pausedAt == null) b.pausedAt = performance.now() }
  function resume() {
    const b = G.current.block
    if (b.pausedAt == null) return
    const d = performance.now() - b.pausedAt
    b.end += d; b.t0 += d; b.pausedAt = null
  }

  function afterAsk() {
    const then = ask.then
    setAsk(null)
    if (then === 'end') { onTimeUp(); return }
    resume(); deal()
  }

  function clickPanel(ev, w) {
    const g = G.current, pic = g?.pic
    if (!pic || g.block.over || g.block.pausedAt != null) return
    const svg = el.current[w]?.art.querySelector('svg')
    if (!svg) return
    const rc = svg.getBoundingClientRect(), t = performance.now()
    const x = f1((ev.clientX - rc.left) / rc.width * 600), y = f1((ev.clientY - rc.top) / rc.height * 400)
    if (pic.tClearAbs === null) { pic.fogClicks++; return }
    if (t < pic.lockUntil) { pic.blocked++; return }
    const tr = Math.round(t - pic.tClearAbs)
    if (pic.clicks.some(c => Math.hypot(c.x - x, c.y - y) < 30)) pic.repeat++
    pic.clicks.push({ x, y, t: tr, panel: w })
    const near = d => d.hits.some(([hx, hy, hr]) => Math.hypot(hx - x, hy - y) <= hr + TOL)
    const hit = pic.sc.diffs.find(d => !pic.found.includes(d.id) && near(d))
    if (hit) {
      pic.found.push(hit.id); pic.finds.push({ id: hit.id, lvl: hit.lvl, t: tr })
      setScore(s => s + 1); setHere(pic.found.length); paint()
      return
    }
    if (pic.sc.diffs.some(d => pic.found.includes(d.id) && near(d))) return   // a click on something already found costs nothing
    pic.wrong++; pic.misses.push({ x, y, t: tr })
    if (pic.wrong > cfg.free) pic.lockUntil = t + cfg.lockout * 1000
  }

  function next() {
    const g = G.current
    if (!g?.pic || g.pic.tClearAbs === null || g.block.over || g.block.pausedAt != null) return
    const rec = endPicture('next')
    if (onAnswer) { pause(); setAsk({ rec, then: 'deal', stage: 'questions' }) } else deal()
  }

  useEffect(() => {
    const t0 = performance.now()
    const block = { type, meanFog: (type === 'thick' ? cfg.thick : cfg.thin) * 1000, t0, end: t0 + cfg.minutes * 60000, over: false, warned: false }
    const g = { block, pic: null, raf: 0 }
    G.current = g
    const loop = () => {
      if (block.over) return
      if (block.pausedAt != null) { g.raf = requestAnimationFrame(loop); return }
      const t = performance.now(), left = block.end - t
      if (left <= 0) {
        block.over = true
        const rec = endPicture('time')
        // the picture the clock ended is asked about too, unless it never cleared
        if (onAnswer && rec?.fogCleared) setAsk({ rec, then: 'end', stage: 'questions' })
        else onTimeUp()
        return
      }
      if (cfg.clock && el.current.clock) {
        el.current.clock.textContent = fmtClock(left)
        el.current.bar.style.width = (100 * left / (block.end - block.t0)).toFixed(2) + '%'
      }
      if (cfg.warn > 0 && !block.warned && left <= cfg.warn * 1000) { block.warned = true; block.warnedAtMs = Math.round(t - block.t0); setWarned(true) }
      const pic = g.pic
      if (pic && pic.tClearAbs === null) {
        const f = 1 - (t - pic.tDealAbs) / pic.fogMs
        if (f <= 0) clearFog(t)
        else for (const p of panels()) {
          if (!p) continue
          p.art.style.filter = `blur(${(16 * Math.pow(f, 1.3)).toFixed(2)}px)`
          p.fog.style.opacity = Math.min(1, f * 1.25).toFixed(3)
          if (cfg.fogCount) p.fogText.textContent = `Clears in ${Math.ceil((pic.tDealAbs + pic.fogMs - t) / 1000)}`
        }
      }
      const lk = pic ? pic.lockUntil - t : 0
      for (const p of panels()) {
        if (!p) continue
        if (lk > 0) { p.lock.hidden = false; p.lock.textContent = `Paused ${Math.ceil(lk / 1000)}` } else p.lock.hidden = true
      }
      g.raf = requestAnimationFrame(loop)
    }
    g.raf = requestAnimationFrame(() => { deal(); loop() })
    return () => { block.over = true; cancelAnimationFrame(g.raf) }
    // Runs once per valley: the valley is remounted (keyed) for the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const part = (w, k) => n => { el.current[w] = el.current[w] ?? {}; el.current[w][k] = n }

  return (
    <section>
      {ask && (ask.stage === 'questions'
        ? <PictureQuestions key={ask.rec.picture} rec={ask.rec} onSubmit={ans => { onAnswer(ask.rec, ans); setAsk(a => ({ ...a, stage: 'feedback' })) }} />
        : <PictureFeedback key={ask.rec.picture} rec={ask.rec} last={ask.then === 'end'} onNext={afterAsk} />)}
      <div hidden={!!ask}>
      <div className="fv-hud">
        <div className="fv-hud-valley"><span className="fv-eyebrow">Valley {valleyNumber} of {totalValleys}</span><b>{fogName(type)}</b></div>
        <div className="fv-hud-clock">
          {cfg.clock && (
            <>
              <div className="fv-bar"><div ref={n => { el.current.bar = n }} /></div>
              <span ref={n => { el.current.clock = n }} className="fv-num">{fmtClock(cfg.minutes * 60000)}</span>
            </>
          )}
          {warned && <span className="fv-warn" role="status">{cfg.warn} seconds left</span>}
        </div>
        <div className="fv-hud-score">
          <span>Points <b className="fv-num">{score}</b></span>
          <span className="fv-muted">This picture <b className="fv-num">{here}</b></span>
        </div>
        <button type="button" className="fv-btn" disabled={fogged} onClick={next}>Next picture</button>
      </div>
      <div className="fv-panels">
        {['A', 'B'].map(w => (
          <div key={w} className={`fv-panel${fogged ? ' fogged' : ''}`} onPointerDown={ev => clickPanel(ev, w)}>
            <div className="fv-art" ref={part(w, 'art')} dangerouslySetInnerHTML={{ __html: art[w] }} />
            <div className="fv-fog" ref={part(w, 'fog')}><span ref={part(w, 'fogText')} /></div>
            <div className="fv-lock" ref={part(w, 'lock')} hidden />
          </div>
        ))}
      </div>
      </div>
    </section>
  )
}

// ── after each picture: the questions, then the feedback ─────────────────────

function PictureQuestions({ rec, onSubmit }) {
  const sc = useMemo(() => getScene(rec.scene - 1), [rec.scene])
  const askReason = rec.endedBy === 'next'
  const [reason, setReason] = useState(null)
  const [estimate, setEstimate] = useState(null)
  const shown = useRef(null)
  const sent = useRef(false)
  useEffect(() => { shown.current = { at: new Date().toISOString(), t: performance.now() } }, [])
  const done = estimate != null && (!askReason || reason != null)

  function submit() {
    if (!done || sent.current) return
    sent.current = true
    onSubmit({
      reason: askReason ? reason : null, estimate,
      answerMs: Math.round(performance.now() - shown.current.t), shownAt: shown.current.at, submittedAt: new Date().toISOString(),
    })
  }

  return (
    <section className="fv-card fv-intro">
      <p className="fv-eyebrow">{askReason ? 'Before the next picture' : 'Time is up in this valley'}</p>
      <h1>About the picture you just searched</h1>
      <div className="fv-pic" dangerouslySetInnerHTML={{ __html: sceneSVG(sc, 'B', foundOverlay(sc, rec.foundIds, false)) }} />
      {askReason && (
        <div className="fv-item">
          <div className="q" id={`fv-why-${rec.picture}`}>{MOVE_ON_QUESTION}</div>
          <div className="fv-opts" role="radiogroup" aria-labelledby={`fv-why-${rec.picture}`}>
            {MOVE_ON_REASONS.map(o => (
              <button key={o.id} type="button" role="radio" aria-checked={reason === o.id} onClick={() => setReason(o.id)}>{o.label}</button>
            ))}
          </div>
        </div>
      )}
      <div className="fv-item">
        <div className="q">{ESTIMATE_QUESTION}</div>
        <div className="fv-est fv-num" aria-hidden="true">{estimate == null ? 'Move the slider' : `${estimate}%`}</div>
        <NoDefaultSlider min={0} max={100} step={1} value={estimate} onChange={setEstimate} ariaLabel={ESTIMATE_QUESTION} />
        <div className="fv-ends"><span>None of them</span><span>All of them</span></div>
      </div>
      <div className="fv-actions"><button type="button" className="fv-btn" disabled={!done} onClick={submit}>Submit</button></div>
    </section>
  )
}

function PictureFeedback({ rec, last, onNext }) {
  const sc = useMemo(() => getScene(rec.scene - 1), [rec.scene])
  const missed = sc.diffs.filter(d => !rec.foundIds.includes(d.id))
  const pct = rec.totalDifferences ? Math.round(100 * rec.found / rec.totalDifferences) : 0
  return (
    <section className="fv-card fv-intro">
      <p className="fv-eyebrow">{last ? 'Time is up in this valley' : 'How you did on that picture'}</p>
      <h1>You found {rec.found} of the {plural(rec.totalDifferences, 'difference')} in this picture: {pct}%</h1>
      <div className="fv-legend">
        <span><ReviewIcon c="#2f9e44" /> found</span><span><ReviewIcon c="#e03131" dash /> not found</span>
        <span><ReviewCross /> click that was not on a difference</span>
      </div>
      <div className="fv-pic" dangerouslySetInnerHTML={{ __html: sceneSVG(sc, 'B', reviewOverlay(sc, rec.foundIds, rec.misses)) }} />
      {missed.length
        ? <><h3>Not found</h3><ul className="fv-missed">{missed.map(d => <li key={d.id}>{d.text}</li>)}</ul></>
        : <p className="fv-muted">You found every difference.</p>}
      <div className="fv-actions"><button type="button" className="fv-btn" onClick={onNext}>{last ? 'Continue' : 'Next picture'}</button></div>
    </section>
  )
}

// ── ratings ──────────────────────────────────────────────────────────────────

function Ratings({ eyebrow, title, lead, groups, onDone, blocked = false }) {
  const items = groups.flatMap(g => g.items)
  const [vals, setVals] = useState({})
  const t0 = useRef(0)
  const sent = useRef(false)
  useEffect(() => { t0.current = performance.now() }, [])
  const left = items.filter(it => vals[it.id] === undefined).length
  const set = (id, v) => setVals(o => ({ ...o, [id]: v }))

  function go() {
    if (sent.current) return
    sent.current = true
    onDone({ ...vals }, Math.round(performance.now() - t0.current))
  }

  return (
    <section className="fv-card fv-intro">
      <p className="fv-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {lead && <div className="fv-prose"><p>{lead}</p></div>}
      {groups.map(g => (
        <div key={g.title}>
          <h3>{g.title}</h3>
          {g.items.map(it => it.type === 'six' ? (
            <div key={it.id} className="fv-item">
              <div className="q" id={`fv-q-${it.id}`}>{it.q}</div>
              <div className="fv-six" role="group" aria-labelledby={`fv-q-${it.id}`}>
                {it.anchors.map((a, i) => (
                  <button key={a} type="button" aria-pressed={vals[it.id] === i + 1} onClick={() => set(it.id, i + 1)}><b>{i + 1}</b>{a}</button>
                ))}
              </div>
            </div>
          ) : (
            <div key={it.id} className="fv-item">
              <label className="q" htmlFor={`fv-r-${it.id}`}>{it.q}</label>
              {it.placeholder && <span className="fv-tag">Placeholder: the build uses the platform’s Study 3 slider, with its wording and anchors</span>}
              <input id={`fv-r-${it.id}`} type="range" min="0" max="100" defaultValue={50} onChange={e => set(it.id, +e.target.value)} />
              <div className="fv-ends"><span>{it.lo}</span><span>{it.hi}</span></div>
            </div>
          ))}
        </div>
      ))}
      <div className="fv-actions">
        <button type="button" className="fv-btn" disabled={left > 0 || blocked} onClick={go}>Continue</button>
        <span className="fv-muted">{left ? `${left} left to answer` : ''}</span>
      </div>
    </section>
  )
}

// ── results (researcher view) ────────────────────────────────────────────────

function Results({ snap, onAgain, onGallery }) {
  const [copied, setCopied] = useState('')
  const json = useMemo(() => JSON.stringify(snap.data, null, 1), [snap])
  const { order, pics, ratings, answers, score, minutes } = snap
  const reviews = pics.filter(p => p.fogCleared)

  async function copy() {
    try { await navigator.clipboard.writeText(json); setCopied('Copied') } catch (_) { setCopied('Copy failed: select the text and press Ctrl+C') }
  }

  return (
    <section>
      <p className="fv-eyebrow">Researcher view</p>
      <h1>{score} point{score === 1 ? '' : 's'} across {pics.length} picture{pics.length === 1 ? '' : 's'}</h1>
      <div className="fv-tbl"><table>
        <thead><tr><th>Valley</th><th>Fog</th><th>Pictures</th><th>Points</th><th>Points per minute</th><th>Average fog</th><th>Average stay after the fog cleared</th><th>Average time after the last find</th></tr></thead>
        <tbody>{order.map((fog, i) => {
          const ps = pics.filter(p => p.valley === i + 1), left = ps.filter(p => p.endedBy === 'next'), pts = ps.reduce((s, p) => s + p.found, 0)
          return (
            <tr key={i}><td>{i + 1}</td><td>{fogName(fog)}</td><td className="n">{ps.length}</td><td className="n">{pts}</td><td className="n">{(pts / minutes).toFixed(1)}</td>
              <td className="n">{fmtS(mean(ps.map(p => p.fogMs)))}</td><td className="n">{fmtS(mean(left.map(p => p.searchMs)))}</td><td className="n">{fmtS(mean(left.map(p => p.timeAfterLastFindMs)))}</td></tr>
          )
        })}</tbody>
      </table></div>
      <p className="fv-note">Stays and times after the last find count only pictures left with Next picture; the picture cut off by the clock is excluded. Foraging theory predicts longer stays in heavy fog, because moving on costs more there, so each picture is worth searching for longer. The question for perfectionism is whether high-Discrepancy participants adjust their stays to the fog as much as others do, and what it costs them in the ratings.</p>
      {ratings.length > 0 && (
        <>
          <h2>Ratings</h2>
          <div className="fv-tbl"><table>
            <thead><tr><th>Item</th>{ratings.map(r => <th key={r.timepoint}>{r.timepoint.replace(/_/g, ' ')}</th>)}</tr></thead>
            <tbody>{[...CORE, ...VALLEY].map(it => (
              <tr key={it.id}><td>{it.q}</td>{ratings.map(r => <td key={r.timepoint} className="n">{r[it.id] ?? '–'}</td>)}</tr>
            ))}</tbody>
          </table></div>
        </>
      )}
      <h2>Each picture</h2>
      <div className="fv-tbl"><table>
        <thead><tr><th>#</th><th>Fog</th><th>Picture</th><th>Fog time</th><th>Found</th><th>Stay after the fog cleared</th><th>Time after the last find</th><th>Wrong clicks</th><th>Ended by</th><th>Thought they found</th><th>Why they moved on</th></tr></thead>
        <tbody>{pics.map(p => (
          <tr key={p.picture}><td className="n">{p.picture}</td><td>{p.fog === 'thick' ? 'Heavy' : 'Light'}</td><td>{p.scene}{p.extraScene ? ' (extra)' : ''} · {p.theme}</td>
            <td className="n">{(p.fogMs / 1000).toFixed(1)} s</td><td className="n">{p.found} of {p.totalDifferences}</td><td className="n">{fmtS(p.searchMs)}</td>
            <td className="n">{fmtS(p.timeAfterLastFindMs)}</td><td className="n">{p.wrongClicks}</td>
            <td>{p.endedBy === 'next' ? 'Next picture' : p.fogCleared ? 'Time up' : 'Time up in fog'}</td>
            <td className="n">{answers[p.picture] ? `${answers[p.picture].estimate}%` : '–'}</td>
            <td>{MOVE_ON_REASONS.find(o => o.id === answers[p.picture]?.reason)?.label ?? '–'}</td></tr>
        ))}</tbody>
      </table></div>
      <h2>Review of what was found and missed</h2>
      <div className="fv-legend">
        <span><ReviewIcon c="#2f9e44" /> found</span><span><ReviewIcon c="#e03131" dash /> not found</span>
        <span><ReviewCross /> click that was not on a difference</span>
      </div>
      <div className="fv-rgrid">
        {reviews.length ? reviews.map(p => {
          const sc = getScene(p.scene - 1), missed = sc.diffs.filter(d => !p.foundIds.includes(d.id))
          return (
            <article key={p.picture} className="fv-rcard">
              <b>Picture {p.picture} · found {p.found} of {p.totalDifferences}</b>
              <div className="pic" dangerouslySetInnerHTML={{ __html: sceneSVG(sc, 'B', reviewOverlay(sc, p.foundIds, p.misses)) }} />
              {missed.length ? <ul>{missed.map(d => <li key={d.id}>{d.text}</li>)}</ul> : <p className="fv-muted" style={{ margin: 0 }}>Every difference found.</p>}
            </article>
          )
        }) : <p className="fv-muted">No picture cleared before time ran out.</p>}
      </div>
      <h2>Data recorded</h2>
      <p className="fv-note">A preview saves nothing. In a study each valley’s start is saved as it begins, and each picture’s record as it ends.</p>
      <textarea readOnly aria-label="Recorded data as JSON" value={json} />
      <div className="fv-actions"><button type="button" className="fv-btn ghost" onClick={copy}>Copy the data</button><span className="fv-muted" aria-live="polite">{copied}</span></div>
      <div className="fv-actions"><button type="button" className="fv-btn" onClick={onAgain}>Play again</button><button type="button" className="fv-btn ghost" onClick={onGallery}>See all 15 pictures</button></div>
    </section>
  )
}

// ── gallery of the 15 pictures with answers ──────────────────────────────────

function Gallery() {
  const { cards, total, lv } = useMemo(() => {
    const lv = { easy: 0, medium: 0, hard: 0 }
    let total = 0
    const cards = []
    for (let i = 0; i < FIXED_PICTURES; i++) {
      const sc = getScene(i), ov = answerOverlay(sc)
      total += sc.diffs.length
      sc.diffs.forEach(d => lv[d.lvl]++)
      cards.push({ i, sc, a: sceneSVG(sc, 'A', ov), b: sceneSVG(sc, 'B', ov) })
    }
    return { cards, total, lv }
  }, [])
  return (
    <>
      <section style={{ marginBottom: 16 }}>
        <p className="fv-eyebrow">Researcher view</p>
        <h1>The 15 pictures</h1>
        <p className="fv-note">{total} differences in all: {lv.easy} easy, {lv.medium} medium and {lv.hard} hard, by the generator’s own guess, which needs piloting. Slight colour changes shift the hue by 16 to 28 degrees and the lightness a little. Every picture is generated from a fixed seed, so all participants see the same 15, in a random order. Orange circles mark the places that count as a difference. A participant who works through all 15 gets further pictures from the same generator with new seeds, flagged as extra in the data.</p>
      </section>
      <div className="fv-ggrid">
        {cards.map(({ i, sc, a, b }) => (
          <article key={i} className="fv-gcard">
            <header><b>Picture {i + 1} · {sc.themeName}</b><span className="fv-muted">{sc.diffs.length} differences</span></header>
            <div className="fv-gpair"><div dangerouslySetInnerHTML={{ __html: a }} /><div dangerouslySetInnerHTML={{ __html: b }} /></div>
            <ol className="fv-dlist">{sc.diffs.map(d => <li key={d.id}><span className={`fv-lvl fv-lvl-${d.lvl}`}>{d.lvl}</span>{d.text}</li>)}</ol>
          </article>
        ))}
      </div>
    </>
  )
}
