// Pure helpers behind the neighbourhood graph (WikiPage) and "My reading"
// (ChapterMap). No React, no Supabase — readingGraph.test.mjs runs them bare.

// Provenance records, not readings — the same exclusion the wiki index and
// the chapter map make. A source record in the graph would read as a page to
// study next.
export const isSourcePage = (p) => p?.type === 'study' ||
  String(p?.slug ?? '').startsWith('fundamentals-psychological-disorders-module')

// How strongly a neighbour is tied to the page being read. A two-way link is
// the strongest claim two pages make about each other; a frontmatter "related"
// entry is an author's deliberate pointer, so it outranks a bare backlink,
// which may be one passing mention on a long page. Sharing a lecture is the
// tie a student is most likely to be studying along.
const KIND_SCORE = { both: 4, out: 3, related: 2.5, in: 2 }
const SAME_LECTURE_BONUS = 1.5

// Everything one hop from `selfId`, ranked. Each argument is what WikiPage
// already has in hand:
//   pagesBySlug  Map slug -> {id, slug, title, type, status} (reader-visible)
//   outIds       resolved target_page_id of this page's own links
//   inIds        source page ids of pages linking here
//   relatedSlugs frontmatter related_* slugs
//   lecturesOf   Map page_id -> Set(lecture_no)
//   visits       Map page_id -> count (empty when not tracked)
// A neighbour the reader cannot see is left out rather than drawn as a dead
// node: the link list below the graph already reports those to staff.
export function rankNeighbours({ selfId, pagesBySlug, outIds = [], inIds = [], relatedSlugs = [], lecturesOf = new Map(), visits = new Map() }) {
  const byId = new Map()
  for (const p of pagesBySlug.values()) if (p.id) byId.set(p.id, p)

  const out = new Set(outIds)
  const inn = new Set(inIds)
  const rel = new Set(relatedSlugs.map(s => pagesBySlug.get(s)?.id).filter(Boolean))
  const mine = lecturesOf.get(selfId) ?? new Set()

  const result = []
  for (const id of new Set([...out, ...inn, ...rel])) {
    if (id === selfId) continue
    const p = byId.get(id)
    if (!p || isSourcePage(p)) continue
    const kind = out.has(id) && inn.has(id) ? 'both'
      : out.has(id) ? 'out'
      : inn.has(id) ? 'in'
      : 'related'
    const theirs = lecturesOf.get(id)
    const sameLecture = !!theirs && [...theirs].some(l => mine.has(l))
    result.push({
      id, slug: p.slug, title: p.title, type: p.type, status: p.status,
      kind, sameLecture,
      // a related entry that is ALSO a link keeps its link kind for the arrow,
      // but the author's pointer still counts toward the rank
      score: KIND_SCORE[kind] + (kind !== 'related' && rel.has(id) ? 1 : 0) + (sameLecture ? SAME_LECTURE_BONUS : 0),
      visits: visits.get(id) ?? 0,
    })
  }
  return result.sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)))
}

// Three bands, not a continuous scale: "have I opened this at all?" is the
// question that matters, and "often" only needs to be distinguishable from
// "once". A colour ramp of raw counts would make one heavily re-read page wash
// every other page out to the same pale tint.
export function visitBand(n) {
  if (!n) return 'none'
  return n >= 3 ? 'often' : 'some'
}

// Split a title into at most `maxLines` lines of roughly `maxChars` for an SVG
// label, which cannot wrap on its own. Breaks at spaces and after slashes or
// hyphens; a word longer than the line is cut, and an overflowing last line
// ends in an ellipsis so a truncated title never reads as the whole title.
export function wrapLabel(text, maxChars, maxLines = 2) {
  const words = String(text ?? '').split(/(?<=[\s/-])/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + w).trimEnd().length <= maxChars) { cur += w; continue }
    if (cur) lines.push(cur.trimEnd())
    cur = w.trimStart()
    while (cur.length > maxChars) { lines.push(cur.slice(0, maxChars)); cur = cur.slice(maxChars) }
  }
  if (cur.trim()) lines.push(cur.trimEnd())
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  const last = kept[maxLines - 1]
  kept[maxLines - 1] = (last.length >= maxChars ? last.slice(0, maxChars - 1) : last).trimEnd() + '…'
  return kept
}
