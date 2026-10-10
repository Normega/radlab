import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import RichText from './RichText'
import SurveyPageRenderer from './SurveyPageRenderer'
import {
  normalizeComposableResponses,
  pageIsComplete,
} from './composableQuestionnaireUtils'
import { COMPONENT_TYPES, responseIsComplete } from './componentRegistry'
import { interleaveOrder } from '../../../lib/interleaveOrder'
import { visibleComponents, pageIsShown, markNotApplicable } from '../../../lib/composableVisibility'
import './composableSurvey.css'
import { useScrollToTopOn } from '../../../lib/scrollToTop'

// The pages this participant sees. Without `interleave` they are the
// definition's own pages. With it, the listed items are re-ordered by
// interleaveOrder (seeded, so a reload shows the same order) and cut into
// `page_sizes`; any component NOT in the shuffle (an information block, say)
// stays at the top of the page it was written on. If no valid order is found
// the definition's fixed pages are used, and the response records that.
function buildPresentation(questionnaire, seed) {
  const spec = questionnaire.interleave
  const written = questionnaire.pages ?? []
  if (!spec) return { pages: written, order: null }

  const result = interleaveOrder(spec, seed)
  if (!result) return { pages: written, order: { method: 'fixed_fallback' } }

  const pool = new Set(spec.items)
  const byId = new Map(written.flatMap(page => page.components ?? []).map(c => [c.id, c]))
  const fixedOn = i => (written[i]?.components ?? []).filter(c => !pool.has(c.id))
  const pages = result.pages.map((ids, i) => ({
    id: `interleave_p${i + 1}`,
    components: [...fixedOn(i), ...ids.map(id => byId.get(id))],
  }))
  for (let i = result.pages.length; i < written.length; i++) {
    if (fixedOn(i).length) pages.push({ ...written[i], components: fixedOn(i) })
  }
  return { pages, order: { method: 'interleave', version: 1, positions: result.positions } }
}

const collects = component => COMPONENT_TYPES[component.type]?.collectsResponse === true

export default function ComposableQuestionnaireRenderer({
  questionnaire,
  partNumber = 1,
  totalParts = 1,
  onComplete,
  onBack,
  previewMode = false,
  isSimMode = false,
  // Seeds the interleaved order. The step wrapper passes one derived from the
  // participant's schedule row; previews pass none and get a fresh order each load.
  orderSeed = null,
}) {
  const hasInstructions = Boolean(questionnaire.instructions?.trim())
  const [showInstructions, setShowInstructions] = useState(hasInstructions)
  const [pageIndex, setPageIndex] = useState(0)
  // Each page starts at the top of the page (see scrollToTop.js).
  useScrollToTopOn(`${showInstructions}:${pageIndex}`)
  const [responses, setResponses] = useState({})
  const [done, setDone] = useState(false)
  const completedRef = useRef(false)
  // Questions still unanswered when Next was tapped (highlighted until answered).
  const [missing, setMissing] = useState([])

  // Answer timing: milliseconds since the first page was shown, on the browser's
  // monotonic clock, so a participant's wrong wall clock cannot distort it. Kept
  // with the answers as _timing: when each page was entered and left, and when
  // each question was answered (every change, so re-answers are visible). The
  // export turns it into seconds per item for speeder screening, which then means
  // the same thing whichever layout a study used.
  const clockRef = useRef({ t0: null, pages: [], answers: {} })
  const clock = useCallback(() => {
    const c = clockRef.current
    if (c.t0 == null) c.t0 = performance.now()
    return Math.round(performance.now() - c.t0)
  }, [])
  useEffect(() => {
    if (showInstructions) return
    const c = clockRef.current
    const open = c.pages[c.pages.length - 1]
    if (open && open[0] === pageIndex && open[2] == null) return
    const t = clock()
    if (open && open[2] == null) open[2] = t
    c.pages.push([pageIndex, t, null])
  }, [showInstructions, pageIndex, clock])

  const [previewSeed] = useState(() => `preview-${Math.random().toString(36).slice(2)}`)
  const presentation = useMemo(
    () => buildPresentation(questionnaire, orderSeed ?? previewSeed),
    [questionnaire, orderSeed, previewSeed],
  )
  const pages = presentation.pages
  const rawPage = pages[pageIndex]
  // Only the components whose show_if holds are drawn or required.
  const page = rawPage ? { ...rawPage, components: visibleComponents(rawPage, responses) } : rawPage
  const shownIndices = pages.map((p, i) => (pageIsShown(p, responses) ? i : -1)).filter(i => i >= 0)
  const nextShown = shownIndices.find(i => i > pageIndex)
  const prevShown = [...shownIndices].reverse().find(i => i < pageIndex)

  const updateResponse = useCallback((componentId, value) => {
    const answers = clockRef.current.answers
    answers[componentId] = [...(answers[componentId] ?? []), clock()]
    setResponses(previous => ({
      ...previous,
      [componentId]: value,
    }))
  }, [clock])

  function finish() {
    if (previewMode) {
      setDone(true)
      return
    }

    if (completedRef.current) return
    completedRef.current = true

    // Hidden questions are recorded as not applicable, never left blank, and
    // the order this participant saw is recorded with their answers (rule 3:
    // column names and analysis come from recorded facts, not inference).
    const normalized = markNotApplicable(
      pages, normalizeComposableResponses(questionnaire, responses), collects)
    if (presentation.order) normalized._order = presentation.order
    const c = clockRef.current
    const end = clock()
    const pagesLog = c.pages.map(([p, inMs, outMs]) => [p, inMs, outMs ?? end])
    normalized._timing = {
      v: 1,
      unit: 'ms since the first page was shown',
      pages: pagesLog,
      answers: c.answers,
      total_ms: end - (pagesLog[0]?.[1] ?? 0),
    }

    onComplete?.({
      responses: normalized,
      subscaleScores: {},
      derivedScores: {},
    })
  }

  // RADlab addition: sim-mode auto-complete, mirroring the legacy player —
  // without it a dry-run study stalls on its first composable questionnaire.
  // Responses stay at their defaults (null/[]); sim exercises flow, not data.
  const finishRef = useRef(null)
  useEffect(() => { finishRef.current = finish })
  useEffect(() => {
    if (!isSimMode) return
    const t = setTimeout(() => finishRef.current?.(), 400)
    return () => clearTimeout(t)
  }, [isSimMode])

  function next() {
    // An incomplete page does not advance: it shows which questions are missing,
    // and scrolls to the first. A greyed-out button that did nothing left people
    // on a long phone page with no idea which card they had skipped.
    if (!pageIsComplete(page, responses)) {
      const ids = page.components
        .filter(c => collects(c) && !responseIsComplete(c, responses[c.id]))
        .map(c => c.id)
      setMissing(ids)
      document.getElementById(`${ids[0]}-prompt`)?.closest('.cs-question-card')
        ?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      return
    }
    setMissing([])

    if (nextShown == null) {
      finish()
      return
    }

    setPageIndex(nextShown)
  }

  function back() {
    setMissing([])
    if (prevShown != null) {
      setPageIndex(prevShown)
      return
    }

    if (hasInstructions) {
      setShowInstructions(true)
      return
    }

    onBack?.()
  }

  if (done && previewMode) {
    return (
      <div className="cs-preview-complete">
        <span aria-hidden="true">✓</span>
        <p>Preview complete.</p>
      </div>
    )
  }

  if (showInstructions) {
    return (
      <div className="cs-player">
        <div className="cs-progress">
          Part {partNumber} of {totalParts}
        </div>

        <main className="cs-instructions">
          <div className="cs-instructions__card">
            <h1>{questionnaire.name}</h1>
            <RichText text={questionnaire.instructions} />
            <button
              type="button"
              className="cs-primary-button"
              onClick={() => setShowInstructions(false)}
            >
              Begin
            </button>
          </div>
        </main>

        {onBack ? (
          <button type="button" className="cs-back-floating" onClick={onBack}>
            ← Back
          </button>
        ) : null}
      </div>
    )
  }

  if (!page) {
    return <div className="cs-error-card">This questionnaire has no pages.</div>
  }

  const canContinue = pageIsComplete(page, responses)
  const stillMissing = missing.filter(id => {
    const c = page.components.find(x => x.id === id)
    return c && !responseIsComplete(c, responses[id])
  })
  const canDecline = stillMissing.some(id => page.components.find(x => x.id === id)?.allow_pna === true)

  return (
    <div className="cs-player">
      <div className="cs-progress">
        <span>{questionnaire.name}</span>
        <span>Page {shownIndices.indexOf(pageIndex) + 1} of {shownIndices.length}</span>
      </div>

      <main className="cs-player__content">
        <SurveyPageRenderer
          page={page}
          responses={responses}
          onChange={updateResponse}
          missingIds={stillMissing}
        />
      </main>

      <div className="cs-navigation">
        <button type="button" className="cs-secondary-button" onClick={back}>
          ← Back
        </button>

        {stillMissing.length > 0 && (
          <p className="cs-missing-note" role="status">
            Please answer the highlighted question{stillMissing.length > 1 ? 's' : ''}
            {canDecline ? ' or choose "Prefer not to answer"' : ''}.
          </p>
        )}

        {/* Not `disabled`: a disabled button swallows the tap, and the tap is what
            shows the participant what is missing. It still looks unavailable. */}
        <button
          type="button"
          className={canContinue ? 'cs-primary-button' : 'cs-primary-button is-waiting'}
          aria-disabled={!canContinue}
          onClick={next}
        >
          {nextShown == null ? 'Finish' : 'Next →'}
        </button>
      </div>
    </div>
  )
}
