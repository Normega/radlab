import { Link, useOutletContext } from 'react-router-dom'
import { AcademicEyebrow } from '../AcademicChrome'
import AvatarMenu from './AvatarMenu'
import { useCoursePaths } from './wiki/useWikiBase'
import { loungePath } from '../courseRoutes'
import { WORDS } from './contributions'

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
//
// The FAQ at the foot collects the questions students actually emailed
// (Norm, 2026-10-04): one source or two, the listed sources vs a new one,
// DOI vs URL, replacing a paper, expired claims — plus how to use the site
// to study for the midterm and exam. Add to it when a new one recurs.
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
        <p style={S.subSmall}>
          Have a specific question? <a href="#faq" style={S.link}>Common questions</a>, including
          how to use the Guide to study for the midterm and exam.
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
              <li style={S.li}><b>What the source found</b> ({WORDS.foundMin}–{WORDS.foundMax} words, aim ~{WORDS.foundAim}): report what the
                study actually found, in your own words, <i>with the numbers that matter</i>.
                Answer the ask; do not advise.</li>
              <li style={S.li}><b>What this source cannot tell us</b> (aim ~{WORDS.limAim} words) — design limits, sample limits,
                what question stays open. <b>This box is the point of the exercise</b>, and the
                skill your work is marked on.</li>
            </ul>
            <b>Length:</b> the syllabus's "{WORDS.totalMin}–{WORDS.totalMax} words" is both boxes
            together, not the first box alone. The form shows the combined count as you type.<br />
            <b>Citations:</b> no formatted reference is needed — the DOI (or URL) is the citation,
            and the reference is generated from it. If you name a study in your text, use APA
            author–date, e.g. (Kilpatrick et al., 2013).<br />
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


        <h2 id="faq" style={S.h2}>Common questions</h2>
        <p style={S.subSmall}>Tap a question to open it.</p>

        <h3 style={S.h3}>Contributions</h3>
        <Faq q="Do I summarize the sources listed on the gap, or find my own?">
          <p style={S.p}>
            <b>Find your own.</b> The sources shown on a gap are the ones the Guide page{' '}
            <i>already cites</i>. They are there so you don't bring back a paper the page already
            has. Your job is to find one <b>new</b>, real source (usually a peer-reviewed paper)
            that answers the gap's question, and report what it found and what it can't tell us.
          </p>
        </Faq>
        <Faq q="Do I paste my writing into the Guide?">
          <p style={S.p}>
            No. You submit it on the gap, and a TA reviews it. If it's accepted, staff draft the
            published section from <i>your paper itself</i>, and your name goes in the page's
            history. Your summary is the evidence that you read and understood the paper.
          </p>
        </Faq>
        <Faq q="Can I use two sources?">
          <p style={S.p}>
            No: one contribution, one source. The form reads that one paper, checks your summary
            against it, and the published section is drafted from it, so a second paper would be
            invisible to all three. If no single paper answers everything the gap asks, pick the
            one that comes closest and say what it doesn't cover in <b>What this source cannot
            tell us</b>. A source that answers part of the question, with its limits stated
            plainly, is a good contribution. Your other paper may fit a different gap.
          </p>
        </Faq>
        <Faq q="What is a DOI, and where do I find it?">
          <p style={S.p}>
            A DOI is a paper's permanent ID. It starts with <b>10.</b> (for example,{' '}
            <code style={S.code}>10.1016/j.jad.2021.01.045</code>) and is printed on the paper's
            first page and on its journal web page. Paste it into the DOI box, either the bare DOI
            or the whole <code style={S.code}>doi.org/…</code> link. The form tells you straight
            away if that paper is already cited on the page.
          </p>
        </Faq>
        <Faq q="DOI or URL: which box do I use?">
          <p style={S.p}>
            Use the <b>DOI</b> whenever the source has one: it's what lets the system find and
            check the paper. Use the <b>URL</b> box only for a source with no DOI, such as a
            government or Statistics Canada report. Don't fill in both for different sources.
          </p>
        </Faq>
        <Faq q="“Find the full text” didn't work. Now what?">
          <p style={S.p}>
            It only finds papers with a free, open-access copy. If yours is behind a paywall, get
            the PDF through the U of T library and press <b>Upload the PDF</b>. The PDF is read
            once and the file isn't kept. A scanned PDF with no selectable text can't be read;
            choose a different copy or a different paper.
          </p>
        </Faq>
        <Faq q="I was sent back for a better paper. How do I change my source?">
          <p style={S.p}>
            Open your claim on the gap board, put the new paper's DOI in the DOI box, then press{' '}
            <b>Replace with a different paper</b> in the full-text box and capture the new one
            (Find the full text, or Upload the PDF). The form won't let you submit while the text
            it holds is from your old paper.
          </p>
        </Faq>
        <Faq q="How long should it be?">
          <p style={S.p}>
            {WORDS.totalMin}–{WORDS.totalMax} words for the <b>two boxes together</b> (aim for
            about {WORDS.foundAim} on what the source found and {WORDS.limAim} on what it can't
            tell us). The form shows the combined count as you type. No formatted reference list
            is needed: the DOI or URL is the citation.
          </p>
        </Faq>
        <Faq q="My contribution was sent back. Is that a penalty?">
          <p style={S.p}>
            No. It's feedback. Read the reviewer's note on your claim (it's also on{' '}
            <Link to={paths.sub('contributions')} style={S.link}>Your contributions</Link>), revise,
            and resubmit: same gap, same claim. Each time a contribution is sent back you get at
            least 14 days from that point to revise it, and there is no limit on rounds.
          </p>
        </Faq>
        <Faq q="My claim expired before I submitted. Can I get it back?">
          <p style={S.p}>
            If the gap still has a free slot, claim it again from the gap board: your draft comes
            back with it. If it's full, email your instructor before the deadline. Claims last 14
            days so that unworked gaps go back to the class, which is why claiming late in a
            deadline's window is risky.
          </p>
        </Faq>
        <Faq q="Where can I see everything I've submitted?">
          <p style={S.p}>
            <Link to={paths.sub('contributions')} style={S.link}>Your contributions</Link> lists
            every claim with its status, the reviewer's note, and the text you submitted.
          </p>
        </Faq>

        <h3 style={S.h3}>Studying for the midterm and exam</h3>
        <Faq q="How do I find the readings for each lecture?">
          <p style={S.p}>
            Open <Link to={paths.sub('chapters')} style={S.link}>Chapters by lecture</Link>. Each
            lecture lists the Guide pages that go with it, in reading order. Pages marked{' '}
            <b>foundation</b> come first: read those before the supporting pages, because the
            quizzes and tests lean on them hardest.
          </p>
        </Faq>
        <Faq q="What's on the midterm, and how should I prepare?">
          <p style={S.p}>
            The midterm (<b>Oct 14</b>) covers Lectures 1–5: <b>50 questions, 10 from each
            lecture</b>, made up of 33 multiple choice, 12 extended matching (several cases that
            share one list of diagnoses) and 5 short typed answers (one or two words; spelling is
            not marked). The questions are drawn from the lectures and their Guide pages. A good
            plan, lecture by lecture:
          </p>
          <ul style={S.ul}>
            <li style={S.li}>Go back through the{' '}
              <Link to={`${loungePath(courseCode)}/slides`} style={S.link}>lecture slides</Link>{' '}
              and note every term, distinction and number that's on a slide.</li>
            <li style={S.li}>Read that lecture's foundation pages in{' '}
              <Link to={paths.sub('chapters')} style={S.link}>Chapters by lecture</Link>, then the
              supporting pages for anything you couldn't explain from the slides.</li>
            <li style={S.li}>Go back over your{' '}
              <Link to={`${loungePath(courseCode)}/quizzes`} style={S.link}>weekly quizzes</Link>:
              your answers stay there to review, and each one has a <b>Read this in the Field
              Guide</b> link. Where you missed one, read that section, not just the answer.</li>
            <li style={S.li}>For the short typed questions, practise saying each key term
              from memory, without the options in front of you.</li>
          </ul>
        </Faq>
        <Faq q="Why does the Guide say it's frozen?">
          <p style={S.p}>
            From Oct 1 to Oct 15 every student sees the same fixed version of the Guide, so
            nobody studies from text that changes the week before the midterm. Contributions are
            still being reviewed and accepted in that time; they appear once the freeze ends,
            the day after the midterm.
          </p>
        </Faq>
        <Faq q="What about the final exam?">
          <p style={S.p}>
            The same approach works: slides, then that lecture's foundation pages, then a review
            of the weekly quizzes. The exam's format and coverage will be announced in lecture and on
            Course Home ahead of time.
          </p>
        </Faq>

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

// One question: a native disclosure, so it works without JavaScript state and
// is keyboard- and screen-reader-accessible for free.
function Faq({ q, children }) {
  return (
    <details style={S.faq}>
      <summary style={S.faqQ}>{q}</summary>
      <div style={S.faqA}>{children}</div>
    </details>
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
  link: { color: 'var(--pkd)' },
  h3: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '24px 0 8px' },
  faq: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '8px 16px', margin: '8px 0' },
  faqQ: { cursor: 'pointer', fontSize: 16, fontWeight: 600, color: 'var(--tx)', lineHeight: 1.5, padding: '4px 0' },
  faqA: { padding: '4px 0 8px' },
  code: { fontFamily: MONO, fontSize: 14 },
  foot: { marginTop: 40, fontSize: 13.5, color: 'var(--tx2)', borderTop: '1px solid var(--bd)', paddingTop: 14 },
}
