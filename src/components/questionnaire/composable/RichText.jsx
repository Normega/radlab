import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Lightweight safe rich text for researcher-authored survey copy.
 *
 * Markdown examples:
 *   **bold**
 *   *italic*
 *
 * Raw HTML is intentionally NOT enabled.
 */
export default function RichText({ text = '', className = '', inline = false }) {
  if (!text) return null

  const components = inline
    ? {
        p: ({ children }) => <span>{children}</span>,
      }
    : undefined

  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={components}
    >
      {text}
    </ReactMarkdown>
  )

  if (!className) return markdown

  return inline
    ? <span className={className}>{markdown}</span>
    : <div className={className}>{markdown}</div>
}
