import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { validateDefinition } from '../../components/questionnaire/questionnaireUtils';

// ── QuestionnaireUpload ────────────────────────────────────────────────────
// /admin/questionnaires/new
// Paste or file-upload a JSON definition, validate, preview structure, save.

export default function QuestionnaireUpload() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const fileInputRef = useRef(null);

  const [raw,      setRaw]      = useState('');
  const [parsed,   setParsed]   = useState(null);
  const [errors,   setErrors]   = useState([]);
  const [jsonError, setJsonError] = useState('');

  // ── Parse + validate on every raw change ─────────────────────────────
  function handleRawChange(text) {
    setRaw(text);
    setJsonError('');
    setErrors([]);
    setParsed(null);
    if (!text.trim()) return;
    let def;
    try {
      def = JSON.parse(text);
    } catch (e) {
      setJsonError(`JSON parse error: ${e.message}`);
      return;
    }
    const errs = validateDefinition(def);
    setErrors(errs);
    if (errs.length === 0) setParsed(def);
  }

  // ── File upload handler ────────────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleRawChange(ev.target.result);
    reader.readAsText(file);
  }

  // ── Save to Supabase ───────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('questionnaires').insert({
        slug:       parsed.slug,
        name:       parsed.name,
        definition: parsed,
        locked:     false,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      navigate(`/admin/questionnaires/${parsed.slug}`);
    },
  });

  const isReady = parsed && errors.length === 0;

  return (
    <div
      style={{
        minHeight: '100vh', background: 'var(--bg)',
        padding: '32px 24px', maxWidth: 720, margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button
          onClick={() => navigate('/admin/questionnaires')}
          style={{
            background: 'transparent', border: '1px solid var(--bd)',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
            fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)',
          }}
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: 'DM Serif Display', fontSize: 24, color: 'var(--tx)', margin: 0 }}>
          Upload questionnaire
        </h1>
      </div>

      {/* File upload strip */}
      <div
        style={{
          background: 'var(--bgc)', border: '1px dashed var(--bds)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 16,
        }}
      >
        <input
          type="file" accept=".json"
          ref={fileInputRef}
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'var(--bgp)', border: '1px solid var(--pkbs)',
            borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
            fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--pkd)',
          }}
        >
          Choose .json file
        </button>
        <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx3)', margin: 0 }}>
          or paste JSON below
        </p>
      </div>

      {/* JSON textarea */}
      <textarea
        value={raw}
        onChange={e => handleRawChange(e.target.value)}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        style={{
          width: '100%', minHeight: 280, boxSizing: 'border-box',
          fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)',
          color: 'var(--tx)', background: 'var(--bgc)',
          border: `1px solid ${jsonError ? '#c0392b' : errors.length ? '#e67e22' : 'var(--bd)'}`,
          borderRadius: 12, padding: 16, resize: 'vertical',
          lineHeight: 1.6,
        }}
      />

      {/* JSON parse error */}
      {jsonError && (
        <p style={{ color: '#c0392b', fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', margin: '8px 0' }}>
          {jsonError}
        </p>
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <div
          style={{
            background: '#fff5f0', border: '1px solid #e67e22',
            borderRadius: 10, padding: '12px 16px', margin: '12px 0',
          }}
        >
          <p style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: '#c0392b', margin: '0 0 6px', fontWeight: 600 }}>
            {errors.length} validation error{errors.length > 1 ? 's' : ''}
          </p>
          {errors.map((e, i) => (
            <p key={i} style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: '#8b4513', margin: '2px 0' }}>
              · {e}
            </p>
          ))}
        </div>
      )}

      {/* Parsed summary */}
      {isReady && (
        <div
          style={{
            background: 'var(--bgp)', border: '1px solid var(--pkb)',
            borderRadius: 10, padding: '12px 16px', margin: '12px 0',
          }}
        >
          <p style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: 'var(--pk)', margin: '0 0 4px' }}>
            ✓ Valid
          </p>
          <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)', margin: 0 }}>
            <strong>{parsed.name}</strong> · slug: {parsed.slug} · {parsed.items.length} items
            · auto_advance: {parsed.auto_advance === false ? 'off' : 'on'}
          </p>
        </div>
      )}

      {/* Save error */}
      {save.isError && (
        <p style={{ color: '#c0392b', fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', margin: '8px 0' }}>
          {save.error?.message?.includes('duplicate') || save.error?.message?.includes('unique')
            ? `A questionnaire with slug "${parsed?.slug}" already exists.`
            : `Save failed: ${save.error?.message}`}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          onClick={() => save.mutate()}
          disabled={!isReady || save.isPending}
          style={{
            background: isReady ? 'var(--pk)' : 'var(--bd)',
            color: isReady ? '#fff' : 'var(--tx3)',
            border: 'none', borderRadius: 10,
            padding: '12px 28px', cursor: isReady ? 'pointer' : 'default',
            fontFamily: 'DM Sans', fontSize: 'var(--fs-body)', fontWeight: 600,
          }}
        >
          {save.isPending ? 'Saving…' : 'Save questionnaire'}
        </button>
      </div>
    </div>
  );
}

const PLACEHOLDER = `{
  "slug": "panas",
  "name": "PANAS",
  "auto_advance": true,
  "instructions": "Rate each word to the extent you feel this way right now.",
  "scale_labels": [
    { "value": 1, "label": "Very slightly or not at all" },
    { "value": 2, "label": "A little" },
    { "value": 3, "label": "Moderately" },
    { "value": 4, "label": "Quite a bit" },
    { "value": 5, "label": "Extremely" }
  ],
  "items": [
    {
      "id": "panas_1",
      "text": "Interested",
      "type": "likert",
      "scale_min": 1,
      "scale_max": 5,
      "subscale": "positive",
      "reverse_score": false,
      "required": true,
      "scale_labels_override": null
    }
  ],
  "scoring": {
    "subscales": {
      "positive": { "items": ["panas_1"], "method": "sum" }
    }
  }
}`;
