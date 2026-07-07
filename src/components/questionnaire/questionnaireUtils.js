// ── questionnaireUtils.js ──────────────────────────────────────────────────
//
// Shared helpers for building the flat slide sequence and resolving
// per-item scale labels. Used by QuestionnaireRenderer and admin pages.

// True when the definition is a checklist-type questionnaire (independently
// endorsed items with fixed point values). Absent questionnaire_type = likert.
export function isChecklistType(questionnaire) {
  return questionnaire?.questionnaire_type === 'checklist';
}

// Canonical stored response object for one checklist item.
// occurrenceCount 0 = unchecked; response_value is the weighted score.
export function checklistItemResponse(item, occurrenceCount) {
  const count = occurrenceCount > 0 ? occurrenceCount : 0;
  return {
    response_value:   (item.weight ?? 0) * count,
    item_weight:      item.weight ?? 0,
    occurrence_count: count,
  };
}

// Fill in never-touched items as unchecked so every checklist item has a
// stored response object.
export function normalizeChecklistResponses(questionnaire, responses) {
  const full = {};
  for (const item of questionnaire.items ?? []) {
    full[item.id] = responses[item.id] ?? checklistItemResponse(item, 0);
  }
  return full;
}

// Total checklist score = sum of weighted item scores (method: weighted_checklist).
export function computeChecklistTotal(questionnaire, responses) {
  return (questionnaire.items ?? []).reduce(
    (sum, item) => sum + (responses[item.id]?.response_value ?? 0), 0);
}

// Resolve effective scale labels for one item.
// Priority: item.scale_labels_override > questionnaire.scale_labels > numeric fallback.
export function effectiveLabels(item, questionnaire) {
  const source = item.scale_labels_override ?? questionnaire.scale_labels ?? null;
  const min = item.scale_min ?? source?.[0]?.value ?? 1;
  const max = item.scale_max ?? source?.[source.length - 1]?.value ?? 5;

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

// Returns true when only the first and last labels carry meaningful text —
// i.e. all middle entries have a label equal to String(value) or are absent.
// Used by LikertItem to switch to bracketed-anchor rendering.
export function isEndpointOnly(labels) {
  if (!labels || labels.length < 3) return false;
  const middle = labels.slice(1, -1);
  return middle.every(l => !l.label || l.label === String(l.value));
}

// Build a flat, ordered array of slide descriptors from a questionnaire definition.
// Types: 'instruction' | 'scale_change' | 'item'
// scale_change slides are auto-inserted when consecutive items have different labels.
export function buildSlides(questionnaire) {
  const slides = [];

  // Instruction screen is always first — mandatory speedbump
  slides.push({ type: 'instruction' });

  // Defensive: a malformed/empty definition (no items array) must not crash the
  // render. Return the instruction slide only; callers guard against empty
  // questionnaires before reaching here, but this keeps buildSlides total.
  const items = Array.isArray(questionnaire?.items) ? questionnaire.items : [];

  // Checklist questionnaires render as one scrollable screen of checkboxes
  // rather than one slide per item.
  if (isChecklistType(questionnaire)) {
    slides.push({ type: 'checklist', items, totalItems: items.length });
    return slides;
  }

  let prevLabels = null;
  let itemDisplayIndex = 0;
  const totalItems = items.length;

  items.forEach((item) => {
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

// Compute subscale scores from raw item responses.
// Returns { [subscaleName]: number } for all subscales in the definition.
// Handles reverse-scoring using per-item scale_min/scale_max with fallback to
// questionnaire-level scale_min/scale_max.
//
// subscales can be either:
//   array:  [{name, item_ids, reverse_items?, method?}, ...]
//   object: {subscaleName: {items, method, reverse_items?}, ...}
export function computeSubscaleScores(questionnaire, responses) {
  const scores = {};
  const subscales = questionnaire.scoring?.subscales;
  if (!subscales) return scores;

  const qMin = questionnaire.scale_min ?? 1;
  const qMax = questionnaire.scale_max ?? 5;
  const checklist = isChecklistType(questionnaire);

  const entries = Array.isArray(subscales)
    ? subscales
    : Object.entries(subscales).map(([name, s]) => ({ ...s, name, item_ids: s.item_ids ?? s.items }));

  for (const subscale of entries) {
    const itemIds = subscale.item_ids ?? subscale.items ?? [];
    const method  = subscale.method ?? questionnaire.scoring?.method ?? 'mean';

    const values = itemIds.map((id) => {
      // Checklist (weighted_checklist): per-item score is the stored weighted
      // value; unchecked/unseen items count as 0. No reverse scoring.
      if (checklist) return responses[id]?.response_value ?? 0;

      const item = questionnaire.items.find(i => i.id === id);
      let value = responses[id];
      if (value == null) return null;

      if (subscale.reverse_items?.includes(id)) {
        const min = item?.scale_min ?? qMin;
        const max = item?.scale_max ?? qMax;
        value = (min + max) - value;
      }
      return value;
    }).filter(v => v !== null);

    if (values.length === 0) {
      scores[subscale.name] = null;
      continue;
    }

    scores[subscale.name] = method === 'mean'
      ? values.reduce((a, b) => a + b, 0) / values.length
      : values.reduce((a, b) => a + b, 0);
  }

  return scores;
}

// Compute derived scores (e.g. SPANE-B) from already-computed subscale scores.
// Returns { [derivedName]: number } for all derived_scores in the definition.
// Supported operations: 'subtract' (operands[0] - operands[1]),
//                       'sum'      (sum of all operands),
//                       'mean'     (mean of all operands).
export function computeDerivedScores(questionnaire, subscaleScores) {
  const derived = {};
  const derivedDefs = questionnaire.scoring?.derived_scores;
  if (!derivedDefs) return derived;

  for (const def of derivedDefs) {
    const values = def.operands.map(name => subscaleScores[name]);
    if (values.some(v => v == null)) {
      derived[def.name] = null;
      continue;
    }

    switch (def.operation) {
      case 'subtract':
        derived[def.name] = values[0] - values[1];
        break;
      case 'sum':
        derived[def.name] = values.reduce((a, b) => a + b, 0);
        break;
      case 'mean':
        derived[def.name] = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      default:
        derived[def.name] = null;
    }
  }

  return derived;
}

// Validate a questionnaire JSON object — returns array of error strings.
export function validateDefinition(def) {
  const errors = [];
  if (!def || typeof def !== 'object') return ['Not a valid JSON object.'];
  if (!def.slug || typeof def.slug !== 'string') errors.push('Missing or invalid "slug".');
  if (!def.name || typeof def.name !== 'string') errors.push('Missing or invalid "name".');
  if (!def.instructions || typeof def.instructions !== 'string') errors.push('Missing "instructions".');
  if (!Array.isArray(def.items) || def.items.length === 0) errors.push('Missing or empty "items" array.');

  const qType = def.questionnaire_type ?? 'likert';
  if (qType !== 'likert' && qType !== 'checklist') {
    errors.push('"questionnaire_type" must be "likert" or "checklist".');
    return errors; // per-type checks below would be meaningless
  }
  const checklist = qType === 'checklist';

  if (checklist) {
    if (def.scale_min != null || def.scale_max != null || def.scale_labels != null) {
      errors.push('Checklist questionnaires must have null "scale_min", "scale_max", and "scale_labels".');
    }
    if (def.scoring?.method !== 'weighted_checklist') {
      errors.push('Checklist questionnaires require "scoring.method" = "weighted_checklist".');
    }
  }

  (def.items ?? []).forEach((item, i) => {
    const prefix = `Item ${i + 1}`;
    if (!item.id)   errors.push(`${prefix}: missing "id".`);
    if (!item.text) errors.push(`${prefix}: missing "text".`);

    if (checklist) {
      if (!Number.isInteger(item.weight) || item.weight < 0 || item.weight > 300) {
        errors.push(`${prefix}: checklist items require an integer "weight" between 0 and 300.`);
      }
      if (typeof item.allow_multiple !== 'boolean') {
        errors.push(`${prefix}: checklist items require boolean "allow_multiple".`);
      }
      if (item.scale_min != null || item.scale_max != null || item.scale_labels_override != null) {
        errors.push(`${prefix}: checklist items do not use scale_min/scale_max/scale_labels_override.`);
      }
      return;
    }

    if (item.type !== 'likert') errors.push(`${prefix}: only "likert" type is supported.`);
    const min = item.scale_min ?? def.scale_labels?.[0]?.value;
    const max = item.scale_max ?? def.scale_labels?.[def.scale_labels.length - 1]?.value;
    if (min == null || max == null) {
      errors.push(`${prefix}: cannot resolve scale range. Set scale_min/scale_max or provide questionnaire-level scale_labels.`);
    }
  });

  return errors;
}
