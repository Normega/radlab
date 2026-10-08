import RichText from './RichText'
import SmileFace, { faceDescription } from './SmileFace'
import NoDefaultSlider from '../../study/NoDefaultSlider'
import PreferNotToAnswer, { PNA } from './PreferNotToAnswer'

// ── GraphicSliderQuestion (type: graphic_slider) ─────────────────────────────
// A five-point slider driving a face that changes from very sad (1) to very
// happy (5): a reproduction of the Qualtrics "Smile" graphic slider that UTMAP
// used for single-item life satisfaction in 2024 and 2025. See SmileFace for
// why the face is drawn rather than emoji.
//
// Before any input the face is neutral, as it was in Qualtrics, but NO value is
// recorded: NoDefaultSlider stores nothing until the participant moves it, so a
// required item cannot be passed by leaving the face where it started.
//
// Opt-in `allow_pna` adds "Prefer not to answer" under the slider, stored as
// 'pna' like every other item that offers it.

export default function GraphicSliderQuestion({ config, value = null, onChange }) {
  const numeric = typeof value === 'number' ? value : null

  return (
    <section className="cs-question-card" aria-labelledby={`${config.id}-prompt`}>
      <div id={`${config.id}-prompt`} className="cs-question-prompt">
        <RichText text={config.question} />
      </div>

      <div className="cs-graphic-face" aria-live="polite">
        <SmileFace value={numeric ?? 3} />
      </div>

      <NoDefaultSlider
        min={1}
        max={5}
        step={1}
        value={numeric}
        onChange={onChange}
        ariaLabel={`${config.question} Currently: ${numeric ? faceDescription(numeric) : 'no answer yet'}`}
      />

      {config.allow_pna === true && (
        <PreferNotToAnswer selected={value === PNA} onChange={onChange} />
      )}
    </section>
  )
}
