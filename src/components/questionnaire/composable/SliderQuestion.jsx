import RichText from './RichText'
import SliderScale from './SliderScale'
import { OptOutButtons, PNA, NOT_SURE } from './PreferNotToAnswer'

export default function SliderQuestion({ config, value = null, onChange }) {
  // Opt-outs are opt-in per item; VAS steps share this component and set neither.
  const optOuts = [
    config.allow_not_sure === true && { value: NOT_SURE, label: 'Not sure' },
    config.allow_pna === true && { value: PNA, label: 'Prefer not to answer' },
  ].filter(Boolean)
  const isOptOut = value === PNA || value === NOT_SURE

  return (
    <section className="cs-question-card" aria-labelledby={`${config.id}-prompt`}>
      <div id={`${config.id}-prompt`} className="cs-question-prompt">
        <RichText text={config.question} />
      </div>

      <SliderScale
        min={config.min ?? 0}
        max={config.max ?? 100}
        step={config.step ?? 1}
        // An opt-out is not a position, so the slider shows as unset; moving
        // it replaces the opt-out with a real value.
        value={isOptOut ? null : value}
        onChange={onChange}
        labels={config.labels ?? []}
        ariaLabel={config.aria_label ?? config.question ?? 'Slider response'}
      />

      {optOuts.length > 0 && (
        <OptOutButtons options={optOuts} value={value} onChange={onChange} />
      )}
    </section>
  )
}
