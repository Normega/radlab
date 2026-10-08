// ── PreferNotToAnswer ────────────────────────────────────────────────────────
// A small opt-out under a required scale item, shown only when the item's
// config sets `allow_pna: true`.
//
// WHY. A study can require every item to be answered (so a page cannot be
// advanced with blanks) and still honour a consent form that says any question
// may be declined: declining becomes an explicit answer rather than an empty
// one. The demographics instruments already work this way, with "Prefer not to
// answer" among their options; this gives Likert and slider items the same.
//
// It is deliberately NOT a scale point. A sixth button on a five-point scale
// invites being read, and analysed, as the far end of the scale. Stored as the
// string 'pna', it can never be averaged into a score by accident, and
// responseIsComplete already treats any non-null value as answered.
//
// Opt-in only: SliderQuestion is shared with the VAS steps, so no item gets this
// control unless its own config asks for it.

export const PNA = 'pna'

export default function PreferNotToAnswer({ selected, onChange, label = 'Prefer not to answer' }) {
  return (
    <div className="cs-pna">
      <button
        type="button"
        className={selected ? 'cs-pna__button is-selected' : 'cs-pna__button'}
        aria-pressed={selected}
        // Pressing it again clears it, so a participant who chose it by mistake
        // is not stuck with an answer they did not mean.
        onClick={() => onChange(selected ? null : PNA)}
      >
        {label}
      </button>
    </div>
  )
}
