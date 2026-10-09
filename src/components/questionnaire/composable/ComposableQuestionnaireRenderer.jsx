import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import RichText from './RichText'
import SurveyPageRenderer from './SurveyPageRenderer'
import {
  normalizeComposableResponses,
  pageIsComplete,
} from './composableQuestionnaireUtils'
import { COMPONENT_TYPES } from './componentRegistry'
import { interleaveOrder } from '../../../lib/interleaveOrder'
import { visibleComponents, pageIsShown, markNotApplicable } from '../../../lib/composableVisibility'
import './composableSurvey.css'

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
  const [responses, setResponses] = useState({})
  const [done, setDone] = useState(false)
  const completedRef = useRef(false)

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
    setResponses(previous => ({
      ...previous,
      [componentId]: value,
    }))
  }, [])

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
    if (!pageIsComplete(page, responses)) return

    if (nextShown == null) {
      finish()
      return
    }

    setPageIndex(nextShown)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function back() {
    if (prevShown != null) {
      setPageIndex(prevShown)
      window.scrollTo({ top: 0, behavior: 'smooth' })
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
        />
      </main>

      <div className="cs-navigation">
        <button type="button" className="cs-secondary-button" onClick={back}>
          ← Back
        </button>

        <button
          type="button"
          className="cs-primary-button"
          disabled={!canContinue}
          onClick={next}
        >
          {nextShown == null ? 'Finish' : 'Next →'}
        </button>
      </div>
    </div>
  )
}
