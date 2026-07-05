// v1 — create/edit a display element: ordered text blocks with optional
// per-block condition visibility (showIf) and {{variable}} insertion pills.
import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { gameVariableTokens } from '../../lib/elementOutputs'

const slugify = s => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const parseArms = text => (text ?? '').split(',').map(a => a.trim()).filter(Boolean)

// Editor block <-> stored block. Stored: { type:'text', text, showIf:{slot,in}|null }
const toEditor = b => ({
  text:       b.text ?? '',
  showIfSlot: b.showIf?.slot ?? '',
  showIfArms: (b.showIf?.in ?? []).join(', '),
})
const toStored = b => ({
  type: 'text',
  text: b.text,
  showIf: b.showIfSlot.trim()
    ? { slot: b.showIfSlot.trim(), in: parseArms(b.showIfArms) }
    : null,
})

export default function DisplayEditorPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name,       setName]       = useState('')
  const [slug,       setSlug]       = useState('')
  const [slugTouched,setSlugTouched]= useState(false)
  const [blocks,     setBlocks]     = useState([{ text: '', showIfSlot: '', showIfArms: '' }])
  const [focusedIdx, setFocusedIdx] = useState(0)
  const [error,      setError]      = useState(null)

  const { data: existing, isLoading } = useQuery({
    queryKey: ['display-edit', id],
    enabled: isEdit,
    queryFn: async () => {
      const { data, error } = await supabase.from('displays').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (!existing) return
    setName(existing.name)
    setSlug(existing.slug)
    setBlocks((existing.blocks ?? []).length
      ? existing.blocks.map(toEditor)
      : [{ text: '', showIfSlot: '', showIfArms: '' }])
  }, [existing])

  // Slider + VAS slugs for the variable picker
  const { data: sliderSlugs } = useQuery({
    queryKey: ['slider-slugs'],
    queryFn: async () => {
      const { data } = await supabase.from('slider_scales').select('slug').order('slug')
      return (data ?? []).map(r => r.slug)
    },
  })
  const { data: vasSlugs } = useQuery({
    queryKey: ['vas-slugs'],
    queryFn: async () => {
      const { data } = await supabase.from('vas_scales').select('slug').order('slug')
      return (data ?? []).map(r => r.slug)
    },
  })

  const varTokens = [
    '{{condition}}',
    ...(sliderSlugs ?? []).map(s => `{{slider.${s}.value}}`),
    ...(vasSlugs ?? []).map(s => `{{vas.${s}.value}}`),
    ...gameVariableTokens(),
  ]

  function insertToken(token) {
    setBlocks(bs => bs.map((b, i) => i === focusedIdx ? { ...b, text: b.text + token } : b))
  }

  const save = useMutation({
    mutationFn: async () => {
      const finalName = name.trim()
      const finalSlug = isEdit ? existing.slug : slugify(slug || name)
      if (!finalName) throw new Error('Name is required.')
      if (!finalSlug) throw new Error('Slug is required.')
      const stored = blocks.map(toStored).filter(b => b.text.trim())
      if (stored.length === 0) throw new Error('At least one block needs text.')

      if (isEdit) {
        const { error } = await supabase.from('displays')
          .update({ name: finalName, blocks: stored, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
        await supabase.from('activities')
          .update({ label: `Display – ${finalName.slice(0, 60)}` })
          .eq('category', 'display').eq('subcategory', finalSlug)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('displays')
          .insert({ slug: finalSlug, name: finalName, blocks: stored, created_by: user.id })
        if (error) throw error
        const { error: actErr } = await supabase.from('activities').insert({
          category:    'display',
          subcategory: finalSlug,
          label:       `Display – ${finalName.slice(0, 60)}`,
        })
        if (actErr) console.warn('activities insert:', actErr.message)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['displays-list'] })
      qc.invalidateQueries({ queryKey: ['activities'] })
      qc.invalidateQueries({ queryKey: ['display-edit', id] })
      navigate('/admin/displays')
    },
    onError: e => setError(e.message),
  })

  if (isEdit && isLoading) return <p style={S.sub}>Loading…</p>

  return (
    <div>
      <div style={S.header}>
        <div>
          <Link to="/admin/displays" style={S.backLink}>← Displays</Link>
          <h1 style={S.h1}>{isEdit ? 'Edit Display' : 'New Display'}</h1>
        </div>
        <button
          style={{ ...S.btnPrimary, opacity: save.isPending ? 0.7 : 1 }}
          onClick={() => { setError(null); save.mutate() }}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create display'}
        </button>
      </div>

      {error && <p style={S.errMsg}>{error}</p>}

      <div style={S.card}>
        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Name *</label>
          <input
            style={S.input}
            value={name}
            onChange={e => {
              setName(e.target.value)
              if (!isEdit && !slugTouched) setSlug(slugify(e.target.value))
            }}
            placeholder="e.g. Aptitude feedback"
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Slug {isEdit ? '(locked)' : '*'}</label>
          <input
            style={{ ...S.input, opacity: isEdit ? 0.55 : 1, fontFamily: '"Space Mono",monospace', fontSize: 13 }}
            value={slug}
            disabled={isEdit}
            onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true) }}
            placeholder="aptitude_feedback"
          />
        </div>

        <div style={S.fieldGroup}>
          <label style={S.fieldLabel}>Insert variable (into focused block)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {varTokens.map(t => (
              <button key={t} type="button" style={S.varPill} onClick={() => insertToken(t)}>
                {t}
              </button>
            ))}
          </div>
          <p style={{ ...S.sub, fontSize: 12 }}>
            Variables resolve at runtime from the participant's condition assignment and earlier steps in the same session. Unresolved variables render as "—".
          </p>
        </div>

        {blocks.map((block, i) => (
          <div key={i} style={S.blockCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={S.blockTitle}>Text block {i + 1}</span>
              {blocks.length > 1 && (
                <button type="button" style={S.deleteBtn} onClick={() => setBlocks(bs => bs.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </div>
            <textarea
              style={{ ...S.input, minHeight: 120, resize: 'vertical' }}
              value={block.text}
              onFocus={() => setFocusedIdx(i)}
              onChange={e => setBlocks(bs => bs.map((b, j) => j === i ? { ...b, text: e.target.value } : b))}
              placeholder={'You predicted you would do better than {{slider.predicted_efficacy.value}}% of people.\nYou actually scored better than {{game.aptitude_suite.avg_pct}}% of people.'}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ ...S.fieldGroup, flex: '0 0 160px' }}>
                <label style={S.fieldLabel}>Show only if slot (optional)</label>
                <input
                  style={S.input}
                  value={block.showIfSlot}
                  onChange={e => setBlocks(bs => bs.map((b, j) => j === i ? { ...b, showIfSlot: e.target.value } : b))}
                  placeholder="condition"
                />
              </div>
              <div style={{ ...S.fieldGroup, flex: 1, minWidth: 160 }}>
                <label style={S.fieldLabel}>…is one of (comma-separated)</label>
                <input
                  style={S.input}
                  value={block.showIfArms}
                  onChange={e => setBlocks(bs => bs.map((b, j) => j === i ? { ...b, showIfArms: e.target.value } : b))}
                  placeholder="treatment"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          style={S.addBtn}
          onClick={() => {
            setBlocks(bs => [...bs, { text: '', showIfSlot: '', showIfArms: '' }])
            setFocusedIdx(blocks.length)
          }}
        >
          + Add text block
        </button>
      </div>
    </div>
  )
}

const S = {
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  backLink:   { fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', display: 'inline-block', marginBottom: 8 },
  h1:         { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: 0 },
  sub:        { fontSize: 14, color: 'var(--tx3)', fontFamily: '"DM Sans",system-ui,sans-serif', margin: 0 },
  errMsg:     { fontSize: 13, color: '#e04', background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', marginBottom: 16 },
  card:       { background: '#fff', border: '1px solid var(--bd)', borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  fieldLabel: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input:      { fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 12px', color: 'var(--tx)', background: '#fff', width: '100%', boxSizing: 'border-box' },
  varPill:    { fontFamily: '"Space Mono",monospace', fontSize: 11, background: 'var(--bgc)', border: '1px solid var(--pkb)', borderRadius: 6, padding: '3px 8px', color: 'var(--pkd)', cursor: 'pointer' },
  blockCard:  { display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 10, padding: '16px 18px' },
  blockTitle: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--pkd)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  deleteBtn:  { fontSize: 13, color: '#e04', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: '"DM Sans",system-ui,sans-serif' },
  addBtn:     { alignSelf: 'flex-start', fontSize: 13, color: 'var(--pkd)', background: '#fff', border: '1px dashed var(--pkb)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  btnPrimary: { display: 'inline-block', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap' },
}
