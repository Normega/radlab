import { useState, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ADVANCED_INSTRUMENTS, getAdvancedInstrument } from '../../components/study/advancedInstruments';

// ── AdvancedInstrumentPreview ──────────────────────────────────────────────
// /admin/questionnaires/advanced/:key
// Renders a coded (non-JSON) instrument from the advanced-instruments
// registry in preview mode — the component's own previewMode prop guarantees
// no database writes. Mirrors QuestionnairePreview's top bar.

// Preview stand-in for a study_enrollments row. previewMode components never
// insert, so ids are never sent anywhere.
const PREVIEW_ENROLLMENT = {
  id: null,
  profile_id: null,
  user_id: null,
  external_id: 'PREVIEW',
  study_id: null,
};

// lazy() components must be created once at module scope, not during render
const PREVIEW_COMPONENTS = Object.fromEntries(
  ADVANCED_INSTRUMENTS.filter(i => i.previewable).map(i => [i.key, lazy(i.load)])
);

export default function AdvancedInstrumentPreview() {
  const { key }  = useParams();
  const navigate = useNavigate();

  const instrument = getAdvancedInstrument(key);
  const [previewKey, setPreviewKey] = useState(0);
  const [completed,  setCompleted]  = useState(false);

  const StepComponent = PREVIEW_COMPONENTS[key] ?? null;

  function reset() {
    setCompleted(false);
    setPreviewKey(k => k + 1);
  }

  if (!instrument) {
    return (
      <div style={{ padding: 40, background: 'var(--bg)', minHeight: '100vh' }}>
        <p style={{ color: 'var(--tx3)', fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)' }}>
          No advanced instrument registered under “{key}”.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Admin top bar */}
      <div
        style={{
          background:   'var(--bgc)',
          borderBottom: '1px solid var(--bd)',
          padding:      '12px 20px',
          display:      'flex',
          alignItems:   'center',
          gap:          12,
          position:     'sticky',
          top:          0,
          zIndex:       30,
        }}
      >
        <button onClick={() => navigate('/admin/questionnaires?tab=advanced')} style={ghostBtn}>
          ← Library
        </button>

        <span style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx)', fontWeight: 600, flex: 1 }}>
          {instrument.name}
          <span style={{ color: 'var(--tx3)', fontWeight: 400, marginLeft: 8 }}>
            preview · no data is saved
          </span>
        </span>

        <button onClick={reset} style={ghostBtn} title="Restart preview from beginning">
          ↺ Reset
        </button>
      </div>

      {/* Instrument metadata strip */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--bd)', background: 'var(--bgc)' }}>
        <p style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: 'var(--tx3)', margin: 0 }}>
          {instrument.source}
          {instrument.table && <> · writes to <strong>{instrument.table}</strong></>}
        </p>
      </div>

      {completed ? (
        <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'DM Serif Display', fontSize: 24, color: 'var(--tx)', margin: '0 0 8px' }}>
            Preview complete
          </p>
          <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)', margin: '0 0 20px' }}>
            The participant would now advance to the next session step. Nothing was written to the database.
          </p>
          <button
            onClick={reset}
            style={{
              background: 'var(--pk)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 24px', cursor: 'pointer',
              fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', fontWeight: 600,
            }}
          >
            ↺ Run preview again
          </button>
        </div>
      ) : StepComponent ? (
        <Suspense
          fallback={
            <p style={{ padding: 40, color: 'var(--tx3)', fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)' }}>
              Loading instrument…
            </p>
          }
        >
          <StepComponent
            key={previewKey}
            enrollment={PREVIEW_ENROLLMENT}
            scheduleId={null}
            previewMode={true}
            onComplete={() => setCompleted(true)}
          />
        </Suspense>
      ) : (
        <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 24px' }}>
          <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body)', color: 'var(--tx2)', lineHeight: 1.6 }}>
            {instrument.description}
          </p>
        </div>
      )}
    </div>
  );
}

const ghostBtn = {
  background:   'transparent',
  border:       '1px solid var(--bd)',
  borderRadius: 8,
  padding:      '6px 14px',
  cursor:       'pointer',
  fontFamily:   'DM Sans',
  fontSize:     'var(--fs-body-sm)',
  color:        'var(--tx2)',
  flexShrink:   0,
};
