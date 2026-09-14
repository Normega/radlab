import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  pickerLabel, pickerSubcategory, nameColumn, instrumentDisplayName, isRenameable,
} from '../../lib/instrumentRename'

// ── RenameInstrumentButton ───────────────────────────────────────────────────
// Changes what people read, and nothing else.
//
// The slug stays put. It is the key a live session step resolves
// (`activities.subcategory` -> VasStepWrapper -> `.eq('slug', …)`) and the value
// each answer records, which is what names that answer's column in the export.
// Eight studies are running against these rows, so a rename that touched the
// slug would strand their steps and split a variable across two export columns.
// The database enforces this independently of this component:
// `forbid_slug_change_trg` refuses a slug change from authenticated/anon
// (20260912_instrument_names_and_slug_lock.sql).
//
// Two writes, and the second is not optional: `activities.label` holds the copy
// of the name the session builder's picker shows. A library that renamed the
// instrument while the picker kept the old name is the confusion this feature
// exists to end, so a failure on the second write is reported as a failed
// rename rather than swallowed.
//
// Both writes assert they hit exactly one row. Under RLS an UPDATE that matches
// nothing returns no error — the silent no-op — so `.select('id')` is what turns
// a policy mismatch or a wrong picker key into a visible red message instead of
// a green one over an unchanged database.
export default function RenameInstrumentButton({ row, cfg, onRenamed, buttonStyle }) {
  const current = instrumentDisplayName(row)
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(current)
  const [error, setError]     = useState(null)

  const rename = useMutation({
    mutationFn: async (next) => {
      const { data: renamed, error: updErr } = await supabase
        .from(cfg.table)
        .update({ [nameColumn(cfg.kind)]: next })
        .eq('id', row.id)
        .select('id')
      if (updErr) throw new Error(updErr.message)
      if ((renamed ?? []).length !== 1) {
        throw new Error(
          'Nothing was renamed — the database accepted the request but changed no row. '
          + 'This usually means your account lacks permission to edit this instrument.'
        )
      }

      // Keyed on subcategory alone, which is unique across all 174 picker rows.
      // Category is NOT part of the filter on purpose: it drifts by family — a
      // VAS package is registered under 'assessment', a scale under 'vas', and
      // rows created before the 2026-08-25 seeds migration carry the older value
      // (SessionBuilder derives the display category for exactly this reason).
      // Matching on it would reintroduce the silent no-op this guard removes.
      const { data: picker, error: actErr } = await supabase
        .from('activities')
        .update({ label: pickerLabel(cfg.typeTitle, next) })
        .eq('subcategory', pickerSubcategory(cfg.kind, row.slug))
        .select('id')
      if (actErr) {
        throw new Error(`The name saved, but the session builder's list did not update: ${actErr.message}`)
      }
      if ((picker ?? []).length !== 1) {
        throw new Error(
          `The name saved, but the session builder's list did not update: `
          + `${(picker ?? []).length} picker entries matched "${pickerSubcategory(cfg.kind, row.slug)}" (expected 1). `
          + `The library and the picker now disagree — tell someone before building a session with it.`
        )
      }
    },
    onSuccess: () => { setEditing(false); setError(null); onRenamed() },
    onError: (e) => setError(e.message),
  })

  const btn = buttonStyle ?? S.btn

  if (!editing) {
    return (
      <button style={btn} onClick={() => { setName(current); setError(null); setEditing(true) }}>
        Rename
      </button>
    )
  }

  return (
    <span style={S.wrap}>
      <input
        autoFocus
        style={S.input}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && isRenameable(current, name)) rename.mutate(name.trim())
          if (e.key === 'Escape') { setEditing(false); setError(null) }
        }}
        aria-label="Instrument name"
      />
      <button
        style={btn}
        disabled={!isRenameable(current, name) || rename.isPending}
        onClick={() => rename.mutate(name.trim())}
      >
        {rename.isPending ? 'Saving…' : 'Save'}
      </button>
      <button style={btn} onClick={() => { setEditing(false); setError(null) }}>Cancel</button>
      {error && <span style={S.err}>{error}</span>}
    </span>
  )
}

const SANS = '"DM Sans",system-ui,sans-serif'

const S = {
  wrap:  { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  input: {
    fontFamily: SANS, fontSize: 13, border: '1px solid var(--pkbs)', borderRadius: 6,
    padding: '5px 8px', color: 'var(--tx)', background: '#fff', minWidth: 220,
  },
  btn: {
    fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: 'var(--pkd)',
    background: 'none', border: '1px solid var(--pkbs)', borderRadius: 20,
    padding: '3px 12px', whiteSpace: 'nowrap', cursor: 'pointer',
  },
  err: {
    fontFamily: SANS, fontSize: 12, color: 'var(--err-tx, #b3261e)',
    flexBasis: '100%', lineHeight: 1.5,
  },
}
