// Markdown renderer for display-element text blocks — participant-facing, so
// raw HTML is deliberately NOT rendered (skipHtml), matching RichText.jsx and
// wikiMarkdown.jsx. remark-breaks keeps the old textarea intuition: a single
// newline is a line break, a blank line is a new paragraph.
//
// Interpolate {{variables}} BEFORE handing text to this component — the
// renderer treats its input as finished prose.
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

const isExternal = href => /^https?:\/\//i.test(href ?? '')

const components = {
  h1: ({ children }) => <h2 style={M.h2}>{children}</h2>, // one h1 per page belongs to the app chrome
  h2: ({ children }) => <h2 style={M.h2}>{children}</h2>,
  h3: ({ children }) => <h3 style={M.h3}>{children}</h3>,
  h4: ({ children }) => <h4 style={M.h4}>{children}</h4>,
  p:  ({ children }) => <p style={M.p}>{children}</p>,
  ul: ({ children }) => <ul style={M.list}>{children}</ul>,
  ol: ({ children }) => <ol style={M.list}>{children}</ol>,
  li: ({ children }) => <li style={M.li}>{children}</li>,
  hr: () => <hr style={M.hr} />,
  strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
  blockquote: ({ children }) => <blockquote style={M.quote}>{children}</blockquote>,
  code: ({ children }) => <code style={M.code}>{children}</code>,
  table: ({ children }) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={M.table}>{children}</table>
    </div>
  ),
  th: ({ children }) => <th style={M.th}>{children}</th>,
  td: ({ children }) => <td style={M.td}>{children}</td>,
  a: ({ href, children }) => isExternal(href)
    ? <a href={href} target="_blank" rel="noreferrer" style={M.link}>{children}</a>
    : <a href={href} style={M.link}>{children}</a>,
}

export default function DisplayMarkdown({ text }) {
  if (!text) return null
  return (
    <div style={M.wrap}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        skipHtml
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

const M = {
  wrap:  { fontSize: 17, color: 'var(--tx)', lineHeight: 1.65, fontFamily: '"DM Sans",system-ui,sans-serif', display: 'flex', flexDirection: 'column', gap: 14 },
  h2:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 24, fontWeight: 400, color: 'var(--tx)', margin: '10px 0 0' },
  h3:    { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: '6px 0 0' },
  h4:    { fontSize: 16, fontWeight: 700, color: 'var(--tx)', margin: '4px 0 0' },
  p:     { margin: 0 },
  list:  { margin: 0, paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 },
  li:    { margin: 0 },
  hr:    { border: 'none', borderTop: '1px solid var(--bd)', margin: '8px 0', width: '100%' },
  quote: { margin: 0, padding: '10px 16px', borderLeft: '3px solid var(--pkb)', background: 'var(--bgp)', borderRadius: '0 8px 8px 0', color: 'var(--tx2)' },
  code:  { fontFamily: '"Space Mono",monospace', fontSize: 14, background: 'var(--bgp)', border: '1px solid var(--bd)', borderRadius: 5, padding: '1px 5px' },
  link:  { color: 'var(--pkd)', textDecorationColor: 'var(--pkb)', textUnderlineOffset: 3 },
  table: { borderCollapse: 'collapse', fontSize: 15 },
  th:    { border: '1px solid var(--bd)', padding: '6px 12px', textAlign: 'left', background: 'var(--bgp)' },
  td:    { border: '1px solid var(--bd)', padding: '6px 12px' },
}
