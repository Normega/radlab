import { useRef } from 'react';
import { useBreathCycle } from '../../EbbAndFlow/useBreathCycle';
import { BASE_BREATH_SPEED_S, BASELINE_BREATHS_COUNT, CONDITION_BREATHS_COUNT } from '../constants';

const BASE_MS = BASE_BREATH_SPEED_S * 1000;

// ── useTrialRunner ─────────────────────────────────────────────────────────
//
// Shared timing logic for Phase 2 and Phase 3 trials.
// One trial = BASELINE_BREATHS_COUNT breaths at BASE + CONDITION_BREATHS_COUNT
// breaths at conditionMs. High-salience: condition loads abruptly at breath 3.
//
// Returns:
//   getPhase      — pass to AvatarBreathPacer (live 0-1 breath cycle position)
//   runTrial      — async (label, trialIdx, conditionMs) → { beltSyncMean }
//   controlRef    — pass to AvatarBreathPacer for imperative reset/resume
//   cycleDurationRef — pass to AvatarBreathPacer if needed for sync

export function useTrialRunner({ breathValueRef, sendTrigger, currentPhaseRef, currentTrialRef }) {
  const { getPhase, startBreath, reset, cycleDurationRef } = useBreathCycle();
  const controlRef        = useRef(null);
  const syncSamplesRef    = useRef([]);
  const sampleIntervalRef = useRef(null);

  function startSyncing() {
    syncSamplesRef.current = [];
    sampleIntervalRef.current = setInterval(() => {
      syncSamplesRef.current.push(breathValueRef.current ?? 0);
    }, 40); // ~25 Hz sampling
  }

  function stopSyncing() {
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
  }

  async function runTrial(phaseLabel, trialIdx, conditionMs) {
    // Label raw data rows with this trial
    currentPhaseRef.current = phaseLabel;
    currentTrialRef.current = trialIdx;

    // Imperatively reset avatar to neutral before trial starts
    controlRef.current?.resetToNeutral?.();
    await new Promise(r => setTimeout(r, 1000)); // 1 s hold at neutral

    // COM trigger: trial start
    await sendTrigger('1');

    // Breaths 1–2: baseline pace
    reset(); // start cycle clock
    controlRef.current?.resumeAnimation?.();
    for (let i = 0; i < BASELINE_BREATHS_COUNT; i++) {
      await startBreath(BASE_MS);
    }

    // Breaths 3–4: condition pace (high salience — abrupt change at breath 3)
    // Start accumulating belt sync samples for condition period
    startSyncing();
    for (let i = 0; i < CONDITION_BREATHS_COUNT; i++) {
      await startBreath(conditionMs);
    }
    stopSyncing();

    // COM trigger: trial end
    await sendTrigger('0');

    // Return to idle label
    currentPhaseRef.current = 'inter_trial';
    currentTrialRef.current = -1;

    const samples     = syncSamplesRef.current;
    const beltSyncMean = samples.length
      ? samples.reduce((a, b) => a + b, 0) / samples.length
      : null;

    return { beltSyncMean };
  }

  return { getPhase, runTrial, controlRef, cycleDurationRef };
}
