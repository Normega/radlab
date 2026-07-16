import { interventionStyles as S } from './InterventionPage'

/**
 * Owl sign-off + Mental Health Supports resources shown after the
 * post-check-in of every Liliana daily training session. Condition-specific
 * (owl + badge only — message/resources are shared across conditions), so
 * unlike the Welcome step this can be pinned statically per session template.
 * Copy is Liliana's canonical wording (Study3/interventions/JSON/
 * landing_page_farewell/farewell-*.json, 2026-07-14).
 */

const CONDITION_META = {
  non_reactivity:  { owl: 'owl_nonreactivity',  badge: 'Non-Reactivity Practice' },
  reappraisal:     { owl: 'owl_reappraisal',    badge: 'Reappraisal Practice' },
  self_compassion: { owl: 'owl_selfcompassion', badge: 'Self-Compassion Practice' },
}

const OWL_MESSAGE =
  "That's it for today. Well done for showing up. Remember, even a small pause can create space between " +
  'what you feel and how you respond. See you tomorrow!'

const INTRO_TEXT =
  'If you feel any discomfort at any point, please feel free to raise those concerns to the experimenter by ' +
  'emailing norman.farb@utoronto.ca. Additionally, if at any time you feel distressed by the contents of the ' +
  'surveys, please take advantage of the following resources:'

const RESOURCES = [
  {
    name: 'U of T Telus Health Student Support — Online',
    description:
      'Provides University of Toronto students with immediate and/or ongoing confidential, 24-hour support for ' +
      'any school, health, or general life concern at no cost to students. Call or chat with a counsellor ' +
      'directly from your phone whenever, wherever you are.',
    links: [
      { label: 'Website', href: 'https://mentalhealth.utoronto.ca/telus-health-student-support/' },
    ],
  },
  {
    name: 'By Phone',
    description: 'Access TELUS Health Student Support 24/7 by phone, or call the Good2Talk Hotline.',
    links: [
      { label: 'TELUS: 1-844-451-9700', href: 'tel:1-844-451-9700' },
      { label: 'Good2Talk: 1-866-925-5454', href: 'tel:1-866-925-5454' },
    ],
  },
  {
    name: 'UTM Health & Counselling Centre — On Campus',
    description:
      'Offers personal counselling, group counselling, and psychiatric care to assist students experiencing a ' +
      'wide range of challenges.',
    links: [
      { label: '905-828-5255', href: 'tel:905-828-5255' },
      { label: 'health.utm@utoronto.ca', href: 'mailto:health.utm@utoronto.ca' },
    ],
    address: 'Room 1152, Davis Building (Around the corner from the Bookstore), 3359 Mississauga Rd., Mississauga, ON L5L 1C6',
  },
]

const SESSION_STEPS = ['Welcome', 'Check-in', 'Practice', 'Check-in', 'Farewell']

export default function DailyFarewellStep({ condition, onComplete }) {
  const meta = CONDITION_META[condition]

  if (!meta) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#e04' }}>Unknown farewell condition: {condition}</div>
  }

  return (
    <div style={S.bg}>
      <div style={S.page}>
        <div style={S.progressBar}>
          <div style={{ display: 'flex' }}>
            {SESSION_STEPS.map((label, i) => {
              const isActive = i === SESSION_STEPS.length - 1
              const color = isActive ? '#2c2c2a' : '#639922'
              const track = isActive ? '#2c2c2a' : '#639922'
              return (
                <div key={label} style={S.stepCol}>
                  <span style={{ ...S.stepLabel, color }}>{label}</span>
                  <div style={{ ...S.stepTrack, background: track }}>
                    <div style={{ ...S.stepDot, background: track }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={S.header}>
          <div style={S.practiceBadge}>
            <div style={S.badgeDot} />
            {meta.badge}
          </div>
          <div style={S.dayNumber}>Session complete</div>
        </div>

        <div style={{ ...S.owlScreen, borderBottom: '1px solid #ebe8e3', background: '#faf9f7', padding: '20px 24px' }}>
          <img src={`/assets/owls/${meta.owl}.png`} alt="" style={{ ...S.owlImg, width: 100, height: 100 }} />
          <div style={S.speechBubble}>{OWL_MESSAGE}</div>
        </div>

        <div style={S.content}>
          <div style={M.sectionHeader}>
            <div style={M.sectionIcon}>🧠</div>
            <span style={M.sectionTitle}>Mental Health Supports</span>
          </div>

          <div style={M.contactBlock}>
            {INTRO_TEXT.split('norman.farb@utoronto.ca')[0]}
            <a href="mailto:norman.farb@utoronto.ca" style={M.link}>norman.farb@utoronto.ca</a>
            {INTRO_TEXT.split('norman.farb@utoronto.ca')[1]}
          </div>

          {RESOURCES.map(r => (
            <div key={r.name} style={M.resourceCard}>
              <div style={M.resourceName}>{r.name}</div>
              <div style={M.resourceDesc}>{r.description}</div>
              <div style={M.resourceLinks}>
                {r.links.map(l => (
                  <a key={l.href} href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" style={M.resourceLink}>
                    {l.label}
                  </a>
                ))}
              </div>
              {r.address && (
                <div style={M.addressNote}>
                  <strong>In person:</strong> {r.address}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={S.footer}>
          <button style={S.btnDone} onClick={() => onComplete?.({ condition })}>
            Close Session
          </button>
          <p style={M.footerNote}>Your responses have been saved. You will receive tomorrow's session by email at 6:00 AM.</p>
        </div>
      </div>
    </div>
  )
}

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

const M = {
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionIcon: {
    width: 26, height: 26, borderRadius: '50%', background: '#f0ede8',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: '#5f5e5a', fontFamily: FONT,
  },
  contactBlock: {
    background: '#f9f8f5', border: '1px solid #e8e5e0', borderLeft: '3px solid #2c2c2a',
    borderRadius: '0 8px 8px 0', padding: '12px 14px', fontSize: 13, lineHeight: 1.6,
    color: '#2c2c2a', marginBottom: 14, fontFamily: FONT,
  },
  link: { color: '#3b6d11', textDecoration: 'none', fontWeight: 600 },
  resourceCard: {
    background: '#faf9f7', border: '1px solid #e8e5e0', borderRadius: 10,
    padding: '14px 16px', marginBottom: 10,
  },
  resourceName: { fontSize: 14, fontWeight: 600, color: '#1a1a18', marginBottom: 4, fontFamily: FONT },
  resourceDesc: { fontSize: 13, color: '#5f5e5a', lineHeight: 1.55, marginBottom: 10, fontFamily: FONT },
  resourceLinks: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  resourceLink: {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
    color: '#3b6d11', textDecoration: 'none', background: '#fff', border: '1px solid #c8ddb8',
    borderRadius: 6, padding: '5px 10px', fontFamily: FONT,
  },
  addressNote: { fontSize: 12, color: '#888780', marginTop: 10, lineHeight: 1.6, fontFamily: FONT },
  footerNote: { textAlign: 'center', fontSize: 11, color: '#a09d98', marginTop: 10, fontFamily: FONT },
}
