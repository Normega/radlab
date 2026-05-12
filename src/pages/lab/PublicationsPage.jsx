import pubs from '../../data/publications.json'

const LAB_MEMBER_NAMES = [
  "Farb, N. A. S.", "Anderson, T.", "Eusebio, J.", "Luu, S.",
  "Wu, L. C.", "Zuo, Z.", "Wang, Y.", "Desormeau, P.",
  "Dinh-Williams, L.", "Walsh, K. M.", "Petranker, R.",
]

function renderApa(apa) {
  const nameEscaped = LAB_MEMBER_NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(
    `(${nameEscaped.join('|')})|(https?://\\S+)`,
    'g'
  )
  const parts = []
  let last = 0
  let match
  let i = 0
  while ((match = pattern.exec(apa)) !== null) {
    if (match.index > last) parts.push(apa.slice(last, match.index))
    if (match[1]) {
      parts.push(<strong key={i++}>{match[1]}</strong>)
    } else {
      const url = match[2].replace(/[.)]+$/, '')
      const trail = match[2].slice(url.length)
      parts.push(<a key={i++} href={url} target="_blank" rel="noreferrer" style={{ color: '#f068a4', textDecoration: 'none' }}>{url}</a>)
      if (trail) parts.push(trail)
    }
    last = match.index + match[0].length
  }
  if (last < apa.length) parts.push(apa.slice(last))
  return parts
}

function groupByYear(publications) {
  const map = {}
  publications.forEach(pub => {
    if (!map[pub.year]) map[pub.year] = []
    map[pub.year].push(pub)
  })
  return Object.entries(map)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, items]) => ({ year: Number(year), items }))
}

export default function PublicationsPage() {
  const groups = groupByYear(pubs)
  return (
    <div className="lab-page">
      {groups.map(({ year, items }) => (
        <section key={year} className="lab-section">
          <h2 className="lab-section__heading">{year}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {items.map(pub => (
              <div key={pub.id} style={S.entry}>
                <p style={S.apa}>{renderApa(pub.apa)}</p>
                {pub.annotation && <p style={S.annotation}>{pub.annotation}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const S = {
  entry: { paddingBottom: '1.25rem', borderBottom: '1px solid rgba(180,100,140,0.1)' },
  apa: { fontSize: '0.875rem', lineHeight: 1.7, color: '#1c1c1e', margin: 0 },
  annotation: { fontSize: '0.8125rem', color: '#6b6c70', lineHeight: 1.6, margin: '0.5rem 0 0', fontStyle: 'italic' },
}
