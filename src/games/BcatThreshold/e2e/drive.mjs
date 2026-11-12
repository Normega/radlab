// End-to-end test drive of the BCAT threshold step in a real headless Chrome (puppeteer-core + the Chrome
// already installed). Not part of `npm test`: it needs a running dev server.
//
//   1. start the app with Supabase pointed at nowhere, so nothing can reach a database:
//        VITE_SUPABASE_URL=http://127.0.0.1:9 VITE_SUPABASE_ANON_KEY=offline npx vite --port 5199 --strictPort
//   2. node src/games/BcatThreshold/e2e/drive.mjs <outDir> [scenario ...]
//        scenarios: simulate (all three arms), demo_touch, blur_vision, reminder_touch, reminder_vision,
//                   fullscreen_vision, fullscreen_iframe, fullscreen_noapi, fullscreen_rejected   (default: all)
//        reminder_* save screenshots bt_reminder_*.png in <outDir>; fullscreen_* save bt_fullscreen_*.png
//        Full screen in headless Chrome: entry is a real request from a trusted space-bar press; an "exit" is
//        document.exitFullscreen() (Esc cannot be sent to the browser itself); no API and a refused request are
//        simulated by replacing the API before the page loads; the iframe case is a real cross-origin frame.
//
// Chrome resolves no host but localhost, and every request to another origin is aborted and counted, so
// the run cannot send anything anywhere. Key presses are trusted input events (CDP Input.dispatchKeyEvent),
// as a keyboard sends them. The page exposes window.__bcatThreshold only in a preview.

import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BCAT_BASE || 'http://localhost:5199'
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p))
const OUT = path.resolve(process.argv[2] || 'bcat_e2e_out')
const WHICH = process.argv.slice(3)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function openPage(browser, url, dl, beforeLoad = null) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  if (beforeLoad) await page.evaluateOnNewDocument(beforeLoad)
  const blocked = []
  await page.setRequestInterception(true)
  page.on('request', req => {
    const u = new URL(req.url())
    if (['localhost', '127.0.0.1'].includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:') req.continue()
    else { blocked.push(req.url()); req.abort() }
  })
  const log = []
  page.on('console', m => log.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', e => log.push(`pageerror: ${e.message}`))
  if (dl) {
    fs.mkdirSync(dl, { recursive: true })
    const cdp = await page.createCDPSession()
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl })
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  return { page, blocked, log }
}

const ui = page => page.evaluate(() => {
  const b = window.__bcatThreshold
  return b ? { ...b.ui, now: performance.now() } : null
})
const snapshot = page => page.evaluate(() => window.__bcatThreshold.snapshot())

async function waitFor(page, pred, ms = 60000) {
  const t = Date.now()
  for (;;) {
    const u = await ui(page)
    if (u && pred(u)) return u
    if (u && u.what === 'error') throw new Error('app error: ' + u.message)
    if (Date.now() - t > ms) throw new Error('timed out waiting; last ui ' + JSON.stringify(u))
    await sleep(50)
  }
}

/**
 * A scripted participant. In the touch and breath arms it holds W while the circle grows and S while it
 * shrinks, lagMs late. Answers correctly 75% of the time. Hooks:
 *   onCircle(u, k)  every poll during a circle (k = main-trial count so far)
 *   holdBeforeAnswer: on main trial n, press W before answering and keep it 1200 ms after (keys-up gate)
 *   offTaskOn: main trial numbers on which it does not comply: touch and breath hold no key; vision holds W
 *     from 3.0 to 3.8 s after fixation onset (during the first pulse)
 *   onPage(u)  awaited on every page before it presses the space bar
 */
async function participant(page, { arm, lagMs = 150, onCircle = null, holdWBeforeAnswerOn = null, offTaskOn = [], onPage = null, onQuestion = null, stopAt = null, log = () => {} }) {
  let held = null, last = null, nMain = 0, gateSeen = false
  const t0 = Date.now()
  while (Date.now() - t0 < 20 * 60 * 1000) {
    const u = await ui(page)
    if (!u) { await sleep(50); continue }
    if (u.what !== last) { log(`[${((Date.now() - t0) / 1000).toFixed(0)} s] ${u.what}${u.id ? ' ' + u.id : ''}${u.phase ? ' ' + u.phase : ''}`); last = u.what }
    if (u.what === 'done') return { nMain, gateSeen }
    if (stopAt && stopAt(u, nMain)) return { nMain, gateSeen, stopped: true }
    if (u.what === 'error' || u.what === 'device') throw new Error('stopped: ' + JSON.stringify(u))
    if (u.what === 'gate') gateSeen = true
    if (u.what === 'page') {
      await sleep(300)
      const again = await ui(page)
      if (again.what === 'page' && again.at === u.at) { if (onPage) await onPage(again); await page.keyboard.press('Space') }
      await sleep(150); continue
    }
    if (u.what === 'circle') {
      if (onCircle) await onCircle(u, nMain)
      const off = u.phase === 'main' && offTaskOn.includes(nMain + 1)
      if (off) {
        const el = u.now - u.t0
        const want = arm === 'vision' && el >= 3000 && el < 3800 ? 'KeyW' : null
        if (want !== held) {
          if (held) await page.keyboard.up(held)
          if (want) await page.keyboard.down(want)
          held = want
        }
      } else if (arm !== 'vision') {
        const durs = u.durs || [4, 4, 4, 4]   // until the level is known: the approved trial's four baseline-length pulses
        const el = (u.now - u.t0 - 1500 - lagMs) / 1000
        let want = null
        if (el >= 0) {
          let acc = 0, k = 0
          while (k < durs.length && el >= acc + durs[k]) { acc += durs[k]; k++ }
          want = k >= durs.length ? held : ((el - acc) / durs[k] < 0.5 ? 'KeyW' : 'KeyS')
        }
        if (want !== held) {
          if (held) await page.keyboard.up(held)
          if (want) await page.keyboard.down(want)
          held = want
        }
      }
    } else if (u.what === 'question') {
      if (held) { await page.keyboard.up(held); held = null }
      if (u.phase === 'main') nMain += 1
      if (onQuestion) await onQuestion(u, nMain)
      const holdW = holdWBeforeAnswerOn !== null && u.phase === 'main' && nMain === holdWBeforeAnswerOn
      if (holdW) await page.keyboard.down('KeyW')
      await sleep(300 + Math.random() * 400)
      const correct = { speeding: 'ArrowRight', slowing: 'ArrowLeft', no_change: 'ArrowUp' }[u.cell]
      const key = Math.random() < 0.75 ? correct : ['ArrowLeft', 'ArrowUp', 'ArrowRight'][Math.floor(Math.random() * 3)]
      await page.keyboard.press(key)
      if (holdW) {
        await sleep(600)
        const g = await ui(page)
        if (g.what === 'gate') gateSeen = true
        await sleep(600)
        await page.keyboard.up('KeyW')
      }
      await waitFor(page, x => x.what !== 'question' || x.trial_index !== u.trial_index || x.phase !== u.phase, 10000)
    }
    await sleep(20)
  }
  throw new Error('participant timed out')
}

// ── timing summary of the live (non-simulated) trials ──
function timing(rows) {
  const live = rows.filter(r => r.timing && !r.timing.simulated && r.delivered_boundaries_ms)
  const errs = live.flatMap(r => r.boundary_error_ms.slice(1))   // index 0 is fixation onset, 0 by definition
  const pulseErr = live.flatMap(r => r.delivered_pulses_ms.map((d, i) => d - (r.planned_boundaries_ms[i + 2] - r.planned_boundaries_ms[i + 1])))
  const abs = a => a.map(Math.abs)
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null }
  return {
    n_trials: live.length,
    frame_period_ms: live[0]?.timing.frame_period_ms ?? null,
    boundary_error_ms: { n: errs.length, mean: errs.reduce((a, b) => a + b, 0) / (errs.length || 1), max_abs: Math.max(...abs(errs)), p95_abs: q(abs(errs), 0.95) },
    pulse_duration_error_ms: { n: pulseErr.length, mean: pulseErr.reduce((a, b) => a + b, 0) / (pulseErr.length || 1), max_abs: Math.max(...abs(pulseErr)) },
    dropped_frames_total: live.reduce((a, r) => a + (r.timing.dropped_frames || 0), 0),
    max_frame_gap_ms: Math.max(...live.map(r => r.timing.max_frame_gap_ms || 0)),
    level_ready_ms_max: Math.max(...live.map(r => r.timing.level_ready_ms ?? 0)),
    level_wait_ms_total: live.reduce((a, r) => a + (r.timing.level_wait_ms || 0), 0),
    rt_ms_median: q(live.map(r => r.rt_ms), 0.5),
  }
}

function checkRows(snap, { arm }) {
  const rows = snap.trials, problems = []
  const want = (c, m) => { if (!c) problems.push(m) }
  want(snap.run && snap.result, 'run and result saved')
  want(Number.isInteger(snap.run.seed) && snap.run.seed >= 0 && snap.run.seed < 2 ** 32, 'seed in [0, 2^32)')
  want(snap.run.arm === arm, 'arm')
  want(rows.every((r, i) => r.seq === i + 1), 'seq 1..n')
  const mains = rows.filter(r => r.phase === 'main')
  want(mains.every((r, i) => r.trial_index === i + 1), 'main trial_index 1..n')
  want(mains.every(r => r.posterior && typeof r.posterior.speeding_threshold === 'number'), 'posterior on every main row')
  want(snap.result.readout && snap.result.readout.n_trials_total === mains.length, 'readout counts the main trials')
  want(!JSON.stringify(snap).match(/PROLIFIC|STUDY_ID|SESSION_ID/), 'no platform identifiers')
  if (arm === 'vision') want(rows.every(r => r.key_events.every(e => e.role !== 'grow' && e.role !== 'shrink')), 'vision: no W/S holds scripted')
  return problems
}

// What the cue line shows now: its text and whether it is visible.
const cueState = page => page.evaluate(() => {
  const el = document.querySelector('.bt-cue')
  return el ? { text: el.textContent, visibility: getComputedStyle(el).visibility } : null
})

// Reminders: screenshot the line during the fixation of each trial that has one (first one per kind), check it
// is gone once the circle moves, and screenshot the page reminder.
async function reminderRun(browser, { arm, url, offTaskOn, tag }) {
  const { page, blocked, log } = await openPage(browser, url)
  const shots = {}, lines = [], pages = []
  let lineTrial = null
  const p = await participant(page, {
    arm, offTaskOn, log: m => console.log(`  ${tag} ` + m),
    onCircle: async (u, nMain) => {
      if (!u.reminder || u.phase !== 'main') return
      const el = u.now - u.t0, k = nMain + 1
      if (el < 1200 && lineTrial !== k) {
        lineTrial = k
        const c = await cueState(page)
        const name = `bt_reminder_line_${tag}_main${k}.png`
        if (!shots.line) { await page.screenshot({ path: path.join(OUT, name) }); shots.line = name }
        lines.push({ main: k, at_ms: Math.round(el), cue: c })
      } else if (el > 2500 && el < 4000 && lines.length && lines[lines.length - 1].main === k && !lines[lines.length - 1].after) {
        const c = await cueState(page)
        lines[lines.length - 1].after = { at_ms: Math.round(el), cue: c }
        if (!shots.gone) { const name = `bt_reminder_line_gone_${tag}_main${k}.png`; await page.screenshot({ path: path.join(OUT, name) }); shots.gone = name }
      }
    },
    onPage: async u => {
      if (u.id !== 'compliance_reminder') return
      const text = await page.evaluate(() => document.querySelector('.bt-card')?.innerText)
      const name = `bt_reminder_page_${tag}.png`
      if (!shots.page) { await page.screenshot({ path: path.join(OUT, name) }); shots.page = name }
      pages.push({ text })
    },
  })
  const snap = await snapshot(page)
  fs.writeFileSync(path.join(OUT, `reminder_${tag}.json`), JSON.stringify(snap))
  const rows = snap.trials
  const res = {
    participant: p, rows: rows.length, main: snap.result.n_main,
    per_main: rows.filter(r => r.phase === 'main').map(r => ({ trial_index: r.trial_index, seq: r.seq, compliant: r.compliant,
      coverage: r.compliance_coverage === null ? null : +r.compliance_coverage.toFixed(3), ws_presses: r.compliance_ws_presses,
      streak: r.noncompliant_streak, line: r.reminder_shown, page: r.reminder_page_shown, reminder_off_ms: r.timing.reminder_off_ms,
      first_pulse_ms: r.delivered_boundaries_ms ? r.delivered_boundaries_ms[1] : null, response: r.response, engine_response: r.engine_response })),
    practice_compliant: rows.filter(r => r.phase === 'practice').map(r => r.compliant),
    counts: { n_noncompliant: snap.result.n_noncompliant, n_reminder_lines: snap.result.n_reminder_lines, n_reminder_pages: snap.result.n_reminder_pages },
    engine_response_equals_response: rows.filter(r => r.phase === 'main').every(r => r.engine_response === r.response),
    lines_seen: lines, pages_seen: pages, screenshots: shots,
    // the vision run presses W on purpose, so checkRows's "no W/S" check is expected to fail there
    problems: checkRows(snap, { arm }).filter(m => !(arm === 'vision' && /vision: no W\/S/.test(m))),
    // the fonts 403 under a worktree's dev server (node_modules is a junction): known, not counted
    blocked: blocked.length, errors: log.filter(l => /error/i.test(l) && !/Failed to load resource/.test(l)),
    font_or_resource_errors: log.filter(l => /Failed to load resource/.test(l)).length,
  }
  console.log(`${tag}:`, JSON.stringify(res, null, 1))
  await page.close()
  return res
}

// ── full screen ──
const fsState = target => target.evaluate(() => ({
  fullscreen: !!document.fullscreenElement, enabled: document.fullscreenEnabled, w: window.innerWidth, h: window.innerHeight,
}))
// The answer panel's box against the window: does it fit, and is the compact layout on?
const panelFit = page => page.evaluate(() => {
  const q = document.querySelector('.bt-answer'), t = document.querySelector('.bt-answer-q')
  const r = q.getBoundingClientRect()
  return { window_h: window.innerHeight, panel_top: Math.round(r.top), panel_bottom: Math.round(r.bottom), fits: r.bottom <= window.innerHeight,
    question_font_px: parseFloat(getComputedStyle(t).fontSize), circle_px: Math.round(document.querySelector('.bt-circle').getBoundingClientRect().height) }
})
const pageText = target => target.evaluate(() => document.querySelector('.bt-card')?.innerText)

// A windowed run up to the first answered main trial: which pages came, and what the run and that row recorded.
async function windowedRun(browser, { tag, url, inIframe = false, beforeLoad = null }) {
  let page, frame, blocked = [], log = []
  if (inIframe) {
    // a cross-origin iframe without allow="fullscreen": the browser itself says full screen is not enabled. The
    // parent is a real page of another origin (localhost vs 127.0.0.1); an about:blank parent makes the frame's
    // sessionStorage throw before the app starts.
    page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    page.on('console', m => log.push(`${m.type()}: ${m.text()}`))
    const u = new URL(url)
    await page.goto(`http://${u.hostname === 'localhost' ? '127.0.0.1' : 'localhost'}:${u.port}/HQlogo.png`)
    await page.evaluate(src => {
      document.body.innerHTML = ''; document.body.style.margin = '0'
      const f = document.createElement('iframe'); f.src = src; f.style.cssText = 'border:0;width:100vw;height:100vh'
      document.body.appendChild(f)
    }, url)
    for (let i = 0; i < 200 && !frame; i++) { frame = page.frames().find(f => f.url().startsWith(url.split('?')[0])); if (!frame) await sleep(50) }
    await frame.waitForFunction(() => window.__bcatThreshold, { timeout: 30000 })
    await page.click('iframe')   // keyboard focus into the frame
  } else {
    ({ page, blocked, log } = await openPage(browser, url, null, beforeLoad))
  }
  const target = inIframe ? frame : page
  const actor = { evaluate: (...a) => target.evaluate(...a), keyboard: page.keyboard }
  const pages = []
  let state = null
  const p = await participant(actor, {
    arm: 'vision', log: m => console.log(`  ${tag} ` + m),
    onPage: async u => { pages.push(u.id); if (u.id === 'fullscreen_enter') await page.screenshot({ path: path.join(OUT, `bt_fullscreen_${tag}_entry.png`) }) },
    onQuestion: async (u, n) => { if (n === 1 && !state) state = await fsState(target) },
    stopAt: (u, n) => n >= 1 && u.what === 'circle',
  })
  await sleep(1000)   // the first main row is saved once the engine has replied
  const snap = await target.evaluate(() => window.__bcatThreshold.snapshot())
  const row = snap.trials.find(r => r.phase === 'main')
  const res = { participant: p, pages, run_fullscreen: snap.run.fullscreen, state_at_first_question: state,
    first_main_row: row && { fullscreen_at_onset: row.fullscreen_at_onset, shown_fullscreen: row.shown_fullscreen, interrupted: row.interrupted, fullscreen_return_shown: row.fullscreen_return_shown },
    blocked: blocked.length, errors: log.filter(l => /error/i.test(l) && !/Failed to load resource/.test(l)) }
  console.log(`${tag}:`, JSON.stringify(res, null, 1))
  await page.close()
  return res
}

const SCENARIOS = {
  // Entry by the space bar on the full-screen page (a trusted key press); an exit during main trial 2 (the API's
  // exitFullscreen, as Esc would); a blur and an exit together during main trial 3; an exit while the question of
  // main trial 4 is up (no interruption, but the page before trial 5); each page answered with the space bar. The
  // window is also shrunk to 1280 x 460 during main trial 5 and restored, to check the answer panel's layout.
  async fullscreen_vision(browser) {
    const { page, blocked, log } = await openPage(browser, `${BASE}/dev/bcat-threshold?arm=vision&demo=1`)
    const seen = { states: [], returnPages: [], layout: [] }
    let did2 = false, did3 = false, did4 = false, did5 = false
    const p = await participant(page, {
      arm: 'vision', log: m => console.log('  fullscreen_vision ' + m),
      onPage: async u => {
        if (u.id === 'fullscreen_enter') {
          seen.entry_text = await pageText(page)
          seen.before_entry = await fsState(page)
          await page.screenshot({ path: path.join(OUT, 'bt_fullscreen_entry_page.png') })
        } else if (u.id === 'instructions_1' && !seen.after_entry) {
          seen.after_entry = await fsState(page)
        } else if (u.id === 'fullscreen_return') {
          const s = await fsState(page)
          seen.returnPages.push({ text: await pageText(page), state: s })
          if (seen.returnPages.length === 1) await page.screenshot({ path: path.join(OUT, 'bt_fullscreen_return_page.png') })
        }
      },
      onCircle: async (u, nMain) => {
        const el = u.now - u.t0
        if (u.phase !== 'main') return
        if (nMain === 1 && !did2 && el > 6000) {
          did2 = true
          await page.evaluate(() => document.exitFullscreen())
          await sleep(300)
          seen.states.push({ at: 'main 2, after exit', ...(await fsState(page)), ui: (await ui(page)).what })
        } else if (nMain === 2 && !did3 && el > 6000) {
          did3 = true
          await page.evaluate(() => { window.dispatchEvent(new Event('blur')); return document.exitFullscreen() })
          await sleep(1000)
          await page.evaluate(() => window.dispatchEvent(new Event('focus')))
        } else if (nMain === 4 && !did5 && el > 3000) {
          did5 = true
          seen.layout.push({ at: 'main 5, full size', ...(await fsState(page)) })
          await page.setViewport({ width: 1280, height: 460 })
          await sleep(300)
          seen.layout.push({ at: 'main 5, shrunk', ...(await fsState(page)) })
        }
      },
      onQuestion: async (u, nMain) => {
        if (u.phase === 'main' && nMain === 4 && !did4) {
          did4 = true
          await page.evaluate(() => document.exitFullscreen())
          await sleep(200)
        }
        if (u.phase === 'main' && nMain === 5 && did5 && !seen.layout_done) {
          seen.layout_done = true
          seen.layout.push({ at: 'main 5 question, 1280 x 460', ...(await panelFit(page)) })
          await page.screenshot({ path: path.join(OUT, 'bt_fullscreen_question_460.png') })
          await page.setViewport({ width: 1280, height: 800 })
          await sleep(300)
          seen.layout.push({ at: 'main 5 question, 1280 x 800', ...(await panelFit(page)) })
          await page.screenshot({ path: path.join(OUT, 'bt_fullscreen_question_800.png') })
        }
      },
    })
    seen.at_done = await fsState(page)
    const snap = await snapshot(page)
    fs.writeFileSync(path.join(OUT, 'fullscreen_vision.json'), JSON.stringify(snap))
    const rows = snap.trials
    const res = {
      participant: p, seen, run_fullscreen: snap.run.fullscreen, client: snap.run.client,
      rows: rows.map(r => ({ seq: r.seq, phase: r.phase, trial_index: r.trial_index, repeat_of: r.repeat_of, fs_onset: r.fullscreen_at_onset, shown_fs: r.shown_fullscreen,
        fs_exits: r.fullscreen_exits, return_page: r.fullscreen_return_shown, interrupted: r.interrupted, reason: r.interruption_reason, reasons: r.interruption_reasons,
        response: r.response, engine_response: r.engine_response, n_blur: r.n_blur, dropped: r.timing.dropped_frames })),
      result: { n_interrupted: snap.result.n_interrupted, n_repeats: snap.result.n_repeats, n_withheld: snap.result.n_withheld, n_fullscreen_exits: snap.result.n_fullscreen_exits,
        n_fullscreen_return_pages: snap.result.n_fullscreen_return_pages, n_interrupted_fullscreen: snap.result.n_interrupted_fullscreen,
        events: snap.result.fullscreen.events.map(e => e.type), readout_missing: snap.result.readout.n_missing_responses },
      timing: timing(rows), problems: checkRows(snap, { arm: 'vision' }), blocked: blocked.length,
      errors: log.filter(l => /error/i.test(l) && !/Failed to load resource/.test(l)), font_or_resource_errors: log.filter(l => /Failed to load resource/.test(l)).length,
    }
    console.log('fullscreen_vision:', JSON.stringify(res, null, 1))
    await page.close()
    return res
  },
  // the step framed without permission: no entry page, windowed, recorded as not_enabled
  fullscreen_iframe: browser => windowedRun(browser, { tag: 'iframe', inIframe: true, url: `${BASE}/dev/bcat-threshold?arm=vision&demo=1&practice=0` }),
  // no API at all (removed before the page loads; simulated)
  fullscreen_noapi: browser => windowedRun(browser, { tag: 'noapi', url: `${BASE}/dev/bcat-threshold?arm=vision&demo=1&practice=0`,
    beforeLoad: () => { delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen } }),
  // the request is refused (replaced by one that rejects before the page loads; simulated)
  fullscreen_rejected: browser => windowedRun(browser, { tag: 'rejected', url: `${BASE}/dev/bcat-threshold?arm=vision&demo=1&practice=0`,
    beforeLoad: () => { Element.prototype.requestFullscreen = function () { return Promise.reject(new TypeError('Permissions check failed')) } } }),
  async simulate(browser) {
    const out = {}
    for (const arm of ['vision', 'touch', 'breath']) {
      const t = Date.now()
      const { page, blocked, log } = await openPage(browser, `${BASE}/dev/bcat-threshold?arm=${arm}&simulate=1`)
      await waitFor(page, u => u.what === 'done', 180000)
      const snap = await snapshot(page)
      fs.writeFileSync(path.join(OUT, `simulate_${arm}.json`), JSON.stringify(snap))
      out[arm] = { seconds: (Date.now() - t) / 1000, rows: snap.trials.length, main: snap.result.n_main, practice: snap.result.n_practice,
        engine_mode: snap.result.engine_mode, seed: snap.run.seed, planned_trials: snap.run.planned_trials,
        speeding_threshold: snap.result.readout.cells.speeding.threshold.x, slowing_threshold: snap.result.readout.cells.slowing.threshold.x,
        key_events_per_main_trial: snap.trials.filter(r => r.phase === 'main').reduce((a, r) => a + r.key_events.length, 0) / snap.result.n_main,
        problems: checkRows(snap, { arm }), blocked: blocked.length, errors: log.filter(l => /error/i.test(l)) }
      console.log(`simulate ${arm}:`, JSON.stringify(out[arm]))
      await page.close()
    }
    return out
  },
  async demo_touch(browser) {
    const dl = path.join(OUT, 'download_demo_touch')
    const { page, blocked, log } = await openPage(browser, `${BASE}/dev/bcat-threshold?arm=touch&demo=1`, dl)
    const p = await participant(page, { arm: 'touch', lagMs: 150, holdWBeforeAnswerOn: 2, log: m => console.log('  demo_touch ' + m) })
    const snap = await snapshot(page)
    fs.writeFileSync(path.join(OUT, 'demo_touch.json'), JSON.stringify(snap))
    const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.startsWith('Download data')); if (b) b.click(); return !!b })
    await sleep(2000)
    const files = fs.existsSync(dl) ? fs.readdirSync(dl) : []
    const rows = snap.trials
    const mains = rows.filter(r => r.phase === 'main')
    const third = mains[2]   // the trial after the one answered with W held
    const res = {
      participant: p, rows: rows.length, practice: snap.result.n_practice, main: mains.length, repeats: snap.result.n_repeats,
      interrupted: snap.result.n_interrupted, timing: timing(rows),
      key_summary_main_mean_coverage: mains.map(r => r.key_summary && r.key_summary.mean_coverage),
      key_summary_main_median_onset_lag_ms: mains.map(r => r.key_summary && r.key_summary.median_onset_lag_ms),
      key_events_per_main_trial: mains.map(r => r.key_events.length),
      gate: { seen: p.gateSeen, third_trial_held_at_onset: third ? third.key_events.filter(e => e.type === 'held_at_onset').map(e => e.key) : null },
      download: { clicked, files }, problems: checkRows(snap, { arm: 'touch' }), blocked: blocked.length,
      errors: log.filter(l => /error/i.test(l)),
    }
    console.log('demo_touch:', JSON.stringify(res, null, 1))
    await page.close()
    return res
  },
  // touch: off task on main trial 2 (the line at main 3), then on 4, 5 and 6 (the page before main 7, and its line)
  reminder_touch: browser => reminderRun(browser, { arm: 'touch', tag: 'touch', offTaskOn: [2, 4, 5, 6],
    url: `${BASE}/dev/bcat-threshold?arm=touch&demo=1` }),
  // vision: W held during the pulses of main trials 2, then 4, 5 and 6
  reminder_vision: browser => reminderRun(browser, { arm: 'vision', tag: 'vision', offTaskOn: [2, 4, 5, 6],
    url: `${BASE}/dev/bcat-threshold?arm=vision&demo=1&practice=0` }),
  async blur_vision(browser) {
    const { page, blocked, log } = await openPage(browser, `${BASE}/dev/bcat-threshold?arm=vision&demo=1&practice=0`)
    let blurred = false
    const p = await participant(page, {
      arm: 'vision', log: m => console.log('  blur_vision ' + m),
      onCircle: async (u, nMain) => {
        // during the second main trial, 6 s after fixation onset: the window loses focus for 1.5 s
        if (!blurred && u.phase === 'main' && nMain === 1 && u.now - u.t0 > 6000) {
          blurred = true
          await page.evaluate(() => window.dispatchEvent(new Event('blur')))
          await sleep(1500)
          await page.evaluate(() => window.dispatchEvent(new Event('focus')))
        }
      },
    })
    const snap = await snapshot(page)
    fs.writeFileSync(path.join(OUT, 'blur_vision.json'), JSON.stringify(snap))
    const rows = snap.trials
    const hit = rows.filter(r => r.interrupted)
    const rep = rows.filter(r => r.phase === 'repeat')
    const res = {
      participant: p, rows: rows.length, main: snap.result.n_main, interrupted: hit.map(r => ({ seq: r.seq, phase: r.phase, trial_index: r.trial_index,
        response: r.response, engine_response: r.engine_response, focus_events: r.focus_events, key_blurs: r.key_blurs, repeat_queued: r.repeat_queued })),
      repeats: rep.map(r => ({ seq: r.seq, repeat_of: r.repeat_of, magnitude: r.magnitude, interrupted: r.interrupted })),
      original_magnitude: hit[0] ? hit[0].magnitude : null,
      readout_missing: snap.result.readout.n_missing_responses, n_withheld: snap.result.n_withheld,
      last_main_seq: Math.max(...rows.filter(r => r.phase === 'main').map(r => r.seq)),
      timing: timing(rows), problems: checkRows(snap, { arm: 'vision' }), blocked: blocked.length, errors: log.filter(l => /error/i.test(l)),
    }
    console.log('blur_vision:', JSON.stringify(res, null, 1))
    await page.close()
    return res
  },
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--no-first-run', '--window-size=1280,800'],
})
fs.mkdirSync(OUT, { recursive: true })
const results = { browser: await browser.version(), when: new Date().toISOString() }
try {
  for (const name of (WHICH.length ? WHICH : Object.keys(SCENARIOS))) {
    const t = Date.now()
    try { results[name] = await SCENARIOS[name](browser); results[name].wall_s = (Date.now() - t) / 1000 } catch (e) { results[name] = { error: String(e.stack || e) }; console.log(name, 'ERROR', e) }
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1))
  }
} finally { await browser.close() }
console.log('done; results in', path.join(OUT, 'results.json'))
