import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loungePath } from '../courseRoutes'
import { courseFeatures } from '../courseFeatures.js'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// First-sign-in tour: three short cards, role-branched, shown once.
// The stamp is onboarded_at on the person row (my_onboarding /
// mark_onboarded RPCs) — durable across devices. Any dismissal marks it;
// the avatar menu's "Tour" reopens it on demand (tourOpen prop).
//
// Failure never blocks the wiki: an RPC error is treated as already
// onboarded.
export default function Onboarding({ client, courseCode, isStaff, tourOpen, onTourClose }) {
  const [onboardedAt, setOnboardedAt] = useState(undefined) // undefined = loading
  const [step, setStep] = useState(0)

  useEffect(() => {
    let cancelled = false
    client.rpc('my_onboarding').then(({ data, error }) => {
      if (cancelled) return
      setOnboardedAt(error ? new Date().toISOString() : data)
    })
    return () => { cancelled = true }
  }, [client])

  const visible = tourOpen || onboardedAt === null
  if (!visible) return null

  const dismiss = () => {
    if (onboardedAt === null) {
      setOnboardedAt(new Date().toISOString())
      client.rpc('mark_onboarded').then(() => {}, () => {})
    }
    setStep(0)
    onTourClose?.()
  }

  const feats = courseFeatures(courseCode)
  const lounge = courseCode ? loungePath(courseCode) : '/academic'

  const cards = isStaff ? [
    {
      kicker: 'Welcome',
      title: 'This is the course textbook',
      body: <>
        <p style={S.p}>The Field Guide is free, openly licensed, and built for this course. Unusually
        for a textbook, it declares its own <strong>gaps</strong> — places where the evidence is thin,
        dated, or missing. Gaps aren&rsquo;t bugs; they&rsquo;re where student work happens.</p>
      </>,
    },
    {
      kicker: 'Your role',
      title: 'The review queue',
      body: <>
        <p style={S.p}>Students claim gaps, cite a source, and submit short contributions. Each one
        lands in <strong>Submissions</strong> with an automatic precheck that flags mechanical faults
        (citation shape, length, gap fit).</p>
        <p style={S.p}>Your job is the one question precheck can&rsquo;t answer: <em>does the text say
        what the cited source says?</em> Send it back with a note, or accept it — accepted work goes
        into the book with the student&rsquo;s name in the page history.</p>
      </>,
    },
    {
      kicker: 'One more thing',
      title: 'Make your avatar',
      body: <>
        <p style={S.p}>The Lecture Lounge gives you a site account with an avatar — it&rsquo;s how
        you&rsquo;ll appear on the class wall, and it makes the top-right corner here yours too.</p>
      </>,
      cta: { to: lounge, label: 'Open the Lecture Lounge →' },
    },
  ] : [
    {
      kicker: 'Welcome',
      title: 'Your textbook lives here',
      body: <>
        <p style={S.p}>The Field Guide is your course textbook — free, built for this course, and
        openly licensed. Every page cites its sources, and the Guide honestly marks its own
        <strong> gaps</strong>: places where the evidence is thin, dated, or missing.</p>
        <p style={S.p}><strong>No password:</strong> signing in always happens through a link sent to
        your U&nbsp;of&nbsp;T email. Keep access to that mailbox and you can always get in.</p>
      </>,
    },
    feats.contributions ? {
      kicker: 'Your part',
      title: 'You’ll help write it',
      body: <>
        <p style={S.p}>Over the term you&rsquo;ll make short contributions: <strong>claim a gap</strong> on
        the gap board (claims are exclusive — nobody duplicates your work), read the source
        you&rsquo;ll cite, write it up, and <strong>submit</strong>. A TA reviews it — sometimes with a
        revision note first — and accepted work becomes part of the textbook, with your name in the
        page history.</p>
        <p style={S.p}>The syllabus has the deadlines. Green gaps are the friendly first ones.</p>
      </>,
    } : {
      kicker: 'How to use it',
      title: 'Built to match your course',
      body: <>
        <p style={S.p}>The Guide is organized week by week to match lecture — each week has its own
        set of short, linked pages, including a companion guide for every practical assignment.
        Spot an error? Every page has a report control, and verified first reports earn
        participation credit.</p>
      </>,
    },
    {
      kicker: 'Last step',
      title: 'Connect your Lecture Lounge',
      body: <>
        <p style={S.p}>The Lounge is where lecture check-ins, the question of the week, and your
        participation credit live — and where your <strong>avatar</strong> comes from. It takes a
        minute, and it&rsquo;s the same login you&rsquo;ll use in class every week.</p>
      </>,
      cta: { to: lounge, label: 'Open the Lecture Lounge →' },
    },
  ]

  const card = cards[step]
  const last = step === cards.length - 1

  return (
    <div style={S.scrim} role="dialog" aria-modal="true" aria-label="Field Guide tour">
      <div style={S.card}>
        <button style={S.x} aria-label="Close tour" onClick={dismiss}>×</button>
        <p style={S.kicker}>{card.kicker}</p>
        <h2 style={S.title}>{card.title}</h2>
        {card.body}
        {card.cta && (
          <Link to={card.cta.to} style={S.cta} onClick={dismiss}>{card.cta.label}</Link>
        )}
        <div style={S.footer}>
          <div style={S.dots}>
            {cards.map((_, i) => (
              <span key={i} style={{ ...S.dot, background: i === step ? 'var(--pk)' : 'var(--bd)' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && <button style={S.ghostBtn} onClick={() => setStep(s => s - 1)}>Back</button>}
            {last
              ? <button style={S.nextBtn} onClick={dismiss}>Done</button>
              : <button style={S.nextBtn} onClick={() => setStep(s => s + 1)}>Next</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  scrim: {
    position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(42,33,48,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  card: {
    position: 'relative', maxWidth: 480, width: '100%', background: 'var(--bg)',
    border: '1px solid var(--bd)', borderRadius: 16, padding: '26px 28px 20px',
    boxShadow: '0 18px 60px rgba(42,33,48,.25)',
  },
  x: {
    position: 'absolute', top: 10, right: 14, border: 'none', background: 'none',
    fontSize: 22, color: 'var(--tx2)', cursor: 'pointer', lineHeight: 1,
  },
  kicker: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  title: { fontFamily: SERIF, fontSize: 26, color: 'var(--tx)', marginBottom: 10, lineHeight: 1.2 },
  p: { fontSize: 14.5, color: 'var(--tx)', lineHeight: 1.6, marginBottom: 10 },
  cta: {
    display: 'inline-block', margin: '2px 0 8px', padding: '9px 18px', borderRadius: 22,
    background: 'var(--pk)', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none',
  },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  dots: { display: 'flex', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: '50%' },
  ghostBtn: {
    fontFamily: MONO, fontSize: 12, padding: '7px 14px', borderRadius: 18,
    border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx2)', cursor: 'pointer',
  },
  nextBtn: {
    fontFamily: MONO, fontSize: 12, padding: '7px 16px', borderRadius: 18,
    border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer', fontWeight: 700,
  },
}
