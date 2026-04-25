import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import Nav from '../Nav'
import BaseAvatar, { SKIN_COLORS, EYE_COLORS } from './BaseAvatar'

function Swatch({ color, label, active, onClick }) {
  return (
    <button
      title={label}
      onClick={onClick}
      style={{
        width: 36, height: 36,
        borderRadius: '50%',
        background: color.hex,
        border: active ? '3px solid #f068a4' : '3px solid transparent',
        outline: active ? '2px solid white' : 'none',
        outlineOffset: '-5px',
        cursor: 'pointer',
        boxShadow: active
          ? '0 0 0 2px #f068a4, 0 3px 10px rgba(0,0,0,0.22)'
          : '0 2px 8px rgba(0,0,0,0.18)',
        transform: active ? 'scale(1.22)' : 'scale(1)',
        transition: 'all 0.16s ease',
        padding: 0,
        flexShrink: 0,
      }}
    />
  )
}

export default function AvatarEditor({ session, setHasAvatar }) {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const userId      = session?.user?.id

  const [skin,    setSkin]    = useState(SKIN_COLORS[1])   // Peach default
  const [eye,     setEye]     = useState(EYE_COLORS[3])    // Sky Blue default
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [bump,    setBump]    = useState(0)

  // Pre-populate pickers from existing avatars row
  useEffect(() => {
    if (!userId) return
    supabase.from('avatars').select('skin_color, eye_color').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const foundSkin = SKIN_COLORS.find(c => c.hex === data.skin_color)
          const foundEye  = EYE_COLORS.find(c => c.hex === data.eye_color)
          if (foundSkin) setSkin(foundSkin)
          if (foundEye)  setEye(foundEye)
        }
        setLoading(false)
      })
  }, [userId])

  function pick(setter, val) {
    setter(val)
    setSaved(false)
    setBump(b => b + 1)
  }

  async function handleSave() {
    if (!userId || saving) return
    setSaving(true)
    const { error } = await supabase.from('avatars').upsert(
      { user_id: userId, skin_color: skin.hex, eye_color: eye.hex, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    setSaving(false)
    if (error) { console.error('AvatarEditor: save failed', error); return }
    setSaved(true)
    // Refresh the header avatar and mark onboarding guard as passed
    queryClient.invalidateQueries({ queryKey: ['avatar', userId] })
    if (setHasAvatar) setHasAvatar(true)
    setTimeout(() => navigate('/profile'), 900)
  }

  if (loading) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />
    </div>
  )

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: '"DM Sans", sans-serif' }}>
      <Nav session={session} />

      <div style={S.wrap}>
        {/* Header */}
        <div style={S.header}>
          <p style={S.eyebrow}>Profile · Avatar</p>
          <h1 style={S.title}>This is you.</h1>
          <p style={S.sub}>
            Start with your base avatar. As you explore and complete activities,
            you'll unlock new features to make it your own.
          </p>
        </div>

        {/* Layout */}
        <div style={S.layout}>

          {/* Left: avatar preview + locked features */}
          <div style={S.previewCol}>
            <div style={S.previewBox}>
              <div key={bump} style={{ animation: 'popIn 0.32s ease both' }}>
                <BaseAvatar skinColor={skin.hex} eyeColor={eye.hex} size={200} />
              </div>
            </div>

            <div style={S.lockedCard}>
              <p style={S.lockedLabel}>Unlocked by exploring</p>
              {[
                { icon: '👂', label: 'Ears & species',  pts: 50 },
                { icon: '👃', label: 'Nose styles',      pts: 100 },
                { icon: '💇', label: 'Hair',              pts: 150 },
                { icon: '😄', label: 'Mouth styles',     pts: 200 },
                { icon: '✨', label: 'Auras & extras',   pts: 300 },
                { icon: '🔱', label: 'Scars & marks',    pts: 500 },
              ].map(item => (
                <div key={item.label} style={S.lockedRow}>
                  <span style={{ fontSize: 13 }}>{item.icon}</span>
                  <span style={S.lockedItemLabel}>{item.label}</span>
                  <span style={S.lockedPts}>{item.pts}pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: pickers + save */}
          <div style={S.controls}>

            <div style={S.panel}>
              <span style={S.panelLabel}>Skin · Fur · Scales</span>
              <div style={S.swatchRow}>
                {SKIN_COLORS.map(c => (
                  <Swatch key={c.hex} color={c} label={c.label} active={skin.hex === c.hex} onClick={() => pick(setSkin, c)} />
                ))}
              </div>
              <p style={S.selectedNote}>
                Selected: <strong style={{ color: 'var(--tx)', fontStyle: 'normal' }}>{skin.label}</strong>
                {['#D4B8E0','#A8D8EA','#B5EAD7','#FFD6A5','#C9B1D0','#8ECAE6','#95D5B2','#E8C1C1','#BDE0FE'].includes(skin.hex)
                  ? ' · fantasy palette' : ' · human palette'}
              </p>
            </div>

            <div style={S.panel}>
              <span style={S.panelLabel}>Eye color</span>
              <div style={S.swatchRow}>
                {EYE_COLORS.map(c => (
                  <Swatch key={c.hex} color={c} label={c.label} active={eye.hex === c.hex} onClick={() => pick(setEye, c)} />
                ))}
              </div>
              <p style={S.selectedNote}>
                Selected: <strong style={{ color: 'var(--tx)', fontStyle: 'normal' }}>{eye.label}</strong>
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                ...S.saveBtn,
                background: saved ? '#52B788' : 'var(--pk)',
                boxShadow: saved
                  ? '0 4px 20px rgba(82,183,136,0.35)'
                  : '0 4px 20px rgba(240,104,164,0.35)',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : saved ? '✓  Avatar saved — let\'s go!' : 'Looks good — save my avatar'}
            </button>

            {saved && (
              <p style={S.savedNote}>
                Your avatar will evolve as you complete games and activities.
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          0%   { transform: scale(0.93) translateY(4px); opacity: 0.7; }
          65%  { transform: scale(1.03) translateY(-1px); }
          100% { transform: scale(1)    translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const S = {
  wrap:       { maxWidth: 900, margin: '0 auto', padding: '48px 24px' },
  header:     { textAlign: 'center', marginBottom: 40 },
  eyebrow:    { fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--pk)', margin: '0 0 8px' },
  title:      { fontFamily: SERIF, fontSize: 'clamp(28px, 5vw, 42px)', color: 'var(--tx)', margin: '0 0 10px', letterSpacing: '-0.5px', lineHeight: 1.1 },
  sub:        { color: 'var(--tx2)', fontSize: 15, margin: 0, maxWidth: 400, marginInline: 'auto', lineHeight: 1.55 },
  layout:     { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
  previewCol: { flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  previewBox: {
    background: 'var(--bgc)', borderRadius: 32, padding: 16,
    boxShadow: '0 8px 40px rgba(240,104,164,0.20)',
    width: 220, height: 220,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  lockedCard:      { background: 'var(--bgc)', borderRadius: 18, padding: '14px 16px', width: 220, boxShadow: '0 3px 14px rgba(240,104,164,0.10)' },
  lockedLabel:     { fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--pk)', margin: '0 0 10px' },
  lockedRow:       { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, opacity: 0.55 },
  lockedItemLabel: { fontSize: 12, color: 'var(--tx)', flex: 1 },
  lockedPts:       { fontFamily: MONO, fontSize: 10, color: 'var(--tx3)', background: 'var(--bg)', borderRadius: 6, padding: '1px 6px' },
  controls:     { flex: 1, minWidth: 280 },
  panel:        { background: 'var(--bgc)', borderRadius: 24, padding: '22px 24px', boxShadow: '0 4px 24px rgba(240,104,164,0.10)', marginBottom: 16 },
  panelLabel:   { fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 12, display: 'block' },
  swatchRow:    { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  selectedNote: { marginTop: 12, marginBottom: 0, fontSize: 12, color: 'var(--tx3)', fontStyle: 'italic' },
  saveBtn: {
    width: '100%', padding: '14px 0',
    color: 'white', border: 'none', borderRadius: 16,
    fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px',
    cursor: 'pointer', transition: 'background 0.4s ease',
  },
  savedNote: { textAlign: 'center', fontSize: 13, color: 'var(--tx3)', marginTop: 12 },
}
