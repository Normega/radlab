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

// WIKI_BASE moved: the wiki is course-scoped (/academic/:courseCode/wiki), so
// the base is per-course — components get it from useWikiBase() and the
// legacy constant path lives on only as a redirect shim in App.jsx. Do not
// re-add a constant here; a hardcoded base is how course A's links end up on
// course B's pages.

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

// Splits a body into its `##` sections so the reader can collapse them.
//
// Ids come from extractHeadings() rather than being re-slugified here, because
// that function de-duplicates repeated headings (`presentation`,
// `presentation-2`) and the collapsible heading has to carry the *same* id the
// table of contents links to. Pass the headings you already computed.
//
// Two things each section carries beyond its markdown:
//
//   startLine  1-based line of its first content line in the *whole* body.
//              wikiMarkdown takes this as `lineOffset` so anchors inside a
//              slice still resolve against ids numbered against the whole page.
//   anchorIds  every heading id inside the section, its own included. A link to
//              a `###` anchor has to be able to open the `##` that contains it,
//              or a table-of-contents click on a collapsed section goes nowhere.
//
// The first entry is the preamble — the H1 and anything before the first `##`.
// It has a null id and is never collapsible: a page whose title folds away
// reads as broken. It is omitted entirely when empty.
export function splitSections(body, headings) {
  const all = headings ?? extractHeadings(body)
  const idByLine = new Map(all.map(h => [h.line, h.id]))
  const lines = (body ?? '').replace(/\r/g, '').split('\n')
  const out = []
  let cur = { id: null, title: null, startLine: 1, lines: [] }
  let inFence = false

  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    if (!inFence && /^##[ \t]+\S/.test(line)) {
      out.push(cur)
      cur = {
        id: idByLine.get(i + 1) ?? slugifyHeading(line.replace(/^##[ \t]+/, '')),
        title: line.replace(/^##[ \t]+/, '').replace(/\s*#*\s*$/, '').replace(/[*_`]/g, '').trim(),
        startLine: i + 2,
        lines: [],
      }
      return
    }
    cur.lines.push(line)
  })
  out.push(cur)

  return out
    .map(s => {
      const end = s.startLine + s.lines.length - 1
      // Leading blank lines are dropped, and startLine moves with them: the
      // offset has to describe the markdown actually handed to the renderer, or
      // every anchor inside the section is looked up one line short.
      let lead = 0
      while (lead < s.lines.length && s.lines[lead].trim() === '') lead++
      return {
        id: s.id,
        title: s.title,
        startLine: s.startLine + lead,
        markdown: s.lines.slice(lead).join('\n').replace(/\s+$/, ''),
        anchorIds: [s.id, ...all.filter(h => h.line >= s.startLine && h.line <= end).map(h => h.id)]
          .filter(Boolean),
      }
    })
    .filter(s => s.id !== null || s.markdown !== '')
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
