import { useState } from 'react'
import RichText from './RichText'
import SliderScale from './SliderScale'
import { countWords, clampWords } from './textLimits'

let localIdCounter = 0
const nextLocalId = () => `row-${Date.now()}-${localIdCounter++}`

function buildRows(config, value) {
  const saved = Array.isArray(value) ? value : []
  const minimum = Math.max(config.initial_boxes ?? 3, saved.length + 1)

  return Array.from({ length: minimum }, (_, index) => {
    const response = saved[index]
    return {
      localId: nextLocalId(),
      factor: response?.factor ?? '',
      contribution: response?.contribution ?? null,
    }
  })
}

function cleanRows(rows, initialBoxes) {
  const next = [...rows]
  while (next.length > initialBoxes) {
    const last = next[next.length - 1]
    const prev = next[next.length - 2]
    if (!last.factor.trim() && prev && !prev.factor.trim()) next.pop()
    else break
  }
  return next
}

export default function OpenTextListQuestion({ config, value = [], onChange }) {
  const initialBoxes = config.initial_boxes ?? 3
  const [rows, setRows] = useState(() => buildRows(config, value))

  function emit(nextRows) {
    onChange(
      nextRows
        .filter(row => row.factor.trim())
        .map(row => ({
          factor: row.factor.trim(),
          contribution: row.contribution,
        }))
    )
  }

  function updateFactor(index, raw) {
    const factor = clampWords(raw, config.max_words)
    let next = rows.map((row, i) =>
      i === index
        ? {
            ...row,
            factor,
            contribution: factor.trim() ? row.contribution : null,
          }
        : row
    )

    const isLast = index === next.length - 1
    if (isLast && factor.trim()) {
      next.push({ localId: nextLocalId(), factor: '', contribution: null })
    }

    next = cleanRows(next, initialBoxes)
    setRows(next)
    emit(next)
  }

  function updateContribution(index, contribution) {
    const next = rows.map((row, i) =>
      i === index ? { ...row, contribution } : row
    )
    setRows(next)
    emit(next)
  }

  return (
    <section className="cs-question-card" aria-labelledby={`${config.id}-prompt`}>
      <div id={`${config.id}-prompt`} className="cs-question-prompt">
        <RichText text={config.question} />
      </div>

      <div className="cs-open-list">
        {rows.map((row, index) => {
          const hasText = Boolean(row.factor.trim())
          const placeholder = config.example_placeholder
            || `${config.placeholder_prefix ?? 'Response'} ${index + 1}...`

          return (
            <div key={row.localId} className="cs-open-list__row">
              <div className="cs-open-list__input-line">
                <input
                  type="text"
                  className="cs-short-text-input"
                  style={{ width: config.response_box_width ?? '520px' }}
                  value={row.factor}
                  placeholder={placeholder}
                  onChange={event => updateFactor(index, event.target.value)}
                  aria-label={`${config.placeholder_prefix ?? 'Response'} ${index + 1}`}
                />
                {config.max_words != null ? (
                  <span className="cs-word-count">
                    {countWords(row.factor)}/{config.max_words} words
                  </span>
                ) : null}
              </div>

              {hasText && (
                <div className="cs-open-list__slider">
                  {config.slider?.question ? (
                    <div className="cs-slider-subquestion">
                      <RichText text={config.slider.question} />
                    </div>
                  ) : null}
                  <SliderScale
                    compact
                    min={config.slider?.min ?? 0}
                    max={config.slider?.max ?? 100}
                    step={config.slider?.step ?? 1}
                    value={row.contribution}
                    onChange={next => updateContribution(index, next)}
                    labels={config.slider?.labels ?? []}
                    ariaLabel={`${config.slider?.question ?? 'Contribution'}: ${row.factor}`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
