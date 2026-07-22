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

export const PROMPT_IN_MS  = 500   // "let your attention rest here" fade-in
export const PROMPT_OUT_MS = 5200  // and fade-out
