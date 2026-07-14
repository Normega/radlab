// Ripple login greeting template matrix.
// greetingFor({ compositeLabel, streakDays, daysSinceLast, arousalTrend })
//   → { headline, sub }
//
// Guardrails (§5 of ripple_spec.md):
//   - mood-valence-neutral: all states get equal warmth, no "bad mood" framing
//   - non-punitive: gaps are never framed as failures or absences
//   - no guilt, no neediness, no streak-shaming

const QUADRANT = {
  excited:  'energized',
  happy:    'energized',
  content:  'settled',
  calm:     'settled',
  sad:      'low',
  bored:    'low',
  tense:    'on_edge',
  stressed: 'on_edge',
  neutral:  'neutral',
}

// Subtitles for gap returns — reference last emotional state, invite reflection
const SUB_GAP = {
  energized: ['Ready for your next challenge?',  'Still have that energy?'],
  settled:   ['Carrying that ease with you?',    'Still feeling grounded?'],
  low:       ['Feeling any better?',             'How are you holding up?'],
  on_edge:   ['Things settled down a bit?',      'How are you doing now?'],
  neutral:   ['How are you feeling today?',      'What are you bringing today?'],
}

// Subtitles for active streaks — forward-looking, reinforce the rhythm
const SUB_STREAK = {
  energized: ['Riding the wave.',              'Still going strong.'],
  settled:   ['Holding steady.',               'Grounded and consistent.'],
  low:       ['Showing up even on hard days.', 'Here anyway. That matters.'],
  on_edge:   ['Still here. That counts.',      'Showing up despite the pressure.'],
  neutral:   ['Another day of noticing.',      'Check in and see where you land.'],
}

// Stable within a calendar day — same pick for a given user all day, changes daily
function daySeed() {
  return Math.floor(Date.now() / 86400000)
}

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length]
}

/**
 * @param {string|null} compositeLabel  — composite_label from last ripple_checkin
 * @param {number}      streakDays      — ripples.streak_current
 * @param {number|null} daysSinceLast   — null = never checked in, 0 = today, 1 = yesterday, etc.
 * @param {'high'|'low'|'neutral'} arousalTrend — derived from mean composite_y of last 7 check-ins
 *   (in the circumplex data, composite_y < 0 = high arousal; composite_y > 0 = low arousal)
 * @returns {{ headline: string, sub: string }}
 */
export function greetingFor({ compositeLabel, streakDays, daysSinceLast, arousalTrend }) {
  const seed = daySeed()
  const q = QUADRANT[compositeLabel?.toLowerCase()] ?? 'neutral'

  // ── Never checked in ──────────────────────────────────────────────────────
  if (daysSinceLast == null) {
    return {
      headline: 'Ready to meet yourself?',
      sub: 'Your first check-in takes about 30 seconds.',
    }
  }

  // ── Streak milestone (7 / 14 / 30) while streak is live ──────────────────
  // Arousal trend modulates whether the headline is energetic or understated
  if (daysSinceLast <= 1) {
    const milestone = [30, 14, 7].find(m => streakDays === m)
    if (milestone) {
      const headline = arousalTrend === 'high'
        ? `${milestone} days in a row. Let's go.`
        : arousalTrend === 'low'
          ? `${milestone} days in a row. Quietly consistent.`
          : `${milestone} days in a row.`
      return { headline, sub: pick(SUB_STREAK[q], seed) }
    }
  }

  // ── Already checked in today (non-milestone) ──────────────────────────────
  if (daysSinceLast === 0) {
    return pick([
      { headline: "You're all set today.", sub: 'Come back tomorrow to keep going.' },
      { headline: "You're checked in.",    sub: 'See you again tomorrow.' },
    ], seed)
  }

  // ── Streak continuing (last check-in was yesterday) ───────────────────────
  if (daysSinceLast === 1) {
    return {
      headline: pick(['Good to see you.', "You're back.", 'Here again.'], seed),
      sub: pick(SUB_STREAK[q], seed),
    }
  }

  // ── Short gap (2–6 days) ──────────────────────────────────────────────────
  if (daysSinceLast <= 6) {
    return {
      headline: pick(['Good to see you.', 'Welcome back.'], seed),
      sub: pick(SUB_GAP[q], seed),
    }
  }

  // ── Long gap (7+ days) ────────────────────────────────────────────────────
  return {
    headline: pick(['Good to have you back.', 'Good to see you again.'], seed),
    sub: pick(SUB_GAP[q], seed),
  }
}
