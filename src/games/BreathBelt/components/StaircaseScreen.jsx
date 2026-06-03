import { useState, useCallback, useRef } from 'react'
import AvatarBreathPacer from '../../EbbAndFlow/components/AvatarBreathPacer'
import TrialSyncOverlay from './TrialSyncOverlay'
import { useTrialRunner } from '../hooks/useTrialRunner'
import { useBeltQuestStaircases } from '../hooks/useBeltQuestStaircases'
import ConfidenceRating from '../../shared/ConfidenceRating'
import ArousalRating from '../../shared/ArousalRating'
import { BASE_BREATH_SPEED_S, QUEST_MAX_PHASE3_TRIALS } from '../constants'

const BASE_MS = BASE_BREATH_SPEED_S * 1000
const SC_STATES = { READY: 'READY', IN_PROGRESS: 'IN_PROGRESS', RESPONSE: 'RESPONSE' }

export default function StaircaseScreen({
  avatarProps,
  breathValueRef,
  sendTrigger,
  currentPhaseRef,
  currentTrialRef,
  getAndClearTrialSamples,
  mlrWeightsRef,
  setPacerContext,
  clearPacerContext,
  recordTrial,
  showSyncOverlay = true,
  savedQuestState,
  onComplete,
}) {
  const [scState,    setScState]    = useState(SC_STATES.READY)
  const [trialCount, setTrialCount] = useState(0)
  const [response,   setResponse]   = useState(null)
  const [confidence, setConfidence] = useState(null)
  const [arousal,    setArousal]    = useState(null)
  const [syncData,   setSyncData]   = useState(null)   // post-trial metrics (no graph)
  const trialsData      = useRef([])
  const pendingTrialRef = useRef(null)
  const avatarSize      = 240

  const quest = useBeltQuestStaircases(savedQuestState)

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
    const { key, log10Delta, deltaSec, sameContext } = quest.getNextTrial()
    const conditionMs = key === 'faster'
      ? Math.max(BASE_MS - deltaSec * 1000, 500)
      : key === 'slower'
      ? BASE_MS + deltaSec * 1000
      : BASE_MS  // SAME catch trial

    setSyncData(null)
    setScState(SC_STATES.IN_PROGRESS)
    setResponse(null); setConfidence(null); setArousal(null)

    const { beltSyncMean, btBaselinePeriodMs, btConditionPeriodMs, syncMetrics } =
      await runTrial('phase3', trialCount + 1, conditionMs)

    setSyncData(syncMetrics)                 // overlay visible during RESPONSE, no graph
    pendingTrialRef.current = { key, log10Delta, deltaSec, conditionMs, sameContext, beltSyncMean, btBaselinePeriodMs, btConditionPeriodMs, syncMetrics }
    setScState(SC_STATES.RESPONSE)
  }, [trialCount, quest, runTrial])

  const submitResponse = useCallback(() => {
    if (!response || confidence === null || arousal === null) return
    const { key, log10Delta, conditionMs, sameContext, beltSyncMean, btBaselinePeriodMs, btConditionPeriodMs, syncMetrics } =
      pendingTrialRef.current

    const { correct } = quest.recordResponse(key, response, log10Delta)
    const row = {
      phase:                  3,
      trial_number:           trialCount + 1,
      condition:              key,
      breath_period_ms:       conditionMs,
      log10_mag:              log10Delta,
      response,
      correct,
      same_context:           sameContext ?? null,
      confidence,
      arousal,
      belt_sync_mean:         beltSyncMean,
      bt_baseline_period_ms:  btBaselinePeriodMs,
      bt_condition_period_ms: btConditionPeriodMs,
      trial_r_baseline:       syncMetrics?.trialRBaseline  ?? null,
      trial_r_condition:      syncMetrics?.trialRCondition ?? null,
      peak_error_ms:          syncMetrics?.peakErrorMs     ?? null,
    }
    trialsData.current.push(row)
    recordTrial(row)

    const nextCount = trialCount + 1
    setTrialCount(nextCount)

    // End on convergence, or at the hard trial cap so the staircase can never
    // run indefinitely if the posterior SD never crosses the threshold.
    if (quest.allConverged() || nextCount >= QUEST_MAX_PHASE3_TRIALS) {
      onComplete(trialsData.current, quest.serialise(), quest.getConvergence())
    } else {
      setSyncData(null)
      setScState(SC_STATES.READY)
    }
  }, [response, confidence, arousal, trialCount, quest, recordTrial, onComplete])

  const conv     = quest.getConvergence()
  const canSubmit = response !== null && confidence !== null && arousal !== null

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-8" style={{ maxWidth: 480, margin: '0 auto' }}>

      {scState !== SC_STATES.RESPONSE && (
        <div style={{ position: 'relative', width: avatarSize, height: avatarSize }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <AvatarBreathPacer
              {...avatarProps}
              scaleAmplitude={0.25}
              getPhase={getPhase}
              controlRef={controlRef}
              paused={scState === SC_STATES.READY}
              size={avatarSize}
            />
          </div>
        </div>
      )}


      {scState === SC_STATES.READY && (
        <>
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)' }}>
            Breathe with the avatar. Notice if the pace changes.
          </p>
          <button onClick={startTrial} className="px-6 py-3 rounded-xl font-medium"
            style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}>
            Start trial
          </button>
        </>
      )}

      {scState === SC_STATES.IN_PROGRESS && (
        <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)' }}>
          Follow the avatar…
        </p>
      )}

      {scState === SC_STATES.RESPONSE && (
        <div className="flex flex-col gap-6 w-full">
          <p className="text-center font-medium" style={{ color: 'var(--tx)', fontSize: 'var(--fs-body)' }}>
            Did the avatar's pace change?
          </p>
          <div className="flex gap-3 justify-center">
            {['slower', 'same', 'faster'].map(opt => (
              <button key={opt} onClick={() => setResponse(opt)}
                className="px-5 py-3 rounded-xl font-medium capitalize"
                style={{
                  background: response === opt ? 'var(--pk)' : 'transparent',
                  color:      response === opt ? '#fff' : 'var(--tx)',
                  border: '1px solid var(--bds)', fontSize: 'var(--fs-body)', minWidth: 80,
                }}>
                {opt}
              </button>
            ))}
          </div>
          <div>
            <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)', marginBottom: 8, textAlign: 'center' }}>
              How confident are you?
            </p>
            <ConfidenceRating value={confidence} onChange={setConfidence} />
          </div>
          <div>
            <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)', marginBottom: 8, textAlign: 'center' }}>
              How activated do you feel right now?
            </p>
            <ArousalRating value={arousal} onChange={setArousal} />
          </div>
          <button onClick={submitResponse} disabled={!canSubmit}
            className="px-6 py-3 rounded-xl font-medium w-full"
            style={{
              background: canSubmit ? 'var(--pk)' : 'var(--bd)',
              color: canSubmit ? '#fff' : 'var(--tx3)',
              fontSize: 'var(--fs-body)', cursor: canSubmit ? 'pointer' : 'default',
            }}>
            Next
          </button>
        </div>
      )}

      {/* Post-trial metrics overlay — no graph in Phase 3 (condition blinding).
          Researcher QC feedback, shown only while piloting (showSyncOverlay). */}
      <TrialSyncOverlay
        syncMetrics={syncData}
        showGraph={false}
        trialNumber={trialCount}
        convergence={conv}
        visible={showSyncOverlay}
      />
    </div>
  )
}
