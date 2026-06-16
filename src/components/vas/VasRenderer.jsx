import { useState } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'

/**
 * Participant-facing VAS scale renderer.
 *
 * Props:
 *   scale          — full vas_scales row (id, slug, question, anchors, scale_type)
 *   userId         — uuid for vas_responses insert
 *   sessionId      — uuid | null
 *   onComplete     — (value: number) => void
 *   previewMode    — bool — if true, skips DB write
 *   partNumber     — int | null — for "Scale N of M" eyebrow
 *   totalParts     — int | null
 *   supabaseClient — optional; falls back to global client
 */
export default function VasRenderer({
  scale,
  userId,
  sessionId = null,
  onComplete,
  previewMode = false,
  partNumber = null,
  totalParts = null,
  supabaseClient,
}) {
  const [selected, setSelected] = useState(null)
  const [hovered,  setHovered]  = useState(null)
  const [saving,   setSaving]   = useState(false)

  if (!scale) return null

  const anchors = scale.anchors ?? []

  async function handleContinue() {
    if (selected === null || saving) return
    if (previewMode) {
      onComplete?.(selected)
      return
    }
    setSaving(true)
    const db = supabaseClient ?? globalSupabase
    const { error } = await db.from('vas_responses').insert({
      user_id:   userId,
      scale_id:  scale.id,
      session_id: sessionId ?? null,
      value:     selected,
    })
    if (error) console.error('vas_responses insert:', error)
    setSaving(false)
    onComplete?.(selected)
  }

  const eyebrow = (partNumber != null && totalParts != null)
    ? `Scale ${partNumber} of ${totalParts}`
    : 'Rating Scale'

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <p style={S.eyebrow}>{eyebrow}</p>
        <h2 style={S.question}>{scale.question}</h2>

        <div style={S.grid}>
          {anchors.map(anchor => {
            const isSel = selected === anchor.value
            const isHov = hovered  === anchor.value
            return (
              <button
                key={anchor.value}
                style={{
                  ...S.cell,
                  background:   (isSel || isHov) ? 'var(--bgp)' : 'transparent',
                  border:       `1px solid ${isSel ? 'var(--pk)' : isHov ? 'var(--pkb)' : 'var(--bd)'}`,
                }}
                onClick={() => setSelected(anchor.value)}
                onMouseEnter={() => setHovered(anchor.value)}
                onMouseLeave={() => setHovered(null)}
              >
                <img
                  src={anchor.emoji_url}
                  alt={anchor.label}
                  style={{
                    ...S.emoji,
                    transform: `scale(${isSel ? 1.12 : isHov ? 1.08 : 1})`,
                  }}
                />
                <span style={S.anchorLabel}>{anchor.label}</span>
                {isSel && <div style={S.underline} />}
              </button>
            )
          })}
        </div>

        <button
          style={{
            ...S.continueBtn,
            opacity:       selected === null ? 0.45 : 1,
            pointerEvents: selected === null ? 'none' : 'auto',
            cursor:        selected === null ? 'default' : 'pointer',
          }}
          onClick={handleContinue}
          disabled={selected === null || saving}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

const S = {
  wrap: {
    display: 'flex', justifyContent: 'center',
    padding: '40px 16px', minHeight: '100vh',
    background: 'var(--bg)', alignItems: 'flex-start',
  },
  card: {
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 16,
    padding: '36px 32px',
    maxWidth: 680, width: '100%',
  },
  eyebrow: {
    fontFamily: '"Space Mono",monospace',
    fontSize: 11, color: 'var(--pk)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    margin: '0 0 16px',
  },
  question: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: '1.25rem', fontWeight: 400,
    color: 'var(--tx)', lineHeight: 1.4,
    margin: '0 0 28px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 8,
    marginBottom: 28,
  },
  cell: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 6,
    padding: '12px 4px',
    borderRadius: 10,
    position: 'relative',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
  },
  emoji: {
    width: 52, height: 52, objectFit: 'contain',
    transition: 'transform 0.15s',
    display: 'block',
  },
  anchorLabel: {
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: '0.7rem', color: 'var(--tx3)',
    textAlign: 'center', lineHeight: 1.3,
    display: 'block',
  },
  underline: {
    position: 'absolute', bottom: 4,
    left: 8, right: 8,
    height: 2.5,
    background: 'var(--pk)',
    borderRadius: 2,
  },
  continueBtn: {
    width: '100%',
    background: 'var(--pk)', color: '#fff',
    border: 'none', borderRadius: 10,
    padding: '13px', fontSize: 15, fontWeight: 500,
    fontFamily: '"DM Sans",system-ui,sans-serif',
    transition: 'opacity 0.2s',
  },
}
