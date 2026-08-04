import InterventionPage from '../../components/study/InterventionPage'

// Dev-only harness for the body_diagram intervention block (stickman figure).
// Route: /dev/body-diagram-preview

const MODULE = {
  title: 'Body Diagram Preview',
  lesson: 0,
  lead_in: {
    owl: 'owl_happy',
    text: 'Dev preview of the body-diagram block. Click Next to see the figure.',
  },
  lead_out: {
    owl: 'owl_excited',
    text: 'End of preview.',
  },
  steps: [
    {
      type: 'body_diagram',
      title: 'Noticing stress in your body',
      instruction:
        'When stress shows up, where do you notice it? Fill in each field — the figure lights up as you go.',
    },
  ],
}

export default function BodyDiagramPreview() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <InterventionPage
        module={MODULE}
        participantId={null}
        dayDataId={null}
        scheduleId={null}
        studyDay={0}
        onComplete={() => {}}
        demoMode
      />
    </div>
  )
}
