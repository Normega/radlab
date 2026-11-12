// Headless checks for the BCAT threshold configuration.
// Run: node --test src/games/BcatThreshold/config.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { makeConfig, MODES, ENGINE_VERSION } from './config.js'
import { validateConfig } from './engine/adaptive.js'

const ref = f => JSON.parse(readFileSync(new URL(`./engine/reference/${f}`, import.meta.url), 'utf8'))
const ENGINE_KEYS = ['model', 'stimulus', 'design', 'stopping', 'placement', 'sdt']
const engineSections = c => Object.fromEntries(ENGINE_KEYS.map(k => [k, c[k]]))

test('online mode is the online pilot build: 30 per direction, catch trials on (reference session B)', () => {
  const c = makeConfig({ mode: 'online' })
  assert.equal(c.mode, 'online')
  assert.equal(c.engine.stopping.change_trials_per_cell, 30)
  assert.equal(c.engine.design.catch_trials.enabled, true)
  assert.deepStrictEqual(c.engine, engineSections(ref('case_B_online_30_catch.json').config))
})

test('lab mode is the approved YAML: 40 per direction, catch trials off (reference session A)', () => {
  const c = makeConfig({ mode: 'lab' })
  assert.equal(c.engine.stopping.change_trials_per_cell, 40)
  assert.equal(c.engine.design.catch_trials.enabled, false)
  assert.deepStrictEqual(c.engine, engineSections(ref('case_A_default_40.json').config))
})

test('the default is online; an unknown mode fails closed', () => {
  assert.equal(makeConfig().mode, 'online')
  assert.throws(() => makeConfig({ mode: 'belt' }), /Unknown mode/)
  assert.throws(() => makeConfig({ mode: null }), /Unknown mode/)
  assert.deepStrictEqual(Object.keys(MODES).sort(), ['lab', 'online'])
})

test('the approved model settings', () => {
  const s = makeConfig().engine.sdt
  assert.equal(s.likelihood_categories, 3)
  assert.deepStrictEqual(s.criterion_prior, { mean: 1.2, sd: 0.7 })
  assert.deepStrictEqual(s.lapse_prior, { logit_normal: { median: 0.049, logit_sd: 2.3 } })
  assert.equal(s.separate_slopes, true)
  assert.deepStrictEqual(s.miss.speeding.grid, [0.0])
  assert.deepStrictEqual(s.miss.slowing.prior_weights, [12, 1, 1, 1, 1])
  assert.equal(s.threshold_dprime, 2.0)
  assert.equal(s.credible_interval, 0.95)
  assert.deepStrictEqual(s.quality_flag, { lapse_at_least: 0.25, probability_above: 0.5 })
  const e = makeConfig().engine
  assert.equal(e.design.no_change_rate, 0.25)
  assert.equal(e.placement.reserved_every, 3)
  assert.deepStrictEqual([e.placement.sub_target_dprime, e.placement.supra_target_dprime], [0.5, 3.0])
  assert.deepStrictEqual([e.stimulus.min_pulse_s, e.stimulus.baseline_pulse_s, e.stimulus.max_pulse_s], [2.0, 4.0, 8.0])
})

test('trial counts, catch trials, demo and fixation are switchable, and every result validates', () => {
  assert.equal(makeConfig({ mode: 'lab', changeTrialsPerDirection: 24 }).engine.stopping.change_trials_per_cell, 24)
  assert.equal(makeConfig({ mode: 'online', catchTrials: false }).engine.design.catch_trials.enabled, false)
  assert.equal(makeConfig({ mode: 'lab', catchTrials: true }).engine.design.catch_trials.enabled, true)
  const demo = makeConfig({ demo: true })
  assert.equal(demo.engine.stopping.change_trials_per_cell, 3)
  assert.equal(demo.engine.design.catch_trials.n_trials, 1)
  assert.equal(makeConfig({ fixationMs: 0 }).timing.fixation_ms, 0)
  assert.equal(makeConfig().timing.fixation_ms, 1500)
  assert.equal(makeConfig({ practice: false }).practice.enabled, false)
  assert.throws(() => makeConfig({ changeTrialsPerDirection: 0 }))
  assert.throws(() => makeConfig({ changeTrialsPerDirection: 2.5 }))
  assert.throws(() => makeConfig({ fixationMs: -1 }))
  for (const o of [{}, { mode: 'lab' }, { demo: true }, { mode: 'lab', demo: true, catchTrials: true }]) validateConfig(makeConfig(o).engine)
})

test('keys: W grows, S shrinks, arrows answer', () => {
  const k = makeConfig().keys
  assert.deepStrictEqual([k.grow.key, k.grow.code, k.shrink.key, k.shrink.code], ['w', 'KeyW', 's', 'KeyS'])
  assert.deepStrictEqual(k.answers, { slowed: 'ArrowLeft', same: 'ArrowUp', sped_up: 'ArrowRight' })
})

test('every call returns an independent copy, stamped with the engine version', () => {
  const a = makeConfig(), b = makeConfig()
  a.engine.sdt.lapse_grid.push(0.99); a.keys.grow.key = 'x'
  assert.equal(b.engine.sdt.lapse_grid.length, 9)
  assert.equal(makeConfig().keys.grow.key, 'w')
  assert.match(ENGINE_VERSION, /^sdt-0\.3\.0-js1\+radlab\.\d+$/)
  assert.equal(b.engine_version, ENGINE_VERSION)
})
