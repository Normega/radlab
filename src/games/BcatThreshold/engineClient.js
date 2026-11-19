// ── BCAT threshold: talking to the engine ──────────────────────────────────
//
// The engine runs in a Web Worker (engine/engine.worker.js) so an update never holds up a frame. Messages and
// replies are the controller's (engine/adaptive.js, makeController): init, respond, readout, abort, plus restore
// for a resume (engine/taskController.js). Every call returns a promise of the reply.
//
// If the worker cannot start, or fails before init has answered, the same controller runs on the main thread
// (as the test build did), and `mode` says so; the run records it. A main-thread reply shares arrays with the
// running session (Stage A notes), so it is cloned before it is handed back. createEngineClient({ worker:
// false }) forces the main thread (node, and the simulated run in tests).

import { makeTaskController } from './engine/taskController.js'

// Review items 9 and 10 (2026-11-19):
//   ready()   a 'hello' round trip, made before the run row is written, so the run's engine_mode is where the
//             session will run (a worker that cannot load has fallen back by then) and the result agrees with it.
//   timeouts  a worker that never answers fails the call (EngineTimeoutError) instead of hanging the step: init and
//             restore 60 s (a full restore takes about 8 s), everything else 20 s. The step then shows its error
//             screen (fail closed); the session is not continued on a main-thread copy, whose state would differ.
export const ENGINE_TIMEOUTS_MS = Object.freeze({ init: 60000, restore: 60000, default: 20000 })

export class EngineTimeoutError extends Error {
  constructor(type, ms) { super(`engine: no reply to ${type} within ${ms} ms`); this.name = 'EngineTimeoutError' }
}

export function createEngineClient({ worker: useWorker = true, timeouts = ENGINE_TIMEOUTS_MS, workerFactory = null } = {}) {
  let worker = null, nextId = 1, fallback = null, initDone = false
  const pending = new Map()
  const client = { mode: 'main_thread' }

  const failAll = err => { for (const p of pending.values()) p.reject(err); pending.clear() }

  if (useWorker && (workerFactory || typeof Worker !== 'undefined')) {
    try {
      worker = workerFactory ? workerFactory() : new Worker(new URL('./engine/engine.worker.js', import.meta.url), { type: 'module' })
      client.mode = 'worker'
      worker.onmessage = ev => {
        const p = pending.get(ev.data && ev.data.id)
        if (!p) return
        pending.delete(ev.data.id)
        if (ev.data.type === 'error') p.reject(new Error(ev.data.message))
        else p.resolve(ev.data)
      }
      worker.onerror = ev => {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault()
        const err = new Error('engine worker failed: ' + ((ev && ev.message) || 'load error'))
        try { worker.terminate() } catch (_) {}
        worker = null
        failAll(err)
      }
    } catch (_) {
      worker = null
    }
  }

  const viaMain = msg => new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        if (!fallback) fallback = makeTaskController()
        resolve(structuredClone(fallback(msg)))
      } catch (e) { reject(e) }
    }, 0)
  })

  let stopped = false
  client.call = msg => {
    if (stopped) return Promise.reject(new Error('engine stopped'))
    if (!worker) { client.mode = 'main_thread'; return viaMain(msg) }
    const id = nextId++
    const ms = timeouts ? (timeouts[msg.type] ?? timeouts.default) : null
    return new Promise((resolve, reject) => {
      const timer = ms ? setTimeout(() => { if (pending.delete(id)) reject(new EngineTimeoutError(msg.type, ms)) }, ms) : null
      pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v) }, reject: e => { clearTimeout(timer); reject(e) } })
      worker.postMessage({ ...msg, id })
    }).then(r => { if (msg.type === 'init' || msg.type === 'restore') initDone = true; return r }, err => {
      // the worker could not load: run the session on the main thread instead (only before it has a session)
      if (!worker && ['init', 'restore', 'hello'].includes(msg.type) && !initDone) return client.call(msg)
      throw err
    })
  }

  /** Resolves once it is settled where the engine runs (client.mode). */
  client.ready = () => client.call({ type: 'hello' }).then(() => client.mode)

  client.terminate = () => {
    stopped = true
    if (worker) { try { worker.terminate() } catch (_) {} worker = null }
    failAll(new Error('engine stopped'))
  }
  return client
}
