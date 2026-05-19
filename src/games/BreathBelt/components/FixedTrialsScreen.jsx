import { useState, useCallback } from 'react';
import AvatarBreathPacer from '../../EbbAndFlow/components/AvatarBreathPacer';
import BeltSyncRing from './BeltSyncRing';
import { useTrialRunner } from '../hooks/useTrialRunner';
import {
  BASE_BREATH_SPEED_S,
  FASTER_BREATH_SPEED_S,
  SLOWER_BREATH_SPEED_S,
  TRIALS_PER_CONDITION,
} from '../constants';

// ── Trial list builder ─────────────────────────────────────────────────────

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildTrialList() {
  return shuffled([
    ...Array(TRIALS_PER_CONDITION).fill('same'),
    ...Array(TRIALS_PER_CONDITION).fill('faster'),
    ...Array(TRIALS_PER_CONDITION).fill('slower'),
  ]);
}

function conditionMs(condition) {
  if (condition === 'faster') return FASTER_BREATH_SPEED_S * 1000;
  if (condition === 'slower') return SLOWER_BREATH_SPEED_S * 1000;
  return BASE_BREATH_SPEED_S * 1000;
}

// ── FixedTrialsScreen ──────────────────────────────────────────────────────
//
// Manages the 9 fixed trials for Phase 2. Between trials shows a "ready" screen.
// After all 9, calls onComplete(trials[]) with the per-trial data array.
//
// trialList is built once on mount (useState lazy init).

const TRIAL_STATES = {
  READY:       'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE:        'DONE',
};

export default function FixedTrialsScreen({
  avatarProps,
  breathValueRef,
  sendTrigger,
  currentPhaseRef,
  currentTrialRef,
  recordTrial,
  onComplete,
}) {
  const [trialList]   = useState(buildTrialList);
  const [trialIdx,    setTrialIdx]    = useState(0);
  const [trialState,  setTrialState]  = useState(TRIAL_STATES.READY);
  const trialsData    = useState([])[0]; // accumulates via push — no re-render needed

  const { getPhase, runTrial, controlRef } = useTrialRunner({
    breathValueRef,
    sendTrigger,
    currentPhaseRef,
    currentTrialRef,
  });

  const avatarSize = 240;

  const startTrial = useCallback(async () => {
    const condition = trialList[trialIdx];
    setTrialState(TRIAL_STATES.IN_PROGRESS);

    const { beltSyncMean } = await runTrial(
      'phase2',
      trialIdx + 1,
      conditionMs(condition),
    );

    const row = {
      phase:           2,
      trial_number:    trialIdx + 1,
      condition,
      breath_period_ms: conditionMs(condition),
      log10_mag:       null,
      response:        null,
      correct:         null,
      confidence:      null,
      arousal:         null,
      belt_sync_mean:  beltSyncMean,
    };
    trialsData.push(row);
    recordTrial(row);

    const next = trialIdx + 1;
    if (next >= trialList.length) {
      onComplete(trialsData);
    } else {
      setTrialIdx(next);
      setTrialState(TRIAL_STATES.READY);
    }
  }, [trialIdx, trialList, runTrial, recordTrial, onComplete, trialsData]);

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-8" style={{ maxWidth: 480, margin: '0 auto' }}>

      {/* Avatar + ring */}
      <div style={{ position: 'relative', width: avatarSize, height: avatarSize }}>
        <BeltSyncRing breathValueRef={breathValueRef} avatarSize={avatarSize} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <AvatarBreathPacer
            {...avatarProps}
            scaleAmplitude={0.25}
            getPhase={getPhase}
            controlRef={controlRef}
            paused={trialState === TRIAL_STATES.READY}
            size={avatarSize}
          />
        </div>
      </div>

      {/* Trial counter */}
      <p style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: 'var(--tx3)' }}>
        Trial {trialIdx + 1} of {trialList.length}
      </p>

      {trialState === TRIAL_STATES.READY && (
        <>
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)' }}>
            Breathe in as the avatar expands, out as it contracts.
          </p>
          <button
            onClick={startTrial}
            className="px-6 py-3 rounded-xl font-medium"
            style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
          >
            Start trial {trialIdx + 1}
          </button>
        </>
      )}

      {trialState === TRIAL_STATES.IN_PROGRESS && (
        <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)' }}>
          Follow the avatar's breathing…
        </p>
      )}
    </div>
  );
}
