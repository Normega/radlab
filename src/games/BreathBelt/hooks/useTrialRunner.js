import { useRef } from 'react';
import { useBreathCycle } from '../../EbbAndFlow/useBreathCycle';
import { estimateBreathPeriodMs, meanOf, getPacerRadiusForTrial } from '../breathUtils';
import { BASE_BREATH_SPEED_S, BASELINE_BREATHS_COUNT, CONDITION_BREATHS_COUNT } from '../constants';

const BASE_MS   = BASE_BREATH_SPEED_S * 1000;
const SAMPLE_MS = 40; // ~25 Hz

// ── COM trigger vocabulary (trial-level) ──────────────────────────────────
// 10  trial start       — baseline breaths begin
// 11  condition onset   — breath 3 begins (baseline→condition boundary)
// 12  trial end
//
// Phase-level codes (1–9) are fired from BreathBelt.jsx at FSM transitions.
// Reusing 10/11/12 across Phase 2 and Phase 3 is intentional — the preceding
// phase code (4 or 6) establishes context in the lab belt signal.

export function useTrialRunner({ breathValueRef, sendTrigger, currentPhaseRef, currentTrialRef, getPacerRadiusFnRef }) {
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
      const sample = { t: Date.now(), value: v };
      if (target === 'baseline')  baselineSamplesRef.current.push(sample);
      else                        conditionSamplesRef.current.push(sample);
    }, SAMPLE_MS);
  }

  function stopSampling() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  async function runTrial(phaseLabel, trialIdx, conditionMs) {
    currentPhaseRef.current = phaseLabel;
    currentTrialRef.current = trialIdx;

    await new Promise(r => setTimeout(r, 500));  // brief fixation hold

    // Code 10 — trial start, baseline breaths begin
    await sendTrigger('10');

    const trialStartMs = Date.now();
    if (getPacerRadiusFnRef) {
      getPacerRadiusFnRef.current = (t) => getPacerRadiusForTrial(t, trialStartMs, BASE_MS, conditionMs);
    }

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
    controlRef.current?.resetToNeutral?.();   // freeze at neutral for next READY state
    if (getPacerRadiusFnRef) {
      getPacerRadiusFnRef.current = () => NaN;
    }

    currentPhaseRef.current = 'inter_trial';
    currentTrialRef.current = -1;

    return {
      beltSyncMean:        meanOf(conditionSamplesRef.current.map(s => s.value)),
      btBaselinePeriodMs:  estimateBreathPeriodMs(baselineSamplesRef.current),
      btConditionPeriodMs: estimateBreathPeriodMs(conditionSamplesRef.current),
    };
  }

  return { getPhase, runTrial, controlRef };
}
