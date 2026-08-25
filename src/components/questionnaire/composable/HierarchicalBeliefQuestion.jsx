import { useEffect } from 'react'
import RichText from './RichText'
import SliderScale from './SliderScale'

function defaultValue(config) {
  return (config.beliefs ?? []).map(belief => ({
    id: belief.id,
    changed: false,
    direction: null,
  }))
}

export default function HierarchicalBeliefQuestion({ config, value, onChange }) {
  const rows = Array.isArray(value) ? value : defaultValue(config)

  useEffect(() => {
    if (!Array.isArray(value)) onChange(defaultValue(config))
    // Initialize only for a new component mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function responseFor(id) {
    return rows.find(row => row.id === id) ?? {
      id,
      changed: false,
      direction: null,
    }
  }

  function toggleBelief(id) {
    const next = (config.beliefs ?? []).map(belief => {
      const current = responseFor(belief.id)
      if (belief.id !== id) return current
      return current.changed
        ? { id, changed: false, direction: null }
        : { id, changed: true, direction: null }
    })
    onChange(next)
  }

  function setDirection(id, direction) {
    const next = (config.beliefs ?? []).map(belief => {
      const current = responseFor(belief.id)
      return belief.id === id
        ? { id, changed: true, direction }
        : current
    })
    onChange(next)
  }

  return (
    <section className="cs-hierarchy" aria-labelledby={`${config.id}-prompt`}>
      <header className="cs-hierarchy__header">
        <div id={`${config.id}-prompt`} className="cs-question-prompt">
          <RichText text={config.question} />
        </div>
        {config.instruction ? (
          <div className="cs-hierarchy__instruction">
            <RichText text={config.instruction} />
          </div>
        ) : null}
      </header>

      <div className="cs-hierarchy__card">
        <div className="cs-hierarchy__guide" aria-hidden="true" />

        <div className="cs-hierarchy__list">
          {(config.beliefs ?? []).map(belief => {
            const response = responseFor(belief.id)
            const selected = response.changed === true

            return (
              <div
                key={belief.id}
                className={selected ? 'cs-belief is-selected' : 'cs-belief'}
                style={{ marginLeft: `${Math.max(0, belief.depth ?? 0) * 14}px` }}
              >
                <button
                  type="button"
                  className="cs-belief__toggle"
                  aria-pressed={selected}
                  onClick={() => toggleBelief(belief.id)}
                >
                  <span className="cs-check-marker" aria-hidden="true" />
                  <span className="cs-belief__level">
                    <RichText text={belief.level} inline />
                  </span>
                  <span className="cs-belief__text">
                    <RichText text={belief.text} inline />
                  </span>
                </button>

                {selected && (
                  <div className="cs-belief__slider">
                    {config.slider?.question ? (
                      <div className="cs-slider-subquestion">
                        <RichText text={config.slider.question} />
                      </div>
                    ) : null}
                    <SliderScale
                      compact
                      min={config.slider?.min ?? -100}
                      max={config.slider?.max ?? 100}
                      step={config.slider?.step ?? 1}
                      value={response.direction}
                      onChange={direction => setDirection(belief.id, direction)}
                      labels={config.slider?.labels ?? []}
                      ariaLabel={`${config.slider?.question ?? 'Direction of change'}: ${belief.text}`}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
