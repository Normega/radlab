// The legend marks for a reviewed picture: a ring for a difference (solid when
// found, dashed when missed) and a cross for a click that was not on one.
// The same colours as reviewOverlay in scenes.js.

export const ReviewIcon = ({ c, dash = false }) => (
  <svg width="22" height="22" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke={c} strokeWidth="3" strokeDasharray={dash ? '4 3' : undefined} /></svg>
)
export const ReviewCross = () => (
  <svg width="22" height="22" aria-hidden="true"><path d="M5 5L17 17M17 5L5 17" stroke="#868e96" strokeWidth="3" strokeLinecap="round" /></svg>
)
