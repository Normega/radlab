import { useRef } from 'react';
import jsQuestPlus from 'jsquest-plus';
import {
  MAGNITUDE_MIN, MAGNITUDE_MAX, MAGNITUDE_STEPS,
  QUEST_PRIORS, QUEST_CONVERGENCE_SD,
} from './constants';

// ── Stimulus / parameter grids ────────────────────────────────────────────

const stimSamples = jsQuestPlus.linspace(
  Math.log10(MAGNITUDE_MIN),
  Math.log10(MAGNITUDE_MAX),
  MAGNITUDE_STEPS
);

const thresholdSamples = jsQuestPlus.linspace(
  Math.log10(MAGNITUDE_MIN),
  Math.log10(MAGNITUDE_MAX),
  MAGNITUDE_STEPS
);

const thresholdPrior = jsQuestPlus.gauss(
  thresholdSamples,
  Math.log10(QUEST_PRIORS.threshold_mean), // ≈ -0.699
  QUEST_PRIORS.threshold_sd                // 0.15 in log10 units
);

const slopeSamples  = [QUEST_PRIORS.slope];
const lapseSamples  = [QUEST_PRIORS.lapse_rate];

// ── Psychometric functions (3AFC Weibull) ─────────────────────────────────

function pCorrect(stim, threshold, slope, lapse) {
  return jsQuestPlus.weibull(stim, threshold, slope, 1 / 3, lapse);
}
function pWrong(stim, threshold, slope, lapse) {
  return (1 - pCorrect(stim, threshold, slope, lapse)) / 2;
}

// Response indices: 0 = "same", 1 = correct direction, 2 = opposite direction
const psychFuncs = [pWrong, pCorrect, pWrong];

// ── Staircase factory ─────────────────────────────────────────────────────

function createStaircase() {
  return new jsQuestPlus({
    psych_func: psychFuncs,
    stim_samples: [stimSamples],
    psych_samples: [thresholdSamples, slopeSamples, lapseSamples],
    priors: jsQuestPlus.set_prior([
      thresholdPrior,
      slopeSamples.length,
      lapseSamples.length,
    ]),
  });
}

// ── Serialization ─────────────────────────────────────────────────────────
//
// The authoritative post-trial state is staircase.normalized_posteriors —
// a flat array that update() rewrites on every trial.
// staircase.posteriors.normalized_priors is an alias to the same array
// (assigned in update()), but going through the posteriors object introduces
// a reference-chain that can break after a JSON/Supabase round-trip.
//
// Fix: read normalized_posteriors directly and copy it to a plain Array so
// JSON.stringify produces an ordinary numeric array with no hidden state.
//
// Restore: jsQuestPlus requires a full { priors, comb_priors, normalized_priors }
// object as the priors: setting.  Build one with set_prior() (same params as
// createStaircase), then replace normalized_priors with the saved posterior so
// the new instance starts exactly where the previous session ended.

function serializeStaircase(staircase) {
  return {
    normalized_posteriors: Array.from(staircase.normalized_posteriors),
    trial_count: staircase.stim_list?.length ?? 0,
  };
}

function deserializeStaircase(saved) {
  // Build a well-formed priors object the constructor can validate,
  // then inject the saved posterior as the starting normalized_priors.
  const restoredPriors = jsQuestPlus.set_prior([
    thresholdPrior,
    slopeSamples.length,
    lapseSamples.length,
  ]);
  restoredPriors.normalized_priors = saved.normalized_posteriors;

  return new jsQuestPlus({
    psych_func: psychFuncs,
    stim_samples: [stimSamples],
    psych_samples: [thresholdSamples, slopeSamples, lapseSamples],
    priors: restoredPriors,
  });
}

// ── Posterior SD for convergence check ───────────────────────────────────
// getSDs() returns [threshold_sd, slope_sd, lapse_sd]
// Index 0 is threshold — what we care about for convergence

function getPosteriorSD(staircase) {
  return staircase.getSDs()[0];
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useQuestStaircases(savedState) {
  const staircases = useRef(null);

  // Initialize synchronously on first render (safe — no side effects)
  if (!staircases.current) {
    if (savedState) {
      staircases.current = {
        faster_high: deserializeStaircase(savedState.faster_high),
        faster_low:  deserializeStaircase(savedState.faster_low),
        slower_high: deserializeStaircase(savedState.slower_high),
        slower_low:  deserializeStaircase(savedState.slower_low),
      };
      // TODO: remove once cross-session persistence is confirmed working
      console.log('[QUEST] Restoring from saved state:', savedState);
      console.log('[QUEST] Trial counts on restore:', {
        faster_high: staircases.current.faster_high.stim_list?.length ?? 0,
        faster_low:  staircases.current.faster_low.stim_list?.length  ?? 0,
        slower_high: staircases.current.slower_high.stim_list?.length ?? 0,
        slower_low:  staircases.current.slower_low.stim_list?.length  ?? 0,
      });
    } else {
      staircases.current = {
        faster_high: createStaircase(),
        faster_low:  createStaircase(),
        slower_high: createStaircase(),
        slower_low:  createStaircase(),
      };
      // TODO: remove once cross-session persistence is confirmed working
      console.log('[QUEST] No saved state found — initializing fresh staircases');
    }
  }

  // Next stimulus for a given staircase, in log10 units (exact — no round-trip float drift)
  function getLog10Magnitude(staircaseKey) {
    const nextStim = staircases.current[staircaseKey].getStimParams();
    // TODO: remove once cross-session persistence is confirmed working
    console.log('[QUEST] Next stimulus selected:', {
      staircaseKey,
      log10Mag:       nextStim?.toFixed(4),
      linearMag:      Math.pow(10, nextStim)?.toFixed(4),
      stimListLength: staircases.current[staircaseKey]?.stim_list?.length,
    });
    return nextStim;
  }

  // Next stimulus for a given staircase, in linear units
  function getNextMagnitude(staircaseKey) {
    return Math.pow(10, getLog10Magnitude(staircaseKey));
  }

  // Record a response; responseKey: 'faster' | 'slower' | 'same'
  function recordResponse(staircaseKey, responseKey, log10Mag) {
    const correctDir = staircaseKey.startsWith('faster') ? 'faster' : 'slower';
    const responseIndex = responseKey === correctDir ? 1 : responseKey === 'same' ? 0 : 2;
    staircases.current[staircaseKey].update(log10Mag, responseIndex);
    // TODO: remove once cross-session persistence is confirmed working
    console.log('[QUEST] update called:', {
      staircaseKey,
      responseKey,
      correctResponse: correctDir,
      responseIndex,
      log10Mag: log10Mag?.toFixed(4),
      trialCountAfter: staircases.current[staircaseKey]?.stim_list?.length ?? 0,
    });
  }

  // Which staircase is most uncertain (highest posterior SD)?
  function getMostUncertainKey() {
    const keys = ['faster_high', 'faster_low', 'slower_high', 'slower_low'];
    return keys.reduce((best, key) =>
      getPosteriorSD(staircases.current[key]) > getPosteriorSD(staircases.current[best])
        ? key : best,
      keys[0]
    );
  }

  function allConverged() {
    return ['faster_high', 'faster_low', 'slower_high', 'slower_low'].every(
      key => getPosteriorSD(staircases.current[key]) < QUEST_CONVERGENCE_SD
    );
  }

  function getThresholdEstimate(key) {
    // Returns mean threshold estimate in linear units
    const log10Est = staircases.current[key].getEstimates('mean');
    // getEstimates returns comb_PF_params element: [threshold, slope, lapse]
    const log10Threshold = Array.isArray(log10Est) ? log10Est[0] : log10Est;
    return Math.pow(10, log10Threshold);
  }

  function getSD(key) {
    return getPosteriorSD(staircases.current[key]);
  }

  function serialize() {
    const sc = staircases.current;
    // TODO: remove once cross-session persistence is confirmed working
    console.log('[QUEST] Saving state:', {
      faster_high_trials: sc.faster_high.stim_list?.length ?? 0,
      faster_low_trials:  sc.faster_low.stim_list?.length  ?? 0,
      slower_high_trials: sc.slower_high.stim_list?.length ?? 0,
      slower_low_trials:  sc.slower_low.stim_list?.length  ?? 0,
    });
    return {
      faster_high: serializeStaircase(sc.faster_high),
      faster_low:  serializeStaircase(sc.faster_low),
      slower_high: serializeStaircase(sc.slower_high),
      slower_low:  serializeStaircase(sc.slower_low),
    };
  }

  return {
    staircases,
    getLog10Magnitude,
    getNextMagnitude,
    recordResponse,
    getMostUncertainKey,
    allConverged,
    getThresholdEstimate,
    getSD,
    serialize,
  };
}
