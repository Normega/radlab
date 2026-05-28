import { useState, useCallback, useRef } from 'react';
import AvatarBreathPacer from '../../EbbAndFlow/components/AvatarBreathPacer';
import BeltSyncRing from './BeltSyncRing';
import SignalGraph from './SignalGraph';
import { useTrialRunner } from '../hooks/useTrialRunner';
import { buildReviewEntry } from '../breathUtils';
import {
  BASE_BREATH_SPEED_S,
  FASTER_BREATH_SPEED_S,
  SLOWER_BREATH_SPEED_S,
  TRIALS_PER_CONDITION,
} from '../constants';

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

// Convert rawAccelRowsRef rows in a timestamp window to {t,x,y,z}[] for MLR processing
function sliceAccelSamples(rawAccelRows, startMs, endMs) {
  return rawAccelRows
    .filter(r => r.packetTimestamp >= startMs && r.packetTimestamp <= endMs)
    .map(r => ({ t: r.packetTimestamp + r.sampleIndex * 5, x: r.x, y: r.y, z: r.z }));
}

const CONDITION_LABELS = { same: 'Same pace', faster: 'Faster', slower: 'Slower' };
const TRIAL_STATES = { READY: 'READY', IN_PROGRESS: 'IN_PROGRESS', REVIEWING: 'REVIEWING' };

export default function FixedTrialsScreen({
  avatarProps,
  breathValueRef,
  sendTrigger,
  currentPhaseRef,
  currentTrialRef,
  getPacerRadiusFnRef,
  setPacerContext,
  clearPacerContext,
  recordTrial,
  rawAccelRowsRef,
  mlrWeightsRef,
  onComplete,
}) {
  const [trialList]  = useState(buildTrialList);
  const [trialIdx,   setTrialIdx]     = useState(0);
  const [trialState, setTrialState]   = useState(TRIAL_STATES.READY);
  const [lastReview, setLastReview]   = useState(null);
  const trialsData    = useState([])[0];
  const reviewDataRef = useRef([]);
  const avatarSize    = 240;

  const { getPhase, runTrial, controlRef } = useTrialRunner({
    breathValueRef, sendTrigger, currentPhaseRef, currentTrialRef, getPacerRadiusFnRef,
    setPacerContext, clearPacerContext,
  });

  const startTrial = useCallback(async () => {
    const condition = trialList[trialIdx];
    setTrialState(TRIAL_STATES.IN_PROGRESS);

    const {
      beltSyncMean, btBaselinePeriodMs, btConditionPeriodMs,
      trialStartMs, trialEndMs, conditionMs: trialConditionMs,
    } = await runTrial('phase2', trialIdx + 1, conditionMs(condition));

    // Build review entry using identical offline filtfilt algorithm as calibration
    const accelSamples = sliceAccelSamples(rawAccelRowsRef?.current ?? [], trialStartMs, trialEndMs);
    const mlr = mlrWeightsRef?.current;
    const entry = (mlr && accelSamples.length >= 20)
      ? buildReviewEntry(accelSamples, mlr, trialStartMs, BASE_BREATH_SPEED_S * 1000, trialConditionMs, condition)
      : { condition, pacerPts: [], beltPts: [], scoreMs: Infinity };

    reviewDataRef.current.push(entry);

    const row = {
      phase:                  2,
      trial_number:           trialIdx + 1,
      condition,
      breath_period_ms:       conditionMs(condition),
      log10_mag:              null,
      response:               null,
      correct:                null,
      confidence:             null,
      arousal:                null,
      belt_sync_mean:         beltSyncMean,
      bt_baseline_period_ms:  btBaselinePeriodMs,
      bt_condition_period_ms: btConditionPeriodMs,
    };
    trialsData.push(row);
    recordTrial(row);

    setLastReview({ ...entry, trialNum: trialIdx + 1 });
    setTrialState(TRIAL_STATES.REVIEWING);
  }, [trialIdx, trialList, runTrial, recordTrial, trialsData, rawAccelRowsRef, mlrWeightsRef]);

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-8" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ position: 'relative', width: avatarSize, height: avatarSize }}>
        <BeltSyncRing breathValueRef={breathValueRef} avatarSize={avatarSize} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <AvatarBreathPacer
            {...avatarProps}
            scaleAmplitude={0.25}
            getPhase={getPhase}
            controlRef={controlRef}
            paused={trialState !== TRIAL_STATES.IN_PROGRESS}
            size={avatarSize}
          />
        </div>
      </div>

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

      {trialState === TRIAL_STATES.REVIEWING && lastReview && (
        <>
          <div style={{ width: '100%' }}>
            <p style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>
              Trial {lastReview.trialNum} — {CONDITION_LABELS[lastReview.condition] ?? lastReview.condition}
            </p>
            <p style={{ fontSize: 11, color: '#888', fontFamily: '"DM Sans",system-ui,sans-serif', marginBottom: 8 }}>
              <span style={{ color: '#3498db' }}>●</span> pacer &nbsp;
              <span style={{ color: '#e67e22' }}>●</span> belt
            </p>
            <SignalGraph
              pacerPts={lastReview.pacerPts}
              beltPts={lastReview.beltPts}
              scoreMs={lastReview.scoreMs}
              width={400}
              height={100}
            />
          </div>
          <button
            onClick={() => {
              const next = trialIdx + 1;
              if (next >= trialList.length) {
                onComplete(trialsData, reviewDataRef.current);
              } else {
                setTrialIdx(next);
                setTrialState(TRIAL_STATES.READY);
              }
            }}
            className="px-6 py-3 rounded-xl font-medium"
            style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
          >
            {trialIdx + 1 >= trialList.length ? 'View trial summary →' : `Start trial ${trialIdx + 2}`}
          </button>
        </>
      )}
    </div>
  );
}
