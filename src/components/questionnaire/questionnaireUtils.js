// ── questionnaireUtils.js ──────────────────────────────────────────────────
//
// Shared helpers for building the flat slide sequence and resolving
// per-item scale labels. Used by QuestionnaireRenderer and admin pages.

// Resolve effective scale labels for one item.
// Priority: item.scale_labels_override > questionnaire.scale_labels > numeric fallback.
export function effectiveLabels(item, questionnaire) {
  const min = item.scale_min ?? 1;
  const max = item.scale_max ?? 5;

  const source = item.scale_labels_override ?? questionnaire.scale_labels ?? null;

  if (source) {
    // Filter to this item's range (handles mixed-scale questionnaires)
    const filtered = source.filter(l => l.value >= min && l.value <= max);
    if (filtered.length > 0) return filtered;
  }

  // Numeric fallback — just show the number
  return Array.from({ length: max - min + 1 }, (_, i) => ({
    value: min + i,
    label: String(min + i),
    image: null,
  }));
}

export function labelsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Build a flat, ordered array of slide descriptors from a questionnaire definition.
// Types: 'instruction' | 'scale_change' | 'item'
// scale_change slides are auto-inserted when consecutive items have different labels.
export function buildSlides(questionnaire) {
  const slides = [];

  // Instruction screen is always first — mandatory speedbump
  slides.push({ type: 'instruction' });

  let prevLabels = null;
  let itemDisplayIndex = 0;
  const totalItems = questionnaire.items.length;

  questionnaire.items.forEach((item) => {
    const labels = effectiveLabels(item, questionnaire);
    if (prevLabels && !labelsEqual(prevLabels, labels)) {
      const anchorLow  = labels[0]?.label  ?? String(item.scale_min ?? 1);
      const anchorHigh = labels[labels.length - 1]?.label ?? String(item.scale_max ?? 5);
      slides.push({
        type: 'scale_change',
        labels,
        scaleMin:   labels[0]?.value,
        scaleMax:   labels[labels.length - 1]?.value,
        anchorLow,
        anchorHigh,
      });
    }
    itemDisplayIndex++;
    slides.push({ type: 'item', item, itemDisplayIndex, totalItems });
    prevLabels = labels;
  });

  return slides;
}

// When navigating back, skip over scale_change slides.
export function prevNavigableIndex(slides, currentIndex) {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (slides[i].type !== 'scale_change') return i;
  }
  return 0;
}

// Validate a questionnaire JSON object — returns array of error strings.
export function validateDefinition(def) {
  const errors = [];
  if (!def || typeof def !== 'object') return ['Not a valid JSON object.'];
  if (!def.slug || typeof def.slug !== 'string') errors.push('Missing or invalid "slug".');
  if (!def.name || typeof def.name !== 'string') errors.push('Missing or invalid "name".');
  if (!def.instructions || typeof def.instructions !== 'string') errors.push('Missing "instructions".');
  if (!Array.isArray(def.items) || def.items.length === 0) errors.push('Missing or empty "items" array.');

  (def.items ?? []).forEach((item, i) => {
    const prefix = `Item ${i + 1}`;
    if (!item.id)   errors.push(`${prefix}: missing "id".`);
    if (!item.text) errors.push(`${prefix}: missing "text".`);
    if (item.type !== 'likert') errors.push(`${prefix}: only "likert" type is supported.`);
    const min = item.scale_min ?? def.scale_labels?.[0]?.value;
    const max = item.scale_max ?? def.scale_labels?.[def.scale_labels.length - 1]?.value;
    if (min == null || max == null) {
      errors.push(`${prefix}: cannot resolve scale range. Set scale_min/scale_max or provide questionnaire-level scale_labels.`);
    }
  });

  return errors;
}
