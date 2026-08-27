import { useEffect, useState } from 'react'

// Final screen for externally-recruited participants (SONA / Prolific), shown
// after the debrief when the study has a completion redirect URL. It replaced a
// bare 2-second "Redirecting…" flash: the redirect URL *is* the credit-granting
// callback on both platforms, so the participant needs to know (a) they're done
// and (b) that leaving before the redirect completes is what costs them credit.
const AUTO_REDIRECT_SECONDS = 10

const SOURCES = {
  sona:     { name: 'SONA',     credit: 'your course credit can be granted' },
  prolific: { name: 'Prolific', credit: 'your payment can be released' },
}

export default function CompletionRedirectScreen({ redirectUrl, source, hasMore }) {
  const site        = SOURCES[source] ?? null
  const siteName    = site?.name ?? 'the recruitment site'
  const [secondsLeft, setSecondsLeft] = useState(AUTO_REDIRECT_SECONDS)

  useEffect(() => {
    if (!redirectUrl) return
    const tick = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000)
    const jump = setTimeout(() => { window.location.href = redirectUrl }, AUTO_REDIRECT_SECONDS * 1000)
    return () => { clearInterval(tick); clearTimeout(jump) }
  }, [redirectUrl])

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.check}>✓</div>

        <h1 style={S.title}>{hasMore ? 'Session Complete' : 'Study Complete'}</h1>

        <p style={S.lead}>
          {hasMore
            ? "You've completed today's session. Thank you for taking part."
            : "You've completed the study. Thank you for taking part."}
        </p>

        <p style={S.body}>
          {site
            ? <>Your participation has been recorded, and {site.name} is being notified so that {site.credit}.</>
            : <>Your participation has been recorded, and the recruitment site is being notified so your credit for participation can be granted.</>}
        </p>

        <button style={S.btn} onClick={() => { window.location.href = redirectUrl }}>
          Return to {siteName} now →
        </button>

        <p style={S.note}>
          {secondsLeft > 0
            ? `Returning automatically in ${secondsLeft}s — please keep this window open until you're back on ${siteName}.`
            : `Returning to ${siteName}…`}
        </p>
      </div>
    </div>
  )
}

const S = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg, #FCF0F5)',
    padding: '40px 24px',
  },
  card: {
    maxWidth: 520,
    width: '100%',
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 16,
    padding: '36px 32px',
    textAlign: 'center',
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  check: {
    width: 52,
    height: 52,
    margin: '0 auto 18px',
    borderRadius: '50%',
    background: 'var(--pk)',
    color: '#fff',
    fontSize: 26,
    lineHeight: '52px',
  },
  title: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 30,
    fontWeight: 400,
    color: 'var(--tx)',
    margin: '0 0 14px',
  },
  lead: {
    fontSize: 17,
    lineHeight: 1.6,
    color: 'var(--tx)',
    margin: '0 0 12px',
  },
  body: {
    fontSize: 15,
    lineHeight: 1.7,
    color: 'var(--tx2)',
    margin: '0 0 26px',
  },
  btn: {
    background: 'var(--pk)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 28px',
    fontSize: 16,
    fontWeight: 600,
    fontFamily: '"DM Sans",system-ui,sans-serif',
    cursor: 'pointer',
  },
  note: {
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--tx3)',
    margin: '18px 0 0',
  },
}
