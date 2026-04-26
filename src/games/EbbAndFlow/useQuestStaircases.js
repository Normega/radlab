import jsQuestPlus from 'jsquest-plus';
import { useRef, useEffect } from 'react';

// Fixed psychometric parameters
const SLOPE = 5.70;
const GUESS = 1 / 3;   // 3AFC
const LAPSE = 0.02;

// Stimulus and threshold grid in log10 space
const N_STEPS = 46;
const LOG_MIN = Math.log10(0.05);
const LOG_MAX = Math.log10(0.50);

function linspace(a, b, n) {
  return Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
}

const stimSamples    = linspace(LOG_MIN, LOG_MAX, N_STEPS);
const threshSamples  = linspace(LOG_MIN, LOG_MAX, N_STEPS);
const slopeSamples   = [SLOPE];
const guessSamples   = [GUESS];
const lapseSamples   = [LAPSE];

// Gaussian prior over threshold, centred on log10(0.20)
const rawPrior = threshSamples.map(t =>
  Math.exp(-0.5 * ((t - Math.log10(0.20)) / 0.15) ** 2)
);
const priorSum = rawPrior.reduce((a, b) => a + b, 0);
const threshPrior = rawPrior.map(v => v / priorSum);

// P(correct) — Weibull 3AFC
function func_resp1(stim, threshold, slope, guess, lapse) {
  const tmp = slope * (stim - threshold);
  return (1 - lapse) * (guess + (1 - guess) * (1 - Math.exp(-Math.pow(10, tmp)))) + lapse * guess;
}

// P(wrong) — split equally between "same" and "opposite"
function func_resp0(stim, threshold, slope, guess, lapse) {
  return (1 - func_resp1(stim, threshold, slope, guess, lapse)) / 2;
}

function func_resp2(stim, threshold, slope, guess, lapse) {
  return (1 - func_resp1(stim, threshold, slope, guess, lapse)) / 2;
}

function createStaircase(priorArray) {
  const prior = priorArray
    ? jsQuestPlus.set_prior([priorArray, [1], [1], [1]])
    : jsQuestPlus.set_prior([threshPrior, [1], [1], [1]]);

  return new jsQuestPlus({
    psych_func: [func_resp0, func_resp1, func_resp2],
    stim_samples: [stimSamples],
    psych_samples: [threshSamples, slopeSamples, guessSamples, lapseSamples],
    priors: prior,
  });
}

function getNextStim(staircase) {
  // getStimParams() returns a scalar in this version of jsQuestPlus
  return staircase.getStimParams();
}

function updateStaircase(staircase, staircaseKey, responseKey, log10Mag) {
  const correctDir = staircaseKey.startsWith('faster') ? 'faster' : 'slower';
  let responseIndex;
  if (responseKey === correctDir)  responseIndex = 1;  // correct
  else if (responseKey === 'same') responseIndex = 0;  // wrong: same
  else                             responseIndex = 2;  // wrong: opposite

  // update() takes a plain scalar — NOT wrapped in array
  staircase.update(log10Mag, responseIndex);
  return responseIndex;
}

function getPosteriorSD(staircase) {
  const posterior = staircase.normalized_posteriors;
  if (!posterior) return 0.15; // fallback to prior SD if not available
  const mean = threshSamples.reduce((acc, t, i) => acc + t * posterior[i], 0);
  const variance = threshSamples.reduce(
    (acc, t, i) => acc + posterior[i] * Math.pow(t - mean, 2), 0
  );
  return Math.sqrt(variance);
}

function serializeStaircase(staircase, trialCount) {
  return {
    trial_count: trialCount,
    normalized_posteriors: staircase.normalized_posteriors,
  };
}

function deserializeStaircase(saved) {
  return createStaircase(saved.normalized_posteriors);
}

export function useQuestStaircases(savedState) {
  const staircases = useRef(null);
  const trialCounts = useRef({ faster_high: 0, faster_low: 0, slower_high: 0, slower_low: 0 });

  useEffect(() => {
    if (savedState === undefined) return; // still loading — wait

    if (savedState && Object.keys(savedState).length > 0) {
      console.log('[QUEST] Restoring from saved state. Trial counts:', {
        faster_high: savedState.faster_high?.trial_count,
        faster_low:  savedState.faster_low?.trial_count,
        slower_high: savedState.slower_high?.trial_count,
        slower_low:  savedState.slower_low?.trial_count,
      });
      staircases.current = {
        faster_high: deserializeStaircase(savedState.faster_high),
        faster_low:  deserializeStaircase(savedState.faster_low),
        slower_high: deserializeStaircase(savedState.slower_high),
        slower_low:  deserializeStaircase(savedState.slower_low),
      };
      trialCounts.current = {
        faster_high: savedState.faster_high?.trial_count ?? 0,
        faster_low:  savedState.faster_low?.trial_count  ?? 0,
        slower_high: savedState.slower_high?.trial_count ?? 0,
        slower_low:  savedState.slower_low?.trial_count  ?? 0,
      };
    } else {
      console.log('[QUEST] No saved state — initializing fresh staircases');
      staircases.current = {
        faster_high: createStaircase(),
        faster_low:  createStaircase(),
        slower_high: createStaircase(),
        slower_low:  createStaircase(),
      };
      trialCounts.current = { faster_high: 0, faster_low: 0, slower_high: 0, slower_low: 0 };
    }

    // Expose to window for console debugging — remove before production
    window.__qp = staircases.current;
  }, [savedState]);

  function getMostUncertainStaircase() {
    const keys = ['faster_high', 'faster_low', 'slower_high', 'slower_low'];
    return keys.reduce((best, key) => {
      const sd    = getPosteriorSD(staircases.current[key]);
      const bestSd = getPosteriorSD(staircases.current[best]);
      return sd > bestSd ? key : best;
    }, keys[0]);
  }

  function recordResponse(staircaseKey, responseKey, log10Mag) {
    const sc = staircases.current[staircaseKey];
    const responseIndex = updateStaircase(sc, staircaseKey, responseKey, log10Mag);
    trialCounts.current[staircaseKey] += 1;

    const nextLog10 = getNextStim(sc);
    console.log('[QUEST] update:', {
      staircaseKey,
      responseKey,
      responseIndex,
      stimUsed: Math.pow(10, log10Mag).toFixed(4),
      nextStim: Math.pow(10, nextLog10).toFixed(4),
      trialCount: trialCounts.current[staircaseKey],
    });

    return responseIndex;
  }

  function allConverged() {
    return ['faster_high', 'faster_low', 'slower_high', 'slower_low'].every(
      key => getPosteriorSD(staircases.current[key]) < 0.04
    );
  }

  function serialize() {
    const sc = staircases.current;
    return {
      faster_high: serializeStaircase(sc.faster_high, trialCounts.current.faster_high),
      faster_low:  serializeStaircase(sc.faster_low,  trialCounts.current.faster_low),
      slower_high: serializeStaircase(sc.slower_high, trialCounts.current.slower_high),
      slower_low:  serializeStaircase(sc.slower_low,  trialCounts.current.slower_low),
    };
  }

  function getNextStimForKey(key) {
    return getNextStim(staircases.current[key]);
  }

  function getSD(key) {
    return getPosteriorSD(staircases.current[key]);
  }

  function getThresholdEstimate(key) {
    const est = staircases.current[key].getEstimates('mean');
    const log10Threshold = Array.isArray(est) ? est[0] : est;
    return Math.pow(10, log10Threshold);
  }

  return {
    staircases,
    getMostUncertainStaircase,
    recordResponse,
    getNextStimForKey,
    getThresholdEstimate,
    getSD,
    allConverged,
    serialize,
    trialCounts,
  };
}
