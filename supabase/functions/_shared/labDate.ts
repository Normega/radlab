// Lab-local calendar date. Edge functions run in UTC, so
// `new Date().toISOString().split('T')[0]` rolls over to "tomorrow" at
// 8 PM Toronto (EDT) — an evening enrollee's whole schedule lands a day
// late. Anchor all scheduled_date math to the lab's time zone instead.

export const LAB_TIMEZONE = 'America/Toronto'

/** Today's date ('YYYY-MM-DD') in the lab's time zone. */
export function todayInLabTz(): string {
  // en-CA formats as YYYY-MM-DD directly.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LAB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
