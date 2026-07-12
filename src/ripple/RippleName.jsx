import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAvatarConfig } from '../hooks/useAvatarConfig'
import RippleAvatar from './RippleAvatar'

// ── RippleName ────────────────────────────────────────────────────────────────
// Route: /ripple/name — WP2 migration beat for existing users.
// Fires once when a public-tier user who has onboarding_complete=true has not
// yet named their Ripple (ripples.name IS NULL). Shows their existing avatar
// colours, prompts for a name, and writes it to ripples on save.

const RIPPLE_NAMES = [
  'Mira', 'Orin', 'Sage', 'Wren', 'Lumi', 'Crest',
  'Fenn', 'Zara', 'Coda', 'Tavi', 'River', 'Bay',
  'Reef', 'Tide', 'Beck', 'Haven', 'Marsh', 'Sol',
]

function pickRandom(current) {
  const others = RIPPLE_NAMES.filter(n => n !== current)
  return others[Math.floor(Math.random() * others.length)]
}

export default function RippleName({ session, onNamed }) {
  const navigate = useNavigate()
  const userId   = session?.user?.id
  const { data: avatarData } = useAvatarConfig(userId)

  const [name, setName] = useState(() => pickRandom(''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    if (!name.trim() || busy) return
    setBusy(true); setError(null)

    const { error: err } = await supabase.from('ripples')
      .upsert({ user_id: userId, name: name.trim() }, { onConflict: 'user_id' })

    setBusy(false)
    if (err) { setError('Could not save — please try again.'); console.error('ripples upsert:', err); return }

    onNamed?.()
    navigate('/dashboard', { replace: true })
  }

  const label = name.trim() || 'your Ripple'

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <p style={S.eyebrow}>Your Ripple</p>
        <h1 style={S.title}>A new way to see yourself</h1>
        <p style={S.body}>
          Your avatar is now your <strong>Ripple</strong> — a partner that
          reflects how you&rsquo;re doing and grows with you as you play and
          check in. Give it a name.
        </p>

        <div style={S.preview}>
          <RippleAvatar
            skinColor={avatarData?.skin_color ?? '#FDBCB4'}
            eyeColor={avatarData?.eye_color   ?? '#4A90D9'}
            species={avatarData?.species       ?? 'human'}
            hairStyle={avatarData?.hair_style  ?? 'none'}
            hairColor={avatarData?.hair_color  ?? '#784421'}
            size={160}
          />
        </div>

        <div style={S.nameRow}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Your Ripple's name"
            style={S.input}
            maxLength={32}
            autoFocus
          />
          <button style={S.genBtn} onClick={() => setName(pickRandom(name))} title="Suggest another name">
            ✦
          </button>
        </div>

        {error && <p style={S.err}>{error}</p>}

        <button
          style={{ ...S.btn, opacity: (!name.trim() || busy) ? 0.5 : 1 }}
          disabled={!name.trim() || busy}
          onClick={handleSave}
        >
          {busy ? 'Saving…' : `Meet ${label} →`}
        </button>
      </div>
    </div>
  )
}

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  page: { background: 'var(--bg)', minHeight: '100vh' },
  wrap: {
    maxWidth: 480, margin: '0 auto', padding: '64px 24px',
    display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-start',
  },
  eyebrow: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--pk)', margin: 0,
  },
  title: {
    fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 36px)',
    color: 'var(--tx)', margin: 0, letterSpacing: -0.5,
  },
  body: { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.7, margin: 0, fontFamily: SANS },
  preview: {
    alignSelf: 'center',
    background: 'var(--bgp)', borderRadius: 32, padding: 20,
    boxShadow: '0 8px 40px rgba(240,104,164,0.15)',
  },
  nameRow: { display: 'flex', gap: 10, alignItems: 'center', width: '100%' },
  input: {
    flex: 1, padding: '12px 16px', borderRadius: 12,
    border: '1.5px solid var(--bd)', fontSize: 16, fontFamily: SANS,
    color: 'var(--tx)', background: 'var(--bg)',
  },
  genBtn: {
    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
    border: '1.5px solid var(--bd)', background: 'var(--bgp)',
    color: 'var(--pk)', fontSize: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  btn: {
    padding: '13px 32px', borderRadius: 12,
    background: 'var(--pk)', color: '#fff', border: 'none',
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
    transition: 'opacity 0.15s',
  },
  err: {
    fontSize: 13, color: '#e04', background: '#fff0f0',
    border: '1px solid #fcc', borderRadius: 8, padding: '10px 16px', margin: 0,
  },
}
