import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ADVANCED_INSTRUMENTS } from '../../components/study/advancedInstruments';

// ── QuestionnairesPage ─────────────────────────────────────────────────────
// /admin/questionnaires
// Global questionnaire library, two tabs:
//   standard — JSON-defined questionnaires uploaded to the questionnaires
//              table; lab members can upload, preview, lock/unlock.
//   advanced — coded (bespoke React) instruments from the advanced-
//              instruments registry. POLICY: every coded instrument must be
//              registered there so it stays reviewable here.

export default function QuestionnairesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'advanced' ? 'advanced' : 'standard';

  const { data: questionnaires, isLoading, isError, error } = useQuery({
    queryKey: ['questionnaires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questionnaires')
        .select('id, slug, name, locked, created_at, definition')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg)', padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'DM Serif Display', fontSize: 28, color: 'var(--tx)', margin: 0 }}>
          Questionnaire Library
        </h1>
        {tab === 'standard' && (
          <button
            onClick={() => navigate('/admin/questionnaires/new')}
            style={{
              background: 'var(--pk)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 20px',
              fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Upload questionnaire
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: '1px solid var(--bd)' }}>
        {[
          { id: 'standard', label: 'Standard (JSON)' },
          { id: 'advanced', label: 'Advanced (coded)' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSearchParams(t.id === 'standard' ? {} : { tab: t.id }, { replace: true })}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 14px 10px',
              fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)',
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? 'var(--pk)' : 'var(--tx2)',
              borderBottom: tab === t.id ? '2px solid var(--pk)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'advanced' ? (
        <AdvancedTab onPreview={key => navigate(`/admin/questionnaires/advanced/${key}`)} />
      ) : (
        <>
          {/* List */}
          {isLoading && (
            <p style={{ color: 'var(--tx3)', fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)' }}>
              Loading…
            </p>
          )}

          {isError && (
            <div
              style={{
                background: '#fff5f0', border: '1px solid #e67e22',
                borderRadius: 14, padding: 24,
              }}
            >
              <p style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: '#c0392b', margin: '0 0 6px', fontWeight: 600 }}>
                Database error
              </p>
              <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: '#8b4513', margin: 0 }}>
                {error?.message ?? 'Could not load questionnaires.'} — run <code>questionnaires_schema.sql</code> in the Supabase SQL editor if the table does not exist yet.
              </p>
            </div>
          )}

          {!isLoading && !isError && questionnaires?.length === 0 && (
            <div
              style={{
                background: 'var(--bgc)', border: '1px dashed var(--bds)',
                borderRadius: 14, padding: 40, textAlign: 'center',
              }}
            >
              <p style={{ color: 'var(--tx3)', fontFamily: 'DM Sans', fontSize: 'var(--fs-body)' }}>
                No questionnaires uploaded yet.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!isError && questionnaires?.map(q => (
              <QuestionnaireCard
                key={q.id}
                questionnaire={q}
                onPreview={() => navigate(`/admin/questionnaires/${q.slug}`)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AdvancedTab({ onPreview }) {
  return (
    <>
      <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)', margin: '0 0 16px', lineHeight: 1.6 }}>
        Coded instruments — built as React components rather than uploaded JSON, for designs the standard
        schema can't express (conditional branching, multi-select with exclusive options, custom widgets).
        Every coded instrument must be registered in{' '}
        <code style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)' }}>advancedInstruments.js</code>{' '}
        so it appears here for review.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ADVANCED_INSTRUMENTS.map(inst => (
          <div
            key={inst.key}
            style={{
              background: 'var(--bgc)', border: '1px solid var(--bd)',
              borderRadius: 14, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 16,
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚙️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body)', color: 'var(--tx)', margin: '0 0 2px', fontWeight: 600 }}>
                {inst.name}
              </p>
              <p style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: 'var(--tx3)', margin: '0 0 6px' }}>
                {inst.key}{inst.table ? ` · ${inst.table}` : ''}
              </p>
              <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)', margin: 0, lineHeight: 1.5 }}>
                {inst.description}
              </p>
            </div>
            {inst.previewable ? (
              <button
                onClick={() => onPreview(inst.key)}
                style={{
                  background: 'transparent', border: '1px solid var(--bds)',
                  borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
                  fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)',
                  flexShrink: 0,
                }}
              >
                Preview
              </button>
            ) : (
              <span style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: 'var(--tx3)', flexShrink: 0 }}>
                no preview
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function QuestionnaireCard({ questionnaire, onPreview }) {
  const itemCount = questionnaire.definition?.items?.length ?? '?';
  const date = new Date(questionnaire.created_at).toLocaleDateString();

  return (
    <div
      style={{
        background: 'var(--bgc)', border: '1px solid var(--bd)',
        borderRadius: 14, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}
    >
      {/* Lock icon */}
      <span style={{ fontSize: 18, flexShrink: 0 }}>
        {questionnaire.locked ? '🔒' : '🔓'}
      </span>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body)', color: 'var(--tx)', margin: '0 0 2px', fontWeight: 600 }}>
          {questionnaire.name}
        </p>
        <p style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: 'var(--tx3)', margin: 0 }}>
          {questionnaire.slug} · {itemCount} items · uploaded {date}
        </p>
      </div>

      {/* Preview button */}
      <button
        onClick={onPreview}
        style={{
          background: 'transparent', border: '1px solid var(--bds)',
          borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
          fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)',
          flexShrink: 0,
        }}
      >
        Preview
      </button>
    </div>
  );
}
