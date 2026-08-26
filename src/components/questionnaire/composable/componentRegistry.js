// Ported from Dana's radlab-composable-surveys package (2026-08-25, handoff in
// website.md §31). RADlab changes on top of her package: the likert_slider
// type (LikertSliderQuestion — the adopted discrete slider, which her package
// predates), registered here and validated in composableQuestionnaireUtils.
// Everything else is hers, verbatim.
import LikertQuestion from './LikertQuestion'
import SliderQuestion from './SliderQuestion'
import LikertSliderQuestion from './LikertSliderQuestion'
import MultipleChoiceQuestion from './MultipleChoiceQuestion'
import InformationBlock from './InformationBlock'
import OpenTextListQuestion from './OpenTextListQuestion'
import HierarchicalBeliefQuestion from './HierarchicalBeliefQuestion'

export const COMPONENT_TYPES = {
  likert: {
    label: 'Likert question',
    component: LikertQuestion,
    collectsResponse: true,
  },
  slider: {
    label: 'Slider question',
    component: SliderQuestion,
    collectsResponse: true,
  },
  likert_slider: {
    label: 'Likert slider',
    component: LikertSliderQuestion,
    collectsResponse: true,
  },
  multiple_choice: {
    label: 'Multiple choice',
    component: MultipleChoiceQuestion,
    collectsResponse: true,
  },
  information: {
    label: 'Information / text',
    component: InformationBlock,
    collectsResponse: false,
  },
  open_text_list: {
    label: 'Open response list + sliders',
    component: OpenTextListQuestion,
    collectsResponse: true,
  },
  hierarchical_belief: {
    label: 'Hierarchical belief selector',
    component: HierarchicalBeliefQuestion,
    collectsResponse: true,
  },
}

export function getComponentDefinition(type) {
  return COMPONENT_TYPES[type] ?? null
}

// RADlab addition: composable_instruments.type (DB names follow the admin
// sidebar) → component registry type (Dana's package contract). Used by the
// session step wrapper and the admin instrument pages.
export const DB_COMPONENT_TYPE = {
  likert_slider:   'likert_slider',
  multiple_choice: 'multiple_choice',
  open_list:       'open_text_list',
  hierarchy:       'hierarchical_belief',
}

export function responseIsComplete(config, value) {
  const type = config.type
  const required = config.required !== false

  if (type === 'information') return true

  if (type === 'likert' || type === 'slider' || type === 'likert_slider') {
    return !required || value != null
  }

  if (type === 'multiple_choice') {
    if (!value?.option_id) return !required

    const option = (config.options ?? []).find(item => item.id === value.option_id)
    if (!option) return false

    if (option.response_type !== 'text' && option.response_type !== 'number') {
      return true
    }

    const raw = String(value.value ?? '').trim()
    if (!raw) return false

    if (option.response_type === 'number') {
      const number = Number(raw)
      if (!Number.isFinite(number)) return false
      if (option.min != null && number < Number(option.min)) return false
      if (option.max != null && number > Number(option.max)) return false
    }

    return true
  }

  if (type === 'open_text_list') {
    const responses = Array.isArray(value) ? value : []
    const minimum = config.minimum_required_responses
      ?? (required ? 1 : 0)

    if (responses.length < minimum) return false

    return responses.every(response =>
      Boolean(String(response.factor ?? '').trim())
      && response.contribution != null
    )
  }

  if (type === 'hierarchical_belief') {
    const rows = Array.isArray(value) ? value : []
    const selected = rows.filter(row => row.changed)

    if (config.allow_none_selected === false && selected.length === 0) {
      return false
    }

    return selected.every(row => row.direction != null)
  }

  return false
}

export function defaultResponseFor(config) {
  if (config.type === 'open_text_list') return []

  if (config.type === 'hierarchical_belief') {
    return (config.beliefs ?? []).map(belief => ({
      id: belief.id,
      changed: false,
      direction: null,
    }))
  }

  return null
}

export function createDefaultComponent(type, id) {
  switch (type) {
    case 'likert':
      return {
        id,
        type,
        required: true,
        question: 'Enter your question here.',
        scale: [
          { value: 1, label: 'Not at all' },
          { value: 2, label: '' },
          { value: 3, label: '' },
          { value: 4, label: '' },
          { value: 5, label: '' },
          { value: 6, label: '' },
          { value: 7, label: 'Very much' },
        ],
      }

    case 'slider':
      return {
        id,
        type,
        required: true,
        question: 'Enter your slider question here.',
        min: 0,
        max: 100,
        step: 1,
        labels: [
          { value: 0, label: 'Low' },
          { value: 50, label: 'Middle' },
          { value: 100, label: 'High' },
        ],
      }

    case 'likert_slider':
      return {
        id,
        type,
        required: true,
        question: 'Enter your Likert slider question here.',
        min: 1,
        max: 6,
        step: 1,
        labels: [
          { value: 1, label: 'Never' },
          { value: 2, label: 'Rarely' },
          { value: 3, label: 'Sometimes' },
          { value: 4, label: 'Often' },
          { value: 5, label: 'Very often' },
          { value: 6, label: 'Almost always' },
        ],
      }

    case 'multiple_choice':
      return {
        id,
        type,
        required: true,
        question: 'Enter your multiple-choice question here.',
        options: [
          { id: `${id}_option_1`, label: 'Option 1', response_type: 'plain' },
          { id: `${id}_option_2`, label: 'Option 2', response_type: 'plain' },
        ],
      }

    case 'information':
      return {
        id,
        type,
        title: 'Task instructions',
        body: 'Enter your instructions or description here.',
        image_url: '',
        image_alt: '',
        image_caption: '',
        image_max_width: '680px',
      }

    case 'open_text_list':
      return {
        id,
        type,
        required: true,
        question: 'What factors contributed to this outcome?',
        initial_boxes: 3,
        response_box_width: '520px',
        max_words: 5,
        example_placeholder: 'Ex. I need better study strategies...',
        placeholder_prefix: 'Response',
        minimum_required_responses: 1,
        slider: {
          question: 'How much did this factor contribute to the outcome?',
          min: 0,
          max: 100,
          step: 1,
          labels: [
            { value: 0, label: 'Did not contribute' },
            { value: 50, label: 'Contributed somewhat' },
            { value: 100, label: 'Contributed a great deal' },
          ],
        },
      }

    case 'hierarchical_belief':
      return {
        id,
        type,
        question: 'How much did this feedback change your belief about…',
        instruction: 'Select all of the beliefs that changed. You can select more than one.',
        allow_none_selected: true,
        beliefs: [
          {
            id: `${id}_level_1`,
            level: 'Level 1',
            depth: 0,
            text: 'Enter the most specific belief here.',
          },
          {
            id: `${id}_level_2`,
            level: 'Level 2',
            depth: 1,
            text: 'Enter the next broader belief here.',
          },
        ],
        slider: {
          question: 'Did this belief change in a positive or negative direction?',
          min: -100,
          max: 100,
          step: 1,
          labels: [
            { value: -100, label: 'Much more negative' },
            { value: 0, label: 'No directional change' },
            { value: 100, label: 'Much more positive' },
          ],
        },
      }

    default:
      throw new Error(`Unknown composable component type: ${type}`)
  }
}
