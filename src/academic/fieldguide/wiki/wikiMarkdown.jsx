import { Children, isValidElement, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  WIKI_BASE, splitFrontmatter, slugifyHeading, extractHeadings, expandWikilinks,
  isInternalTarget, humanize,
} from './wikiText'

// Rendering half of the Field Guide wiki. The link rules it honours live in
// wikiText.js, next to the note about keeping them in step with the database's
// own extraction.
//
// react-markdown is used rather than a hand-rolled renderer for one reason
// beyond correctness: it does not render raw HTML unless explicitly told to,
// and from WP6 this component renders text submitted by ~300 students.

const textOf = (node) => Children.toArray(node)
  .map(c => (typeof c === 'string' || typeof c === 'number') ? String(c)
    : isValidElement(c) ? textOf(c.props.children) : '')
  .join('')

/**
 * Renders a wiki page body.
 *
 * @param content     raw page content, frontmatter included
 * @param pages       Map slug → { title }, of pages THIS READER can see. A link
 *                    to a slug outside the map renders as unresolved — which for
 *                    a student legitimately includes pages that exist but are
 *                    still drafts. That is the honest state either way: the page
 *                    is not there to read.
 * @param lineOffset  when `content` is a slice of a larger body (a collapsible
 *                    section), the number of lines that precede it. Anchor ids
 *                    are looked up by absolute line, so a slice would otherwise
 *                    give its headings the ids belonging to the top of the page.
 *                    A non-zero offset also means "this is not a whole
 *                    document", so no frontmatter is stripped from it.
 * @param headingIds  Map absolute line → id, from extractHeadings() over the
 *                    whole body. Optional; without it the ids are derived from
 *                    `content` alone, which is right for a whole page.
 */
export function WikiMarkdown({ content, pages, lineOffset = 0, headingIds }) {
  const { body } = useMemo(
    () => (lineOffset ? { body: content ?? '' } : splitFrontmatter(content)),
    [content, lineOffset])
  const source = useMemo(() => expandWikilinks(body), [body])

  // Anchor ids, keyed by source line so the heading and the table of contents
  // agree even when the same heading text appears more than once. expandWikilinks
  // only ever substitutes within a line, so line numbers survive it.
  const idByLine = useMemo(
    () => headingIds ?? new Map(extractHeadings(body).map(h => [h.line, h.id])),
    [headingIds, body])
  const headingId = useCallback(
    (node, children) =>
      idByLine.get((node?.position?.start?.line ?? 0) + lineOffset)
        ?? slugifyHeading(textOf(children)),
    [idByLine, lineOffset])

  const components = useMemo(() => ({
    h1: ({ node, children }) => <h2 id={headingId(node, children)} style={M.h2}>{children}</h2>,
    h2: ({ node, children }) => <h2 id={headingId(node, children)} style={M.h2}>{children}</h2>,
    h3: ({ node, children }) => <h3 id={headingId(node, children)} style={M.h3}>{children}</h3>,
    h4: ({ children }) => <h4 style={M.h4}>{children}</h4>,
    p:  ({ children }) => <p style={M.p}>{children}</p>,
    ul: ({ children }) => <ul style={M.list}>{children}</ul>,
    ol: ({ children }) => <ol style={M.list}>{children}</ol>,
    li: ({ children }) => <li style={M.li}>{children}</li>,
    hr: () => <hr style={M.hr} />,
    // react-markdown no longer passes an `inline` flag, so `code` is styled
    // once and `pre` only provides the scroll box around a fenced block.
    code: ({ children }) => <code style={M.codeInline}>{children}</code>,
    pre: ({ children }) => <pre style={M.pre}>{children}</pre>,
    // Wide content scrolls inside its own box rather than the page.
    table: ({ children }) => (
      <div style={{ overflowX: 'auto', margin: '14px 0' }}>
        <table style={M.table}>{children}</table>
      </div>
    ),
    th: ({ children }) => <th style={M.th}>{children}</th>,
    td: ({ children }) => <td style={M.td}>{children}</td>,
    // The ingest prompt writes declared gaps as `> **Needs research:** …`, so
    // the one blockquote the wiki actually uses is a gap marker. Styled as a
    // callout: it is an invitation to contribute, not a defect notice.
    blockquote: ({ children }) => {
      const isGap = /^\s*needs research/i.test(textOf(children))
      return <blockquote style={isGap ? M.gapQuote : M.quote}>{children}</blockquote>
    },
    a: ({ href, children }) => {
      if (!isInternalTarget(href)) {
        return <a href={href} target="_blank" rel="noreferrer" style={M.extLink}>{children}</a>
      }
      const [rawTarget, rawSection] = href.split('#')
      const slug = rawTarget.replace(/\.md$/, '').toLowerCase()
      // Anchors are slugified ids, so the section has to be put through the
      // same function the headings were. expandWikilinks already does this for
      // the [[slug#Section]] form; the [label](slug.md#Section) form arrives raw.
      const section = rawSection && slugifyHeading(rawSection)
      const target = pages?.get(slug)
      const label = textOf(children)
      // Bare [[slug]] — show the page's real title instead of its slug.
      const shown = (label === slug && target?.title) ? target.title : children
      if (!target) {
        return (
          <span style={M.redLink} title={`No page for “${slug}” yet — or it is not published`}>
            {label === slug ? humanize(slug) : children}
          </span>
        )
      }
      return (
        <Link to={`${WIKI_BASE}/${slug}${section ? `#${section}` : ''}`} style={M.link}>
          {shown}
        </Link>
      )
    },
    // headingId carries this page's anchors — a components object memoized
    // without it would keep an earlier page's.
  }), [pages, headingId])

  return (
    <div style={M.root}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
}

const SERIF = '"DM Serif Display", Georgia, serif'
const MONO  = '"Space Mono", "Courier New", monospace'

const M = {
  root: { color: 'var(--tx)', fontSize: 16, lineHeight: 1.65, overflowWrap: 'anywhere' },
  h2: { fontFamily: SERIF, fontSize: 23, color: 'var(--tx)', margin: '30px 0 8px', scrollMarginTop: 20 },
  h3: { fontFamily: SERIF, fontSize: 18, color: 'var(--tx)', margin: '22px 0 6px', scrollMarginTop: 20 },
  h4: { fontSize: 15, fontWeight: 700, color: 'var(--tx)', margin: '18px 0 4px' },
  p:  { margin: '0 0 12px' },
  list: { margin: '0 0 12px', paddingLeft: 22 },
  li: { margin: '0 0 6px' },
  hr: { border: 'none', borderTop: '1px solid var(--bd)', margin: '24px 0' },
  link: { color: 'var(--pk)', textDecoration: 'none', borderBottom: '1px solid rgba(214,51,132,.35)' },
  extLink: { color: 'var(--pk)', textDecoration: 'underline' },
  // Unresolved links stay visible but unclickable — a wiki that hides its own
  // holes can't be used to find them, and finding them is WP6's assignment list.
  redLink: { color: 'var(--tx2)', borderBottom: '1px dotted var(--tx2)', cursor: 'help' },
  quote: { margin: '0 0 12px', padding: '8px 14px', borderLeft: '3px solid var(--bd)', color: 'var(--tx2)' },
  gapQuote: { margin: '0 0 12px', padding: '10px 14px', borderLeft: '3px solid var(--pk)', background: 'rgba(214,51,132,.06)', borderRadius: '0 8px 8px 0', color: 'var(--tx)', fontSize: 14 },
  codeInline: { fontFamily: MONO, fontSize: 14, background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 4, padding: '1px 5px' },
  pre: { margin: '0 0 12px', overflowX: 'auto' },
  table: { borderCollapse: 'collapse', fontSize: 14, minWidth: 'min(100%, 420px)' },
  th: { textAlign: 'left', padding: '7px 10px', borderBottom: '2px solid var(--bd)', fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--tx2)' },
  td: { padding: '7px 10px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top' },
}
