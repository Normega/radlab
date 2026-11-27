import SaveRetryBanner from './SaveRetryBanner'
import './ComprehensionCheck.css'

// The questions of a game's comprehension check, on its start screen. The state,
// loading and saving are in useComprehensionCheck.js, which says what it records.

export default function ComprehensionCheck({ check }) {
  if (check.status === 'off') return null
  if (check.status === 'loading') return <p className="cc-note">Loading…</p>
  if (check.status === 'error') {
    return (
      <div className="cc" role="alert">
        <p className="cc-note">The questions for this task could not load. Check your connection and try again.</p>
        <button type="button" className="cc-retry" onClick={check.retryLoad}>Try again</button>
      </div>
    )
  }
  const cfg = check.config
  const retryText = cfg.retry_text ?? 'Not quite. Read the instructions again and try another answer.'
  return (
    <section className="cc" aria-label={cfg.title ?? 'Check your understanding'}>
      <h2 className="cc-title">{cfg.title ?? 'Check your understanding'}</h2>
      {cfg.intro && <p className="cc-intro">{cfg.intro}</p>}
      {cfg.questions.map((q, i) => {
        const a = check.answers[q.id] ?? { wrong: [], solved: false }
        return (
          <fieldset key={q.id} className="cc-q">
            <legend className="cc-legend">{i + 1}. {q.text}</legend>
            <div className="cc-opts">
              {q.options.map(o => {
                const wrong = a.wrong.includes(o.id)
                const right = a.solved && o.id === q.correct
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`cc-opt${wrong ? ' is-wrong' : ''}${right ? ' is-right' : ''}`}
                    disabled={a.solved || wrong}
                    aria-pressed={wrong || right}
                    onClick={() => check.choose(q.id, o.id)}
                  >
                    {o.text}
                  </button>
                )
              })}
            </div>
            <p className={`cc-fb${a.solved ? ' is-right' : a.wrong.length ? ' is-wrong' : ''}`} aria-live="polite">
              {a.solved ? 'Correct.' : a.wrong.length ? retryText : ''}
            </p>
          </fieldset>
        )
      })}
      {check.status === 'saving' && <p className="cc-note">Saving…</p>}
      {check.status === 'failed' && <SaveRetryBanner message={check.saveError} busy={check.busy} onRetry={check.retrySave} />}
    </section>
  )
}
