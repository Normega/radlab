import { Link, useOutletContext } from 'react-router-dom'
import { AcademicEyebrow } from '../AcademicChrome'
import AvatarMenu from './AvatarMenu'
import { useCoursePaths } from './wiki/useWikiBase'
import { loungePath } from '../courseRoutes'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The student how-to for gap contributions (Norm, 2026-09-16). Started life as
// a static page in the course's public deck dir, but a page students land on
// needs the avatar menu and a way back — the same dead-end rule that gave
// ClassSlides its menu on 2026-09-09 — so it lives in the partition now. The
// old static gap-guide.html URL carries a meta-refresh here.
//
// Content mirrors the L2 walkthrough slides and the live claim flow: if the
// form's rules change (word counts, claim limits, TTL), change this page in
// the same commit.
export default function ContributionHowTo() {
  const paths = useCoursePaths()
  const { courseClient, courseCode, session, isStaff } = useOutletContext()

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <AcademicEyebrow to={paths.home} courseCode={courseCode} suffix=" · students" />
          {session && (
            <AvatarMenu client={courseClient} fgEmail={session.user.email}
                        courseCode={courseCode} isStaff={isStaff} />
          )}
        </div>

        <h1 style={S.h1}>How to do a gap contribution</h1>
        <p style={S.sub}>
          Your Field Guide contributions are 20% of the course: over the term you research and
          write <strong>three short pieces of the textbook</strong>. This page is the whole
          process, start to finish. Ten minutes now saves you an hour in October.
        </p>

        <h2 style={S.h2}>The idea</h2>
        <div style={S.card}>
          <p style={S.p}>
            The Field Guide is your textbook — and it is honest about what it doesn't yet know.
            Every place it needs work is marked on the page as a <b>gap</b>: a specific ask
            like <em>"Canadian data on the anxiety disorders, absent anywhere in this
            chapter."</em> You claim a gap, find a real source that answers it, and report what
            that source found — and what it <i>can't</i> tell us. If your work is accepted, a
            section drafted from your source goes through staff review into the published
            Guide. You are not writing an assignment that gets filed away; you are writing the
            book the next reader studies from.
          </p>
        </div>

        <h2 style={S.h2}>Deadlines and difficulty tiers</h2>
        <table style={S.table}>
          <thead>
            <tr><th style={S.th}>Due</th><th style={S.th}>What</th><th style={S.th}>Tier</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={S.td}><b>Oct 7</b></td><td style={S.td}>Contribution 1</td>
              <td style={S.td}><Badge kind="g">green</Badge> — well covered in recent open literature; a good first contribution</td>
            </tr>
            <tr>
              <td style={S.td}><b>Nov 11</b></td><td style={S.td}>Contribution 2</td>
              <td style={S.td}><Badge kind="a">amber</Badge> — needs more careful sourcing or synthesis</td>
            </tr>
            <tr>
              <td style={S.tdLast}><b>Nov 27</b></td><td style={S.tdLast}>Contribution 3</td>
              <td style={S.tdLast}><Badge kind="a">amber</Badge></td>
            </tr>
          </tbody>
        </table>
        <ul style={S.ul}>
          <li style={S.li}>Your <b>first claim must be a green gap</b>; amber unlocks once your green is submitted.</li>
          <li style={S.li}>Gaps shown as <Badge kind="r">red</Badge> are staff work — dimmed on the board, never yours to claim.</li>
          <li style={S.li}>Late policy is in the syllabus — automated and the same for everyone.</li>
        </ul>

        <h2 style={S.h2}>Step by step</h2>
        <ol style={S.ul}>
          <li style={S.li}>
            <b>Browse the board.</b> Course Home → <Link to={paths.sub('gaps')} style={S.link}>Gap board</Link>.
            Each gap shows its page, the ask, its tier, and how many claim slots remain. You can
            also spot gaps inline while reading any Guide page.
          </li>
          <li style={S.li}>
            <b>Claim it.</b> A claim is yours for <b>14 days</b> and you can hold at most{' '}
            <b>two unsubmitted claims</b>. The claim panel shows what the page already cites —
            read that first, so you don't fetch a source it already has. Change your mind?
            Release the claim; no cost.
          </li>
          <li style={S.li}>
            <b>Attach your source.</b> Paste the paper's <b>DOI</b> — preferred, because it's
            what the checks can verify. The moment you paste it, the system tells you if that
            source is already cited on the page (before you've written a word). Press{' '}
            <b>Find the full text</b> and the open-access copy is fetched for you; if the paper
            has no open copy, <b>upload the PDF</b> — it's read once and the file is not kept.
          </li>
          <li style={S.li}>
            <b>Write two things.</b>
            <ul style={S.ul}>
              <li style={S.li}><b>What the source found</b> (60–400 words, aim ~150): report what the
                study actually found, in your own words, <i>with the numbers that matter</i>.
                Answer the ask; do not advise.</li>
              <li style={S.li}><b>What this source cannot tell us</b> — design limits, sample limits,
                what question stays open. <b>This box is the point of the exercise</b>, and the
                skill your work is marked on.</li>
            </ul>
            Your draft autosaves in your browser and there's a Save draft button — nothing is
            lost if you close the tab.
          </li>
          <li style={S.li}>
            <b>Submit for review.</b> An automatic precheck runs first — unverifiable citation,
            missing limitation, quoting too much, giving clinical advice. If it refuses your
            submission it lists exactly why, and <b>a refusal costs you an edit, not the
            claim</b>: fix it and submit again, the gap is still yours. After submission, the
            system also reads your actual source and checks that it says what you say it says.
          </li>
          <li style={S.li}>
            <b>A TA decides.</b> A human reads every submission.
            <ul style={S.ul}>
              <li style={S.li}><b>Accepted</b> → you get an email; a section drafted <i>from your
                paper</i> goes to staff for publication, and the contribution counts toward your
                three. (Your summary is the evidence you read the paper — the published text is
                drafted from the source itself, so the Guide stays sourced.)</li>
              <li style={S.li}><b>Sent back</b> → you get an email with the reviewer's note on your
                claim. It's feedback, not a penalty: revise and resubmit, same gap, same claim.</li>
            </ul>
          </li>
        </ol>

        <h2 style={S.h2}>What a good one looks like</h2>
        <p style={S.subSmall}>
          Same gap — <em>"Canadian data on the anxiety disorders, absent anywhere in this
          chapter"</em> — done twice. (You saw these in Lecture 2.)
        </p>
        <div style={S.good}>
          <p style={S.p}>
            <b>Good:</b> "Statistics Canada's 2012 Canadian Community Health Survey – Mental
            Health measured generalized anxiety disorder in a national sample: past-12-month
            prevalence was <b>2.6%</b>, roughly twice as common among women as men…"<br />
            <b>Limitation:</b> "One disorder, one survey year — a GAD figure is not 'the anxiety
            disorders'. And diagnoses come from a lay-administered interview, not clinician
            assessment."
          </p>
          <p style={S.subSmall}>
            Why it passes: the numbers come from the paper, in the writer's own words, and the
            limitation does real work instead of apologising.
          </p>
        </div>
        <div style={S.bad}>
          <p style={S.p}>
            <b>Refused:</b> "Anxiety is super common in Canada — about 1 in 4 people struggle
            with it at some point. If you're feeling anxious, practice deep breathing and try
            CBT, which is proven to work for almost everyone."<br />
            <b>Limitation:</b> "None — this is a good source."
          </p>
          <p style={S.subSmall}>
            Three precheck blocks: no verifiable citation (a blog is not a checkable source) ·
            clinical advice (the ask is a lookup; "you should…" is advice, not evidence) · the
            limitation field is the point of the exercise.
          </p>
        </div>

        <h2 style={S.h2}>The other way in: catch the Guide being wrong</h2>
        <div style={S.card}>
          <p style={S.p}>
            Every Guide page has <b>Report an issue</b>. If you find a genuine error — or a
            source that <i>contradicts</i> what a page says — report it. A verified
            contradiction becomes a claimable gap, and <b>your submission on it counts as one of
            your three contributions</b>. Reading like a skeptic is the same skill as writing
            well.
          </p>
        </div>

        <h2 style={S.h2}>Advice your TAs will give you anyway</h2>
        <ul style={S.ul}>
          <li style={S.li}><b>Claim early.</b> The earlier you submit, the more feedback rounds you get
            before the deadline — the students who start in the last week have a bad time.</li>
          <li style={S.li}><b>Read the page section first.</b> The best submissions answer the ask
            precisely — nothing more.</li>
          <li style={S.li}><b>Numbers beat vibes.</b> "Prevalence was 2.6%" is a contribution; "anxiety
            is common" is not.</li>
          <li style={S.li}><b>The limitation is where the marks live.</b> Every strong source still
            can't tell us something. Say what.</li>
          <li style={S.li}>Stuck on a claim you've lost interest in? Release it — hoarding an unworked
            claim just runs out your 14 days.</li>
        </ul>

        <p style={S.foot}>
          Questions → the <Link to={`${loungePath(courseCode)}/boards`} style={S.link}>discussion boards</Link>,
          where your TAs answer.
        </p>
      </div>
    </div>
  )
}

function Badge({ kind, children }) {
  const colour = kind === 'g' ? '#2e7d32' : kind === 'a' ? '#b8860b' : '#c0392b'
  return (
    <span style={{ display: 'inline-block', fontFamily: MONO, fontSize: 11.5, padding: '2px 9px',
                   borderRadius: 12, border: `1px solid ${colour}`, color: colour, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

const S = {
  h1: { fontFamily: SERIF, fontSize: 30, lineHeight: 1.2, color: 'var(--tx)', margin: '18px 0 10px' },
  h2: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', margin: '34px 0 10px' },
  sub: { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6 },
  subSmall: { fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.6, margin: '6px 0' },
  p: { fontSize: 15.5, color: 'var(--tx)', lineHeight: 1.6, margin: '4px 0' },
  ul: { paddingLeft: 22, margin: '10px 0' },
  li: { fontSize: 15.5, color: 'var(--tx)', lineHeight: 1.6, margin: '8px 0' },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 18px', margin: '14px 0' },
  table: { width: '100%', borderCollapse: 'collapse', margin: '14px 0', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden', fontSize: 14.5 },
  th: { textAlign: 'left', padding: '9px 12px', borderBottom: '1px solid var(--bd)', fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)' },
  td: { textAlign: 'left', padding: '9px 12px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top', color: 'var(--tx)' },
  tdLast: { textAlign: 'left', padding: '9px 12px', verticalAlign: 'top', color: 'var(--tx)' },
  good: { borderLeft: '3px solid #2e7d32', padding: '2px 0 2px 14px', margin: '12px 0' },
  bad: { borderLeft: '3px solid #c0392b', padding: '2px 0 2px 14px', margin: '12px 0' },
  link: { color: 'var(--pk)' },
  foot: { marginTop: 40, fontSize: 13.5, color: 'var(--tx2)', borderTop: '1px solid var(--bd)', paddingTop: 14 },
}
