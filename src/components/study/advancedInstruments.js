// ── Advanced instrument registry ─────────────────────────────────────────────
// POLICY: every bespoke (coded-in-React, non-JSON) instrument that collects
// participant data must have an entry here. This registry drives the
// "Advanced" tab of the admin Questionnaire Library (QuestionnairesPage) and
// the per-instrument preview route (/admin/questionnaires/advanced/:key), so
// nothing lives only in the codebase where it can be forgotten.
//
// `key` is the activities.subcategory for category='form' instruments —
// StepDispatcher.jsx dispatches on it. `load` lazy-imports the component so
// the admin library page doesn't pull participant step code into its chunk.
//
// previewable: false entries are still listed (visibility is the point) with
// a note explaining how to review them instead.

export const ADVANCED_INSTRUMENTS = [
  {
    key: 'demographics',
    name: 'Standard Demographics',
    description: 'Age, gender (free text), racialized identity, and perceived socioeconomic status (MacArthur ladder).',
    source: 'src/components/study/DemographicsStep.jsx',
    table: 'demographics',
    previewable: true,
    load: () => import('./DemographicsStep'),
  },
  {
    key: 'equity_census',
    name: 'U of T Student Equity Census',
    description: 'Full 2025–2026 U of T Student Equity Census plus a leading numeric age question: age, gender identity, trans identity, sexual orientation, disability, Indigenous identity, racial/ethnocultural identity, religion, parental education, feedback. Every census question offers "Prefer not to answer"; age requires a numeric entry. Maximally sensitive wording — may be overkill for some studies; prefer Standard Demographics unless equity reporting requires it.',
    source: 'src/components/study/EquityCensusStep.jsx',
    table: 'equity_census_responses',
    previewable: true,
    load: () => import('./EquityCensusStep'),
  },
  {
    key: 'compensation',
    name: 'Compensation Form',
    description: 'End-of-session compensation election: e-transfer email or SONA credit ID. Submissions are reviewed at /admin/compensation.',
    source: 'src/components/study/CompensationStep.jsx',
    table: 'participant_compensation',
    previewable: true,
    load: () => import('./CompensationStep'),
  },
  {
    key: 'mood_checkin',
    name: 'Mood Check-in (Self-Monitoring)',
    description: 'Zerin study daily touchpoint — 1–7 mood rating + Better/Worse/Same vs. the previous check. Day and time slot come from the schedule; one widget serves all three daily slots.',
    source: 'src/components/study/MoodCheckinStep.jsx',
    table: 'zerin_daily_checkins',
    previewable: true,
    load: () => import('./MoodCheckinStep'),
  },
  {
    key: 'mood_checkin_reflective',
    name: 'Mood Check-in (Reflective)',
    description: 'Zerin study daily touchpoint — the Self-Monitoring check-in plus a short free-text reason (the reflective-processing manipulation).',
    source: 'src/components/study/MoodCheckinStep.jsx',
    table: 'zerin_daily_checkins',
    previewable: true,
    load: () => import('./MoodCheckinStep'),
  },
  {
    key: 'wellness_tip',
    name: 'Daily Wellness Tip (Control)',
    description: 'Zerin study Attention-Control touchpoint — a day/slot-specific wellness tip + acknowledge step, matching contact time across arms without collecting mood data. 21-day × 3-slot script baked in.',
    source: 'src/components/study/WellnessTipStep.jsx',
    table: 'zerin_daily_checkins',
    previewable: true,
    load: () => import('./WellnessTipStep'),
  },
  {
    key: 'debrief',
    name: 'Debrief',
    description: 'Renders the debrief HTML defined per-study. Review its content on the study edit page.',
    source: 'src/components/study/DebriefStep.jsx',
    table: null,
    previewable: false,
  },
  {
    key: 'midpoint',
    name: 'Midpoint Check-in',
    description: 'Mid-session check-in step. Requires live session context; review in a simulated session run.',
    source: 'src/components/study/MidpointStep.jsx',
    table: null,
    previewable: false,
  },
  {
    key: 'belt_setup',
    name: 'Physio Belt Setup',
    description: 'Breath-belt hardware setup and signal check. Requires a connected belt; review in a simulated session run.',
    source: 'src/components/study/PhysioSetupStep.jsx',
    table: null,
    previewable: false,
  },
]

export function getAdvancedInstrument(key) {
  return ADVANCED_INSTRUMENTS.find(i => i.key === key) ?? null
}
