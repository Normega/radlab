import { useRef } from 'react';
import { useBreathCycle } from '../../EbbAndFlow/useBreathCycle';
import { estimateBreathPeriodMs, meanOf } from '../breathUtils';
import { BASE_BREATH_SPEED_S, BASELINE_BREATHS_COUNT, CONDITION_BREATHS_COUNT } from '../constants';

const BASE_MS   = BASE_BREATH_SPEED_S * 1000;
const SAMPLE_MS = 40; // ~25 Hz
const READY_DELAY_MS = 1000;

// ── COM trigger vocabulary (trial-level) ──────────────────────────────────
// 10  trial start       — baseline breaths begin
// 11  condition onset   — breath 3 begins (baseline→condition boundary)
// 12  trial end
//
// Phase-level codes (1–9) are fired from BreathBelt.jsx at FSM transitions.
// Reusing 10/11/12 across Phase 2 and Phase 3 is intentional — the preceding
// phase code (4 or 6) establishes context in the lab belt signal.

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
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  async function runTrial(phaseLabel, trialIdx, conditionMs) {
    currentPhaseRef.current = phaseLabel;
    currentTrialRef.current = trialIdx;

    controlRef.current?.resetToNeutral?.();
    await new Promise(r => setTimeout(r, READY_DELAY_MS));

    // Code 10 — trial start, baseline breaths begin
    await sendTrigger('10');

    reset();
    controlRef.current?.resumeAnimation?.();
    startSampling('baseline');
    for (let i = 0; i < BASELINE_BREATHS_COUNT; i++) {
      await startBreath(BASE_MS);
    }
    stopSampling();

    // Code 11 — condition onset, breath 3 begins
    await sendTrigger('11');

    startSampling('condition');
    for (let i = 0; i < CONDITION_BREATHS_COUNT; i++) {
      await startBreath(conditionMs);
    }
    stopSampling();

    // Code 12 — trial end
    await sendTrigger('12');

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
