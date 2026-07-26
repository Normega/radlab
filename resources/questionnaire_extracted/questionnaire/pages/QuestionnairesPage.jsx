import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// ── QuestionnairesPage ─────────────────────────────────────────────────────
// /admin/questionnaires
// Global questionnaire library. Lab members can upload, preview, lock/unlock.

export default function QuestionnairesPage() {
  const navigate = useNavigate();

  const { data: questionnaires, isLoading } = useQuery({
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
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'DM Serif Display', fontSize: 28, color: 'var(--tx)', margin: 0 }}>
          Questionnaire Library
        </h1>
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
      </div>

      {/* List */}
      {isLoading && (
        <p style={{ color: 'var(--tx3)', fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)' }}>
          Loading…
        </p>
      )}

      {!isLoading && questionnaires?.length === 0 && (
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
        {questionnaires?.map(q => (
          <QuestionnaireCard
            key={q.id}
            questionnaire={q}
            onPreview={() => navigate(`/admin/questionnaires/${q.slug}`)}
          />
        ))}
      </div>
    </div>
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
