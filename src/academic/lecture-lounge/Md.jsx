// Just enough markdown for assessment item text: paragraphs, **bold**, and pipe
// tables (short-answer scenarios carry data tables). Built as React elements,
// never innerHTML. Shared by the console's Quizzes tab and the class test.
export default function Md({ text, style }) {
  const blocks = String(text ?? '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  const out = []
  let rows = []
  const flush = () => {
    if (!rows.length) return
    const [head, ...body] = rows
    out.push(
      <table key={`t${out.length}`} style={T.table}>
        <thead><tr>{head.map((c, i) => <th key={i} style={T.th}>{inline(c)}</th>)}</tr></thead>
        <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, i) => <td key={i} style={T.td}>{inline(c)}</td>)}</tr>)}</tbody>
      </table>,
    )
    rows = []
  }
  for (const b of blocks) {
    // A folded YAML table arrives one row per block; a literal one, one block.
    const lines = b.split('\n').map((l) => l.trim())
    if (lines.every((l) => /^\|.*\|$/.test(l))) {
      for (const l of lines) {
        if (/^\|[\s:|-]+\|$/.test(l)) continue
        rows.push(l.slice(1, -1).split('|').map((c) => c.trim()))
      }
      continue
    }
    flush()
    out.push(<p key={`p${out.length}`} style={{ margin: '0 0 8px' }}>{inline(b)}</p>)
  }
  flush()
  return <div style={style}>{out}</div>
}

function inline(s) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)
}

const T = {
  table: { borderCollapse: 'collapse', margin: '8px 0 10px', fontSize: 13.5 },
  th: { border: '1px solid var(--bd)', padding: '5px 9px', textAlign: 'left', background: 'var(--bg)' },
  td: { border: '1px solid var(--bd)', padding: '5px 9px' },
}
