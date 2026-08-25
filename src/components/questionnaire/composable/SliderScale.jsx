import NoDefaultSlider from '../../study/NoDefaultSlider'

function labelStyle(label, min, max) {
  const span = Math.max(1, max - min)
  const pct = ((label.value - min) / span) * 100

  if (pct <= 0) return { left: 0, textAlign: 'left', transform: 'none' }
  if (pct >= 100) return { right: 0, textAlign: 'right', transform: 'none' }
  return { left: `${pct}%`, textAlign: 'center', transform: 'translateX(-50%)' }
}

/**
 * Shared survey slider shell.
 *
 * Uses RADLab's existing NoDefaultSlider so there is genuinely no stored/default
 * answer until the participant deliberately interacts with the control.
 */
export default function SliderScale({
  min = 0,
  max = 100,
  step = 1,
  value = null,
  onChange,
  labels = [],
  ariaLabel = 'Slider response',
  showValue = true,
  compact = false,
}) {
  const visibleLabels = (labels ?? []).filter(
    label => label && label.label && label.value >= min && label.value <= max
  )

  return (
    <div className={compact ? 'cs-slider-scale is-compact' : 'cs-slider-scale'}>
      <div className="cs-slider-scale__row">
        <div className="cs-slider-scale__main">
          <NoDefaultSlider
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={onChange}
            ariaLabel={ariaLabel}
          />

          {visibleLabels.length > 0 && (
            <div className="cs-slider-labels" aria-hidden="true">
              {visibleLabels.map((label, index) => (
                <div
                  key={`${label.value}-${index}`}
                  className="cs-slider-label"
                  style={labelStyle(label, min, max)}
                >
                  <strong>{label.value}</strong>
                  <span>{label.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {showValue && (
          <div className="cs-slider-value" aria-live="polite">
            <span className="cs-slider-value__caption">Value</span>
            <span className={value == null ? 'cs-slider-value__number is-empty' : 'cs-slider-value__number'}>
              {value == null ? '—' : value}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
