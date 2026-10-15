// Support services offered to everyone a screener turns away (Norm,
// 2026-10-15: "always offer the health support info"). A study's own list
// (studies.screener.resources) is used when it has one; this is the fallback so
// no not-eligible screen is ever shown without somewhere to turn.
export const DEFAULT_SUPPORT_RESOURCES = [
  { name: 'U of T Telus Health Student Support', contact: '1-844-451-9700 (24/7)' },
  { name: 'Good2Talk Student Helpline',          contact: '1-866-925-5454 (24/7)' },
  { name: 'Talk Suicide Canada',                 contact: '1-833-456-4566 (24/7)' },
]

export function supportResourcesFor(screener) {
  const list = screener?.resources
  return Array.isArray(list) && list.length ? list : DEFAULT_SUPPORT_RESOURCES
}
