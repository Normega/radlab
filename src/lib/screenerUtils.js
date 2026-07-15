export function sumAnswers(answers) {
  return Object.values(answers).reduce((a, b) => a + b, 0)
}

export function getGAD7Band(score) {
  if (score <= 9)  return 'none_mild'
  if (score <= 14) return 'moderate'
  return 'severe'
}

export function getPHQ8Band(score) {
  if (score <= 9)  return 'none_mild'
  if (score <= 19) return 'moderate'
  return 'severe'
}

export function evaluatePhase2(gad7Answers, phq8Answers) {
  const gadScore = sumAnswers(gad7Answers)
  const phqScore = sumAnswers(phq8Answers)
  const gadBand  = getGAD7Band(gadScore)
  const phqBand  = getPHQ8Band(phqScore)

  const isSevere   = gadBand === 'severe' || phqBand === 'severe'
  const isModerate = gadBand === 'moderate' || phqBand === 'moderate'

  if (isSevere)                return 'fail_high'
  if (!isSevere && isModerate) return 'pass'
  return 'fail_low'
}

// Generalized phase-2 evaluator, driven by the screener definition, over an
// arbitrary set of questionnaires keyed by slug. Returns 'pass' | 'fail_low' |
// 'fail_high'.
//
//   phase2.scoring.mode === 'range':  single-instrument band gate (Zerin: PHQ-8
//     score 5–9 passes; below is fail_low, above is fail_high). Shape:
//       { mode: 'range', questionnaire_slug, pass: {min,max} }
//     (fail_low = below pass.min, fail_high = above pass.max)
//
//   otherwise: the legacy two-instrument GAD-7 + PHQ-8 logic (Liliana), by the
//     questionnaire list order — byte-identical to the original path.
export function evaluateScreenerPhase2(responsesBySlug, phase2) {
  const scoring = phase2?.scoring ?? {}

  if (scoring.mode === 'range') {
    const slug  = scoring.questionnaire_slug
    const score = sumAnswers(responsesBySlug[slug] ?? {})
    const min   = scoring.pass?.min ?? -Infinity
    const max   = scoring.pass?.max ?? Infinity
    if (score < min) return 'fail_low'
    if (score > max) return 'fail_high'
    return 'pass'
  }

  const slugs = (phase2?.questionnaires ?? []).map(q => q.questionnaire_slug)
  return evaluatePhase2(responsesBySlug[slugs[0]] ?? {}, responsesBySlug[slugs[1]] ?? {})
}
