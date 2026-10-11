import { useEffect } from 'react'

// Participant sessions are not offered to the browser's page translator.
//
// Two reasons. (1) A questionnaire is an instrument: a machine-translated item is
// a different item, and studies recruit fluent English speakers. (2) Translation
// replaces the page's text nodes with its own, and when React later removes one
// it is no longer there: "Failed to execute 'removeChild' on 'Node'", which
// crashed 30 Chrome/Edge participants of Sense Foraging Study 1 on 2026-10-11
// (Safari and Firefox users, who see no auto-translate, never crashed).
//
// `translate="no"` on <html> stops Chrome and Edge translating the page, and the
// `notranslate` class covers Google's older translator. Set while the session is
// mounted and restored after, so the rest of the site keeps its normal behaviour.
export function setNoTranslate(doc) {
  const el = doc?.documentElement
  if (!el) return () => {}
  const prev = el.getAttribute('translate')
  const hadClass = el.classList.contains('notranslate')
  el.setAttribute('translate', 'no')
  el.classList.add('notranslate')
  return () => {
    if (prev == null) el.removeAttribute('translate')
    else el.setAttribute('translate', prev)
    if (!hadClass) el.classList.remove('notranslate')
  }
}

export function useNoTranslate() {
  useEffect(() => setNoTranslate(typeof document === 'undefined' ? null : document), [])
}
