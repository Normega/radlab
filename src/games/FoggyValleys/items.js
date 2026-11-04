// Ratings asked inside the game, worded exactly as in the Study 4 prototype.
// CORE is the set asked at every time point; VALLEY items only after each valley.
// Stress uses the platform's own item. The two emotionality sliders are
// placeholders for the platform's Study 3 sliders, whose wording a study build
// must copy exactly. Calm, motivation and alertness use the wording in Sandy's
// Study_Flow_for_Norm.md.
//
// These run in the preview only. A study session asks its ratings with the
// platform's own rating steps between the valleys, so they save to the same
// tables as every other rating (see FoggyValleys.jsx, studyMode).

export const CORE = [
  { id: 'stress', type: 'six', q: 'Right now, how stressed are you feeling?', anchors: ['Not at all stressed', 'Slightly stressed', 'Somewhat stressed', 'Moderately stressed', 'Very stressed', 'Extremely stressed'] },
  { id: 'negative_emotionality', type: 'slider', q: 'Negative emotionality', placeholder: true, lo: '0', hi: '100' },
  { id: 'positive_emotionality', type: 'slider', q: 'Positive emotionality', placeholder: true, lo: '0', hi: '100' },
  { id: 'calm', type: 'slider', q: 'How calm or relaxed do you feel right now?', lo: 'Not at all calm', hi: 'Extremely calm' },
  { id: 'motivation', type: 'slider', q: 'How motivated are you to do well on this task?', lo: 'Not at all motivated', hi: 'Extremely motivated' },
  { id: 'alertness', type: 'slider', q: 'How alert or energetic do you feel right now?', lo: 'Not at all alert', hi: 'Extremely alert' },
]

export const VALLEY = [
  { id: 'bother_moving_on', type: 'slider', q: 'How much did it bother you to move on from pictures before you had found every difference?', lo: 'Not at all', hi: 'Extremely' },
  { id: 'enjoyment', type: 'six', q: 'How enjoyable did you find this valley?', anchors: ['Not at all enjoyable', 'Slightly enjoyable', 'Somewhat enjoyable', 'Moderately enjoyable', 'Very enjoyable', 'Extremely enjoyable'] },
]
