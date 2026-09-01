import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCourseClient } from './courseClient'
import { coursePath, pickNewestTerm, termSortKey } from './courseRoutes'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// /academic — the course directory, and the academic area's main routing
// entry. Every course gets one card linking its home (/academic/:code);
// superusers additionally get the admin door.
//
// Data assembly is best-effort from BOTH backends and must degrade to a
// useful static page when either is unreachable (the academic client needs
// /api, which plain `vite dev` does not serve):
//  - MAIN project: the caller's own class_members rows (RLS) — the courses a
//    signed-in student actually belongs to.
//  - ACADEMIC project: is_public courses for everyone; the caller's
//    enrollments when an academic session exists.
// The two lists are merged by lowercase code — classes.slug and
// courses.code are the same token by convention.
export default function AcademicHome({ session, role, superAdmin }) {
  const [byCode, setByCode] = useState(new Map()) // code -> {code, name, term, sources}

  const merge = (entries) => setByCode(prev => {
    const next = new Map(prev)
    for (const e of entries) {
      const key = String(e.code).toLowerCase()
      const cur = next.get(key)
      next.set(key, {
        code: key,
        // Prefer the academic project's name (it carries the course title);
        // fall back to the class name.
        name: e.fromAcademic ? e.name : (cur?.name ?? e.name),
        term: [cur?.term, e.term].filter(Boolean).sort((a, b) => termSortKey(b) - termSortKey(a))[0] ?? null,
      })
    }
    return next
  })

  // Main project: my classes.
  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false
    supabase.from('class_members').select('classes ( slug, name )')
      .then(({ data }) => {
        if (cancelled) return
        merge((data ?? []).filter(r => r.classes)
          .map(r => ({ code: r.classes.slug, name: r.classes.name, term: null })))
      })
    return () => { cancelled = true }
  }, [session?.user?.id])

  // Academic project: public courses + my enrollments (best-effort).
  useEffect(() => {
    let cancelled = false
    getCourseClient().then(async (client) => {
      const { data: pub } = await client
        .from('courses').select('code, name, term').eq('is_public', true)
      if (cancelled) return
      merge((pub ?? []).map(c => ({ ...c, fromAcademic: true })))
      const { data: { session: s } } = await client.auth.getSession()
      if (cancelled || !s) return
      const { data: enr } = await client
        .from('enrollments').select('status, courses ( code, name, term )')
        .eq('status', 'active')
      if (cancelled) return
      // One entry per code, newest term.
      const per = new Map()
      for (const e of (enr ?? [])) {
        if (!e.courses?.code) continue
        const k = e.courses.code.toLowerCase()
        per.set(k, pickNewestTerm([per.get(k), e.courses].filter(Boolean)))
      }
      merge([...per.values()].map(c => ({ ...c, fromAcademic: true })))
    }).catch(() => {}) // no /api — static content below still renders
    return () => { cancelled = true }
  }, [])

  const courses = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
  const isLab = role === 'lab' || superAdmin

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%' }}>
        <p style={S.eyebrow}>radlab</p>
        <h1 style={S.title}>Academic</h1>
        <p style={S.sub}>Courses on the radlab platform. Each course page has its lecture tools and its Field Guide.</p>

        {courses.map(c => (
          <Link key={c.code} to={coursePath(c.code)} style={S.card}>
            <h2 style={S.cardTitle}>{c.code.toUpperCase()}</h2>
            <p style={S.sub}>{c.name}{c.term ? ` · ${c.term}` : ''}</p>
          </Link>
        ))}

        {!courses.length && (
          <div style={{ ...S.card, cursor: 'default' }}>
            <h2 style={S.cardTitle}>In a class?</h2>
            <p style={S.sub}>
              Scan your class QR code, or open your course page directly — it's
              /academic/ followed by the course code, like <code style={S.code}>/academic/psy240</code>.
            </p>
          </div>
        )}

        {isLab && (
          <Link to="/academic/admin" style={S.card}>
            <h2 style={S.cardTitle}>Academic admin</h2>
            <p style={S.sub}>Classes, instructors, QR codes, and the cross-course Field Guide tools.</p>
          </Link>
        )}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  title: { fontFamily: SERIF, fontSize: 36, color: 'var(--tx)', margin: '2px 0 6px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  code: { fontFamily: MONO, fontSize: 12 },
  card: { display: 'block', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 16px', marginTop: 16, textDecoration: 'none' },
  cardTitle: { fontFamily: SERIF, fontSize: 20, color: 'var(--tx)', marginBottom: 4 },
}
