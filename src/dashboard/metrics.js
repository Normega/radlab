// ── Check-in metrics ──────────────────────────────────────────────────────────
// Pure functions over `ripple_checkins` rows. No React, no supabase, so the
// maths can be read and checked on its own.
//
// THE TWO RATINGS ARE ALREADY THE TWO DIAGONALS. computeRating() in
// games/StillWater/constants.js locks each phase to one diagonal of the
// circumplex:
//
//   pos_rating 1..7  "How good or energised do you feel?"   Sad ↔ Excited  (y =  x)
//   neg_rating 1..7  "How settled or on-edge do you feel?"  Calm ↔ Tense   (y = -x)
//
// which is to say they ARE positive activation and negative activation, measured
// directly rather than derived. 4 is neutral on both, so centring and scaling by
// 3 puts each on [-1, 1]. Everything below is built from those two numbers.
//
// AROUSAL SIGN (the thing that was wrong on the old dashboard): in stored data
// composite_y is POSITIVE for high arousal — verified against live rows, where
// `Alert` sits at +0.50 and `Excited` at +0.33. getCompositeLabel() reads it with
// atan2 in maths convention (y up). SVG y grows downward, so any renderer must
// negate it: y = centre - composite_y * R. Forgetting that draws an alert
// check-in in the corner labelled "calm".

export const paOf = r => (r.pos_rating - 4) / 3   // -1 = sad,  +1 = excited
export const naOf = r => (r.neg_rating - 4) / 3   // -1 = calm, +1 = tense

export const hasRatings = r => r?.pos_rating != null && r?.neg_rating != null

// ── Time windows ──────────────────────────────────────────────────────────────
// halfLife is the recency half-life in days used for the weighted means: a
// check-in that old counts half as much as today's. It scales with the window,
// because "recent" inside a 24-hour view is not "recent" inside a year.

export const WINDOWS = [
  { id: 'all',   label: 'Any time',    days: null, halfLife: 30 },
  { id: '24h',   label: 'Past 24 hrs', days: 1,    halfLife: 0.5 },
  { id: 'week',  label: 'Past week',   days: 7,    halfLife: 2 },
  { id: 'month', label: 'Past month',  days: 30,   halfLife: 7 },
  { id: 'year',  label: 'Past year',   days: 365,  halfLife: 30 },
]

export const windowById = id => WINDOWS.find(w => w.id === id) ?? WINDOWS[0]

// local_date is a plain 'YYYY-MM-DD' calendar date, so compare at midnight and
// never through Date parsing of the timestamp — that would drag the user's
// timezone into a number that is meant to be whole days.
export function dayKey(date = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function daysAgo(localDate, today = dayKey()) {
  const a = new Date(today + 'T00:00:00')
  const b = new Date(localDate + 'T00:00:00')
  return Math.round((a - b) / 86_400_000)
}

export function filterWindow(rows, windowId, today = dayKey()) {
  const w = windowById(windowId)
  if (w.days == null) return rows
  return rows.filter(r => daysAgo(r.local_date, today) < w.days)
}

// ── Recency-weighted mean ─────────────────────────────────────────────────────
// A flat mean assumes check-ins arrive on a regular schedule. They do not — the
// real pattern is clumps and gaps — so weight by exponential decay on age.

export function recencyWeightedMean(rows, valueOf, halfLife, today = dayKey()) {
  let num = 0, den = 0
  for (const r of rows) {
    const v = valueOf(r)
    if (v == null || Number.isNaN(v)) continue
    const w = Math.pow(0.5, daysAgo(r.local_date, today) / halfLife)
    num += w * v
    den += w
  }
  return den === 0 ? null : num / den
}

// ── Ambivalence ───────────────────────────────────────────────────────────────
// NOT the stored `ambivalence_mag` column. That one is the distance between the
// two picks, √2·√(t₁²+t₂²), which is really an INTENSITY: a 7-positive /
// 3-negative check-in — maximally good, not tense at all — scores 1.49 on it,
// the highest in the data. It does not measure "high on both".
//
// This is Griffin's ambivalence formula over the two positive parts: the average
// of the two intensities, penalised by how far apart they are. It peaks only when
// both dimensions are elevated AND similar, which is the mixed-feelings construct.
// Raw range is [-0.5, 1]; negatives mean "clearly one and not the other", so they
// clamp to 0 for display.

export function ambivalenceOf(r) {
  const p = Math.max(0, paOf(r))
  const n = Math.max(0, naOf(r))
  return (p + n) / 2 - Math.abs(p - n)
}

// Clamp PER ROW, before averaging. Averaging the raw score and clamping the mean
// looks equivalent and is not: a clearly one-sided check-in scores -0.5, so a
// person who is usually decisively one thing averages negative and every window
// collapses to a flat 0. Clamping first makes a one-sided day contribute nothing
// rather than actively cancelling out the mixed ones, which is the question being
// asked — how mixed do you get, not how one-sided are you on balance.
export const mixednessOf = r => Math.max(0, ambivalenceOf(r))

// ── Volatility ────────────────────────────────────────────────────────────────
// Mean absolute change in positive activation between consecutive check-ins —
// affective instability. Deliberately NOT divided by the gap between them: two
// check-ins a week apart differing wildly is not the same evidence as two on
// consecutive days, but normalising by gap makes a long gap look calm, which is
// worse. Reported alongside the gap-aware caveat in the UI copy.

export function volatility(rows) {
  const usable = rows.filter(hasRatings).slice().sort((a, b) => a.local_date.localeCompare(b.local_date))
  if (usable.length < 2) return null
  let total = 0
  for (let i = 1; i < usable.length; i++) total += Math.abs(paOf(usable[i]) - paOf(usable[i - 1]))
  return total / (usable.length - 1)
}

// ── Intention follow-through ──────────────────────────────────────────────────
// prev_intention_outcome is written at the NEXT check-in, judging the intention
// set at the previous one. Collected since WP4 and never surfaced anywhere.

export function followThrough(rows) {
  const counts = { did: 0, partly: 0, not_today: 0 }
  for (const r of rows) if (r.prev_intention_outcome in counts) counts[r.prev_intention_outcome]++
  const total = counts.did + counts.partly + counts.not_today
  return total === 0 ? null : { ...counts, total, rate: (counts.did + 0.5 * counts.partly) / total }
}

// ── Sector distribution ───────────────────────────────────────────────────────
// The 8 labels come from getCompositeLabel(); 'neutral' is the dead zone inside
// r < 0.15. Colours follow the four quadrant families already used across the
// app rather than inventing a ninth palette.

export const SECTORS = ['Good', 'Excited', 'Alert', 'Tense', 'Bad', 'Sad', 'Still', 'Calm']

export const SECTOR_COLOR = {
  Good:    '#f068a4', Excited: '#f068a4',   // pleasant
  Alert:   '#9b6bb5', Tense:   '#9b6bb5',   // activated
  Bad:     '#4888cc', Sad:     '#4888cc',   // unpleasant
  Still:   '#2a9d8f', Calm:    '#2a9d8f',   // settled
  neutral: '#a8a4b0',
}

export function sectorWeights(rows, halfLife, today = dayKey()) {
  const out = {}
  let max = 0
  for (const r of rows) {
    const key = r.composite_label ?? 'neutral'
    const w = Math.pow(0.5, daysAgo(r.local_date, today) / halfLife)
    out[key] = (out[key] ?? 0) + w
    if (out[key] > max) max = out[key]
  }
  return { weights: out, max }
}

// Returns null unless some label actually repeats. With three check-ins that are
// three different moods there is no "most often", and picking the first of a
// three-way tie presents a single occurrence as a pattern.
export function modeLabel(rows) {
  const counts = {}
  for (const r of rows) if (r.composite_label) counts[r.composite_label] = (counts[r.composite_label] ?? 0) + 1
  const [top] = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return top && top[1] >= 2 ? top[0] : null
}

// ── Time of day ───────────────────────────────────────────────────────────────
// created_at carries the clock time the check-in was submitted, which nothing has
// ever read. Buckets match the reminder windows the Edge Function already uses.

export const TIME_BUCKETS = [
  { id: 'morning', label: 'Morning', from: 5,  to: 12 },
  { id: 'midday',  label: 'Midday',  from: 12, to: 17 },
  { id: 'evening', label: 'Evening', from: 17, to: 22 },
  { id: 'night',   label: 'Night',   from: 22, to: 5  },
]

export function timeOfDayProfile(rows) {
  const out = TIME_BUCKETS.map(b => ({ ...b, count: 0, paSum: 0 }))
  for (const r of rows) {
    if (!r.created_at) continue
    const h = new Date(r.created_at).getHours()
    const b = out.find(x => (x.from < x.to ? h >= x.from && h < x.to : h >= x.from || h < x.to))
    if (!b) continue
    b.count++
    if (hasRatings(r)) b.paSum += paOf(r)
  }
  const total = out.reduce((s, b) => s + b.count, 0)
  return total === 0 ? null : out.map(b => ({ ...b, meanPa: b.count ? b.paSum / b.count : null, share: b.count / total }))
}

// ── Calendar cells ────────────────────────────────────────────────────────────
// One entry per calendar day across the span, most recent last, with the day's
// check-in attached if there is one. Days without a check-in are kept — the gaps
// are the honest part of the picture.

export function calendarDays(rows, windowId, today = dayKey()) {
  const w = windowById(windowId)
  const byDate = new Map()
  for (const r of rows) byDate.set(r.local_date, r)

  let span = w.days
  if (span == null) {
    // "Any time" spans from the first check-in, not from a fixed window — with a
    // two-week floor so a brand-new user still gets a strip rather than one cell.
    // A larger floor back-fills empty days from before the account existed.
    const oldest = rows.reduce((m, r) => (r.local_date < m ? r.local_date : m), today)
    span = Math.max(14, daysAgo(oldest, today) + 1)
  }
  span = Math.min(span, 371)  // a year of week columns is the most we ever draw

  const out = []
  const base = new Date(today + 'T00:00:00')
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    const key = dayKey(d)
    out.push({ date: key, weekday: d.getDay(), row: byDate.get(key) ?? null })
  }
  return out
}

// Magnitude of the composite position, used for cell intensity. Falls back to
// the ratings when composite_x/y are missing.
export function intensityOf(r) {
  if (r.composite_x != null && r.composite_y != null) {
    return Math.min(1, Math.sqrt(r.composite_x ** 2 + r.composite_y ** 2))
  }
  if (!hasRatings(r)) return 0
  return Math.min(1, Math.sqrt(paOf(r) ** 2 + naOf(r) ** 2) / Math.SQRT2)
}

// ── Summary ───────────────────────────────────────────────────────────────────
// One call that produces everything the Emotion tab renders, so the component
// stays a renderer and this stays the place where the numbers are decided.

export function emotionSummary(allRows, windowId, today = dayKey()) {
  const w    = windowById(windowId)
  const rows = filterWindow(allRows, windowId, today)
  const rated = rows.filter(hasRatings)

  return {
    window:      w,
    rows,
    rated,
    count:       rows.length,
    pa:          recencyWeightedMean(rated, paOf, w.halfLife, today),
    na:          recencyWeightedMean(rated, naOf, w.halfLife, today),
    ambivalence: recencyWeightedMean(rated, mixednessOf, w.halfLife, today),
    mixedCount:  rated.filter(r => ambivalenceOf(r) > 0).length,
    ratedCount:  rated.length,
    volatility:  volatility(rated),
    follow:      followThrough(rows),
    sectors:     sectorWeights(rows, w.halfLife, today),
    mode:        modeLabel(rows),
    timeOfDay:   timeOfDayProfile(rows),
    days:        calendarDays(rows, windowId, today),
  }
}
