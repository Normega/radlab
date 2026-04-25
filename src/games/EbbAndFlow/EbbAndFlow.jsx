import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../../components/Nav';
import { supabase } from '../../lib/supabase';
import { useQuestStaircases } from './useQuestStaircases';
import { useBreathCycle } from './useBreathCycle';
import { useButtonSync } from './useButtonSync';
import {
  BASELINE_BREATH_DURATION_MS, BREATHS_PER_TRIAL,
  CATCH_TRIAL_PROPORTION, GAME_MODES, POINTS,
  MIN_TRIALS_PER_SESSION, CONTINUE_PROMPT_INTERVAL, ITI_DURATION_MS,
  WARMUP_SYNC_THRESHOLD,
} from './constants';
import SessionStart   from './components/SessionStart';
import WarmupScreen   from './components/WarmupScreen';
import GetReadyScreen from './components/GetReadyScreen';
import ResponseScreen  from './components/ResponseScreen';
import ContinuePrompt  from './components/ContinuePrompt';
import SessionSummary  from './components/SessionSummary';

// ── Trial logic helpers ────────────────────────────────────────────────────

function computeBreathDurations(baseDuration, magnitude, direction, salience) {
  const totalChange = direction === 'faster' ? 1 - magnitude : 1 + magnitude;
  const changed     = baseDuration * totalChange;
  if (salience === 'high') {
    return [baseDuration, baseDuration, changed, changed];
  } else {
    const step = (changed - baseDuration) / 3;
    return [
      baseDuration,
      baseDuration + step,
      baseDuration + step * 2,
      baseDuration + step * 3,
    ];
  }
}

function computeTrialScore(trialType, correct, confidence) {
  let pts = 0;
  if (trialType === 'catch') {
    pts += correct ? POINTS.correct_catch : POINTS.false_alarm;
  } else {
    const salience = trialType.endsWith('high') ? 'high' : 'low';
    if (correct) pts += salience === 'high' ? POINTS.correct_high_salience : POINTS.correct_low_salience;
    const confidentCorrect = confidence >= 5 && correct;
    const uncertainWrong   = confidence <= 3 && !correct;
    if (confidentCorrect || uncertainWrong) pts += POINTS.confidence_calibrated;
  }
  return pts;
}

// ── EbbAndFlow ─────────────────────────────────────────────────────────────

export default function EbbAndFlow({ session, onSessionComplete }) {
  const navigate   = useNavigate();
  const userId     = session?.user?.id;

  // ── Game phase (React state for rendering + ref for async reads) ──────
  const [phase, _setPhase] = useState('SESSION_START');
  const phaseRef           = useRef('SESSION_START');
  function setPhase(p) { phaseRef.current = p; _setPhase(p); }

  // ── Button held state (React state for rendering only) ───────────────
  const [isHeld,        setIsHeld]        = useState(false);
  const [syncScore,     setSyncScore]     = useState(0);
  const [showHint,      setShowHint]      = useState(false);
  const [breathIndex,   setBreathIndex]   = useState(0);
  const [trialCount,    setTrialCount]    = useState(0);
  const [sessionScore,  setSessionScore]  = useState(0);
  const [avatarPaused,  setAvatarPaused]  = useState(false);

  // ── Profile + avatar ──────────────────────────────────────────────────
  const [profile,    setProfile]    = useState(null);
  const [avatarData, setAvatarData] = useState(null);
  const profileRef   = useRef(null);

  // ── Session tracking (refs — mutated inside async loops) ─────────────
  const pauseTimerRef      = useRef(null);
  const sessionTrialsRef   = useRef([]);
  const sessionScoreRef    = useRef(0);
  const trialCountRef      = useRef(0);
  const breathSyncRef      = useRef([]); // per-breath sync data for current trial
  const trialStartTimeRef  = useRef(null);
  const currentTrialRef    = useRef(null);
  const warmupScoresRef    = useRef([]);
  const warmupBreathRef    = useRef(0);
  const syncScoreRef       = useRef(0);

  // ── Hooks ─────────────────────────────────────────────────────────────
  const { getPhase, startBreath, reset: resetBreath } = useBreathCycle();
  const {
    staircases,
    getNextMagnitude, recordResponse,
    getMostUncertainKey, allConverged,
    getThresholdEstimate, getSD, serialize,
  } = useQuestStaircases(profile?.ebb_flow_quest_state);
  const { onPress: rawPress, onRelease: rawRelease, computeBreathSyncScore } = useButtonSync(getPhase);

  // ── Load profile + avatar ─────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('avatars').select('skin_color, eye_color').eq('user_id', userId).maybeSingle(),
    ]).then(([{ data: p }, { data: a }]) => {
      profileRef.current = p;
      setProfile(p);
      setAvatarData(a);
    });
  }, [userId]);

  // Derive game mode from profile
  const gameMode = profile?.ebb_flow_game_mode || 'beginner';
  const modeConfig = GAME_MODES[gameMode];

  // ── Button handlers ───────────────────────────────────────────────────
  const handlePress = useCallback(() => {
    rawPress();
    setIsHeld(true);
  }, [rawPress]);

  const handleRelease = useCallback(() => {
    const result = rawRelease();
    setIsHeld(false);
    if (!result) return;
    const { pressPhase, releasePhase, syncScore: sc } = result;

    // Record breath sync data for current trial breath
    const idx = phaseRef.current === 'WARMUP'
      ? warmupBreathRef.current
      : breathSyncRef.current.length;

    const entry = { breath_index: idx, press_phase: pressPhase, release_phase: releasePhase, sync_score: sc };

    if (phaseRef.current === 'WARMUP') {
      warmupScoresRef.current.push(sc);
      const last4   = warmupScoresRef.current.slice(-4);
      const rolling = last4.reduce((a, b) => a + b, 0) / last4.length;
      syncScoreRef.current = rolling;
      setSyncScore(rolling);
    } else {
      breathSyncRef.current.push(entry);
    }
  }, [rawRelease]);

  // ── WARMUP phase ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'WARMUP') return;
    let cancelled = false;
    warmupScoresRef.current = [];
    warmupBreathRef.current = 0;
    syncScoreRef.current = 0;
    setShowHint(false);

    async function warmupLoop() {
      resetBreath();
      while (!cancelled && phaseRef.current === 'WARMUP') {
        await startBreath(BASELINE_BREATH_DURATION_MS);
        if (cancelled) break;
        warmupBreathRef.current++;

        // Check rolling mean
        const scores  = warmupScoresRef.current;
        const last4   = scores.slice(-4);
        const rolling = last4.length ? last4.reduce((a, b) => a + b, 0) / last4.length : 0;

        if (rolling >= WARMUP_SYNC_THRESHOLD && scores.length >= 2) {
          if (!cancelled) setPhase('GET_READY');
          return;
        }
        if (warmupBreathRef.current >= 12) {
          setShowHint(true);
        }
      }
    }
    warmupLoop();
    return () => { cancelled = true; };
  }, [phase]);

  // ── TRIAL_ITI phase ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'TRIAL_ITI') return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) beginTrial();
    }, ITI_DURATION_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phase]);

  // ── BREATH_SEQUENCE phase ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'BREATH_SEQUENCE') return;
    let cancelled = false;
    breathSyncRef.current = [];

    async function breathSequence() {
      // Reset avatar to neutral for 1 000 ms before breath 1 begins
      setAvatarPaused(true);
      await new Promise(resolve => { pauseTimerRef.current = setTimeout(resolve, 1000); });
      if (cancelled) return;
      setAvatarPaused(false);
      resetBreath(); // restart breath cycle from phase 0

      const trial     = currentTrialRef.current;
      const durations = trial.durations;
      trialStartTimeRef.current = performance.now();

      for (let i = 0; i < BREATHS_PER_TRIAL; i++) {
        if (cancelled) return;
        setBreathIndex(i);
        await startBreath(durations[i]);
        if (cancelled) return;
      }
      if (!cancelled) setPhase('RESPONSE');
    }
    breathSequence();
    return () => {
      cancelled = true;
      if (pauseTimerRef.current) { clearTimeout(pauseTimerRef.current); pauseTimerRef.current = null; }
    };
  }, [phase]);

  // ── Trial setup ───────────────────────────────────────────────────────
  function beginTrial() {
    const isCatch = Math.random() < CATCH_TRIAL_PROPORTION;
    let trialType, durations, magnitude, log10Mag, direction, salience;

    if (isCatch) {
      trialType   = 'catch';
      durations   = [BASELINE_BREATH_DURATION_MS, BASELINE_BREATH_DURATION_MS, BASELINE_BREATH_DURATION_MS, BASELINE_BREATH_DURATION_MS];
      magnitude   = 0;
      log10Mag    = null;
      direction   = null;
      salience    = null;
    } else {
      trialType   = getMostUncertainKey();
      direction   = trialType.startsWith('faster') ? 'faster' : 'slower';
      salience    = trialType.endsWith('high') ? 'high' : 'low';
      magnitude   = getNextMagnitude(trialType);
      log10Mag    = Math.log10(magnitude);
      durations   = computeBreathDurations(BASELINE_BREATH_DURATION_MS, magnitude, direction, salience);
    }

    currentTrialRef.current = { trialType, durations, magnitude, log10Mag, direction, salience };
    setTrialCount(t => { trialCountRef.current = t + 1; return t + 1; });
    setPhase('BREATH_SEQUENCE');
  }

  // ── Response submission ───────────────────────────────────────────────
  function handleResponse({ afc, confidence, arousal, reactionTimeMs }) {
    const trial = currentTrialRef.current;
    if (!trial) return;

    const { trialType, magnitude, log10Mag, direction, salience } = trial;

    // Correctness
    let correct = false;
    if (trialType === 'catch') {
      correct = afc === 'same';
    } else {
      correct = afc === direction;
    }

    // Update staircase
    if (trialType !== 'catch') {
      recordResponse(trialType, afc, log10Mag);
    }

    // Score
    const pts = computeTrialScore(trialType, correct, confidence);
    sessionScoreRef.current += pts;
    setSessionScore(sessionScoreRef.current);

    // Sync data
    const syncData    = breathSyncRef.current.slice();
    const syncMean    = syncData.length
      ? syncData.reduce((a, b) => a + b.sync_score, 0) / syncData.length
      : 0;

    // QUEST estimates
    const qMean = trialType !== 'catch' ? Math.log10(magnitude) : null;
    const qSD   = trialType !== 'catch' ? getSD(trialType) : null;

    const trialRecord = {
      trial_number:         trialCountRef.current,
      trial_type:           trialType,
      total_change:         direction ? (direction === 'faster' ? 1 - magnitude : 1 + magnitude) : 1,
      magnitude,
      log10_magnitude:      log10Mag,
      salience,
      direction,
      response:             afc,
      correct,
      confidence,
      arousal,
      reaction_time_ms:     reactionTimeMs,
      breath_sync:          syncData,
      trial_sync_mean:      syncMean,
      quest_posterior_mean: qMean,
      quest_posterior_sd:   qSD,
      game_mode:            gameMode,
      scale_amplitude:      modeConfig.scaleAmplitude,
    };
    sessionTrialsRef.current.push(trialRecord);

    // Decide next state
    const count = trialCountRef.current;
    if (count >= MIN_TRIALS_PER_SESSION && count % CONTINUE_PROMPT_INTERVAL === 0) {
      setPhase('CONTINUE_PROMPT');
    } else if (allConverged()) {
      setPhase('STABILITY_COMPLETE');
    } else {
      setPhase('TRIAL_ITI');
    }
  }

  // ── Session completion ─────────────────────────────────────────────────
  async function finishSession() {
    const p             = profileRef.current;
    const prevTotal     = p?.ebb_flow_total_trials ?? 0;
    const prevScore     = p?.ebb_flow_total_score  ?? 0;
    const newTotal      = prevTotal + trialCountRef.current;
    const newScore      = prevScore + sessionScoreRef.current;
    const questState    = serialize();
    const trials        = sessionTrialsRef.current;
    const syncMean      = trials.length
      ? trials.reduce((a, t) => a + (t.trial_sync_mean ?? 0), 0) / trials.length
      : 0;

    // Mode unlock check
    let newModeUnlocked = null;
    if (prevTotal < 50 && newTotal >= 50)  newModeUnlocked = 'listener';
    if (prevTotal < 100 && newTotal >= 100) newModeUnlocked = 'empath';

    setPhase('SESSION_COMPLETE');

    onSessionComplete?.({
      user_id:          userId,
      trials,
      session_score:    sessionScoreRef.current,
      total_score:      newScore,
      total_trials:     newTotal,
      quest_state:      questState,
      game_mode:        gameMode,
      new_mode_unlocked: newModeUnlocked,
      all_converged:    allConverged(),
      session_sync_mean: syncMean,
    });
  }

  // ── Mode change ───────────────────────────────────────────────────────
  async function handleModeSelect(key) {
    if (!userId) return;
    await supabase.from('profiles').update({ ebb_flow_game_mode: key }).eq('id', userId);
    setProfile(p => ({ ...p, ebb_flow_game_mode: key }));
  }

  // ── Estimates for summary ─────────────────────────────────────────────
  const questEstimates = phase === 'SESSION_COMPLETE'
    ? {
        faster_high: getThresholdEstimate('faster_high'),
        faster_low:  getThresholdEstimate('faster_low'),
        slower_high: getThresholdEstimate('slower_high'),
        slower_low:  getThresholdEstimate('slower_low'),
      }
    : {};
  const questSDs = phase === 'SESSION_COMPLETE'
    ? {
        faster_high: getSD('faster_high'),
        faster_low:  getSD('faster_low'),
        slower_high: getSD('slower_high'),
        slower_low:  getSD('slower_low'),
      }
    : {};

  const newModeUnlocked = (() => {
    const p = profileRef.current;
    const prevTotal = p?.ebb_flow_total_trials ?? 0;
    const newTotal  = prevTotal + trialCountRef.current;
    if (prevTotal < 50 && newTotal >= 50)  return 'listener';
    if (prevTotal < 100 && newTotal >= 100) return 'empath';
    return null;
  })();

  // ── Render ─────────────────────────────────────────────────────────────
  const skinColor = avatarData?.skin_color || '#FDBCB4';
  const eyeColor  = avatarData?.eye_color  || '#4A90D9';

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />

      {phase === 'SESSION_START' && (
        <SessionStart
          totalTrials={profile?.ebb_flow_total_trials ?? 0}
          totalScore={profile?.ebb_flow_total_score ?? 0}
          sessionScore={0}
          selectedMode={gameMode}
          onSelectMode={handleModeSelect}
          onBegin={() => setPhase('WARMUP')}
        />
      )}

      {(phase === 'WARMUP' || phase === 'TRIAL_ITI' || phase === 'BREATH_SEQUENCE') && (
        <WarmupScreen
          phase={phase === 'WARMUP' ? 'warmup' : 'trial'}
          skinColor={skinColor}
          eyeColor={eyeColor}
          scaleAmplitude={modeConfig.scaleAmplitude}
          getPhase={getPhase}
          avatarPaused={avatarPaused}
          isHeld={isHeld}
          onPress={handlePress}
          onRelease={handleRelease}
          syncScore={syncScore}
          showHint={showHint}
          breathIndex={breathIndex}
          trialCount={trialCountRef.current}
        />
      )}

      {phase === 'GET_READY' && (
        <GetReadyScreen
          skinColor={skinColor}
          eyeColor={eyeColor}
          scaleAmplitude={modeConfig.scaleAmplitude}
          onBegin={() => setPhase('TRIAL_ITI')}
        />
      )}

      {phase === 'RESPONSE' && (
        <ResponseScreen
          onSubmit={handleResponse}
          trialStartTime={trialStartTimeRef.current}
        />
      )}

      {phase === 'CONTINUE_PROMPT' && (
        <ContinuePrompt
          trialCount={trialCountRef.current}
          sessionScore={sessionScoreRef.current}
          onContinue={() => setPhase('TRIAL_ITI')}
          onStop={finishSession}
        />
      )}

      {phase === 'STABILITY_COMPLETE' && (
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: '"Space Mono", monospace', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 12 }}>
            Stability reached
          </p>
          <h2 style={{ fontFamily: '"DM Serif Display", serif', fontSize: 32, color: 'var(--tx)', marginBottom: 16 }}>
            Your sensitivity profile is complete.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 32 }}>
            All four staircases have converged. You've mapped your interoceptive sensitivity across all conditions.
          </p>
          <button style={S.primaryBtn} onClick={finishSession}>See results →</button>
        </div>
      )}

      {phase === 'SESSION_COMPLETE' && (
        <SessionSummary
          sessionScore={sessionScoreRef.current}
          totalScore={(profile?.ebb_flow_total_score ?? 0) + sessionScoreRef.current}
          totalTrials={(profile?.ebb_flow_total_trials ?? 0) + trialCountRef.current}
          questEstimates={questEstimates}
          questSDs={questSDs}
          allConverged={allConverged()}
          newModeUnlocked={newModeUnlocked}
          gameMode={gameMode}
          sessionSyncMean={
            sessionTrialsRef.current.length
              ? sessionTrialsRef.current.reduce((a, t) => a + (t.trial_sync_mean ?? 0), 0) / sessionTrialsRef.current.length
              : 0
          }
          onDone={() => navigate('/dashboard')}
        />
      )}
    </div>
  );
}

const S = {
  primaryBtn: {
    padding: '13px 32px', borderRadius: 12,
    background: 'var(--pk)', color: '#fff', border: 'none',
    fontFamily: '"Space Mono", monospace', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
  },
};
