// /psy240trial: the PSY240 teaching trial's launch tracker (Norm, Oct 8 2026).
// Content only; Psy240Trial.jsx is layout. The source of truth is PLAN.md in the
// private repo Normega/psy240internal2026; keep the two in step when either changes.
// Status values: 'done' | 'now' | 'next' | 'blocked'.

export const UPDATED = 'Oct 8, 2026'
export const ONBOARDING = '2026-10-14T10:30:00-04:00'   // Wed Oct 14, after the midterm, IB 120
export const REPO = 'https://github.com/Normega/psy240internal2026'

export const SUMMARY = [
  'A teaching trial, not research: PSY240 students consent, complete a baseline survey, are randomized to one of three 28-day arms, repeat the wellbeing measures after day 28, and are debriefed. The class sees its own aggregate results on Dec 2. Data are never shared or published.',
  'Every arm is about five minutes a day: stress and mood on six faces, a practice of about three minutes, the same two ratings again, and one line inviting the practice into the rest of the day. Good enough, not polished.',
]

export const ARMS = [
  { name: 'Sense Foraging', what: 'The Sense Foraging Foundations calendar, in a light version: the same practice each day, run for 3 minutes, inside the radlab session, ending with a one-line Quest.', state: 'Course live; the light, embedded version is to build.', preview: 'https://senseforaging.com/preview/session?day=', days: 28 },
  { name: 'Nonreactivity', what: 'Liliana Study 3’s non-reactivity program re-cut as text: breath, body scan, five senses, decentering; repeats that never run unchanged; a choice on days 22–27; Graduation on day 28.', state: 'All 28 days written and rendering; not yet loaded into the database.', preview: '/dev/class-rct?arm=nr&day=', days: 28 },
  { name: 'Stress mindset', what: 'Liliana Study 3’s reappraisal program (Crum’s acknowledge, welcome, utilize) re-cut as text, with the same calendar shape.', state: 'All 28 days written and rendering; not yet loaded into the database.', preview: '/dev/class-rct?arm=sm&day=', days: 28 },
]

export const MILESTONES = [
  { when: 'Thu Oct 8', what: 'Plan, private repo, this tracker; decisions D1–D8 settled with Norm', status: 'done' },
  { when: 'Fri Oct 9', what: 'Controls loaded (56 modules); Sense Foraging light + embedded step; consent and debrief drafted', status: 'now' },
  { when: 'Sat Oct 10', what: 'Pre and post surveys; daily templates for 3 arms × 28 days', status: 'next' },
  { when: 'Sun Oct 11', what: 'The study: join link, consent, randomization, schedule, reminders, withdrawal, debrief', status: 'next' },
  { when: 'Mon Oct 12', what: 'Smoke test with fake participants in every arm; fix list', status: 'next' },
  { when: 'Mon–Tue', what: 'Norm previews every day of every arm', status: 'next' },
  { when: 'Tue Oct 13', what: 'Fixes, freeze, onboarding slide with the join QR', status: 'next' },
  { when: 'Wed Oct 14', what: '10:55 join email; Norm guides the class through consent and baseline; Quercus announcement after class', status: 'next' },
  { when: 'Thu–Fri Oct 15–16', what: 'Baseline reminder, then last call (baseline closes Fri night; late joiners still welcome)', status: 'next' },
  { when: 'Sat Oct 17', what: 'Day 1 for everyone', status: 'next' },
  { when: 'Nov 4', what: 'In-class adherence check-in', status: 'next' },
  { when: 'Fri Nov 13', what: 'Day 28', status: 'next' },
  { when: 'Nov 14–16', what: 'Post assessment (3 days)', status: 'next' },
  { when: 'Wed Nov 18', what: 'Debrief, reflections and the class’s results', status: 'next' },
]

export const DECISIONS = [
  { id: 'D1', q: 'The schedule', decided: 'Join email Oct 14 10:55; baseline reminders Oct 15 and 16; day 1 Sat Oct 17 for everyone; day 28 Nov 13; post Nov 14–16; debrief Nov 18. Fixed window (missed days count, the count moves on). Baseline is a hard gate; late finishers join on the calendar’s current day.', status: 'decided' },
  { id: 'D2', q: 'The dose, matched', decided: 'Every arm: stress and mood on six faces, before and after. Sense Foraging runs 3 minutes of practice (the day’s own practice, cut short; no wheel or hand) and ends with a one-line Quest, with no follow-up. The controls end with a matching line inviting that day’s practice into the rest of the day.', status: 'decided' },
  { id: 'D3', q: 'Delivery', decided: 'Embedded: every arm runs the same way, one radlab link a day. Sense Foraging’s practice runs full-screen inside the radlab session and hands back when done (finished, and how long it ran); an “open in a new tab” link inside the step is the fallback. No senseforaging.com account.', status: 'decided' },
  { id: 'D4', q: 'The arms’ own measures', decided: 'One measure allied with each arm: Sense Foraging, sf-pool-5 (34 items); Nonreactivity, the MPoD-t (15 items, with a nonreactivity facet; a copy, since Study 3 uses the original); Stress mindset, Crum’s Stress Mindset Measure (8 items). The wellbeing scales are the arm-neutral outcomes.', status: 'decided' },
  { id: 'D5', q: 'The wellbeing set', decided: 'SPANE (2 weeks), Flourishing, life satisfaction (Study 3’s six-face item, reused), PHQ-4, self-rated health, pre and post. Everyone sees the support resources (UTMAP 2026’s sheet) at the end of each survey, on withdrawal and in the debrief, with a Support link in every trial email. Nobody reads individual rows; the export is de-identified first.', status: 'decided' },
  { id: 'D6', q: 'Randomization', decided: '1:1:1 in shuffled blocks of three (radlab’s own draw), at the moment baseline is submitted. Study 3 students (9 today, matched by email) go to Sense Foraging outside the blocks, flagged, so Nov 18 can show results with and without them. Arm names stay out of the emails and consent; arms and hypotheses revealed at the debrief.', status: 'decided' },
  { id: 'D7', q: 'Students who decline or withdraw', decided: 'Participation credit moves, at the same weight, to an alternative: a 2.5–3 page proposal for a daily practice to improve students’ mental health (thesis and argument, no citations). Its prompts ask why students might not take a practice up, never why the writer chose not to. Everyone writes the RCT reflection. Due date to set.', status: 'decided' },
  { id: 'D8', q: 'Credit', decided: 'Participation earns credit; opting out or withdrawing transfers it to the alternative, so stopping never costs marks. Proposed: credit for taking part (consent, baseline, not withdrawn), not for days completed.', status: 'decided' },
]

export const CHECKLIST = [
  { group: 'Content', items: [
    { what: 'Nonreactivity: 28 days written (src/data/classRct/nonreactivity.js)', status: 'done' },
    { what: 'Stress mindset: 28 days written (src/data/classRct/reappraisal.js)', status: 'done' },
    { what: 'Norm’s review of nonreactivity days 8–28 and the stress-mindset lessons', status: 'next' },
    { what: 'Sense Foraging light version: 3-minute practice, no wheel or hand, a one-line Quest; embeddable, hands back when done', status: 'next' },
    { what: 'Controls: a one-line “for the rest of today” invitation on all 56 days, from that day’s practice', status: 'next' },
    { what: 'Consent form (teaching wording, continuing consent, the alternative assignment)', status: 'next' },
    { what: 'Alternative assignment drafted (forms/alternative_assignment.md); due date and Quercus assignment to set', status: 'now' },
    { what: 'Opt-out list from Norm, marked in the roster so the join email skips them', status: 'next' },
    { what: 'Debrief form', status: 'next' },
    { what: 'Support resources: drafted from UTMAP’s sheet (forms/support_resources.md); shown at the end of each survey, on withdrawal, in the debrief; Support link in every trial email. Inherits UTMAP’s phone sign-off', status: 'now' },
  ] },
  { group: 'Surveys', items: [
    { what: 'Pre: demographics → the three arms’ measures (sf-pool-5, MPoD-t, SMM) → SPANE → Flourishing → life satisfaction → PHQ-4 → self-rated health (about 17 minutes)', status: 'next' },
    { what: 'New questionnaires psy240-mpod-t (copy of mpod-t, neutral instructions) and smm-8 (Crum 2013; 0–4, items 1, 3, 5, 7 reversed)', status: 'next' },
    { what: 'Daily stress (Study 3’s item) and mood (new, six faces), before and after', status: 'next' },
    { what: 'Post: the three arms’ measures + wellbeing + enjoyed / helped / would continue / what stood out', status: 'next' },
  ] },
  { group: 'Build on radlab.zone', items: [
    { what: 'Scheduler: a fixed calendar start (day 1 = Oct 17 whenever baseline was done; late joiners anchored to the calendar)', status: 'next' },
    { what: 'Baseline reminders that count missed days, until done', status: 'next' },
    { what: 'Load test: 250 fake students through consent and baseline', status: 'next' },
    { what: 'Load classrct-nr-d01…d28 and classrct-ra-d01…d28 into intervention_modules', status: 'next' },
    { what: 'A sense_foraging step type in radlab sessions', status: 'next' },
    { what: 'Session templates: pre, post, 84 daily (generated)', status: 'next' },
    { what: 'Study: open join link, consent, randomization (blocks of three; Study 3 → Sense Foraging by email, outside the blocks, flagged), 28-day schedule, daily reminder, withdrawal without adherence emails, debrief', status: 'next' },
    { what: 'Emails and consent name no arm (“today’s practice”); arms revealed at the debrief', status: 'next' },
    { what: 'Smoke test with fake participants; remove them before launch', status: 'next' },
  ] },
  { group: 'Class', items: [
    { what: 'Onboarding slide: what happens, the join QR, “your first practice arrives Saturday”', status: 'next' },
    { what: 'Quercus announcement after class (drafted: forms/quercus_announcement_oct14.md)', status: 'now' },
    { what: 'Nov 4 adherence check-in', status: 'next' },
    { what: 'Dec 2 results deck (adapt the 2025 “RCT Initial Results” slides)', status: 'next' },
  ] },
]
