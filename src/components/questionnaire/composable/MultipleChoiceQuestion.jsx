import RichText from './RichText'

function inputIsValid(option, rawValue) {
  const text = String(rawValue ?? '').trim()
  if (!text) return false

  if (option.response_type !== 'number') return true

  const number = Number(text)
  if (!Number.isFinite(number)) return false
  if (option.min != null && number < Number(option.min)) return false
  if (option.max != null && number > Number(option.max)) return false
  return true
}

export default function MultipleChoiceQuestion({ config, value = null, onChange }) {
  const selectedId = value?.option_id ?? null
  const selectedValue = value?.value ?? ''

  function select(option) {
    if (option.response_type === 'text' || option.response_type === 'number') {
      onChange({
        option_id: option.id,
        value: selectedId === option.id ? selectedValue : '',
      })
    } else {
      onChange({ option_id: option.id, value: null })
    }
  }

  function updateConditional(option, raw) {
    const nextValue = option.response_type === 'number'
      ? (raw === '' ? '' : Number(raw))
      : raw
    onChange({ option_id: option.id, value: nextValue })
  }

  return (
    <section className="cs-question-card" aria-labelledby={`${config.id}-prompt`}>
      <div id={`${config.id}-prompt`} className="cs-question-prompt">
        <RichText text={config.question} />
      </div>

      <div className="cs-mc-list" role="radiogroup" aria-labelledby={`${config.id}-prompt`}>
        {(config.options ?? []).map(option => {
          const selected = selectedId === option.id
          const hasInput = option.response_type === 'text' || option.response_type === 'number'

          return (
            <div
              key={option.id}
              className={selected ? 'cs-mc-option is-selected' : 'cs-mc-option'}
            >
              <button
                type="button"
                className="cs-mc-option__button"
                role="radio"
                aria-checked={selected}
                onClick={() => select(option)}
              >
                <span className="cs-radio-dot" aria-hidden="true" />
                <span className="cs-mc-option__label">
                  <RichText text={option.label} inline />
                </span>
              </button>

              {selected && hasInput && (
                <div className="cs-mc-option__conditional">
                  {option.prefix ? <span>{option.prefix}</span> : null}
                  <input
                    autoFocus
                    type={option.response_type === 'number' ? 'number' : 'text'}
                    value={selectedValue}
                    placeholder={option.placeholder ?? ''}
                    min={option.min}
                    max={option.max}
                    step={option.step}
                    onChange={event => updateConditional(option, event.target.value)}
                    aria-invalid={!inputIsValid(option, selectedValue)}
                  />
                  {option.suffix ? <span>{option.suffix}</span> : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
