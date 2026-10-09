// The calendar a held baseline gates, when that calendar is fixed (2026-10-09).
//
// A `hold` entry session is re-sent daily until it is completed (check_schedule,
// HOLD SESSIONS in materializeSchedule). Its re-send copy said the daily part
// "begins the day after you complete it", which is true of a relative calendar
// (Liliana Study 3) and false of a fixed one, where day 1 is a date for
// everyone and a late joiner starts wherever the calendar is (the PSY240 class
// trial: day 1 = Oct 17). For a graph with fixed-date timepoints this returns
// the first day's date and how many of its days have already gone by, so the
// copy can say so ("you've missed 3 days so far"). Null for any graph without
// a fixed date, which keeps every other study's copy exactly as it was.

interface GraphLike {
  nodes?: Array<{ type?: string; timing?: string; fixed_date?: string | null }>
}

export interface HoldCalendar {
  starts: string        // "Saturday, October 17"
  days_passed: number   // calendar days already gone by, before today; 0 on or before day 1
}

const DAY_MS = 86_400_000

export function holdCalendar(graph: GraphLike | null | undefined, today: string): HoldCalendar | null {
  const dates = (graph?.nodes ?? [])
    .filter((n) => n?.type === 'timepoint' && n.timing === 'fixed' && typeof n.fixed_date === 'string')
    .map((n) => n.fixed_date as string)
    .sort()
  if (dates.length === 0) return null
  const first = dates[0]
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / DAY_MS)
  const starts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(`${first}T12:00:00Z`))
  return { starts, days_passed: Math.max(0, days) }
}
