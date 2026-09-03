import RichText from './RichText'
import { countWords, clampWords } from './textLimits'

/**
 * OpenTextQuestion — a plain free-text response.
 *
 * Added 2026-09-03. The package shipped `open_text_list` (participant-generated
 * factors, each forcing a contribution slider) but nothing for "just answer in
 * your own words", so a study needing one free-response question had no
 * component at all (Dana's CHM135 build; the chemistry course wanted the same).
 *
 * One component covers both shapes via `multiline`: a single-line input for a
 * short answer, a textarea for a paragraph. Splitting them into two instrument
 * types would double the library, the editor and the registry for what is one
 * attribute of the same question.
 *
 * Config contract:
 *   { question, multiline, rows, placeholder, max_words, min_words, required }
 *
 * Response: a plain string (empty string when untouched, never null — the
 * value is always the text as typed, so `responseIsComplete` can judge it
 * without distinguishing "not answered" from "answered with nothing").
 */
export default function OpenTextQuestion({ config, value = '', onChange }) {
  const multiline = config.multiline !== false
  const maxWords = config.max_words ?? null
  const text = String(value ?? '')
  const words = countWords(text)

  function update(raw) {
    onChange(clampWords(raw, maxWords))
  }

  const shared = {
    value: text,
    placeholder: config.placeholder ?? '',
    onChange: event => update(event.target.value),
    'aria-labelledby': `${config.id}-prompt`,
  }

  return (
    <section className="cs-question-card" aria-labelledby={`${config.id}-prompt`}>
      <div id={`${config.id}-prompt`} className="cs-question-prompt">
        <RichText text={config.question} />
      </div>

      {multiline ? (
        <textarea
          {...shared}
          className="cs-open-text-input"
          rows={config.rows ?? 4}
        />
      ) : (
        <input {...shared} type="text" className="cs-short-text-input cs-open-text-input is-single" />
      )}

      {(maxWords != null || config.min_words != null) && (
        <div className="cs-open-text-meta">
          {config.min_words != null && words < config.min_words ? (
            <span className="cs-open-text-hint">
              At least {config.min_words} word{config.min_words === 1 ? '' : 's'}.
            </span>
          ) : <span />}
          {maxWords != null && (
            <span className="cs-word-count">{words}/{maxWords} words</span>
          )}
        </div>
      )}
    </section>
  )
}
