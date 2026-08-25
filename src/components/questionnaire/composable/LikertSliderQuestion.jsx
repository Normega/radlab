import RichText from './RichText'
import NoDefaultSlider from '../../study/NoDefaultSlider'

/**
 * LikertSliderQuestion — the adopted discrete slider (Norm, 2026-08-19/24).
 *
 * RADlab addition to Dana's package: her SliderQuestion is the continuous
 * numeric instrument (sparse anchors + VALUE box); this is the other half of
 * the slider split — stepped scale where the label IS the value, so there is
 * no numeric readout. Layout per the adopted spec: the track is inset from
 * the card edges so ALL labels — endpoints included — center on their snap
 * position, which makes the spacing between labels exactly track/(N−1).
 * (NoDefaultSlider's own pointLabels edge-anchor the end labels because its
 * track runs full-width; that is the wrong rule for this instrument, hence
 * the label row lives here.)
 *
 * Config contract (mirrors SliderQuestion's):
 *   { question, min, max, step, labels: [{ value, label }, ...] }
 */
export default function LikertSliderQuestion({ config, value = null, onChange }) {
  const min = config.min ?? 1
  const max = config.max ?? (config.labels?.length ?? 6)
  const span = Math.max(1, max - min)

  return (
    <section className="cs-question-card" aria-labelledby={`${config.id}-prompt`}>
      <div id={`${config.id}-prompt`} className="cs-question-prompt">
        <RichText text={config.question} />
      </div>

      <div className="cs-likert-slider">
        <NoDefaultSlider
          min={min}
          max={max}
          step={config.step ?? 1}
          value={value}
          onChange={onChange}
          ariaLabel={config.aria_label ?? config.question ?? 'Likert slider response'}
        />
        <div className="cs-likert-slider__labels" aria-hidden="true">
          {(config.labels ?? []).filter(l => l && l.label).map(l => (
            <span
              key={l.value}
              className={value === l.value ? 'cs-likert-slider__label is-selected' : 'cs-likert-slider__label'}
              style={{ left: `${((l.value - min) / span) * 100}%` }}
            >
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
