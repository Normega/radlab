import { Link } from 'react-router-dom'

const MONO = '"Space Mono", "Courier New", monospace'

// Shared chrome for the academic partition (Field Guide + Lecture Lounge).
//
// The problem this solves (Norm, 2026-09-04): the Field Guide had its own
// header — eyebrow left, avatar menu right, 980px column, works on a phone —
// while the Lounge mounted the main site's <Nav>, so walking from wiki to
// lounge swapped menu, width and identity mid-course. Now every academic
// page renders the same header row through these two components, and the
// main Nav appears nowhere in student-facing academic chrome.
//
// AcademicEyebrow — the top-left identity: small RADlab logo (link to the
// main site — the "way home" anchor Norm asked for on every page) beside the
// area eyebrow ("FIELD GUIDE · PSY240"), which links to the area's home.
// Light-background logo per /brand: RADlab_Logo.svg is white-outline,
// dark-bg only.
export function AcademicEyebrow({ area = 'Field Guide', courseCode, to, suffix }) {
  return (
    <span style={S.row}>
      <Link to="/" aria-label="RADlab home" style={S.logoLink}>
        <img src="/RADlab_Logo_light.svg" alt="RADlab" style={S.logo} />
      </Link>
      <p style={S.eyebrow}>
        {to ? <Link to={to} style={S.eyebrowLink}>{area}</Link> : area}
        {courseCode ? ` · ${String(courseCode).toUpperCase()}` : ''}
        {suffix ?? ''}
      </p>
    </span>
  )
}

// AcademicShell — full-page wrapper for Lounge-side pages (the Field Guide
// pages keep their richer local Shells and mount AcademicEyebrow inside
// them). Header always sits in the 980 column so it aligns with the wiki;
// `contentWidth` lets a page keep a narrower reading column beneath it.
export function AcademicShell({ area = 'Lecture Lounge', courseCode, homeTo, menu, contentWidth, children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '20px 16px 64px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={S.bar}>
          <AcademicEyebrow area={area} courseCode={courseCode} to={homeTo} />
          {menu ?? null}
        </div>
      </div>
      <div style={{ maxWidth: contentWidth ?? 980, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  )
}

const S = {
  row: { display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: 46 },
  logoLink: { display: 'inline-flex', alignItems: 'center' },
  logo: { height: 24, display: 'block' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', margin: 0 },
  eyebrowLink: { color: 'inherit', textDecoration: 'none' },
  bar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
}
