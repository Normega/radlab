// Time-of-day slot for the Zerin daily touchpoints (3/day at 09:00 / 14:00 / 20:00
// America/Toronto). Derived from participant_schedule.send_time (a "HH:MM[:SS]"
// string surfaced by get_session_by_token), so the check-in / tip widgets show
// the right day-part without any per-node configuration.

export function slotFromSendTime(sendTime) {
  if (!sendTime) return null
  const h = parseInt(String(sendTime).slice(0, 2), 10)
  if (Number.isNaN(h)) return null
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

// The reference point a mood rating is compared against, per the approved
// protocol wording: 9AM vs. last check, 2PM vs. this morning, 8PM vs. this afternoon.
export function comparisonAnchor(slot) {
  switch (slot) {
    case 'morning':   return 'your last check-in'
    case 'afternoon': return 'this morning'
    case 'evening':   return 'this afternoon'
    default:          return 'your last check-in'
  }
}
