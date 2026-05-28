import { useState } from 'react'

export default function ConsentStep({ enrollment, onComplete, html }) {
  const [agreed, setAgreed] = useState(false)

  function handleAgree() {
    if (!agreed) return
    onComplete({ consented: true, consented_at: new Date().toISOString() })
  }

  return (
    <div style={S.wrap}>
      <h1 style={S.title}>Before We Begin</h1>

      <div style={S.body}>
        {html
          ? <div className="consent-body" dangerouslySetInnerHTML={{ __html: html }} />
          : <>
              <p><strong>Purpose of this study</strong></p>
              <p>
                You are being invited to take part in a research study conducted by the RADlab at the
                University of Toronto Mississauga. The purpose of this study is to understand how people
                perceive and regulate their emotions in response to various stimuli and tasks.
              </p>
              <p><strong>What you will do</strong></p>
              <p>
                During this session you will complete one or more tasks and questionnaires. The total
                time required is approximately 60–90 minutes. Your participation is entirely voluntary.
              </p>
              <p><strong>Confidentiality</strong></p>
              <p>
                Your responses will be kept confidential. Data will be stored securely and only accessed
                by members of the research team. Results will be reported in aggregate form only.
              </p>
              <p><strong>Your rights</strong></p>
              <p>
                You may withdraw at any time without penalty. If you have questions about this study,
                please speak with the researcher present in the room.
              </p>
              <p style={{ fontSize: 12, color: 'var(--tx3)', fontStyle: 'italic' }}>
                [PLACEHOLDER — attach a consent form to this study to replace this text]
              </p>
            </>
        }
      </div>

      <label style={S.checkRow}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: 'var(--pk)', flexShrink: 0 }}
        />
        <span style={S.checkLabel}>
          I have read and understood the above, and I agree to participate.
        </span>
      </label>

      <button
        style={{ ...S.btn, opacity: agreed ? 1 : 0.45, cursor: agreed ? 'pointer' : 'default' }}
        onClick={handleAgree}
        disabled={!agreed}
      >
        I Agree — Begin Study
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
    maxHeight: '45vh',
    overflowY: 'auto',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    cursor: 'pointer',
  },
  checkLabel: {
    fontSize: 15,
    color: 'var(--tx)',
    lineHeight: 1.5,
    fontFamily: '"DM Sans",system-ui,sans-serif',
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
    transition: 'opacity 0.15s',
  },
}
