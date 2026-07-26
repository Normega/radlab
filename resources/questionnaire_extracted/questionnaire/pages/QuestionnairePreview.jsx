import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import QuestionnaireRenderer from '../../components/questionnaire/QuestionnaireRenderer';

// ── QuestionnairePreview ───────────────────────────────────────────────────
// /admin/questionnaires/:slug
// Shows the full QuestionnaireRenderer in preview mode.
// Top bar: lock/unlock toggle, edit (if unlocked), back to library.

export default function QuestionnairePreview() {
  const { slug }    = useParams();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [showEditor, setShowEditor] = useState(false);
  const [editRaw,    setEditRaw]    = useState('');
  const [editError,  setEditError]  = useState('');
  const [previewKey, setPreviewKey] = useState(0); // bump to reset renderer

  const { data: q, isLoading } = useQuery({
    queryKey: ['questionnaire', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questionnaires')
        .select('*')
        .eq('slug', slug)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // ── Lock / unlock ────────────────────────────────────────────────────
  const toggleLock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('questionnaires')
        .update({ locked: !q.locked, updated_at: new Date().toISOString() })
        .eq('id', q.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire', slug] });
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
    },
  });

  // ── Save edit ────────────────────────────────────────────────────────
  const saveEdit = useMutation({
    mutationFn: async () => {
      let def;
      try { def = JSON.parse(editRaw); } catch (e) {
        throw new Error(`JSON parse error: ${e.message}`);
      }
      const { error } = await supabase
        .from('questionnaires')
        .update({
          definition: def,
          name:       def.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', q.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setShowEditor(false);
      setEditError('');
      setPreviewKey(k => k + 1);
      queryClient.invalidateQueries({ queryKey: ['questionnaire', slug] });
    },
    onError: (e) => setEditError(e.message),
  });

  function openEditor() {
    setEditRaw(JSON.stringify(q.definition, null, 2));
    setEditError('');
    setShowEditor(true);
  }

  if (isLoading) {
    return (
      <div style={{ padding: 40, background: 'var(--bg)', minHeight: '100vh' }}>
        <p style={{ color: 'var(--tx3)', fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)' }}>Loading…</p>
      </div>
    );
  }
  if (!q) return null;

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
        <button
          onClick={() => navigate('/admin/questionnaires')}
          style={ghostBtn}
        >
          ← Library
        </button>

        <span style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx)', fontWeight: 600, flex: 1 }}>
          {q.name}
          <span style={{ color: 'var(--tx3)', fontWeight: 400, marginLeft: 8 }}>preview</span>
        </span>

        {/* Reset preview */}
        <button
          onClick={() => setPreviewKey(k => k + 1)}
          style={ghostBtn}
          title="Restart preview from beginning"
        >
          ↺ Reset
        </button>

        {/* Edit — only when unlocked */}
        {!q.locked && (
          <button onClick={openEditor} style={ghostBtn}>
            ✏ Edit JSON
          </button>
        )}

        {/* Lock toggle */}
        <button
          onClick={() => toggleLock.mutate()}
          disabled={toggleLock.isPending}
          style={{
            ...ghostBtn,
            color:   q.locked ? 'var(--pk)' : 'var(--tx2)',
            border:  `1px solid ${q.locked ? 'var(--pkbs)' : 'var(--bd)'}`,
          }}
        >
          {q.locked ? '🔒 Locked' : '🔓 Unlocked'}
        </button>
      </div>

      {/* JSON editor overlay */}
      {showEditor && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              background: 'var(--bgc)', borderRadius: 16,
              padding: 24, width: '100%', maxWidth: 680,
              maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'DM Serif Display', fontSize: 20, color: 'var(--tx)', margin: 0 }}>
                Edit definition
              </h3>
              <button onClick={() => setShowEditor(false)} style={{ ...ghostBtn, border: 'none' }}>✕</button>
            </div>
            <textarea
              value={editRaw}
              onChange={e => setEditRaw(e.target.value)}
              style={{
                flex: 1, minHeight: 300, fontFamily: 'Space Mono',
                fontSize: 'var(--fs-mono-sm)', color: 'var(--tx)',
                background: 'var(--bg)', border: '1px solid var(--bd)',
                borderRadius: 10, padding: 12, resize: 'vertical', lineHeight: 1.6,
              }}
            />
            {editError && (
              <p style={{ color: '#c0392b', fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', margin: 0 }}>
                {editError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => saveEdit.mutate()}
                disabled={saveEdit.isPending}
                style={{
                  background: 'var(--pk)', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '10px 24px', cursor: 'pointer',
                  fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', fontWeight: 600,
                }}
              >
                {saveEdit.isPending ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => setShowEditor(false)} style={ghostBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Live renderer */}
      <QuestionnaireRenderer
        key={previewKey}
        questionnaire={q.definition}
        partNumber={1}
        totalParts={1}
        previewMode={true}
      />
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
