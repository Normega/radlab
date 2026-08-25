import RichText from './RichText'

export default function LikertQuestion({ config, value = null, onChange }) {
  const scale = Array.isArray(config.scale) ? config.scale : []

  return (
    <section className="cs-question-card" aria-labelledby={`${config.id}-prompt`}>
      <div id={`${config.id}-prompt`} className="cs-question-prompt">
        <RichText text={config.question} />
      </div>

      <div
        className="cs-likert-grid"
        role="radiogroup"
        aria-labelledby={`${config.id}-prompt`}
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, scale.length)}, minmax(0, 1fr))`,
        }}
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
    </section>
  )
}
