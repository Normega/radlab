import RichText from './RichText'
import SliderScale from './SliderScale'
import PreferNotToAnswer, { PNA } from './PreferNotToAnswer'

export default function SliderQuestion({ config, value = null, onChange }) {
  return (
    <section className="cs-question-card" aria-labelledby={`${config.id}-prompt`}>
      <div id={`${config.id}-prompt`} className="cs-question-prompt">
        <RichText text={config.question} />
      </div>

      <SliderScale
        min={config.min ?? 0}
        max={config.max ?? 100}
        step={config.step ?? 1}
        // A 'pna' answer is not a position, so the slider shows as unset;
        // moving it replaces the opt-out with a real value.
        value={value === PNA ? null : value}
        onChange={onChange}
        labels={config.labels ?? []}
        ariaLabel={config.aria_label ?? config.question ?? 'Slider response'}
      />

      {config.allow_pna === true && (
        <PreferNotToAnswer selected={value === PNA} onChange={onChange} />
      )}
    </section>
  )
}
