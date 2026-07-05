// v1 — dependency checking for display elements inside a session sequence.
// A display's {{variables}} and showIf slots are only useful if something
// produces them: earlier steps in the same session (slider/vas/game outputs)
// or the study's condition slots (randomizer). Pure functions — callers fetch
// display blocks and package contents, this module just reasons about order.
import { GAME_OUTPUTS } from './elementOutputs'

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g

/**
 * Parse a display's blocks into dependencies.
 * Returns { stepDeps: [{ type:'slider'|'vas'|'game', slug, key?, token }],
 *           slotDeps: [slotName] }
 * Bare tokens ({{condition}}) and showIf slots are slot dependencies.
 */
export function extractDeps(blocks) {
  const stepDeps = new Map() // token -> dep
  const slotDeps = new Set()
  for (const b of blocks ?? []) {
    for (const m of (b.text ?? '').matchAll(TOKEN_RE)) {
      const token = m[1]
      const parts = token.split('.')
      if (parts[0] === 'slider' || parts[0] === 'vas') {
        if (parts[1]) stepDeps.set(token, { type: parts[0], slug: parts[1], token })
      } else if (parts[0] === 'game') {
        if (parts[1]) stepDeps.set(token, { type: 'game', slug: parts[1], key: parts[2], token })
      } else {
        slotDeps.add(parts[0])
      }
    }
    if (b.showIf?.slot) slotDeps.add(b.showIf.slot)
  }
  return { stepDeps: [...stepDeps.values()], slotDeps: [...slotDeps] }
}

/**
 * What a sequence item produces for the session context.
 * Returns { type:'slider'|'vas'|'game'|'pkg', slug } or null.
 * 'pkg' producers are expanded by the caller via pkgContents.
 */
export function itemProduces(category, subcategory) {
  if (!subcategory) return null
  if (category === 'game') return { type: 'game', slug: subcategory }
  if (category === 'vas') {
    if (subcategory.startsWith('slider_'))  return { type: 'slider', slug: subcategory.slice(7) }
    if (subcategory.startsWith('vas_pkg_')) return { type: 'pkg',    slug: subcategory.slice(8) }
    if (subcategory.startsWith('vas_'))     return { type: 'vas',    slug: subcategory.slice(4) }
  }
  return null
}

function providerSatisfies(prod, dep, pkgContents) {
  if (!prod) return false
  if (prod.type === 'pkg') {
    return (pkgContents[prod.slug] ?? []).some(c => c.type === dep.type && c.slug === dep.slug)
  }
  return prod.type === dep.type && prod.slug === dep.slug
}

/**
 * Check every display in an ordered sequence.
 *
 * items:         [{ category, subcategory, label }] in session order
 * displayBlocks: { [displaySlug]: blocks }   (fetched by caller)
 * pkgContents:   { [pkgSlug]: [{ type:'slider'|'vas', slug }] }
 *
 * Returns an array aligned with items: null for non-displays (or displays
 * whose blocks aren't loaded yet), else
 *   { unmet: [{ token, reason: 'missing'|'after'|'badkey', producerLabel? }],
 *     slots: [slotName] }
 */
export function checkSequence(items, displayBlocks = {}, pkgContents = {}) {
  return items.map((item, idx) => {
    if (item.category !== 'display') return null
    const blocks = displayBlocks[item.subcategory]
    if (!blocks) return null
    const { stepDeps, slotDeps } = extractDeps(blocks)
    const unmet = []

    for (const dep of stepDeps) {
      let earlier = null, later = null
      items.forEach((cand, ci) => {
        if (ci === idx) return
        const prod = itemProduces(cand.category, cand.subcategory)
        if (!providerSatisfies(prod, dep, pkgContents)) return
        if (ci < idx) { if (earlier === null) earlier = ci }
        else          { if (later   === null) later   = ci }
      })

      // Game key typo check applies wherever the producer sits.
      const badKey = dep.type === 'game'
        && dep.key
        && (GAME_OUTPUTS[dep.slug]?.length ?? 0) > 0
        && !GAME_OUTPUTS[dep.slug].includes(dep.key)

      if (earlier !== null && badKey) {
        unmet.push({ token: dep.token, reason: 'badkey' })
      } else if (earlier === null && later !== null) {
        unmet.push({ token: dep.token, reason: 'after', producerLabel: items[later].label })
      } else if (earlier === null) {
        unmet.push({ token: dep.token, reason: 'missing' })
      }
    }

    return { unmet, slots: slotDeps }
  })
}

/** Human-readable message for one unmet dependency. */
export function unmetMessage(u) {
  if (u.reason === 'after')  return `{{${u.token}}} — "${u.producerLabel}" runs after this display`
  if (u.reason === 'badkey') return `{{${u.token}}} — the game has no output with that name`
  return `{{${u.token}}} — nothing in this session produces it`
}
