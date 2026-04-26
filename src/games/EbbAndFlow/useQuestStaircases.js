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

// Slope, guess, and lapse are fixed — only threshold is estimated.
// Hardcoding them in the psychometric functions keeps psych_samples 1D.
const SLOPE = QUEST_PRIORS.slope;
const GUESS = QUEST_PRIORS.guess_rate; // 1/3 for 3AFC
const LAPSE = QUEST_PRIORS.lapse_rate;

// ── Psychometric functions (3AFC Weibull) ─────────────────────────────────
// Only threshold is a free parameter; slope/guess/lapse are closed over.

function pCorrect(stim, threshold) {
  return jsQuestPlus.weibull(stim, threshold, SLOPE, GUESS, LAPSE);
}
function pWrong(stim, threshold) {
  return (1 - jsQuestPlus.weibull(stim, threshold, SLOPE, GUESS, LAPSE)) / 2;
}

// Response indices: 0 = "same", 1 = correct direction, 2 = opposite direction
const psychFuncs = [pWrong, pCorrect, pWrong];

// ── Staircase factory ─────────────────────────────────────────────────────

function createStaircase() {
  return new jsQuestPlus({
    psych_func:    psychFuncs,
    stim_samples:  [stimSamples],
    psych_samples: [thresholdSamples],
    priors:        jsQuestPlus.set_prior([thresholdPrior]),
  });
}

// ── Serialization ─────────────────────────────────────────────────────────
//
// Saved shape: { trial_count: N, normalized_posteriors: [46 values] }
//
// Serialize: read staircase.normalized_posteriors directly (authoritative
// post-trial state) and copy to a plain Array for clean JSON round-trip.
//
// Restore: pass the saved posterior as the sole marginal into set_prior()
// (threshold only — slope/guess/lapse are hardcoded in the psych functions).
// set_prior() builds a valid { priors, comb_priors, normalized_priors }
// from scratch — no post-hoc property injection the constructor might overwrite.

// trial_count is passed in from trialCounts ref — jsQuestPlus does not
// reconstruct stim_list when seeded via priors so we can't read it back.
function serializeStaircase(staircase, trial_count) {
  return {
    trial_count,
    normalized_posteriors: Array.from(staircase.normalized_posteriors),
  };
}

function deserializeStaircase(saved) {
  // TODO: remove once cross-session persistence is confirmed working
  console.log('[QUEST] deserializing staircase, keys in saved:', Object.keys(saved));
  console.log('[QUEST] saved.normalized_posteriors (first 4):', saved.normalized_posteriors?.slice(0, 4));

  const restoredPrior = jsQuestPlus.set_prior([saved.normalized_posteriors]);

  return new jsQuestPlus({
    psych_func:    psychFuncs,
    stim_samples:  [stimSamples],
    psych_samples: [thresholdSamples],
    priors:        restoredPrior,
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
  const staircases  = useRef(null);
  // trialCounts tracks cumulative trials across sessions — jsQuestPlus does not
  // reconstruct stim_list when seeded via priors, so we maintain the count ourselves.
  const trialCounts = useRef({
    faster_high: savedState?.faster_high?.trial_count ?? 0,
    faster_low:  savedState?.faster_low?.trial_count  ?? 0,
    slower_high: savedState?.slower_high?.trial_count ?? 0,
    slower_low:  savedState?.slower_low?.trial_count  ?? 0,
  });

  // Initialize once we have a definitive value for savedState.
  // undefined = profile still loading — skip and wait for re-render.
  // null      = profile loaded, no saved state — initialize fresh.
  // object    = profile loaded with saved state — restore.
  if (!staircases.current && savedState !== undefined) {
    if (savedState) {
      staircases.current = {
        faster_high: deserializeStaircase(savedState.faster_high),
        faster_low:  deserializeStaircase(savedState.faster_low),
        slower_high: deserializeStaircase(savedState.slower_high),
        slower_low:  deserializeStaircase(savedState.slower_low),
      };
      window.__qp = staircases.current; // TODO: remove — debug handle
      // TODO: remove once cross-session persistence is confirmed working
      console.log('[QUEST] Restoring from saved state:', savedState);
      console.log('[QUEST] Trial counts on restore:', {
        faster_high: savedState.faster_high?.trial_count,
        faster_low:  savedState.faster_low?.trial_count,
        slower_high: savedState.slower_high?.trial_count,
        slower_low:  savedState.slower_low?.trial_count,
      });
    } else {
      staircases.current = {
        faster_high: createStaircase(),
        faster_low:  createStaircase(),
        slower_high: createStaircase(),
        slower_low:  createStaircase(),
      };
      window.__qp = staircases.current; // TODO: remove — debug handle
      // TODO: remove once cross-session persistence is confirmed working
      console.log('[QUEST] No saved state found — initializing fresh staircases');
    }
  }

  // Next stimulus for a given staircase, in log10 units (exact — no round-trip float drift)
  function getLog10Magnitude(staircaseKey) {
    const nextStim = staircases.current[staircaseKey].getStimParams()[0];
    // TODO: remove once cross-session persistence is confirmed working
    console.log('[QUEST] Next stimulus selected:', {
      staircaseKey,
      log10Mag:       nextStim?.toFixed(4),
      linearMag:      Math.pow(10, nextStim).toFixed(4),
      cumulativeTrials: trialCounts.current[staircaseKey],
      note: 'linearMag should differ from 0.2000 on session 2+ if restore is working',
    });
    return nextStim;
  }

  // Next stimulus for a given staircase, in linear units
  function getNextMagnitude(staircaseKey) {
    return Math.pow(10, getLog10Magnitude(staircaseKey));
  }

  // Record a response; responseKey: 'faster' | 'slower' | 'same'
  function recordResponse(staircaseKey, responseKey, log10Mag) {
    const correctDir    = staircaseKey.startsWith('faster') ? 'faster' : 'slower';
    const responseIndex = responseKey === correctDir ? 1 : responseKey === 'same' ? 0 : 2;
    const staircase     = staircases.current[staircaseKey];

    // TODO: remove once cross-session persistence is confirmed working
    console.log('[QUEST] update() args:', {
      staircaseKey,
      stimArg:             log10Mag,
      responseIndex,
      correctResponse:     correctDir,
      participantResponse: responseKey,
      linearMag:           Math.pow(10, log10Mag).toFixed(4),
    });

    staircase.update([log10Mag], responseIndex);
    trialCounts.current[staircaseKey] += 1;

    // TODO: remove once cross-session persistence is confirmed working
    console.log('[QUEST] posterior after update:', {
      staircaseKey,
      nextStim: Math.pow(10, staircase.getStimParams()[0]).toFixed(4),
      cumulativeTrials: trialCounts.current[staircaseKey],
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
    const tc = trialCounts.current;
    // TODO: remove once cross-session persistence is confirmed working
    console.log('[QUEST] Saving state:', {
      faster_high_trials: tc.faster_high,
      faster_low_trials:  tc.faster_low,
      slower_high_trials: tc.slower_high,
      slower_low_trials:  tc.slower_low,
    });
    return {
      faster_high: serializeStaircase(sc.faster_high, tc.faster_high),
      faster_low:  serializeStaircase(sc.faster_low,  tc.faster_low),
      slower_high: serializeStaircase(sc.slower_high, tc.slower_high),
      slower_low:  serializeStaircase(sc.slower_low,  tc.slower_low),
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
