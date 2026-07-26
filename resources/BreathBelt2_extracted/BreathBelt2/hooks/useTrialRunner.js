import { useRef } from 'react';
import { useBreathCycle } from '../../EbbAndFlow/useBreathCycle';
import { estimateBreathPeriodMs, meanOf } from '../breathUtils';
import { BASE_BREATH_SPEED_S, BASELINE_BREATHS_COUNT, CONDITION_BREATHS_COUNT } from '../constants';

const BASE_MS      = BASE_BREATH_SPEED_S * 1000;
const SAMPLE_MS    = 40; // ~25 Hz

// ── useTrialRunner ─────────────────────────────────────────────────────────
//
// Shared timing logic for Phase 2 and Phase 3 trials.
// Samples breathValueRef separately during baseline breaths and condition
// breaths so period estimates can be computed for each window independently.
//
// runTrial returns:
//   beltSyncMean        — mean breathValue during condition breaths (0–1)
//   btBaselinePeriodMs  — estimated breath period from baseline window (ms | null)
//   btConditionPeriodMs — estimated breath period from condition window (ms | null)
//
// null period estimates mean < 2 peaks were detected — store as null in DB,
// do not drop the trial.

export function useTrialRunner({ breathValueRef, sendTrigger, currentPhaseRef, currentTrialRef }) {
  const { getPhase, startBreath, reset } = useBreathCycle();
  const controlRef = useRef(null);

  const baselineSamplesRef  = useRef([]);
  const conditionSamplesRef = useRef([]);
  const intervalRef         = useRef(null);

  function startSampling(target) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (target === 'baseline')  baselineSamplesRef.current  = [];
    else                        conditionSamplesRef.current = [];

    intervalRef.current = setInterval(() => {
      const v = breathValueRef.current ?? 0;
      if (target === 'baseline')  baselineSamplesRef.current.push(v);
      else                        conditionSamplesRef.current.push(v);
    }, SAMPLE_MS);
  }

  function stopSampling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function runTrial(phaseLabel, trialIdx, conditionMs) {
    currentPhaseRef.current = phaseLabel;
    currentTrialRef.current = trialIdx;

    controlRef.current?.resetToNeutral?.();
    await new Promise(r => setTimeout(r, READY_DELAY_MS));

    // COM trigger: trial start
    await sendTrigger('1');

    // Breaths 1–2: baseline pace — sample for period estimation
    reset();
    controlRef.current?.resumeAnimation?.();
    startSampling('baseline');
    for (let i = 0; i < BASELINE_BREATHS_COUNT; i++) {
      await startBreath(BASE_MS);
    }
    stopSampling();

    // Breaths 3–4: condition pace — sample for sync mean + period estimation
    startSampling('condition');
    for (let i = 0; i < CONDITION_BREATHS_COUNT; i++) {
      await startBreath(conditionMs);
    }
    stopSampling();

    // COM trigger: trial end
    await sendTrigger('0');

    currentPhaseRef.current = 'inter_trial';
    currentTrialRef.current = -1;

    return {
      beltSyncMean:        meanOf(conditionSamplesRef.current),
      btBaselinePeriodMs:  estimateBreathPeriodMs(baselineSamplesRef.current,  SAMPLE_MS),
      btConditionPeriodMs: estimateBreathPeriodMs(conditionSamplesRef.current, SAMPLE_MS),
    };
  }

  return { getPhase, runTrial, controlRef };
}

// Local import — avoids circular dep
const READY_DELAY_MS = 1000;
