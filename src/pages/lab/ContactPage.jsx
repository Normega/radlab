// ContactPage.jsx
// What the lab looks for, the "Pitch Us Something" form, and the address.
// Copy lives here directly; the form posts to api/pitch.js, which stores the
// pitch in lab_pitches and emails research@radlab.zone.

import { useState } from 'react'
import { useSubmitLock } from '../../lib/useSubmitLock'

const ROLE_OPTIONS = [
  ['undergrad', 'Undergraduate'],
  ['grad', 'Graduate student'],
  ['postdoc', 'Postdoc'],
  ['other', 'Other'],
]

const EMPTY = { name: '', email: '', role: '', build_what: '', values_fit: '', portfolio_url: '', website: '' }

function PitchForm() {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const { submit, busy } = useSubmitLock()

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = (e) => {
    e.preventDefault()
    setError(null)
    submit(async () => {
      let data = {}
      let ok = false
      try {
        const rsp = await fetch('/api/pitch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        ok = rsp.ok
        data = await rsp.json().catch(() => ({}))
      } catch {
        data = { error: 'Could not reach the server. Check your connection and try again.' }
      }
      if (!ok) {
        // Throwing releases the lock so the person can correct and resend.
        throw new Error(data.error || 'Something went wrong. Please try again, or email research@radlab.zone.')
      }
      setSent(true)
    }).catch((err) => setError(err.message))
  }

  if (sent) {
    return (
      <div className="contact-block" role="status">
        <h3 className="contact-block__title">Thank you</h3>
        <p className="contact-block__body">
          Your pitch has reached the lab. We read every one, and we will reply by email if it is a fit.
        </p>
      </div>
    )
  }

  return (
    <form className="contact-block contact-form" onSubmit={onSubmit}>
      <div className="contact-form__row">
        <label className="contact-form__field">
          <span className="contact-form__label">Name</span>
          <input className="contact-form__input" type="text" required maxLength={120}
            autoComplete="name" value={form.name} onChange={set('name')} />
        </label>
        <label className="contact-form__field">
          <span className="contact-form__label">Email</span>
          <input className="contact-form__input" type="email" required maxLength={254}
            autoComplete="email" value={form.email} onChange={set('email')} />
        </label>
      </div>

      <label className="contact-form__field">
        <span className="contact-form__label">Role</span>
        <select className="contact-form__input" required value={form.role} onChange={set('role')}>
          <option value="" disabled>Choose one</option>
          {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <label className="contact-form__field">
        <span className="contact-form__label">What do you want to build, and for whom?</span>
        <textarea className="contact-form__input contact-form__textarea" required minLength={20} maxLength={3000}
          rows={5} value={form.build_what} onChange={set('build_what')} />
      </label>

      <label className="contact-form__field">
        <span className="contact-form__label">How does it connect to breath, body awareness, or the lab's values?</span>
        <textarea className="contact-form__input contact-form__textarea" required minLength={20} maxLength={3000}
          rows={4} value={form.values_fit} onChange={set('values_fit')} />
      </label>

      <label className="contact-form__field">
        <span className="contact-form__label">Link to something you've made</span>
        <input className="contact-form__input" type="url" required maxLength={500}
          placeholder="https://" value={form.portfolio_url} onChange={set('portfolio_url')} />
      </label>

      {/* Honeypot: hidden from people and screen readers; bots that fill it are discarded server-side. */}
      <div className="contact-form__hp" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
        </label>
      </div>

      <p className="contact-form__privacy">
        We collect your name, email, role, answers and link, and use them only to respond to your pitch.
        They are seen by Prof. Farb and lab members.
      </p>

      {error && <p className="contact-form__error" role="alert">{error}</p>}

      <div>
        <button className="contact-form__submit" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send pitch'}
        </button>
      </div>
    </form>
  )
}

export default function ContactPage() {
  return (
    <div className="lab-page">

      {/* What we look for */}
      <section className="lab-section">
        <h2 className="lab-section__heading">What We Look For</h2>
        <p className="contact-block__body">
          RADlab builds games, software, and hardware that train breath and body awareness, informed by
          contemplative practice. We take risks, and some of what we try may not work. We look for people who:
        </p>
        <ul className="contact-list">
          <li>read broadly;</li>
          <li>care about user-centered design and fun, immersive experiences;</li>
          <li>are creative and have already made things, such as a board game, an app built with AI, or a social event;</li>
          <li>make full use of the tools around them.</li>
        </ul>
      </section>

      {/* Pitch */}
      <section className="lab-section">
        <h2 className="lab-section__heading">Pitch Us Something</h2>
        <div className="contact-blocks">
          <p className="contact-block__body">
            We do not use an application form. Whether you are an undergraduate, graduate student, postdoc, or
            from outside the university, pitch us something you want to build that fits the lab's direction.
          </p>
          <p className="contact-block__body contact-note">
            Graduate intake is limited. Postdoc inquiries should name a specific funding opportunity.
          </p>
          <PitchForm />
        </div>
      </section>

      {/* Location */}
      <section className="lab-section">
        <h2 className="lab-section__heading">Location</h2>
        <address className="contact-address">
          Deerfield Hall<br />
          Department of Psychology<br />
          University of Toronto Mississauga<br />
          3359 Mississauga Road<br />
          Mississauga, Ontario L5L 1C6<br />
          Canada
        </address>
      </section>

    </div>
  )
}
