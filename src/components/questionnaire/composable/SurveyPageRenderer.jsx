import SurveyComponentRenderer from './SurveyComponentRenderer'

// `missingIds`: questions left unanswered when Next was tapped. Each component
// sits in a `display: contents` wrapper, so the page layout is unchanged and the
// highlight is pure CSS on the card inside.
export default function SurveyPageRenderer({ page, responses, onChange, missingIds = [] }) {
  return (
    <div className="cs-page">
      {(page.components ?? []).map(component => (
        <div key={component.id} className={missingIds.includes(component.id) ? 'cs-component is-missing' : 'cs-component'}>
          <SurveyComponentRenderer
            config={component}
            value={responses[component.id]}
            onChange={value => onChange(component.id, value)}
          />
        </div>
      ))}
    </div>
  )
}
