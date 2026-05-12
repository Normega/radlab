import { labDescription, researchAreas } from '../../data/research'

function ResearchCard({ area }) {
  return (
    <div style={S.card}>
      {area.image && (
        <img
          src={area.image}
          alt={area.title}
          style={S.img}
          onError={e => { e.target.style.display = 'none' }}
        />
      )}
      <h3 style={S.title}>{area.title}</h3>
      <p style={S.desc}>{area.description}</p>
      {area.links?.length > 0 && (
        <div style={S.links}>
          {area.links.map(link => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="person-card__link"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ResearchPage() {
  return (
    <div className="lab-page">
      <section className="lab-section">
        <p style={{ fontSize: '1rem', lineHeight: 1.75, color: '#444', maxWidth: 700 }}>
          {labDescription}
        </p>
      </section>
      <section className="lab-section">
        <h2 className="lab-section__heading">Research Areas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {researchAreas.map(area => (
            <ResearchCard key={area.id} area={area} />
          ))}
        </div>
      </section>
    </div>
  )
}

const S = {
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  img: { width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, display: 'block' },
  title: { fontFamily: '"DM Serif Display", serif', fontSize: '1.1rem', color: '#1c1c1e', margin: 0 },
  desc: { fontSize: '0.875rem', color: '#444', lineHeight: 1.65, margin: 0 },
  links: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 4 },
}
