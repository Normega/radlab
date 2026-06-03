import { useState, useCallback, useRef } from 'react'
import AvatarBreathPacer from '../../EbbAndFlow/components/AvatarBreathPacer'
import BeltSyncRing from './BeltSyncRing'
import TrialSyncOverlay from './TrialSyncOverlay'
import { useTrialRunner } from '../hooks/useTrialRunner'
import {
  BASE_BREATH_SPEED_S, FASTER_BREATH_SPEED_S, SLOWER_BREATH_SPEED_S, TRIALS_PER_CONDITION,
} from '../constants'

function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildTrialList() {
  return shuffled([
    ...Array(TRIALS_PER_CONDITION).fill('same'),
    ...Array(TRIALS_PER_CONDITION).fill('faster'),
    ...Array(TRIALS_PER_CONDITION).fill('slower'),
  ])
}

function conditionMs(condition) {
  if (condition === 'faster') return FASTER_BREATH_SPEED_S * 1000
  if (condition === 'slower') return SLOWER_BREATH_SPEED_S * 1000
  return BASE_BREATH_SPEED_S * 1000
}

const TRIAL_STATES = { READY: 'READY', IN_PROGRESS: 'IN_PROGRESS' }

export default function FixedTrialsScreen({
  avatarProps,
  breathValueRef,
  syncQuality,
  sendTrigger,
  currentPhaseRef,
  currentTrialRef,
  getAndClearTrialSamples,
  mlrWeightsRef,
  setPacerContext,
  clearPacerContext,
  recordTrial,
  onComplete,
}) {
  const [trialList]  = useState(buildTrialList)
  const [trialIdx,   setTrialIdx]   = useState(0)
  const [trialState, setTrialState] = useState(TRIAL_STATES.READY)
  const [syncData,   setSyncData]   = useState(null)   // post-trial metrics overlay
  const trialsData   = useState([])[0]
  const trialGraphsRef = useRef([])
  const avatarSize   = 240

  const { getPhase, runTrial, controlRef } = useTrialRunner({
    breathValueRef,
    sendTrigger,
    currentPhaseRef,
    currentTrialRef,
    getAndClearTrialSamples,
    mlrWeightsRef,
    setPacerContext,
    clearPacerContext,
  })

  const startTrial = useCallback(async () => {
    const condition = trialList[trialIdx]
    setSyncData(null)                          // clear previous overlay
    setTrialState(TRIAL_STATES.IN_PROGRESS)

    const { beltSyncMean, btBaselinePeriodMs, btConditionPeriodMs, syncMetrics } =
      await runTrial('phase2', trialIdx + 1, conditionMs(condition))

    setSyncData(syncMetrics)                   // show overlay on READY screen

    trialGraphsRef.current.push({
      trialNumber: trialIdx + 1,
      condition,
      pacerPts:    syncMetrics?.pacerPts   ?? [],
      beltPts:     syncMetrics?.beltPts    ?? [],
      peakErrorMs: syncMetrics?.peakErrorMs ?? null,
    })

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
      trial_r_baseline:       syncMetrics?.trialRBaseline  ?? null,
      trial_r_condition:      syncMetrics?.trialRCondition ?? null,
      peak_error_ms:          syncMetrics?.peakErrorMs     ?? null,
    }
    trialsData.push(row)
    recordTrial(row)

    const next = trialIdx + 1
    if (next >= trialList.length) {
      onComplete(trialsData, trialGraphsRef.current)
    } else {
      setTrialIdx(next)
      setTrialState(TRIAL_STATES.READY)
    }
  }, [trialIdx, trialList, runTrial, recordTrial, onComplete, trialsData])

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-8" style={{ maxWidth: 480, margin: '0 auto' }}>

      <div style={{ position: 'relative', width: avatarSize, height: avatarSize }}>
        {/* BeltSyncRing hidden during trials per research protocol */}
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

      {/* Post-trial overlay — bottom-left, with graph. Only feedback shown to participant. */}
      <TrialSyncOverlay
        syncMetrics={syncData}
        showGraph={true}
        trialNumber={trialIdx}
      />
    </div>
  )
}
