import { useCallback, useEffect, useRef, useState } from 'react'
import RichText from './RichText'
import SurveyPageRenderer from './SurveyPageRenderer'
import {
  normalizeComposableResponses,
  pageIsComplete,
} from './composableQuestionnaireUtils'
import './composableSurvey.css'

export default function ComposableQuestionnaireRenderer({
  questionnaire,
  partNumber = 1,
  totalParts = 1,
  onComplete,
  onBack,
  previewMode = false,
  isSimMode = false,
}) {
  const hasInstructions = Boolean(questionnaire.instructions?.trim())
  const [showInstructions, setShowInstructions] = useState(hasInstructions)
  const [pageIndex, setPageIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [done, setDone] = useState(false)
  const completedRef = useRef(false)

  const pages = questionnaire.pages ?? []
  const page = pages[pageIndex]

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

    onComplete?.({
      responses: normalizeComposableResponses(questionnaire, responses),
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

    if (pageIndex >= pages.length - 1) {
      finish()
      return
    }

    setPageIndex(index => index + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function back() {
    if (pageIndex > 0) {
      setPageIndex(index => index - 1)
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
        <span>Page {pageIndex + 1} of {pages.length}</span>
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
          {pageIndex === pages.length - 1 ? 'Finish' : 'Next →'}
        </button>
      </div>
    </div>
  )
}
