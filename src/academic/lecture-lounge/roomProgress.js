// The popcorn bowl's two numbers. `answered` is the server's count of
// responses to the check-in (get_checkin_progress); `total` is the room: the
// class presence list, which already runs the avatar wall. The viewer counts
// once in each even before their own presence or answer shows up, since the
// bowl only appears after their own submit. Someone who answered and then
// closed the lounge still counts as answered but not as in the room, so
// answered can pass the room count: the room grows to match rather than the
// bowl claiming more than 100%. A null count (not loaded yet) stays null.
export function roomProgress(present, selfUserId, answeredCount) {
  let room = 1
  for (const p of present) {
    if (p && !(selfUserId && p.user_id === selfUserId)) room++
  }
  if (answeredCount === null || answeredCount === undefined) return { answered: null, total: room }
  const answered = Math.max(1, answeredCount)
  return { answered, total: Math.max(room, answered) }
}

// Polling cadence for get_checkin_progress: quick while answers are arriving,
// easing off while the count sits still, so a long-open check-in (a break)
// doesn't keep every phone asking every few seconds.
export const PROGRESS_POLL_MIN_MS = 4000
export const PROGRESS_POLL_MAX_MS = 15000
export function nextPollDelay(prevDelay, changed) {
  if (changed) return PROGRESS_POLL_MIN_MS
  return Math.min(PROGRESS_POLL_MAX_MS, Math.round(prevDelay * 1.5))
}
