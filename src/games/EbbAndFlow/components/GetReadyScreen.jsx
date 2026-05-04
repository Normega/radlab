import { useEffect } from 'react';
import AvatarBreathPacer from './AvatarBreathPacer';
import SyncAura from '../../../components/SyncAura';
import { auraParamsFromSync, AURA_DEFAULT_COLOR } from '../../../lib/auraUtils';

// â”€â”€ GetReadyScreen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Shown once after warmup sync threshold is reached, before the first trial.
// Avatar is frozen at neutral. Spacebar or "Begin" button advances.
//
// Props:
//   skinColor / eyeColor / scaleAmplitude â€” avatar appearance
//   onBegin â€” () => void

export default function GetReadyScreen({ skinColor, eyeColor, species = 'human', auraConfig = null, syncScore = 0, scaleAmplitude, onBegin }) {
  const auraColor  = (auraConfig?.enabled !== false && auraConfig?.color) ? auraConfig.color : AURA_DEFAULT_COLOR
  const maxInset   = auraConfig?.maxInset ?? 4
  const rawAura    = auraParamsFromSync(syncScore)
  const auraParams = rawAura ? { ...rawAura, inset: Math.min(rawAura.inset, maxInset) } : null
  useEffect(() => {
    function onKey(e) {
      if (e.code === 'Space') { e.preventDefault(); onBegin(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBegin]);

  return (
    <div style={S.wrap}>
      <div style={S.avatarWrap}>
        <SyncAura params={auraParams} color={auraColor} size={240}>
        <AvatarBreathPacer
          skinColor={skinColor}
          eyeColor={eyeColor}
          species={species}
          scaleAmplitude={scaleAmplitude}
          getPhase={null}
          paused={true}
          size={240}
        />
        </SyncAura>
      </div>
      <p style={S.eyebrow}>Warmup complete</p>
      <h2 style={S.title}>Good. Now get ready to begin.</h2>
      <button style={S.btn} onClick={onBegin}>Begin â†’</button>
      <p style={S.hint}>or press Space</p>
    </div>
  );
}

const MONO  = '"Space Mono", monospace';
const SERIF = '"DM Serif Display", Georgia, serif';

const S = {
  wrap:       { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '32px 24px', textAlign: 'center' },
  avatarWrap: { marginBottom: 28 },
  eyebrow:    { fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--pk)', margin: '0 0 10px' },
  title:      { fontFamily: SERIF, fontSize: 'clamp(24px, 5vw, 34px)', color: 'var(--tx)', margin: '0 0 32px', letterSpacing: -0.5 },
  btn: {
    padding: '13px 40px', borderRadius: 12,
    background: 'var(--pk)', color: '#fff', border: 'none',
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(240,104,164,0.3)',
    marginBottom: 12,
  },
  hint: { fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx3)', margin: 0 },
};
