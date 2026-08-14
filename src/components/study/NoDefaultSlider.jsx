import { useRef } from 'react'

/**
 * NoDefaultSlider — a discrete slider with genuinely no initial position.
 *
 * Why this exists: a plain <input type="range"> must hold some number, so its
 * handle always sits somewhere, and that position both anchors the response and
 * — if the surrounding form treats it as an answer — gets recorded for people
 * who never touched it. On the intervention modules' 1–6 items that produced a
 * silent 4. See website.md 2026-07-31.
 *
 * How it works: the native input is kept as a *transparent* layer on top, so
 * keyboard operation, dragging, touch and screen-reader semantics are all
 * inherited rather than reimplemented. The visible track, fill and handle are
 * drawn underneath — which is what makes "no handle at all" expressible.
 *
 * `value` is the single source of truth for whether the item is answered:
 * null/undefined means untouched, and the handle is not rendered. There is no
 * separate `touched` flag to drift out of sync with the value.
 *
 * Selecting the value the hidden handle happens to rest on works, which a naive
 * implementation gets wrong: a native range fires no change event when the
 * value does not change, so a click there would be swallowed. onPointerDown
 * derives the value from the pointer position and commits it directly, so every
 * deliberate interaction registers — including one that lands on the resting
 * value. Nothing commits without a real interaction, so an accidental focus or
 * a Tab-through still leaves the item unanswered.
 */
export default function NoDefaultSlider({
  min,
  max,
  step = 1,
  value = null,
  onChange,
  ariaLabel,
  disabled = false,
  // Optional word per scale point, in ascending order (length must equal the
  // number of ticks). Rendered beneath the track at the tick positions, using
  // this component's own geometry — computing it in the caller would duplicate
  // the half-handle inset and drift the moment either side changed.
  pointLabels = null,
}) {
  const inputRef = useRef(null)
  const answered = value != null
  const span = Math.max(1, max - min)

  // Where the handle sits while unanswered. Never shown and never saved — it
  // only gives the native input somewhere to start, and the midpoint leaves
  // arrow keys room to move in both directions on the first press.
  const restingValue = Math.round((min + max) / 2)
  const current = answered ? value : restingValue
  const pct = ((current - min) / span) * 100

  // Inset by half the handle so it does not overhang either end.
  const at = (p) => `calc(${p}% + ${12 - (p / 100) * 24}px)`

  // Always fires, even when the value is unchanged: re-selecting the same
  // value is how a first touch on the resting position registers at all.
  // Callers treat it as idempotent.
  function commit(v) {
    const clamped = Math.min(max, Math.max(min, v))
    // Snap relative to min — `round(v / step) * step` would land off-grid
    // whenever min is not itself a multiple of step.
    onChange(min + Math.round((clamped - min) / step) * step)
  }

  function handlePointerDown(e) {
    if (disabled) return
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return
    // Mirror the native geometry: the usable track is inset by half a handle at
    // each end, so the extremes remain reachable at the very edges.
    const usable = Math.max(1, rect.width - 24)
    const x = Math.min(usable, Math.max(0, e.clientX - rect.left - 12))
    commit(min + (x / usable) * span)
  }

  const ticks = []
  if (span / step <= 12) {
    for (let v = min; v <= max; v += step) ticks.push(((v - min) / span) * 100)
  }

  // Only render labels we can actually place — one per tick. A mismatched
  // array is dropped rather than rendered against the wrong points, because a
  // frequency scale silently shifted by one is worse than an unlabelled one.
  const labels = pointLabels && pointLabels.length === ticks.length ? pointLabels : null

  return (
    <div className={labels ? 'ndslider ndslider--labelled' : 'ndslider'}>
      <input
        ref={inputRef}
        className="ndslider__input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuetext={answered ? String(value) : 'No value chosen yet'}
        onPointerDown={handlePointerDown}
        onChange={e => commit(Number(e.target.value))}
      />
      <div className="ndslider__visual">
        <div className="ndslider__track" />
        {ticks.map((p, i) => (
          <div key={i} className="ndslider__tick" style={{ left: at(p) }} />
        ))}
        {answered && (
          <>
            <div className="ndslider__fill" style={{ left: '12px', width: `calc(${at(pct)} - 12px)` }} />
            <div className="ndslider__thumb" style={{ left: at(pct) }} />
          </>
        )}
      </div>
      {labels && (
        <div className="ndslider__labels">
          {labels.map((label, i) => {
            const selected = answered && min + i * step === value
            // The end labels anchor to the container edges instead of centring
            // on their tick: a centred first label would hang off the left of
            // the card, and the browser would clip it rather than wrap.
            const isFirst = i === 0
            const isLast  = i === labels.length - 1
            const pos = isFirst ? { left: 0, textAlign: 'left' }
                      : isLast  ? { right: 0, textAlign: 'right' }
                      : { left: at(ticks[i]), transform: 'translateX(-50%)', textAlign: 'center' }
            return (
              <span
                key={i}
                className={selected ? 'ndslider__label is-selected' : 'ndslider__label'}
                style={pos}
              >
                {label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
