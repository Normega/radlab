import { WARMUP_SYNC_THRESHOLD } from '../constants';
import AvatarBreathPacer from './AvatarBreathPacer';
import PsiAmpButton from './PsiAmpButton';
import SyncAura from '../../../components/SyncAura';
import { auraParamsFromSync, AURA_DEFAULT_COLOR } from '../../../lib/auraUtils';

// â”€â”€ WarmupScreen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders during WARMUP and BREATH_SEQUENCE phases.
//
// Props:
//   phase          â€” 'warmup' | 'trial'
//   skinColor / eyeColor / scaleAmplitude â€” avatar props
//   getPhase       â€” () => 0â€“1 breath phase
//   isHeld         â€” boolean, PSI-AMP button state
//   onPress / onRelease â€” PSI-AMP handlers
//   syncScore      â€” 0â€“1 rolling mean (warmup only)
//   showHint       â€” boolean: show alignment hint
//   breathIndex    â€” 0â€“3, which breath we're on (trial phase)
//   trialCount     â€” current trial number (shown during trial)

export default function WarmupScreen({
  phase = 'warmup',
  skinColor, eyeColor, species = 'human', auraConfig = null, scaleAmplitude,
  getPhase,
  avatarControlRef,
  isHeld, onPress, onRelease,
  syncScore = 0,
  showHint = false,
  breathIndex = 0,
  trialCount = 0,
}) {
  const isWarmup = phase === 'warmup';

  const auraColor  = (auraConfig?.enabled !== false && auraConfig?.color) ? auraConfig.color : AURA_DEFAULT_COLOR
  const maxInset   = auraConfig?.maxInset ?? 4
  const rawAura    = auraParamsFromSync(syncScore)
  const auraParams = rawAura ? { ...rawAura, inset: Math.min(rawAura.inset, maxInset) } : null

  return (
    <div style={S.wrap}>

      {/* Top label */}
      <div style={S.topRow}>
        {isWarmup ? (
          <p style={S.eyebrow}>Warming up â€” sync your breath</p>
        ) : (
          <div style={S.trialHeader}>
            <p style={S.eyebrow}>Trial {trialCount}</p>
            <div style={S.breathDots}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ ...S.dot, background: i <= breathIndex ? 'var(--pk)' : 'var(--bgp)', border: i === breathIndex ? '2px solid var(--pk)' : '2px solid var(--pkb)' }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div style={S.avatarWrap}>
        <SyncAura params={auraParams} color={auraColor} size={240}>
        <AvatarBreathPacer
          skinColor={skinColor}
          eyeColor={eyeColor}
          species={species}
          scaleAmplitude={scaleAmplitude}
          getPhase={getPhase}
          controlRef={avatarControlRef}
          size={240}
        />
        </SyncAura>
      </div>

      {/* PSI-AMP button */}
      <div style={S.btnWrap}>
        <PsiAmpButton
          onPress={onPress}
          onRelease={onRelease}
          isHeld={isHeld}
          showRing={isWarmup}
          syncScore={syncScore}
          disabled={false}
        />
      </div>

      {/* Warmup sync indicator */}
      {isWarmup && (
        <div style={S.syncBar}>
          <div style={S.syncTrack}>
            <div style={{ ...S.syncFill, width: `${Math.round(syncScore * 100)}%`, background: syncScore >= WARMUP_SYNC_THRESHOLD ? '#1D9E75' : syncScore >= 0.5 ? '#F0A500' : '#E05050' }} />
            <div style={S.syncThreshMark} />
          </div>
          <p style={S.syncNote}>
            {syncScore >= WARMUP_SYNC_THRESHOLD
              ? 'âœ“ Synced â€” starting now'
              : 'Hold on inhale Â· release on exhale'}
          </p>
        </div>
      )}

      {/* Gentle hint after 12 warmup breaths */}
      {showHint && isWarmup && (
        <div style={S.hint}>
          Try pressing the button right as the face begins to expand.
        </div>
      )}

    </div>
  );
}

const MONO = '"Space Mono", monospace';

const S = {
  wrap:       { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', minHeight: '80vh', justifyContent: 'center' },
  topRow:     { marginBottom: 16, width: '100%', maxWidth: 360, textAlign: 'center' },
  eyebrow:    { fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--pk)', margin: 0 },
  trialHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  breathDots: { display: 'flex', gap: 6 },
  dot:        { width: 10, height: 10, borderRadius: '50%', transition: 'background 0.2s, border-color 0.2s' },
  avatarWrap: { marginBottom: 24, position: 'relative' },
  btnWrap:    { marginBottom: 24 },
  syncBar:    { width: '100%', maxWidth: 280, textAlign: 'center' },
  syncTrack:  { height: 6, borderRadius: 999, background: 'var(--bgp)', overflow: 'hidden', position: 'relative', marginBottom: 8 },
  syncFill:   { height: '100%', borderRadius: 999, transition: 'width 0.4s ease, background 0.4s ease' },
  syncThreshMark: { position: 'absolute', top: 0, left: '80%', width: 2, height: '100%', background: 'rgba(0,0,0,0.2)' },
  syncNote:   { fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em', color: 'var(--tx3)', margin: 0 },
  hint:       { marginTop: 16, padding: '10px 16px', background: 'var(--bgp)', borderRadius: 10, fontSize: 13, color: 'var(--tx2)', maxWidth: 320, textAlign: 'center' },
};
