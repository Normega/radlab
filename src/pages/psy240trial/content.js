// /psy240trial: the PSY240 teaching trial's launch tracker (Norm, Oct 8 2026).
// Content only; Psy240Trial.jsx is layout. The source of truth is PLAN.md in the
// private repo Normega/psy240internal2026; keep the two in step when either changes.
// Status values: 'done' | 'now' | 'next' | 'blocked'.

export const UPDATED = 'Oct 8, 2026'
export const ONBOARDING = '2026-10-14T10:30:00-04:00'   // Wed Oct 14, after the midterm, IB 120
export const REPO = 'https://github.com/Normega/psy240internal2026'

export const SUMMARY = [
  'A teaching trial, not research: PSY240 students consent, complete a baseline survey, are randomized to one of three 28-day arms, repeat the wellbeing measures after day 28, and are debriefed. The class sees its own aggregate results on Dec 2. Data are never shared or published.',
  'Every arm is about five minutes a day: a stress and a mood slider, a practice of at most four minutes, the sliders again. Good enough, not polished.',
]

export const ARMS = [
  { name: 'Sense Foraging', what: 'The Sense Foraging Foundations calendar, in a light version (a 3-minute practice) run inside the radlab session.', state: 'Course live; the light, embedded version is to build.', preview: 'https://senseforaging.com/preview/session?day=', days: 28 },
  { name: 'Nonreactivity', what: 'Liliana Study 3’s non-reactivity program re-cut as text: breath, body scan, five senses, decentering; repeats that never run unchanged; a choice on days 22–27; Graduation on day 28.', state: 'All 28 days written and rendering; not yet loaded into the database.', preview: '/dev/class-rct?arm=nr&day=', days: 28 },
  { name: 'Stress mindset', what: 'Liliana Study 3’s reappraisal program (Crum’s acknowledge, welcome, utilize) re-cut as text, with the same calendar shape.', state: 'All 28 days written and rendering; not yet loaded into the database.', preview: '/dev/class-rct?arm=sm&day=', days: 28 },
]

export const MILESTONES = [
  { when: 'Thu Oct 8', what: 'Plan, private repo, this tracker; decisions asked', status: 'done' },
  { when: 'Fri Oct 9', what: 'Controls loaded (56 modules); Sense Foraging light + embedded step; consent and debrief drafted', status: 'now' },
  { when: 'Sat Oct 10', what: 'Pre and post surveys; daily templates for 3 arms × 28 days', status: 'next' },
  { when: 'Sun Oct 11', what: 'The study: join link, consent, randomization, schedule, reminders, withdrawal, debrief', status: 'next' },
  { when: 'Mon Oct 12', what: 'Smoke test with fake participants in every arm; fix list', status: 'next' },
  { when: 'Mon–Tue', what: 'Norm previews every day of every arm', status: 'next' },
  { when: 'Tue Oct 13', what: 'Fixes, freeze, onboarding slide with the join QR', status: 'next' },
  { when: 'Wed Oct 14', what: 'Onboarding in class: consent, baseline, randomization, first session', status: 'next' },
  { when: 'Oct 15 or 21', what: 'Day 1 (decision D1)', status: 'next' },
  { when: 'Nov 4', what: 'In-class adherence check-in', status: 'next' },
  { when: 'Nov 11 or 17', what: 'Day 28 → post survey (one-week window) → debrief', status: 'next' },
  { when: 'Dec 2', what: 'In-class results: Day × Pre/Post × Arm', status: 'next' },
]

export const DECISIONS = [
  { id: 'D1', q: 'Day 1: Oct 15 (day 28 = Nov 11) or Oct 21 (day 28 = Nov 17)?', suggest: 'Oct 15, the day after onboarding.', status: 'open' },
  { id: 'D2', q: 'Sense Foraging’s dose: a light version (3-minute practice, radlab’s sliders instead of its own check-ins) to match the controls?', suggest: 'Yes.', status: 'open' },
  { id: 'D3', q: 'Delivery: Sense Foraging inside the radlab daily session (embedded, hands back when done), or a link out with “I’ve done it”?', suggest: 'Embedded; the link is the fallback.', status: 'open' },
  { id: 'D4', q: 'Which Sense Foraging questionnaire: sf-pool-5 (34 items, 7-point) or the REB-approved v1.2 (32 items, 1–6)?', suggest: 'Pool 5.', status: 'open' },
  { id: 'D5', q: 'Wellbeing set pre and post: SPANE (2 weeks), Flourishing, life satisfaction, PHQ-4, self-rated health?', suggest: 'Yes, ending with campus resources; the instructor sees aggregates only (PHQ-4 in identifiable students).', status: 'open' },
  { id: 'D6', q: 'Randomization 1:1:1, with Liliana Study 3 participants assigned to Sense Foraging?', suggest: 'Keep (decided Sep 28).', status: 'open' },
  { id: 'D7', q: 'What do students who decline do for the reflection assignment?', suggest: 'An alternative (e.g., a published RCT to reflect on), named in the consent form.', status: 'open' },
  { id: 'D8', q: 'Is participation worth marks, or only the reflection?', suggest: '—', status: 'open' },
]

export const CHECKLIST = [
  { group: 'Content', items: [
    { what: 'Nonreactivity: 28 days written (src/data/classRct/nonreactivity.js)', status: 'done' },
    { what: 'Stress mindset: 28 days written (src/data/classRct/reappraisal.js)', status: 'done' },
    { what: 'Norm’s review of nonreactivity days 8–28 and the stress-mindset lessons', status: 'next' },
    { what: 'Sense Foraging light version, embeddable, hands back when done', status: 'next' },
    { what: 'Consent form (teaching wording, continuing consent, alternative for decliners)', status: 'next' },
    { what: 'Debrief form, and campus resources after the surveys', status: 'next' },
  ] },
  { group: 'Surveys', items: [
    { what: 'Pre: demographics → Sense Foraging questionnaire → SPANE → Flourishing → life satisfaction → PHQ-4 → self-rated health', status: 'next' },
    { what: 'New questionnaire psy240-life-satisfaction (the one item, not the UTMAP bundle)', status: 'next' },
    { what: 'Daily stress and mood sliders, before and after', status: 'next' },
    { what: 'Post: Sense Foraging questionnaire + wellbeing + enjoyed / helped / would continue / what stood out', status: 'next' },
  ] },
  { group: 'Build on radlab.zone', items: [
    { what: 'Load classrct-nr-d01…d28 and classrct-ra-d01…d28 into intervention_modules', status: 'next' },
    { what: 'A sense_foraging step type in radlab sessions', status: 'next' },
    { what: 'Session templates: pre, post, 84 daily (generated)', status: 'next' },
    { what: 'Study: open join link, consent, randomization (Study 3 → Sense Foraging), 28-day schedule, daily reminder, withdrawal without adherence emails, debrief', status: 'next' },
    { what: 'Smoke test with fake participants; remove them before launch', status: 'next' },
  ] },
  { group: 'Class', items: [
    { what: 'Onboarding slide: what happens, the join QR, “bring the device you’ll practise on”', status: 'next' },
    { what: 'Nov 4 adherence check-in', status: 'next' },
    { what: 'Dec 2 results deck (adapt the 2025 “RCT Initial Results” slides)', status: 'next' },
  ] },
]
