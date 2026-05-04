// PeoplePage.jsx
// Reads from people.js — edit that file to update lab members.
// Alumni section is collapsed by default on mobile, expanded on desktop.

import { useState } from 'react';
import { pi, gradStudents, alumni } from '../data/people';

// ─── Sub-components ────────────────────────────────────────────────────────

function PersonCard({ person, featured = false }) {
  const hasLinks = Object.keys(person.links).length > 0;

  return (
    <div className={`person-card ${featured ? 'person-card--featured' : ''}`}>
      <div className="person-card__photo-wrap">
        <img
          src={person.photo}
          alt={person.name}
          className="person-card__photo"
          onError={e => { e.target.style.background = '#f9d0e5'; e.target.src = ''; }}
        />
      </div>
      <div className="person-card__body">
        <p className="person-card__role">{person.role}</p>
        <h3 className="person-card__name">
          {hasLinks && person.links.website
            ? <a href={person.links.website} target="_blank" rel="noreferrer">{person.name}{person.credentials ? `, ${person.credentials}` : ''}</a>
            : <>{person.name}{person.credentials ? `, ${person.credentials}` : ''}</>
          }
        </h3>
        {hasLinks && person.links.scholar && (
          <a className="person-card__link" href={person.links.scholar} target="_blank" rel="noreferrer">
            Google Scholar →
          </a>
        )}
        <p className="person-card__bio">{person.bio}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function PeoplePage() {
  const [alumniOpen, setAlumniOpen] = useState(false);

  return (
    <div className="lab-page">

      {/* PI */}
      <section className="lab-section">
        <h2 className="lab-section__heading">Principal Investigator</h2>
        <PersonCard person={pi} featured />
      </section>

      {/* Grad students */}
      <section className="lab-section">
        <h2 className="lab-section__heading">Graduate Students</h2>
        <div className="person-grid">
          {gradStudents.map(p => (
            <PersonCard key={p.id} person={p} />
          ))}
        </div>
      </section>

      {/* Alumni — collapsible */}
      <section className="lab-section">
        <button
          className="alumni-toggle"
          onClick={() => setAlumniOpen(o => !o)}
          aria-expanded={alumniOpen}
        >
          <h2 className="lab-section__heading" style={{ display: 'inline' }}>
            Alumni &amp; Affiliated Researchers
          </h2>
          <span className="alumni-toggle__icon">{alumniOpen ? '−' : '+'}</span>
        </button>

        {alumniOpen && (
          <div className="person-grid person-grid--alumni">
            {alumni.map(p => (
              <PersonCard key={p.id} person={p} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

/*
─── CSS to add to your stylesheet ─────────────────────────────────────────────

.lab-page {
  max-width: 900px;
  padding: 64px 52px 100px;
}

.lab-section {
  margin-bottom: 64px;
}

.lab-section__heading {
  font-family: var(--serif);
  font-size: 1.5rem;
  color: var(--dark);
  margin-bottom: 32px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--pink-light);
}

.person-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 32px;
}

.person-card {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.person-card--featured {
  flex-direction: row;
  gap: 28px;
}

.person-card__photo-wrap {
  flex-shrink: 0;
}

.person-card__photo {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--pink-pale);
  display: block;
}

.person-card--featured .person-card__photo {
  width: 120px;
  height: 120px;
}

.person-card__role {
  font-family: var(--mono);
  font-size: var(--fs-mono-sm);   /* 12px */
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--pink);
  margin-bottom: 4px;
}

.person-card__name {
  font-family: var(--serif);
  font-size: 1.2rem;
  color: var(--dark);
  margin-bottom: 6px;
}

.person-card__name a {
  color: var(--dark);
  text-decoration: none;
  border-bottom: 1.5px solid var(--pink-light);
  transition: border-color 0.2s;
}

.person-card__name a:hover {
  border-color: var(--pink);
}

.person-card__link {
  display: inline-block;
  font-family: var(--mono);
  font-size: var(--fs-mono-sm);   /* 12px */
  color: var(--pink);
  text-decoration: none;
  margin-bottom: 10px;
  letter-spacing: 0.06em;
}

.person-card__bio {
  font-size: var(--fs-body-sm);   /* 14px */
  line-height: 1.7;
  color: var(--gray);
  font-weight: 300;
}

.alumni-toggle {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  margin-bottom: 32px;
  width: 100%;
  text-align: left;
}

.alumni-toggle__icon {
  font-family: var(--mono);
  font-size: 1.2rem;
  color: var(--pink);
  flex-shrink: 0;
}

.person-grid--alumni .person-card__photo {
  width: 64px;
  height: 64px;
}

*/
