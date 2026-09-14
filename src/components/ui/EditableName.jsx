import { useState } from 'react'
import PrimaryCTA from './PrimaryCTA'
import SecondaryCTA from './SecondaryCTA'

/**
 * EditableName — design-system rename control (Figma "EditableName", Sept 14
 * 2026 handoff). One standardized component for renaming the Ripple
 * (/ripple) and the display name (/account), replacing the two near-identical
 * inline state machines those pages carried.
 *
 * Closed: current name + a pink-outline "Rename" (SecondaryCTA per Figma).
 * Open:   input + PrimaryCTA Save + SecondaryCTA Cancel. Enter saves,
 *         Escape cancels. Formal buttons both states — no bare text links.
 *
 * `onSave(name)` is the caller's persistence: resolve truthy on success
 * (closes), falsy on failure (stays open and editable so the attempt isn't
 * lost). Error copy renders in the caller, next to whatever else it manages.
 *
 * `initialInput` lets /account seed the field with the raw stored name
 * rather than the displayed fallback; defaults to `name`.
 */
export default function EditableName({
  name,
  onSave,
  ariaLabel = 'Name',
  initialInput,
  nameStyle,
  maxLength = 60,
}) {
  const [editing, setEditing] = useState(false)
  const [input,   setInput]   = useState('')
  const [saving,  setSaving]  = useState(false)

  function open() {
    setInput(initialInput ?? name ?? '')
    setEditing(true)
  }

  async function save() {
    if (saving) return
    setSaving(true)
    const ok = await onSave(input.trim())
    setSaving(false)
    if (ok) setEditing(false)
  }

  if (!editing) {
    return (
      <span style={S.wrap}>
        <span style={{ ...S.name, ...nameStyle }}>{name}</span>
        <SecondaryCTA onClick={open} style={S.rename}>Rename</SecondaryCTA>
      </span>
    )
  }

  return (
    <span style={S.wrap}>
      <input
        autoFocus
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        style={S.input}
        maxLength={maxLength}
        aria-label={ariaLabel}
      />
      <PrimaryCTA onClick={save} disabled={saving} style={S.btn}>
        {saving ? '…' : 'Save'}
      </PrimaryCTA>
      <SecondaryCTA onClick={() => setEditing(false)} style={S.btn}>Cancel</SecondaryCTA>
    </span>
  )
}

const S = {
  wrap: { display: 'inline-flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', minWidth: 0 },
  name: {
    fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 14,
    lineHeight: 1.5, color: 'var(--tx)',
  },
  // Figma's Closed state draws Rename as the outline pill in primary pink.
  rename: {
    padding: '6px 14px', fontSize: 14,
    borderColor: 'var(--pk)', color: 'var(--pk)',
  },
  input: {
    fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 14,
    padding: '6px 12px', minWidth: 0, width: 160,
    borderRadius: 8, border: '1px solid var(--bds)',
    background: 'var(--bgc)', color: 'var(--tx)',
  },
  btn: { padding: '6px 14px', fontSize: 14 },
}
