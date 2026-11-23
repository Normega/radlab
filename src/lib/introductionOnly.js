// An introduction-only composable definition: instructions to read and nothing to answer.
//
// The Sense Foraging 2b retest's no-vignette arm sees the vignettes' introduction on the
// same instructions card as the vignette arm, and then nothing else (sf2b-retest-intro:
// sf2b-vignettes' name and instructions, one page with no components). The renderer ends
// such a step at "Begin" rather than showing a blank page, and the validator accepts this
// one shape of empty page; any other definition still needs a component on every page.

export function isIntroductionOnly(definition) {
  const pages = definition?.pages
  return typeof definition?.instructions === 'string'
    && definition.instructions.trim() !== ''
    && Array.isArray(pages) && pages.length > 0
    && pages.every(page => Array.isArray(page?.components) && page.components.length === 0)
}
