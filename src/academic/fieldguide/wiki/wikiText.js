// Text half of the wiki reader: frontmatter, headings, wikilinks. No React in
// this file, deliberately — these are the rules that have to agree with the
// database (see below), and keeping them free of JSX keeps them directly
// testable against real page content.
//
// The DB half — sync_wiki_links() in 20260726_wiki_links_both_syntaxes.sql —
// decides which references become rows in wiki_links; this file decides which
// become clickable. **Those two rules have to agree**, or a page shows a link
// the backlink graph doesn't know about (or vice versa). The shared rule,
// deliberately narrow:
//
//     [[slug]] [[slug|label]] [[slug#section]]      → slug
//     [label](slug.md)  [label](slug.md#section)    → slug
//
// with anything carrying a scheme (http:, mailto:) or a path separator
// skipped. If you change one side, change the other.

export const WIKI_BASE = '/academic/fieldguide/wiki'

// The ingest prompt emits a small, flat YAML block: scalars plus inline
// `[a, b, c]` lists. Parsing only that shape (rather than pulling in a YAML
// dependency) keeps the reader honest — anything more elaborate than the
// prompt asks for is left alone rather than half-parsed.
export function splitFrontmatter(raw) {
  const text = raw ?? ''
  const m = text.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { meta: {}, body: text }
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!kv) continue
    const [, key, rawVal] = kv
    const val = rawVal.trim()
    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    } else if (val) {
      meta[key] = val.replace(/^["']|["']$/g, '')
    }
  }
  return { meta, body: text.slice(m[0].length) }
}

export function slugifyHeading(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Headings for the table of contents. Fenced code blocks are skipped so a
// commented-out `# heading` inside one doesn't appear in the ToC.
//
// Ids are made unique, and each carries its 1-based source line. Both matter:
// pages built by accepting several `update` proposals repeat the six-section
// disorder skeleton once per merge — major-depressive-disorder currently
// carries it three times — so "presentation" is not a unique anchor on real
// content. The line number is how the renderer hands the *same* id to the
// *same* heading (mdast reports a position for every node), instead of both
// sides guessing with a counter that re-renders would desynchronise.
export function extractHeadings(body) {
  const out = []
  const seen = new Map()
  let inFence = false
  const lines = (body ?? '').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    // H1 counts. The renderer demotes it to an h2 (the page title is the only
    // real h1), and real pages do use it — "# Update from Fonagy (2015)" is a
    // whole section on psychodynamic-psychotherapy. Scanning only h2/h3 left
    // those sections anchored but missing from the contents.
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const text = m[2].replace(/[*_`]/g, '').trim()
    const base = slugifyHeading(text)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    out.push({ depth: Math.max(2, m[1].length), text, id: n === 1 ? base : `${base}-${n}`, line: i + 1 })
  }
  return out
}

// Note the split on '#' — `slug.md#section` is an internal target even though
// it doesn't end in `.md`. The database rule stops at the hash for the same
// reason (`\]\(([^)\s#]+\.md)`); testing the raw href instead sent every
// section link out through the external-link branch.
export const isInternalTarget = (href) => {
  const target = (href ?? '').split('#')[0]
  return !!target && target.endsWith('.md') && !target.includes(':') && !target.includes('/')
}

// [[…]] → ordinary markdown links, so one link renderer handles both syntaxes.
// The label is left equal to the slug when the author gave none; the link
// renderer treats that as "substitute the target page's real title".
export function expandWikilinks(body) {
  return (body ?? '').replace(/\[\[([^\]]+)\]\]/g, (whole, inner) => {
    const [targetPart, labelPart] = inner.split('|')
    const [slugPart, section] = targetPart.split('#')
    const slug = slugPart.trim().toLowerCase().replace(/\.md$/, '')
    if (!slug || slug.includes(':') || slug.includes('/')) return whole
    const label = (labelPart ?? slug).trim()
    return `[${label}](${slug}.md${section ? `#${slugifyHeading(section)}` : ''})`
  })
}

export const humanize = (slug) => slug.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())
