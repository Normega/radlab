// ── BCAT threshold engine, off the display thread (Vite module worker) ─────
//
// Thin wrapper, as 6_online_pilot/js/worker.js: same messages, same replies, plus the `id` the caller
// sent. The messages are documented on makeController in adaptive.js:
//   {type:'init', cfg, seed}                 -> {type:'trial', trial, finished, init_ms, prior_running, ...}
//   {type:'respond', trial_index, response}  -> {type:'result', scoring, running, next_trial, finished, procedure_ms, history, ...}
//   {type:'readout'} / {type:'abort'}        -> {type:'readout', readout}
// An exception comes back as {id, type:'error', message}.
//
// Start it with:  new Worker(new URL('./engine/engine.worker.js', import.meta.url), { type: 'module' })
// Not node-tested (it is only this wrapper); the controller it runs is, in engine.test.mjs.

import { makeController } from './adaptive.js'

const handle = makeController()

self.onmessage = (ev) => {
  const msg = ev.data
  try {
    const out = handle(msg)
    out.id = msg.id
    self.postMessage(out)
  } catch (err) {
    self.postMessage({ id: msg.id, type: 'error', message: String((err && err.stack) || err) })
  }
}
