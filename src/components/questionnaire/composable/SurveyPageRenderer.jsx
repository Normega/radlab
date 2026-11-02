import SurveyComponentRenderer from './SurveyComponentRenderer'

// `missingIds`: questions left unanswered when Next was tapped. Each component
// sits in a `display: contents` wrapper, so the page layout is unchanged and the
// highlight is pure CSS on the card inside.
// `onAdvance` and `seed` reach only components that run their own flow
// (`ownsNavigation` in the registry); the others ignore them.
export default function SurveyPageRenderer({ page, responses, onChange, missingIds = [], onAdvance, seed }) {
  return (
    <div className="cs-page">
      {(page.components ?? []).map(component => (
        <div key={component.id} className={missingIds.includes(component.id) ? 'cs-component is-missing' : 'cs-component'}>
          <SurveyComponentRenderer
            config={component}
            value={responses[component.id]}
            onChange={value => onChange(component.id, value)}
            onAdvance={answer => onAdvance?.(component.id, answer)}
            seed={seed}
          />
        </div>
      ))}
    </div>
  )
}
