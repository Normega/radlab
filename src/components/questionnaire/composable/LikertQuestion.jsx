import RichText from './RichText'
import PreferNotToAnswer, { PNA } from './PreferNotToAnswer'

export default function LikertQuestion({ config, value = null, onChange }) {
  const scale = Array.isArray(config.scale) ? config.scale : []

  return (
    <section className="cs-question-card" aria-labelledby={`${config.id}-prompt`}>
      <div id={`${config.id}-prompt`} className="cs-question-prompt">
        <RichText text={config.question} />
      </div>

      <div
        className={scale.length >= 5 ? 'cs-likert-grid cs-likert-grid--wide' : 'cs-likert-grid'}
        role="radiogroup"
        aria-labelledby={`${config.id}-prompt`}
        /* Column count travels as a custom property rather than as an inline
           grid-template-columns, so the narrow-screen rule in
           composableSurvey.css can still override it. Setting the property
           inline and reading it in the stylesheet keeps one source of truth for
           the count while leaving the layout to CSS. */
        style={{ '--cs-likert-columns': Math.max(1, scale.length) }}
      >
        {scale.map(option => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? 'cs-likert-option is-selected' : 'cs-likert-option'}
              onClick={() => onChange(option.value)}
            >
              <span className="cs-likert-option__value">{option.value}</span>
              {option.label ? (
                <span className="cs-likert-option__label">{option.label}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {config.allow_pna === true && (
        <PreferNotToAnswer selected={value === PNA} onChange={onChange} />
      )}
    </section>
  )
}
