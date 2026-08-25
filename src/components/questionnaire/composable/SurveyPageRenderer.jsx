import SurveyComponentRenderer from './SurveyComponentRenderer'

export default function SurveyPageRenderer({ page, responses, onChange }) {
  return (
    <div className="cs-page">
      {(page.components ?? []).map(component => (
        <SurveyComponentRenderer
          key={component.id}
          config={component}
          value={responses[component.id]}
          onChange={value => onChange(component.id, value)}
        />
      ))}
    </div>
  )
}
