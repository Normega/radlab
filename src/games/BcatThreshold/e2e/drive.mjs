// End-to-end test drive of the BCAT threshold step in a real headless Chrome (puppeteer-core + the Chrome
// already installed). Not part of `npm test`: it needs a running dev server.
//
//   1. start the app with Supabase pointed at nowhere, so nothing can reach a database:
//        VITE_SUPABASE_URL=http://127.0.0.1:9 VITE_SUPABASE_ANON_KEY=offline npx vite --port 5199 --strictPort
//   2. node src/games/BcatThreshold/e2e/drive.mjs <outDir> [scenario ...]
//        scenarios: simulate (all three arms), demo_touch, blur_vision   (default: all)
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

async function openPage(browser, url, dl) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
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
 */
async function participant(page, { arm, lagMs = 150, onCircle = null, holdWBeforeAnswerOn = null, log = () => {} }) {
  let held = null, last = null, nMain = 0, gateSeen = false
  const t0 = Date.now()
  while (Date.now() - t0 < 20 * 60 * 1000) {
    const u = await ui(page)
    if (!u) { await sleep(50); continue }
    if (u.what !== last) { log(`[${((Date.now() - t0) / 1000).toFixed(0)} s] ${u.what}${u.id ? ' ' + u.id : ''}${u.phase ? ' ' + u.phase : ''}`); last = u.what }
    if (u.what === 'done') return { nMain, gateSeen }
    if (u.what === 'error' || u.what === 'device') throw new Error('stopped: ' + JSON.stringify(u))
    if (u.what === 'gate') gateSeen = true
    if (u.what === 'page') { await sleep(300); const again = await ui(page); if (again.what === 'page' && again.at === u.at) await page.keyboard.press('Space'); await sleep(150); continue }
    if (u.what === 'circle') {
      if (onCircle) await onCircle(u, nMain)
      if (arm !== 'vision') {
        const durs = u.durs || [4, 4, 4, 4, 4]
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

const SCENARIOS = {
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
