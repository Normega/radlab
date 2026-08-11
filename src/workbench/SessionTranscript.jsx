import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Renders a session's turns. Shared by the member view and the admin console so
// that what Norm previews before sharing is byte-for-byte what the student reads
// — a preview that renders differently is worse than no preview.
//
// The turn stream from the hook is deliberately granular: one row per assistant
// *message*, because that is the only unit the transcript file appends without
// ever rewriting, which is what makes live updates and re-push safety work (see
// the long comment in scripts/claude-session-push.mjs). Reading 150 separate
// one-tool blocks would be miserable, so the grouping happens here — runs of
// consecutive assistant turns collapse into one block, prose and tool headlines
// interleaved in their original order.
//
// There is no tool output to render. The pipeline never collects it.

function groupTurns(turns) {
  const blocks = []
  for (const turn of turns) {
    const last = blocks[blocks.length - 1]
    if (turn.role === 'assistant' && last?.role === 'assistant') {
      last.items.push(turn)
      last.endAt = turn.at
    } else {
      blocks.push({
        role: turn.role,
        items: [turn],
        startAt: turn.at,
        endAt: turn.at,
        key: `${turn.role}-${turn.seq}`,
      })
    }
  }
  return blocks
}

function timeOf(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function dayOf(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function ToolRow({ tool }) {
  return (
    <div style={S.toolRow}>
      <span style={S.toolGear} aria-hidden="true">⚙</span>
      <span style={S.toolName}>{tool.name}</span>
      {tool.headline ? <span style={S.toolHeadline}>{tool.headline}</span> : null}
    </div>
  )
}

export default function SessionTranscript({ turns, authorName = 'Norm', emptyNote }) {
  const blocks = useMemo(() => groupTurns(turns ?? []), [turns])

  if (!turns?.length) {
    return <p style={S.empty}>{emptyNote ?? 'Nothing has been pushed for this session yet.'}</p>
  }

  let lastDay = null

  return (
    <div style={S.wrap}>
      {blocks.map((block) => {
        const day = dayOf(block.startAt)
        const showDay = day && day !== lastDay
        lastDay = day || lastDay

        return (
          <div key={block.key}>
            {showDay ? <div style={S.dayRule}><span style={S.dayLabel}>{day}</span></div> : null}

            <article style={block.role === 'user' ? S.userBlock : S.assistantBlock}>
              <header style={S.blockHead}>
                <span style={block.role === 'user' ? S.whoUser : S.whoAssistant}>
                  {block.role === 'user' ? authorName : 'Claude'}
                </span>
                <span style={S.stamp}>{timeOf(block.startAt)}</span>
              </header>

              {block.items.map((turn) => (
                <div key={turn.seq} style={S.item}>
                  {turn.body ? (
                    <div style={S.prose}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.body}</ReactMarkdown>
                    </div>
                  ) : null}
                  {turn.tools?.length ? (
                    <div style={S.toolGroup}>
                      {turn.tools.map((tool, i) => <ToolRow key={i} tool={tool} />)}
                    </div>
                  ) : null}
                </div>
              ))}
            </article>
          </div>
        )
      })}
    </div>
  )
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 14 },

  empty: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body-sm)',
    color: 'var(--tx2)',
    padding: '18px 0',
  },

  dayRule: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '18px 0 4px',
  },
  dayLabel: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--gy)',
    background: 'var(--bg)',
    paddingRight: 10,
  },

  userBlock: {
    background: 'var(--bgp)',
    border: '1px solid var(--pkb)',
    borderRadius: 12,
    padding: '14px 18px',
  },
  assistantBlock: {
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: '14px 18px',
  },

  blockHead: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 8,
  },
  whoUser: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    fontWeight: 700,
    color: 'var(--pkd)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  whoAssistant: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    fontWeight: 700,
    color: 'var(--tx2)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  stamp: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    color: 'var(--gy)',
  },

  item: { marginBottom: 2 },

  prose: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 'var(--fs-body)',
    lineHeight: 1.6,
    color: 'var(--tx)',
    overflowWrap: 'anywhere',
  },

  toolGroup: {
    margin: '8px 0 4px',
    borderLeft: '2px solid var(--pkb)',
    paddingLeft: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  toolRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  toolGear: { color: 'var(--pk)', fontSize: 'var(--fs-mono-sm)' },
  toolName: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    fontWeight: 700,
    color: 'var(--tx2)',
  },
  toolHeadline: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 'var(--fs-mono-sm)',
    color: 'var(--gy)',
    overflowWrap: 'anywhere',
  },
}
