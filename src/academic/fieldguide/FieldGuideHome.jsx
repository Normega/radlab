import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useWikiCourse } from './wiki/useWikiCourse'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The Field Guide's front door (/academic/fieldguide). One page, two
// audiences: every member gets the student surfaces; staff additionally
// get the working queues with live counts, so a TA opens ONE url and sees
// where attention is needed rather than memorizing four routes.
//
// Course-generic since PSY309 joined the project: the course comes from the
// same picker state the wiki uses (useWikiCourse), so front door and reader
// always agree on which course is meant. PSY240 keeps its student-contribution
// surface (research gaps — the gap_board machinery is that course's); other
// courses show the surfaces that exist for every course.
//
// Counts are fetched with the caller's own client — RLS decides what comes
// back, so a student never fetches (or sees) the staff tiles, and this page
// holds no privileged logic of its own.
export default function FieldGuideHome() {
  const { courseClient, enrollments, isStaff } = useOutletContext()
  const { courseId, select, courses, course } = useWikiCourse(enrollments)
  // Same switch as the wiki index: PSY240 is the disorders-catalogue course;
  // everything later is week-anchored and skips PSY240-only machinery.
  const legacyCatalogue = course?.code === 'PSY240'
  const [staffCounts, setStaffCounts] = useState(null)

  useEffect(() => {
    if (!isStaff || !courseId) return
    let live = true
    const soon = new Date(Date.now() + 3 * 86400000).toISOString()
    Promise.all([
      // The first four queues have no course_id column (submission_review_queue,
      // gap_review_queue, gap_claims, corrections_feed) — they stay project-wide
      // "attention needed anywhere" counts. Everything that can be scoped is.
      courseClient.from('submission_review_queue').select('route'),
      courseClient.from('review_queue').select('version_id', { count: 'exact', head: true })
        .eq('course_id', courseId),
      courseClient.from('gap_review_queue').select('id', { count: 'exact', head: true })
        .not('review_reason', 'is', null),
      courseClient.from('gap_claims').select('id', { count: 'exact', head: true })
        .eq('status', 'claimed').lt('expires_at', soon),
      courseClient.from('wiki_pages').select('id', { count: 'exact', head: true })
        .eq('course_id', courseId).eq('status', 'published'),
      courseClient.from('wiki_pages').select('id', { count: 'exact', head: true })
        .eq('course_id', courseId),
      courseClient.from('corrections_feed').select('version_id', { count: 'exact', head: true })
        .gt('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      courseClient.from('page_reviews').select('page_id').eq('course_id', courseId),
      courseClient.from('page_reports').select('id', { count: 'exact', head: true })
        .eq('course_id', courseId).eq('status', 'open'),
    ]).then(([subs, proposals, gapFlags, expiring, published, pages, corrections, reviews, reports]) => {
      if (!live) return
      const routes = {}
      for (const r of subs.data ?? []) routes[r.route] = (routes[r.route] ?? 0) + 1
      setStaffCounts({
        submissions: (subs.data ?? []).length,
        blocked: routes['BLOCKED'] ?? 0,
        proposals: proposals.count ?? 0,
        gapFlags: gapFlags.count ?? 0,
        expiring: expiring.count ?? 0,
        published: published.count ?? 0,
        pages: pages.count ?? 0,
        corrections7d: corrections.count ?? 0,
        reviewed: new Set((reviews.data ?? []).map(r => r.page_id)).size,
        reports: reports.count ?? 0,
      })
    })
    return () => { live = false }
  }, [courseClient, isStaff, courseId])

  const c = staffCounts

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <p style={S.eyebrow}>Field Guide</p>
        <h1 style={S.title}>{course ? `${course.code} · ${course.term}` : 'Field Guide'}</h1>
        <p style={S.sub}>
          {course?.name ?? 'Course reference wiki'} — the living reference the class reads,
          and fills, together.
        </p>

        {courses?.length > 1 && (
          <select style={S.coursePick} value={courseId} onChange={e => select(e.target.value)}>
            {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.code} — {c.name}</option>)}
          </select>
        )}

        <div style={S.grid}>
          <Card to="/academic/fieldguide/wiki" title="Read the guide"
                body={legacyCatalogue
                  ? '262 pages: disorders, concepts, treatments, debates — every claim carries its sources.'
                  : 'The course textbook as a wiki, organized week by week — every page names its sources, and every concept links to its neighbours.'} />
          {legacyCatalogue && (
            <Card to="/academic/fieldguide/gaps" title="Research gaps"
                  body="Where the guide names its own missing evidence. Claim a gap, find a source, report what it found — and what it cannot tell us." />
          )}
          <Card to="/academic/fieldguide/whats-new" title="What we've learned"
                body={legacyCatalogue
                  ? "The guide grows as the class fills it. Every accepted contribution since September, newest first — and whether it's examinable yet."
                  : 'The guide grows through the term. Every accepted page and correction, newest first.'} />
        </div>

        {isStaff && (
          <>
            <h2 style={S.h2}>Staff</h2>
            <div style={S.grid}>
              <Card to="/academic/fieldguide/submissions" title="Student submissions"
                    badge={c ? `${c.submissions} awaiting${c.blocked ? ` · ${c.blocked} blocked` : ''}` : '…'}
                    body="The review queue. Precheck has already stripped mechanical faults; what is left is the one question it cannot answer — does the source actually say this?" />
              <Card to="/academic/fieldguide/review" title="Ingest proposals"
                    badge={c ? `${c.proposals} pending` : '…'}
                    body="Staff authoring path: proposed page versions awaiting accept/reject. Every accepted version carries provenance." />
              <Card to="/academic/fieldguide/corrections" title="Corrections"
                    badge={c ? `${c.corrections7d} this week` : '…'}
                    body="The audit feed: every staff edit with its required note. Corrections apply immediately; this is the review." />
              <Card to="/academic/fieldguide/ingest" title="Ingest portal"
                    body="Upload a source, propose pages from it." />
              <Card to="/academic/fieldguide/roster" title="Roster"
                    body="Import the ACORN CSV, send invites, watch enrollment land. The join-page QR for lecture slides points at /academic/fieldguide/join." />
              <Card to="/academic/fieldguide/reports" title="Student reports"
                    badge={c ? `${c.reports} open` : '…'}
                    body="Errors and contradictions students found while reading. Fix, convert a verified contradiction into a claimable gap, or dismiss with a note." />
              <Card to="/academic/fieldguide/read" title="Reading queue"
                    badge={c ? `${c.reviewed} reviewed` : '…'}
                    body="The pre-publish read in risk order. Read, stamp on the page, and the stamp bar hands you the next one — a stamp also makes the page item-eligible for tests." />
            </div>
            {c && (
              <p style={S.statusLine}>
                {c.published} of {c.pages} pages published
                {' · '}{c.reviewed} reviewed
                {' · '}{c.gapFlags === 0 ? 'gap triage clear' : `${c.gapFlags} gap flags to adjudicate`}
                {' · '}{c.expiring === 0 ? 'no claims expiring soon' : `${c.expiring} claim${c.expiring === 1 ? '' : 's'} expiring within 3 days`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Card({ to, title, body, badge }) {
  return (
    <Link to={to} style={S.card}>
      <span style={S.cardTitle}>
        {title}
        {badge != null && <span style={S.badge}>{badge}</span>}
      </span>
      <span style={S.cardBody}>{body}</span>
    </Link>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 640 },
  h2: { fontFamily: SERIF, fontSize: 20, color: 'var(--tx)', margin: '30px 0 0' },

  coursePick: { width: '100%', boxSizing: 'border-box', fontSize: 15, padding: '10px 13px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', marginTop: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 14 },
  card: { display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 18px', textDecoration: 'none' },
  cardTitle: { fontFamily: SERIF, fontSize: 18, color: 'var(--tx)', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  cardBody: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.55 },
  badge: { fontFamily: MONO, fontSize: 11, color: 'var(--pk)', border: '1px solid var(--pk)', borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' },

  statusLine: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', marginTop: 14, lineHeight: 1.6 },
}
