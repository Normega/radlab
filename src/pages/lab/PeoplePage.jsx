import { useState } from 'react'
import { pi, gradStudents, alumni } from '../../data/people'

function PersonCard({ person, featured }) {
  return (
    <div className={`person-card${featured ? ' person-card--featured' : ''}`}>
      <div className="person-card__photo-wrap">
        <img
          src={person.photo}
          alt={person.name}
          className={`person-card__photo${featured ? ' person-card__photo--featured' : ''}`}
          onError={e => { e.target.style.visibility = 'hidden' }}
        />
      </div>
      <div className="person-card__body">
        <p className="person-card__role">{person.role}</p>
        <h3 className="person-card__name">
          {person.name}{person.credentials ? `, ${person.credentials}` : ''}
        </h3>
        <p className="person-card__bio">{person.bio}</p>
        {person.links?.length > 0 && (
          <div className="person-card__links">
            {person.links.map(link => (
              <a
                key={link.url}
                className="person-card__link"
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PeoplePage() {
  const [alumniOpen, setAlumniOpen] = useState(false)

  return (
    <div className="lab-page">

      <section className="lab-section">
        <h2 className="lab-section__heading">Principal Investigator</h2>
        <PersonCard person={pi} featured />
      </section>

      <section className="lab-section">
        <h2 className="lab-section__heading">Current Members</h2>
        <div className="person-grid">
          {gradStudents.map(p => (
            <PersonCard key={p.name} person={p} />
          ))}
        </div>
      </section>

      <section className="lab-section">
        <button
          className="alumni-toggle"
          onClick={() => setAlumniOpen(o => !o)}
          aria-expanded={alumniOpen}
        >
          {alumniOpen ? 'Hide alumni ▴' : 'Show alumni ▾'}
        </button>
        {alumniOpen && (
          <>
            <h2 className="lab-section__heading">Alumni &amp; Affiliated Researchers</h2>
            <div className="person-grid">
              {alumni.map(p => (
                <PersonCard key={p.name} person={p} />
              ))}
            </div>
          </>
        )}
      </section>

    </div>
  )
}
