// Ratings asked inside the game, worded exactly as in the Study 4 prototype.
// CORE is the set asked at every time point; VALLEY items only after each valley
// (the past-tense motivation and performance items too, so "before you start"
// never asks about a task not yet done).
// Updated 2026-11-12 to Study 4's revised wording (stress 0-100, no alertness,
// past-tense motivation, performance relative to other people). The two emotionality sliders are
// placeholders for the platform's Study 3 sliders, whose wording a study build
// must copy exactly. Calm and motivation follow the wording in Sandy's
// Study_Flow_for_Norm.md.
//
// These run in the preview only. A study session asks its ratings with the
// platform's own rating steps between the valleys, so they save to the same
// tables as every other rating (see FoggyValleys.jsx, studyMode).

export const CORE = [
  { id: 'stress', type: 'slider', q: 'Right now, how stressed are you feeling?', lo: 'Not at all stressed', hi: 'Extremely stressed' },
  { id: 'negative_emotionality', type: 'slider', q: 'Negative emotionality', placeholder: true, lo: '0', hi: '100' },
  { id: 'positive_emotionality', type: 'slider', q: 'Positive emotionality', placeholder: true, lo: '0', hi: '100' },
  { id: 'calm', type: 'slider', q: 'How calm or relaxed do you feel right now?', lo: 'Not at all calm', hi: 'Extremely calm' },
]

export const VALLEY = [
  { id: 'motivation', type: 'slider', q: 'How motivated were you to do well on this task?', lo: 'Not at all motivated', hi: 'Extremely motivated' },
  { id: 'performance', type: 'slider', q: 'How well do you think you performed on this task relative to other people?', lo: 'Much worse than others', hi: 'Much better than others' },
  { id: 'bother_moving_on', type: 'slider', q: 'How much did it bother you to move on from pictures before you had found every difference?', lo: 'Not at all', hi: 'Extremely' },
  { id: 'enjoyment', type: 'six', q: 'How much did you enjoy looking for differences in this valley?', anchors: ['Not at all', 'Slightly', 'Somewhat', 'Moderately', 'Very much', 'Extremely'] },
]

// Asked after each picture that cleared (D4, 2026-11-05): why they moved on
// (only when they chose to, with Next picture), then the share of its
// differences they think they found. Only after that is submitted does the
// feedback screen show the true share and mark what was missed (D3, D7).
// Saved to foggy_valleys_picture_ratings; `id` is the value recorded.

export const MOVE_ON_QUESTION = 'Why did you move on from this picture?'
export const MOVE_ON_REASONS = [
  { id: 'found_all',   label: 'I thought I had found them all' },
  { id: 'no_more',     label: 'I could not find any more' },
  { id: 'better_use',  label: 'I thought a new picture was a better use of my time' },
  { id: 'tired_bored', label: 'I got tired or bored' },
  { id: 'other',       label: 'Something else' },
]
export const ESTIMATE_QUESTION = 'What share of the differences in this picture do you think you found?'
