export default function DebriefStep({ enrollment, onComplete, html }) {
  function handleComplete() {
    onComplete({ debriefed_at: new Date().toISOString() })
  }

  return (
    <div style={S.wrap}>
      <h1 style={S.title}>Thank You</h1>

      <div style={S.body}>
        {html
          ? <div className="consent-body" dangerouslySetInnerHTML={{ __html: html }} />
          : <>
              <p><strong>About this study</strong></p>
              <p>
                This study examines how people experience and regulate their emotions in the context of
                physiological feedback and cognitive tasks. Your data will help us better understand the
                relationship between bodily signals and emotional experience.
              </p>
              <p><strong>What we measured</strong></p>
              <p>
                During the tasks, we recorded your responses to various stimuli and, where applicable,
                physiological signals such as heart rate. All data are completely anonymous and will be
                analysed at the group level.
              </p>
              <p><strong>Further information</strong></p>
              <p>
                If you have questions about this research after leaving, please contact the RADlab at
                the University of Toronto Mississauga. Contact details are available at radlab.zone.
              </p>
              <p>Thank you for your time and contribution to this research.</p>
              <p style={{ fontSize: 12, color: 'var(--tx3)', fontStyle: 'italic' }}>
                [PLACEHOLDER — attach a debrief form to this study to replace this text]
              </p>
            </>
        }
      </div>

      <button style={S.btn} onClick={handleComplete}>
        Complete Session
      </button>
    </div>
  )
}

const S = {
  wrap: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '40px 24px 60px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  title: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 32,
    fontWeight: 400,
    color: 'var(--tx)',
    margin: 0,
  },
  body: {
    fontSize: 15,
    lineHeight: 1.75,
    color: 'var(--tx)',
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 12,
    padding: '24px 28px',
    maxHeight: '50vh',
    overflowY: 'auto',
  },
  btn: {
    alignSelf: 'flex-start',
    background: 'var(--pk)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 28px',
    fontSize: 16,
    fontWeight: 500,
    fontFamily: '"DM Sans",system-ui,sans-serif',
    cursor: 'pointer',
  },
}
