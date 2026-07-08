import { useState } from 'react'
import { interventionStyles as S, OwlScreen } from './InterventionPage'
import { SESSION_SLOT_LABELS } from './wrapperElements'

// Renders one standard session wrapper element (welcome / check-in / farewell)
// in the same visual system as InterventionPage, with the 5-step progress bar
// showing this element's actual position in the session sequence.
// Preview-only for now: nothing is saved.

export default function WrapperElementPage({ element, onComplete }) {
  const screens = element.screens
  const [screenIndex, setScreenIndex] = useState(0)

  // Slider state: { `${screenIdx}:${itemId}`: value }; touched mirrors it
  const [values,  setValues]  = useState({})
  const [touched, setTouched] = useState({})

  const current = screens[screenIndex]
  const isLast  = screenIndex === screens.length - 1

  const nextEnabled =
    current.type !== 'ratings' ||
    current.items.every(item => touched[`${screenIndex}:${item.id}`])

  function handleNext() {
    if (!nextEnabled) return
    if (isLast) onComplete()
    else setScreenIndex(i => i + 1)
  }

  function stepState(i) {
    return i < element.slot ? 'done' : i === element.slot ? 'active' : 'upcoming'
  }

  return (
    <div style={S.bg}>
      <div style={S.page}>

        {/* 5-step session progress bar — this element's slot is active */}
        <div style={S.progressBar}>
          <div style={{ display: 'flex' }}>
            {SESSION_SLOT_LABELS.map((label, i) => {
              const state = stepState(i)
              const color = state === 'done' ? '#639922' : state === 'active' ? '#2c2c2a' : '#a09d98'
              const bar   = state === 'done' ? '#639922' : state === 'active' ? '#2c2c2a' : '#ddd'
              return (
                <div key={i} style={S.stepCol}>
                  <span style={{ ...S.stepLabel, color }}>{label}</span>
                  <div style={{ ...S.stepTrack, background: bar }}>
                    <div style={{ ...S.stepDot, background: bar }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Header */}
        <div style={S.header}>
          <div style={S.practiceBadge}>
            <div style={S.badgeDot} />
            Every session
          </div>
          <div style={S.dayNumber}>{element.name}</div>
          <div style={S.daySubtitle}>{element.description}</div>
        </div>

        {/* Step pips */}
        <div style={S.pips}>
          {screens.map((_, i) => (
            <div key={i} style={{
              ...S.pip,
              background: i < screenIndex ? '#639922' : i === screenIndex ? '#2c2c2a' : '#ddd',
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={S.content}>
          {current.type === 'owl' && (
            <OwlScreen owl={current.owl} text={current.text} />
          )}

          {current.type === 'ratings' && (
            <div>
              {current.heading && <h3 style={S.textH3}>{current.heading}</h3>}
              {current.sub     && <p  style={S.textP}>{current.sub}</p>}
              {current.items.map(item => {
                const key     = `${screenIndex}:${item.id}`
                const value   = values[key] ?? 50
                const isMoved = !!touched[key]
                return (
                  <div key={item.id} style={{ marginBottom: 18 }}>
                    <p style={S.promptLabel}>{item.prompt}</p>
                    <div style={S.sliderWrap}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={value}
                        onChange={e => {
                          const v = Number(e.target.value)
                          setValues(prev => ({ ...prev, [key]: v }))
                          if (!isMoved) setTouched(prev => ({ ...prev, [key]: true }))
                        }}
                        style={{ ...S.bigSlider, accentColor: isMoved ? '#639922' : '#c0bdb8' }}
                      />
                      <div style={S.sliderLabels}>
                        <span style={{ whiteSpace: 'pre-line' }}>{item.min_label}</span>
                        <span style={{ ...S.sliderVal, color: isMoved ? '#639922' : '#c0bdb8' }}>
                          {isMoved ? value : '—'}
                        </span>
                        <span style={{ whiteSpace: 'pre-line', textAlign: 'right' }}>{item.max_label}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button
            onClick={handleNext}
            disabled={!nextEnabled}
            style={
              isLast && element.finalButtonGreen
                ? S.btnDone
                : !nextEnabled
                  ? { ...S.btnNext, ...S.btnDisabled }
                  : S.btnNext
            }
          >
            {isLast ? element.finalButtonLabel : 'Next'}
          </button>
        </div>

      </div>
    </div>
  )
}
