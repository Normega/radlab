// Questionnaire layout v2: render a legacy (item-based, one-item-per-screen)
// definition as labelled cards, several to a page.
//
// Why at render time rather than by rewriting definitions: the layout is a
// property of the STUDY (studies.questionnaire_layout), not of the instrument.
// The same PHQ or MPoD definition must keep rendering one item per screen in the
// studies that started that way (a format change mid-study confounds change over
// time with a change of administration) and as cards in v2 studies. Item ids are
// kept, so the stored responses and the export columns are identical in both.
//
// The rules follow the literature review (reports/Items per screen in web
// surveys.md, 2026-10-10):
//   - published item order, never shuffled (order is part of a validated scale);
//   - a new page wherever the response scale changes, so a page has one scale;
//   - about 8 items per page, split into near-equal pages rather than leaving a
//     stray item on the last page (34 items → 7, 7, 7, 7, 6);
//   - every card carries its own fully labelled options (no shared grid header);
//   - the instructions shown before item 1 and again at the top of every page,
//     as the legacy renderer kept them pinned above every item.
// Returns null where the definition cannot be shown faithfully this way
// (checklists, image labels, non-Likert items); the caller then keeps v1.

export const DEFAULT_ITEMS_PER_PAGE = 8

// Same rule as questionnaireUtils.effectiveLabels (kept React-free here so it is
// testable): the item's override, else the questionnaire's labels, filtered to the
// item's range; numbers where no labels are given.
export function effectiveLabels(item, questionnaire) {
  const source = item.scale_labels_override ?? questionnaire.scale_labels ?? null
  const min = item.scale_min ?? source?.[0]?.value ?? 1
  const max = item.scale_max ?? source?.[source.length - 1]?.value ?? 5
  if (source) {
    const filtered = source.filter(l => l.value >= min && l.value <= max)
    if (filtered.length > 0) return filtered
  }
  return Array.from({ length: max - min + 1 }, (_, i) => ({ value: min + i, label: String(min + i), image: null }))
}

// A card already shows each option's number, so a label that is only the number
// is dropped rather than shown twice ("2  2").
function toScale(labels) {
  return labels.map(l => ({
    value: l.value,
    label: l.label && l.label !== String(l.value) ? l.label : '',
  }))
}

export function pageSizes(n, perPage = DEFAULT_ITEMS_PER_PAGE) {
  if (n <= 0) return []
  const pages = Math.ceil(n / perPage)
  const base = Math.floor(n / pages)
  return Array.from({ length: pages }, (_, i) => base + (i < n % pages ? 1 : 0))
}

export function legacyToStacked(def, { perPage = DEFAULT_ITEMS_PER_PAGE } = {}) {
  if (!def || def.questionnaire_type === 'composable') return null
  if ((def.questionnaire_type ?? 'likert') !== 'likert') return null
  const items = def.items ?? []
  if (!items.length) return null
  if (items.some(i => (i.type ?? 'likert') !== 'likert')) return null

  // Consecutive runs of items sharing one response scale.
  const runs = []
  for (const item of items) {
    const labels = effectiveLabels(item, def)
    if (labels.some(l => l.image)) return null
    const key = JSON.stringify(labels.map(l => [l.value, l.label]))
    const last = runs[runs.length - 1]
    if (last && last.key === key) last.items.push({ item, labels })
    else runs.push({ key, items: [{ item, labels }] })
  }

  const instructions = (def.instructions ?? '').trim()
  const pages = []
  for (const run of runs) {
    let i = 0
    for (const size of pageSizes(run.items.length, perPage)) {
      const p = pages.length + 1
      const cards = run.items.slice(i, i + size).map(({ item, labels }) => ({
        id: item.id,
        type: 'likert',
        question: item.text,
        scale: toScale(labels),
        required: item.required !== false,
      }))
      i += size
      pages.push({
        id: `v2_p${p}`,
        components: instructions
          ? [{ id: `v2_instructions_p${p}`, type: 'information', title: '', body: instructions, image_url: '', image_alt: '' }, ...cards]
          : cards,
      })
    }
  }

  return {
    slug: def.slug,
    name: def.name,
    questionnaire_type: 'composable',
    instructions,
    pages,
    // Not read by the renderer; says where this came from to anyone inspecting it.
    converted_from: 'legacy_one_per_screen',
  }
}
