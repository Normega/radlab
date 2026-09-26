// Pure logic for buddy_send — no I/O, so it runs under node's test runner too
// (logic.test.mjs). Everything here is about Toronto wall-clock time, because
// that is what "8:00 on a weekday" means to the student.

export const TZ = 'America/Toronto'

export type TorontoNow = { date: string; hour: number; isoDow: number }

const DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

export function torontoNow(now: Date): TorontoNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(now).map(p => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10),
    isoDow: DOW[parts.weekday],
  }
}

// Monday to Friday, 08:00–11:59. The cron fires hourly at :00, so the send
// normally goes at 8:00 and 9/10/11 are retry room for a failed send.
export function inSendWindow(t: TorontoNow): boolean {
  return t.isoDow >= 1 && t.isoDow <= 5 && t.hour >= 8 && t.hour <= 11
}

// paused_until is inclusive: no sends on or before that date.
export function isPaused(pausedUntil: string | null, today: string): boolean {
  return pausedUntil != null && today <= pausedUntil
}

export type Milestone = { position: number; title: string; target_date: string | null; done_at: string | null }

export function currentMilestone(ms: Milestone[]): Milestone | null {
  return [...ms].sort((a, b) => a.position - b.position).find(m => m.done_at == null) ?? null
}

// Milestones ticked off since the previous successful send. No previous send →
// nothing to celebrate (the first email is not a celebration).
export function newlyCompleted(ms: Milestone[], prevSentAt: string | null): Milestone[] {
  if (!prevSentAt) return []
  const since = new Date(prevSentAt).getTime()
  return [...ms]
    .filter(m => m.done_at != null && new Date(m.done_at).getTime() > since)
    .sort((a, b) => a.position - b.position)
}

// Quote rotation: a random pick among the active quotes this student has been
// sent the fewest times. Equivalent to "shuffle once, walk the list, reshuffle
// when exhausted" — no repeats until every quote has been used — but with no
// stored order to keep in sync when quotes are added or deactivated (a new
// quote has zero uses, so it goes to the front of the queue).
export function pickQuote<T extends { id: string }>(
  quotes: T[], uses: Map<string, number>, rand: () => number = Math.random,
): T | null {
  if (quotes.length === 0) return null
  const least = Math.min(...quotes.map(q => uses.get(q.id) ?? 0))
  const pool = quotes.filter(q => (uses.get(q.id) ?? 0) === least)
  return pool[Math.floor(rand() * pool.length)] ?? pool[0]
}

// "Fri Oct 2, 3:00 pm"
export function formatMeeting(iso: string): string {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })
    .format(d).replace(',', '')
  const time = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(d).replace(/\s?AM$/i, ' am').replace(/\s?PM$/i, ' pm')
  return `${day}, ${time}`
}

// "Fri Oct 9" — a calendar date, so formatted in UTC to avoid a timezone shift.
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
    .format(new Date(`${date}T12:00:00Z`)).replace(',', '')
}

export function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

// Must match the database: encode(extensions.digest(token, 'sha256'), 'hex').
export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}
