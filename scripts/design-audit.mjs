#!/usr/bin/env node
/*
 * design-audit — measures drift from the design system documented at /brand.
 *
 *   npm run audit:design           report with per-file offender lists
 *   npm run audit:design:check     compare against design-audit/baseline.json;
 *                                  exit 1 if any ratcheted count INCREASED
 *   npm run audit:design:update    rewrite the baseline at current counts
 *
 * The ratchet, not a wall: existing debt never blocks anyone; new debt does.
 * After a migration lands, run :update so the lower counts lock in.
 *
 * Scopes: "site" is ratcheted; "sanctioned" is reported for information only —
 * game-internal artwork was ruled a sanctioned exception in
 * design-audit/DRIFT-REPORT-2026-08-12.md, and avatar colour palettes and
 * talk-deck graphics are the same kind of thing: their colours are content.
 * Token definitions (`--x: value` lines) and the /brand swatch data are
 * excluded from hex counting because defining a token is not drift.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const BASELINE_PATH = join(ROOT, 'design-audit', 'baseline.json')

const TYPE_SCALE = new Set([12, 14, 16, 20, 28, 36])
const HERO_PX = 72 // Display/Hero — the one sanctioned off-scale style
const RADII = new Set([0, 12, 24]) // plus 50%, which the px regexes never match
const SPACE_SCALE = new Set([0, 4, 8, 16, 24, 32, 40, 48, 64])
// The eleven primitives plus legacy #A8A9AD (pre-merge --tx3, still a token value in old code)
const TOKEN_HEXES = new Set([
  '#FCF0F5', '#FBEAF3', '#F068A4', '#C04A82', '#FFFFFF', '#ABADB0', '#6B6C70',
  '#1C1C1E', '#FCEBEB', '#F09595', '#A32D2D', '#A8A9AD',
])
// Files whose hex literals are the point, not drift
const HEX_EXEMPT = new Set(['pages/BrandAssets.jsx'])
// Content, not UI: game artwork (2026-08-12 ruling), avatar colour palettes,
// one-off talk-deck graphics. Reported but never ratcheted.
const SANCTIONED_DIRS = ['games/', 'components/Avatar/', 'pages/toni-july-2026/', 'pages/keynote/', 'pages/adobe-aug-2026/']

const files = []
;(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p)
    else if (/\.(jsx|js|css)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(p)
  }
})(SRC)

function newCounts() {
  return {
    'font-size: off-scale 13px': 0,
    'font-size: below 12px floor': 0,
    'font-size: other off-scale': 0,
    'font-size: on scale': 0,
    'radius: off-system': 0,
    'hex: token value hard-coded': 0,
    'hex: off-palette': 0,
    'spacing: off-scale px': 0,
  }
}
const scopes = { site: newCounts(), sanctioned: newCounts() }
const offenders = {} // category -> Map(file -> count), site scope only

function hit(scope, rel, category, n = 1) {
  scopes[scope][category] += n
  if (scope === 'site') {
    ;(offenders[category] ??= new Map()).set(rel, (offenders[category].get(rel) ?? 0) + n)
  }
}

const FONT_RE = /(?:font-size\s*:\s*|fontSize\s*[:=]\s*[{'"]?\s*)(\d+(?:\.\d+)?)(px|rem)?/g
const RADIUS_RE = /(?:border-radius\s*:\s*|borderRadius\s*[:=]\s*[{'"]?\s*)(\d+(?:\.\d+)?)(px)?/g
const HEX_RE = /#[0-9a-fA-F]{6}\b/g
const SPACE_RE = /(?:\b(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block))?\s*:|\b(?:padding|margin|gap|rowGap|columnGap|marginTop|marginRight|marginBottom|marginLeft|paddingTop|paddingRight|paddingBottom|paddingLeft|marginInline|paddingInline|marginBlock|paddingBlock)\s*[:=])([^;\n}]*)/g

for (const file of files) {
  const rel = relative(SRC, file).replaceAll('\\', '/')
  const scope = SANCTIONED_DIRS.some((d) => rel.startsWith(d)) ? 'sanctioned' : 'site'
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')

  for (const line of lines) {
    const isTokenDef = /^\s*--[\w-]+\s*:/.test(line)

    // SVG <text> sizes are viewBox coordinates, not CSS px — scaled with the drawing
    const svgText = /<text\b/.test(line)
    for (const m of line.matchAll(FONT_RE)) {
      if (svgText) continue
      // bare numbers in JSX styles are px; CSS needs the unit — require it there
      if (!m[2] && /font-size/.test(m[0])) continue
      const px = m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1])
      if (px === HERO_PX) continue // sanctioned Display/Hero
      if (TYPE_SCALE.has(px)) hit(scope, rel, 'font-size: on scale')
      else if (px === 13) hit(scope, rel, 'font-size: off-scale 13px')
      else if (px < 12) hit(scope, rel, 'font-size: below 12px floor')
      else hit(scope, rel, 'font-size: other off-scale')
    }

    for (const m of line.matchAll(RADIUS_RE)) {
      const px = parseFloat(m[1])
      if (!m[2] && /border-radius/.test(m[0])) continue
      if (px >= 999) continue // pill shorthand — reads as fully-rounded, same family as 50%
      if (!RADII.has(px)) hit(scope, rel, 'radius: off-system')
    }

    if (!isTokenDef && !HEX_EXEMPT.has(rel)) {
      for (const m of line.matchAll(HEX_RE)) {
        const hex = m[0].toUpperCase()
        if (TOKEN_HEXES.has(hex)) hit(scope, rel, 'hex: token value hard-coded')
        else hit(scope, rel, 'hex: off-palette')
      }
    }

    for (const m of line.matchAll(SPACE_RE)) {
      // In a JS object literal the value ends at the next `key:`, not at a
      // semicolon — without this the capture swallows neighbouring properties
      // and counts their pixels as spacing (`padding: 24, flex: '1 1 480px'`
      // was reporting a 480px pad; `margin: '…', borderTop: '1px solid …'` a 1px one).
      const cut = m[1].search(/[,{]\s*[\w-]+\s*:/)
      const value = cut >= 0 ? m[1].slice(0, cut) : m[1]
      for (const v of value.matchAll(/(\d+(?:\.\d+)?)px/g)) {
        const px = parseFloat(v[1])
        if (!SPACE_SCALE.has(px)) hit(scope, rel, 'spacing: off-scale px')
      }
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────
const RATCHETED = Object.keys(newCounts()).filter((c) => c !== 'font-size: on scale')
// --warn checks and reports but always exits 0. This is what runs in the build
// (npm prebuild), so a drift regression is loud on every deploy without a stale
// baseline ever being able to block one. See the flip date in the plan.
const warnOnly = process.argv.includes('--warn')
const mode = (process.argv.includes('--check') || warnOnly) ? 'check'
  : process.argv.includes('--update') ? 'update' : 'report'

const pad = (s, n) => String(s).padEnd(n)
console.log(`design-audit · ${files.length} files scanned\n`)
console.log(pad('category', 34) + pad('site', 8) + 'sanctioned (info only)')
console.log('─'.repeat(64))
for (const cat of Object.keys(newCounts())) {
  console.log(pad(cat, 34) + pad(scopes.site[cat], 8) + scopes.sanctioned[cat])
}
const onScale = scopes.site['font-size: on scale']
const totalFs = onScale + scopes.site['font-size: off-scale 13px']
  + scopes.site['font-size: below 12px floor'] + scopes.site['font-size: other off-scale']
console.log(`\ntype-scale compliance (site): ${onScale}/${totalFs} = ${Math.round((onScale / totalFs) * 100)}%`)

if (mode === 'report') {
  for (const cat of RATCHETED) {
    const top = [...(offenders[cat] ?? [])].sort((a, b) => b[1] - a[1]).slice(0, 5)
    if (!top.length) continue
    console.log(`\nworst offenders — ${cat}`)
    for (const [f, n] of top) console.log(`  ${pad(n, 5)} src/${f}`)
  }
}

if (mode === 'update') {
  const baseline = {
    date: new Date().toISOString().slice(0, 10),
    note: 'Ratchet baseline for npm run audit:design:check — counts may go down, never up. Site scope only (src/ minus the sanctioned content dirs listed in scripts/design-audit.mjs).',
    counts: Object.fromEntries(RATCHETED.map((c) => [c, scopes.site[c]])),
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
  console.log(`\nbaseline written: ${relative(ROOT, BASELINE_PATH)}`)
}

if (mode === 'check') {
  if (!existsSync(BASELINE_PATH)) {
    console.error('\nno baseline — run npm run audit:design:update first')
    process.exit(warnOnly ? 0 : 1)
  }
  // strip a UTF-8 BOM — Windows editors and PowerShell redirects add one
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8').replace(/^﻿/, ''))
  let failed = false
  console.log(`\nratchet check vs baseline of ${baseline.date}`)
  for (const cat of RATCHETED) {
    const was = baseline.counts[cat] ?? 0
    const now = scopes.site[cat]
    const delta = now - was
    const flag = delta > 0 ? 'FAIL' : delta < 0 ? 'improved' : 'ok'
    if (delta > 0) failed = true
    console.log(`  ${pad(cat, 34)} ${pad(was, 6)}→ ${pad(now, 6)} ${flag}`)
    if (delta < 0) console.log(`    ↳ run npm run audit:design:update to lock this in`)
  }
  if (failed) {
    console.error('\nNew design drift introduced — fix it or (for a sanctioned exception) update the baseline deliberately.')
    if (warnOnly) {
      console.error('(warn-only: the build continues. Run npm run audit:design to see the offending files.)')
    }
    process.exit(warnOnly ? 0 : 1)
  }
  console.log('\nratchet holds.')
}
