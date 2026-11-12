// ── BCAT threshold: talking to the engine ──────────────────────────────────
//
// The engine runs in a Web Worker (engine/engine.worker.js) so an update never holds up a frame. Messages and
// replies are the controller's (engine/adaptive.js, makeController): init, respond, readout, abort. Every
// call returns a promise of the reply.
//
// If the worker cannot start, or fails before init has answered, the same controller runs on the main thread
// (as the test build did), and `mode` says so; the run records it. A main-thread reply shares arrays with the
// running session (Stage A notes), so it is cloned before it is handed back. createEngineClient({ worker:
// false }) forces the main thread (node, and the simulated run in tests).

import { makeController } from './engine/adaptive.js'

export function createEngineClient({ worker: useWorker = true } = {}) {
  let worker = null, nextId = 1, fallback = null, initDone = false
  const pending = new Map()
  const client = { mode: 'main_thread' }

  const failAll = err => { for (const p of pending.values()) p.reject(err); pending.clear() }

  if (useWorker && typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('./engine/engine.worker.js', import.meta.url), { type: 'module' })
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
        if (!fallback) fallback = makeController()
        resolve(structuredClone(fallback(msg)))
      } catch (e) { reject(e) }
    }, 0)
  })

  let stopped = false
  client.call = msg => {
    if (stopped) return Promise.reject(new Error('engine stopped'))
    if (!worker) { client.mode = 'main_thread'; return viaMain(msg) }
    const id = nextId++
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      worker.postMessage({ ...msg, id })
    }).then(r => { if (msg.type === 'init') initDone = true; return r }, err => {
      // the worker could not load: run the session on the main thread instead (only before it has a session)
      if (!worker && msg.type === 'init' && !initDone) return client.call(msg)
      throw err
    })
  }

  client.terminate = () => {
    stopped = true
    if (worker) { try { worker.terminate() } catch (_) {} worker = null }
    failAll(new Error('engine stopped'))
  }
  return client
}
