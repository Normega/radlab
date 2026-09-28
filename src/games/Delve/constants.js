// Delve — tunable mechanic constants (values confirmed in dwell_to_reveal_prototype.html)

export const DWELL_VELOCITY_PX_S = 55    // below this pointer speed counts as "resting"
export const REVEAL_RADIUS       = 105   // px, soft falloff radius around pointer
export const GROWTH_RATE         = 0.62  // reveal growth per second at radius center
export const DECAY_RATE          = 0.045 // fade back to haze per second
export const CELL                = 26    // px, reveal grid cell size
export const DPR_MAX             = 1.5   // deliberate perf clamp — blur + per-cell gradients are the cost centers

// Haze look. ctx.filter needs Safari 18+; on older Safari the image renders
// sharp — if that bites, feature-detect ('filter' in ctx) and fall back to a
// downscale-upscale blur plus a dark overlay.
export const HAZE_FILTER = 'blur(46px) saturate(65%) brightness(0.6)'
export const HAZE_BG     = '#1b1726'
export const PARCHMENT   = '#f0e6d8'

// In-world guidance (2026-09-26). Players did not know what to do: moving the
// pointer normally reveals nothing, and nothing said to move on once something
// cleared. So the game teaches itself: a ring at the pointer opens while it is
// still, and one-time lines respond to what the player actually does.
export const RING_DIAMETER   = 150    // px at full stillness, about the visibly cleared patch
export const RING_OPEN_S     = 1.4    // stillness needed for the ring to open fully
export const RING_CLOSE_S    = 0.3    // and how fast it closes on movement
export const CLEAR_AT        = 0.55   // reveal value under the pointer that counts as "cleared"
export const LINE_HOLD_MS    = 5500   // a line stays up this long...
export const LINE_GAP_MS     = 2800   // ...and the next waits this long after it fades
export const RESTLESS_S      = 15     // moving without a clearing this long -> one gentle nudge
export const QUESTION_AT_S   = [60, 120] // noticing questions, by time spent on the stage
