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
