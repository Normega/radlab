import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Nav from '../../components/Nav';
import { supabase, saveFirstContactSession } from '../../lib/supabase';
import { useAvatarConfig } from '../../hooks/useAvatarConfig';
import SyncAura from '../../components/SyncAura';
import { auraParamsFromSync, AURA_DEFAULT_COLOR } from '../../lib/auraUtils';
import { useBreathCycle } from '../EbbAndFlow/useBreathCycle';
import { useButtonSync } from '../EbbAndFlow/useButtonSync';
import { useBreathSync } from './useBreathSync';
import {
  SYNC_THRESHOLD, MIN_CYCLES_BEFORE_COMPLETE, BREATH_DURATION_MS, COPY,
} from './constants';
import ContactAvatar   from './components/ContactAvatar';
import SyncMeter       from './components/SyncMeter';
import BreathPrompt    from './components/BreathPrompt';
import ContactComplete from './components/ContactComplete';
import PsiAmpButton    from '../EbbAndFlow/components/PsiAmpButton';

// ── FirstContact ──────────────────────────────────────────────────────────
//
// State machine: INTRO → SYNCING → COMPLETE
//
// First-time mode:  profile.first_contact_complete === false
//   Avatar in ghost reveal — features fade in as sync improves.
//   On COMPLETE → save profile fields, call onComplete(), navigate ebb-flow.
//
// Returning mode (Deeper Contact): profile.first_contact_complete === true
//   Avatar at full opacity + aura.
//   On COMPLETE → update sync stats, navigate /games.

export default function FirstContact({ session, onComplete }) {
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const fromEbbFlow     = searchParams.get('from') === 'ebb-flow';
  const userId          = session?.user?.id;

  // ── Phase (React state + ref for async reads) ─────────────────────────
  const [phase, _setPhase] = useState('INTRO');
  const phaseRef           = useRef('INTRO');
  function setPhase(p) { phaseRef.current = p; _setPhase(p); }

  // ── UI state ──────────────────────────────────────────────────────────
  const [isHeld,      setIsHeld]      = useState(false);
  const [syncLevel,   setSyncLevel]   = useState(0);
  const [cycleCount,  setCycleCount]  = useState(0);
  const [justUpdated, setJustUpdated] = useState(false);

  // ── Profile (undefined = loading, null = no row) ──────────────────────
  const [profile,  setProfile]  = useState(undefined);
  const profileRef = useRef(null);

  const { data: avatarData } = useAvatarConfig(userId);

  // ── Avatar imperative control ─────────────────────────────────────────
  const avatarControlRef = useRef(null);

  // ── Per-cycle refs ────────────────────────────────────────────────────
  const pauseTimerRef  = useRef(null);
  const cycleScoreRef  = useRef(null);  // last press-release score this cycle
  const cycleCountRef  = useRef(0);
  const syncLevelRef   = useRef(0);

  // ── Hooks ─────────────────────────────────────────────────────────────
  const { getPhase, startBreath }                     = useBreathCycle();
  const { onPress: rawPress, onRelease: rawRelease }  = useButtonSync(getPhase);
  const { addCycleSync, getRollingMean, reset: resetSync } = useBreathSync();

  // ── Load profile ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('*').eq('id', userId).single()
      .then(({ data: p }) => {
        profileRef.current = p;
        setProfile(p ?? null);
      });
  }, [userId]);

  const isReturning = profile?.first_contact_complete === true;

  // ── Button handlers ───────────────────────────────────────────────────
  const handlePress = useCallback(() => {
    rawPress();
    setIsHeld(true);
  }, [rawPress]);

  const handleRelease = useCallback(() => {
    const result = rawRelease();
    setIsHeld(false);
    if (!result) return;
    cycleScoreRef.current = result.syncScore; // keep last score in this cycle
  }, [rawRelease]);

  // ── Spacebar → INTRO to SYNCING ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'INTRO') return;
    function onKey(e) {
      if (e.code === 'Space') { e.preventDefault(); setPhase('SYNCING'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  // ── SYNCING loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'SYNCING') return;
    let cancelled = false;

    resetSync();
    cycleCountRef.current = 0;
    syncLevelRef.current  = 0;
    cycleScoreRef.current = null;
    setSyncLevel(0);
    setCycleCount(0);

    async function syncLoop() {
      // 1. Cancel RAF, pin to neutral for 1 000 ms hold
      avatarControlRef.current?.resetToNeutral();
      await new Promise(resolve => {
        pauseTimerRef.current = setTimeout(resolve, 1000);
      });
      if (cancelled) return;

      // 2. Start breath clock BEFORE resumeAnimation so getPhase() reads
      //    a fresh cycleStartRef on the very first RAF frame
      let pendingBreath = startBreath(BREATH_DURATION_MS);
      avatarControlRef.current?.resumeAnimation();

      while (!cancelled && phaseRef.current === 'SYNCING') {
        await pendingBreath;
        if (cancelled) break;

        // End of cycle — record score (0 if user never pressed this cycle)
        const score = cycleScoreRef.current ?? 0;
        cycleScoreRef.current = null;
        addCycleSync(score);

        const newCount        = cycleCountRef.current + 1;
        cycleCountRef.current = newCount;
        setCycleCount(newCount);

        const mean           = getRollingMean();
        syncLevelRef.current = mean;
        setSyncLevel(mean);

        // Pulse sync meter (one render cycle)
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 250);

        // Completion gate: rolling mean ≥ 80% after ≥ 4 complete cycles
        if (mean >= SYNC_THRESHOLD && newCount >= MIN_CYCLES_BEFORE_COMPLETE) {
          if (!cancelled) doComplete(mean);
          return;
        }

        pendingBreath = startBreath(BREATH_DURATION_MS);
      }
    }

    syncLoop();
    return () => {
      cancelled = true;
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Completion ────────────────────────────────────────────────────────
  function doComplete(rollingMean) {
    setPhase('COMPLETE');
    const p          = profileRef.current;
    const isFirstTime = !p?.first_contact_complete;

    // Fire-and-forget — don't block the UI transition
    saveFirstContactSession({
      userId,
      rollingMean,
      previousBest:     p?.deeper_contact_best_sync ?? 0,
      previousSessions: p?.deeper_contact_sessions  ?? 0,
      isFirstTime,
    });

    // Notify App.jsx so the EbbFlow guard updates immediately
    if (isFirstTime) onComplete?.();
  }

  function handleContinue() {
    if (!isReturning) {
      navigate('/games/ebb-flow');
    } else {
      navigate('/games');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  const skinColor  = avatarData?.skin_color || '#FDBCB4';
  const eyeColor   = avatarData?.eye_color  || '#4A90D9';
  const species    = avatarData?.species    ?? 'human';

  const auraConfig  = avatarData?.aura
  const auraColor   = (auraConfig?.enabled !== false && auraConfig?.color) ? auraConfig.color : AURA_DEFAULT_COLOR
  const maxInset    = auraConfig?.maxInset ?? 4
  const rawAura     = auraParamsFromSync(syncLevel)
  const auraParams  = rawAura ? { ...rawAura, inset: Math.min(rawAura.inset, maxInset) } : null

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />

      <div style={S.wrap}>

        {/* Redirect banner when bounced from /games/ebb-flow */}
        {fromEbbFlow && phase === 'INTRO' && (
          <p style={S.redirectNote}>
            Complete Contact before beginning Ebb &amp; Flow.
          </p>
        )}

        {/* INTRO: narrative copy */}
        {phase === 'INTRO' && (
          <p style={S.introText}>
            {profile === undefined
              ? ' '
              : isReturning ? COPY.intro_returning : COPY.intro_first}
          </p>
        )}

        {/* Avatar — always visible across all phases */}
        <div style={S.avatarWrap}>
          <SyncAura params={auraParams} color={auraColor} size={240}>
            <ContactAvatar
              skinColor={skinColor}
              eyeColor={eyeColor}
              species={species}
              getPhase={getPhase}
              syncLevel={syncLevel}
              isFirstContact={!isReturning && phase !== 'COMPLETE'}
              isComplete={phase === 'COMPLETE'}
              controlRef={avatarControlRef}
              size={240}
            />
          </SyncAura>
        </div>

        {/* SYNCING: breath prompt + sync meter + PSI-AMP button */}
        {phase === 'SYNCING' && (
          <>
            <BreathPrompt
              getPhase={getPhase}
              syncLevel={syncLevel}
              cycleCount={cycleCount}
            />
            <SyncMeter syncLevel={syncLevel} justUpdated={justUpdated} />
            <div style={S.btnWrap}>
              <PsiAmpButton
                isHeld={isHeld}
                onPress={handlePress}
                onRelease={handleRelease}
                showRing={true}
                syncScore={syncLevel}
              />
            </div>
          </>
        )}

        {/* INTRO: Begin button (hidden while profile is loading) */}
        {phase === 'INTRO' && profile !== undefined && (
          <button style={S.beginBtn} onClick={() => setPhase('SYNCING')}>
            Begin
          </button>
        )}

        {/* COMPLETE */}
        {phase === 'COMPLETE' && (
          <ContactComplete
            syncLevel={syncLevel}
            isReturning={isReturning}
            onContinue={handleContinue}
          />
        )}

      </div>
    </div>
  );
}

const MONO  = '"Space Mono", monospace';
const SERIF = '"DM Serif Display", serif';

const S = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 24px',
    minHeight: 'calc(100vh - 60px)',
    justifyContent: 'center',
    gap: 20,
  },
  redirectNote: {
    fontFamily: MONO, fontSize: 12, letterSpacing: '0.10em',
    textTransform: 'uppercase', color: 'var(--pk)',
    background: 'var(--bgp)', border: '1px solid var(--pkb)',
    borderRadius: 8, padding: '8px 16px', margin: 0,
  },
  introText: {
    fontFamily: SERIF, fontSize: 20, color: 'var(--tx2)',
    textAlign: 'center', maxWidth: 320, lineHeight: 1.5, margin: 0,
  },
  avatarWrap: { position: 'relative' },
  btnWrap:    { marginTop: 4 },
  beginBtn: {
    padding: '13px 40px', borderRadius: 12,
    background: 'var(--pk)', color: '#fff', border: 'none',
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
  },
};
