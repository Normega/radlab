import { getComponentDefinition } from './componentRegistry'

export default function SurveyComponentRenderer({ config, value, onChange, onAdvance, seed }) {
  const definition = getComponentDefinition(config.type)

  if (!definition) {
    return (
      <div className="cs-error-card">
        Unknown survey component type: <code>{config.type}</code>
      </div>
    )
  }

  const Component = definition.component

  return (
    <Component
      config={config}
      value={value}
      onChange={onChange}
      onAdvance={onAdvance}
      seed={seed}
    />
  )
}
