import jsQuestPlus from 'jsquest-plus';
import { useRef } from 'react';
import {
  QUEST_LOG_MIN, QUEST_LOG_MAX, QUEST_N_STEPS,
  QUEST_SLOPE, QUEST_LAPSE, QUEST_GUESS,
  QUEST_CONVERGENCE_SD, QUEST_PRIOR_MEAN_LOG, QUEST_PRIOR_SD,
} from '../constants';

// ── Stim / parameter grids ────────────────────────────────────────────────

function linspace(a, b, n) {
  return Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
}

const stimSamples  = linspace(QUEST_LOG_MIN, QUEST_LOG_MAX, QUEST_N_STEPS);
const threshSamples = linspace(QUEST_LOG_MIN, QUEST_LOG_MAX, QUEST_N_STEPS);

// Gaussian prior centred at QUEST_PRIOR_MEAN_LOG
const rawPrior = threshSamples.map(t =>
  Math.exp(-0.5 * ((t - QUEST_PRIOR_MEAN_LOG) / QUEST_PRIOR_SD) ** 2)
);
const priorSum   = rawPrior.reduce((a, b) => a + b, 0);
const threshPrior = rawPrior.map(v => v / priorSum);

// ── Psychometric functions (3AFC, Weibull) ────────────────────────────────
// Response indices: 0 = wrong/same  1 = correct  2 = wrong/opposite
// Note: func_resp0 and func_resp2 are intentionally symmetric.

function pCorrect(stim, threshold, slope, guess, lapse) {
  const tmp = slope * (stim - threshold);
  return (1 - lapse) * (guess + (1 - guess) * (1 - Math.exp(-Math.pow(10, tmp)))) + lapse * guess;
}
function pWrongSame(stim, threshold, slope, guess, lapse) {
  return (1 - pCorrect(stim, threshold, slope, guess, lapse)) / 2;
}
function pWrongOpposite(stim, threshold, slope, guess, lapse) {
  return (1 - pCorrect(stim, threshold, slope, guess, lapse)) / 2;
}

// ── Staircase factory ─────────────────────────────────────────────────────

function createStaircase(savedPosteriors) {
  const prior = savedPosteriors
    ? jsQuestPlus.set_prior([savedPosteriors, [1], [1], [1]])
    : jsQuestPlus.set_prior([threshPrior,     [1], [1], [1]]);

  return new jsQuestPlus({
    psych_func:    [pWrongSame, pCorrect, pWrongOpposite],
    stim_samples:  [stimSamples],
    psych_samples: [threshSamples, [QUEST_SLOPE], [QUEST_GUESS], [QUEST_LAPSE]],
    priors:        prior,
  });
}

function posteriorMeanLog(staircase) {
  const post = staircase.normalized_posteriors;
  if (!post) return QUEST_PRIOR_MEAN_LOG;
  return threshSamples.reduce((a, t, i) => a + t * post[i], 0);
}

function posteriorSD(staircase) {
  const post = staircase.normalized_posteriors;
  if (!post) return QUEST_CONVERGENCE_SD + 0.01; // fallback above threshold
  const mean = posteriorMeanLog(staircase);
  return Math.sqrt(threshSamples.reduce((a, t, i) => a + post[i] * (t - mean) ** 2, 0));
}

// ── useBeltQuestStaircases ────────────────────────────────────────────────
//
// savedState shape: { faster: { normalized_posteriors }, slower: { ... } }
// Pass null / undefined to start fresh.
//
// getNextTrial() → { key: 'faster'|'slower', log10Delta, deltaSec }
//   key          — which staircase drives this trial (highest posterior SD)
//   log10Delta   — log10(delta_seconds) — for Supabase storage
//   deltaSec     — 10^log10Delta — for breath period computation
//     FASTER trial period: BASE_BREATH_SPEED_S - deltaSec
//     SLOWER trial period: BASE_BREATH_SPEED_S + deltaSec
//
// recordResponse(key, responseKey, log10Delta)
//   responseKey: 'faster' | 'same' | 'slower'

export function useBeltQuestStaircases(savedState) {
  const scRef = useRef(null);

  if (!scRef.current) {
    scRef.current = {
      faster: createStaircase(savedState?.faster?.normalized_posteriors ?? null),
      slower: createStaircase(savedState?.slower?.normalized_posteriors ?? null),
    };
  }

  function getNextTrial() {
    const { faster, slower } = scRef.current;
    const fasterSD = posteriorSD(faster);
    const slowerSD = posteriorSD(slower);
    const key = fasterSD >= slowerSD ? 'faster' : 'slower';
    const log10Delta = scRef.current[key].getStimParams(); // returns scalar
    const deltaSec   = Math.pow(10, log10Delta);
    return { key, log10Delta, deltaSec };
  }

  function recordResponse(staircaseKey, responseKey, log10Delta) {
    // responseKey: 'faster' | 'same' | 'slower'
    const correct = staircaseKey; // 'faster' or 'slower'
    let responseIndex;
    if (responseKey === correct)  responseIndex = 1; // correct
    else if (responseKey === 'same') responseIndex = 0; // wrong: said same
    else                          responseIndex = 2; // wrong: said opposite
    // update() takes a plain scalar — do NOT wrap in array (NaN posterior bug)
    scRef.current[staircaseKey].update(log10Delta, responseIndex);
    return responseIndex;
  }

  function getConvergence() {
    const { faster, slower } = scRef.current;
    return {
      faster: { sd: posteriorSD(faster), meanDeltaSec: Math.pow(10, posteriorMeanLog(faster)) },
      slower: { sd: posteriorSD(slower), meanDeltaSec: Math.pow(10, posteriorMeanLog(slower)) },
    };
  }

  function allConverged() {
    const { faster, slower } = getConvergence();
    return faster.sd < QUEST_CONVERGENCE_SD && slower.sd < QUEST_CONVERGENCE_SD;
  }

  function serialise() {
    return {
      faster: { normalized_posteriors: scRef.current.faster.normalized_posteriors },
      slower: { normalized_posteriors: scRef.current.slower.normalized_posteriors },
    };
  }

  return { getNextTrial, recordResponse, getConvergence, allConverged, serialise };
}
