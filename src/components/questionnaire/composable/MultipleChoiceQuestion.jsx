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

/**
 * Single-select (radio, the default) or, with `allow_multiple: true`,
 * select-all-that-apply (checkboxes).
 *
 * Response shapes differ so the stored row is self-describing:
 *   single   { option_id, value }
 *   multiple [{ option_id, value }, ...]  — in the order the participant
 *                                           selected, empty array = none yet
 */
export default function MultipleChoiceQuestion({ config, value = null, onChange }) {
  const multiple = config.allow_multiple === true

  const selections = multiple ? (Array.isArray(value) ? value : []) : null
  const selectedId = multiple ? null : value?.option_id ?? null
  const selectedValue = multiple ? null : value?.value ?? ''

  function selectionFor(optionId) {
    return selections?.find(s => s.option_id === optionId) ?? null
  }

  function hasInput(option) {
    return option.response_type === 'text' || option.response_type === 'number'
  }

  function select(option) {
    if (multiple) {
      if (selectionFor(option.id)) {
        onChange(selections.filter(s => s.option_id !== option.id))
      } else {
        onChange([...selections, { option_id: option.id, value: hasInput(option) ? '' : null }])
      }
      return
    }

    if (hasInput(option)) {
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
    if (multiple) {
      onChange(selections.map(s => s.option_id === option.id ? { ...s, value: nextValue } : s))
    } else {
      onChange({ option_id: option.id, value: nextValue })
    }
  }

  return (
    <section className="cs-question-card" aria-labelledby={`${config.id}-prompt`}>
      <div id={`${config.id}-prompt`} className="cs-question-prompt">
        <RichText text={config.question} />
      </div>

      {multiple && (
        <p className="cs-mc-note">Select all that apply.</p>
      )}

      <div
        className="cs-mc-list"
        role={multiple ? 'group' : 'radiogroup'}
        aria-labelledby={`${config.id}-prompt`}
      >
        {(config.options ?? []).map(option => {
          const selection = multiple ? selectionFor(option.id) : null
          const selected = multiple ? selection != null : selectedId === option.id
          const conditionalValue = multiple ? selection?.value ?? '' : selectedValue

          return (
            <div
              key={option.id}
              className={selected ? 'cs-mc-option is-selected' : 'cs-mc-option'}
            >
              <button
                type="button"
                className="cs-mc-option__button"
                role={multiple ? 'checkbox' : 'radio'}
                aria-checked={selected}
                onClick={() => select(option)}
              >
                {multiple
                  ? <span className="cs-check-marker" aria-hidden="true" />
                  : <span className="cs-radio-dot" aria-hidden="true" />}
                <span className="cs-mc-option__label">
                  <RichText text={option.label} inline />
                </span>
              </button>

              {selected && hasInput(option) && (
                <div className="cs-mc-option__conditional">
                  {option.prefix ? <span>{option.prefix}</span> : null}
                  <input
                    autoFocus
                    type={option.response_type === 'number' ? 'number' : 'text'}
                    value={conditionalValue}
                    placeholder={option.placeholder ?? ''}
                    min={option.min}
                    max={option.max}
                    step={option.step}
                    onChange={event => updateConditional(option, event.target.value)}
                    aria-invalid={!inputIsValid(option, conditionalValue)}
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
