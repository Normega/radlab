import {
  COMPONENT_TYPES,
  defaultResponseFor,
  responseIsComplete,
} from './componentRegistry'

export function isComposableQuestionnaire(questionnaire) {
  return questionnaire?.questionnaire_type === 'composable'
}

export function allComponents(questionnaire) {
  return (questionnaire?.pages ?? []).flatMap(page => page.components ?? [])
}

export function pageIsComplete(page, responses) {
  return (page?.components ?? []).every(component => {
    if (!COMPONENT_TYPES[component.type]) return false
    return responseIsComplete(component, responses?.[component.id])
  })
}

export function normalizeComposableResponses(questionnaire, responses) {
  const normalized = {}

  for (const component of allComponents(questionnaire)) {
    const definition = COMPONENT_TYPES[component.type]
    if (!definition?.collectsResponse) continue

    normalized[component.id] =
      responses?.[component.id] !== undefined
        ? responses[component.id]
        : defaultResponseFor(component)
  }

  return normalized
}

function validateScale(scale, prefix, errors) {
  if (!Array.isArray(scale) || scale.length < 2) {
    errors.push(`${prefix}: scale must contain at least two points.`)
    return
  }

  const values = scale.map(point => Number(point.value))
  if (values.some(value => !Number.isFinite(value))) {
    errors.push(`${prefix}: every scale point requires a numeric value.`)
  }

  if (new Set(values).size !== values.length) {
    errors.push(`${prefix}: scale values must be unique.`)
  }
}

function validateSlider(slider, prefix, errors) {
  const min = Number(slider?.min)
  const max = Number(slider?.max)
  const step = Number(slider?.step ?? 1)

  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    errors.push(`${prefix}: slider requires numeric min < max.`)
  }

  if (!Number.isFinite(step) || step <= 0) {
    errors.push(`${prefix}: slider step must be greater than 0.`)
  }

  for (const label of slider?.labels ?? []) {
    if (!label?.label) continue
    if (label.value === '' || label.value == null) {
      errors.push(`${prefix}: every visible slider label requires a numeric position.`)
      continue
    }
    const value = Number(label.value)
    if (!Number.isFinite(value) || value < min || value > max) {
      errors.push(`${prefix}: slider label values must fall within the slider range.`)
    }
  }
}

export function validateComposableDefinition(definition) {
  const errors = []

  if (!definition || typeof definition !== 'object') {
    return ['Not a valid questionnaire definition.']
  }

  if (definition.questionnaire_type !== 'composable') {
    errors.push('"questionnaire_type" must be "composable".')
  }

  if (!definition.slug || typeof definition.slug !== 'string') {
    errors.push('Missing or invalid "slug".')
  }

  if (!definition.name || typeof definition.name !== 'string') {
    errors.push('Missing or invalid "name".')
  }

  if (!Array.isArray(definition.pages) || definition.pages.length === 0) {
    errors.push('Composable questionnaires require a non-empty "pages" array.')
    return errors
  }

  const pageIds = new Set()
  const componentIds = new Set()

  definition.pages.forEach((page, pageIndex) => {
    const pagePrefix = `Page ${pageIndex + 1}`

    if (!page.id) errors.push(`${pagePrefix}: missing "id".`)
    else if (pageIds.has(page.id)) errors.push(`${pagePrefix}: duplicate page id "${page.id}".`)
    else pageIds.add(page.id)

    if (!Array.isArray(page.components)) {
      errors.push(`${pagePrefix}: "components" must be an array.`)
      return
    }

    if (page.components.length === 0) {
      errors.push(`${pagePrefix}: add at least one component.`)
    }

    page.components.forEach((component, componentIndex) => {
      const prefix = `${pagePrefix}, component ${componentIndex + 1}`

      if (!component.id) {
        errors.push(`${prefix}: missing "id".`)
      } else if (componentIds.has(component.id)) {
        errors.push(`${prefix}: duplicate component id "${component.id}".`)
      } else {
        componentIds.add(component.id)
      }

      if (!COMPONENT_TYPES[component.type]) {
        errors.push(`${prefix}: unknown type "${component.type}".`)
        return
      }

      if (component.type !== 'information' && !component.question) {
        errors.push(`${prefix}: missing "question".`)
      }

      if (component.type === 'likert') {
        validateScale(component.scale, prefix, errors)
      }

      if (component.type === 'slider' || component.type === 'likert_slider') {
        validateSlider(component, prefix, errors)
      }

      if (component.type === 'multiple_choice') {
        if (!Array.isArray(component.options) || component.options.length < 2) {
          errors.push(`${prefix}: multiple choice requires at least two options.`)
        } else {
          const optionIds = new Set()
          component.options.forEach((option, optionIndex) => {
            if (!option.id) errors.push(`${prefix}, option ${optionIndex + 1}: missing id.`)
            else if (optionIds.has(option.id)) errors.push(`${prefix}: duplicate option id "${option.id}".`)
            else optionIds.add(option.id)

            if (!option.label) errors.push(`${prefix}, option ${optionIndex + 1}: missing label.`)

            const allowed = ['plain', 'text', 'number']
            if (!allowed.includes(option.response_type ?? 'plain')) {
              errors.push(`${prefix}, option ${optionIndex + 1}: invalid response_type.`)
            }
          })
        }
      }

      if (component.type === 'open_text_list') {
        if ((component.initial_boxes ?? 3) < 1) {
          errors.push(`${prefix}: initial_boxes must be at least 1.`)
        }
        if (component.max_words != null && component.max_words < 1) {
          errors.push(`${prefix}: max_words must be at least 1 or null.`)
        }
        validateSlider(component.slider, `${prefix} contribution slider`, errors)
      }

      if (component.type === 'hierarchical_belief') {
        if (!Array.isArray(component.beliefs) || component.beliefs.length === 0) {
          errors.push(`${prefix}: hierarchical belief component requires beliefs.`)
        }
        validateSlider(component.slider, `${prefix} direction slider`, errors)
      }
    })
  })

  return errors
}
