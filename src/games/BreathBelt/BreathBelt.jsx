import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBeltConnection } from './hooks/useBeltConnection';
import { useBeltSession } from './hooks/useBeltSession';
import { useStreamingBackup } from './hooks/useStreamingBackup';
import BrowserWarning from './components/BrowserWarning';
import CalibrationScreen from './components/CalibrationScreen';
import BaselineScreen from './components/BaselineScreen';
import FixedTrialsScreen from './components/FixedTrialsScreen';
import StaircaseScreen from './components/StaircaseScreen';
import SessionComplete from './components/SessionComplete';
import Phase2ReviewScreen from './components/Phase2ReviewScreen';
import {
  BASELINE_DURATION_MS, POST_BASELINE_DURATION_MS, BASE_BREATH_SPEED_S,
  TRIGGER_DEVICES, DEFAULT_TRIGGER_DEVICE, PILOT_MODE,
} from './constants';

// ── COM trigger vocabulary ─────────────────────────────────────────────────
//  1   session start
//  2   pre-baseline start
//  3   pre-baseline end
//  4   phase 2 start
//  5   phase 2 end
//  6   phase 3 start
//  7   phase 3 end
//  8   post-baseline start
//  9   post-baseline end
//  10  trial start          (baseline breaths begin)   — fired from useTrialRunner
//  11  condition onset      (breath 3 begins)          — fired from useTrialRunner
//  12  trial end                                       — fired from useTrialRunner
//  13  session end
//
// NB: code 0 is NOT used as an event marker — on the AD_BBT (Black Box ToolKit)
// device "00" is the line-clear command, so session end uses 13 to stay distinct.

const S = {
  BROWSER_CHECK:           'BROWSER_CHECK',
  ACCESS_DENIED:           'ACCESS_DENIED',
  BT_CONNECT:              'BT_CONNECT',
  COM_CONNECT:             'COM_CONNECT',
  SESSION_SETUP:           'SESSION_SETUP',
  CALIB_READY:             'CALIB_READY',
  CALIBRATING:             'CALIBRATING',
  BASELINE_READY:          'BASELINE_READY',
  BASELINE_RECORDING:      'BASELINE_RECORDING',
  BASELINE_COMPLETE:       'BASELINE_COMPLETE',
  PHASE2_READY:            'PHASE2_READY',
  PHASE2_RUNNING:          'PHASE2_RUNNING',
  PHASE2_REVIEW:           'PHASE2_REVIEW',
  PHASE3_INTRO:            'PHASE3_INTRO',
  PHASE3_RUNNING:          'PHASE3_RUNNING',
  POST_BASELINE_READY:     'POST_BASELINE_READY',
  POST_BASELINE_RECORDING: 'POST_BASELINE_RECORDING',
  POST_BASELINE_COMPLETE:  'POST_BASELINE_COMPLETE',
  SESSION_COMPLETE:        'SESSION_COMPLETE',
};

export default function BreathBelt({ studyMode = false, userId, studyId, onSessionComplete, supabaseClient }) {
  const navigate = useNavigate();
  // In a participant study session the caller passes the participant-authenticated
  // client; all data reads/writes must use it so RLS (auth.uid() = user_id) passes.
  // Falls back to the shared global client for normal self-serve play.
  const db = supabaseClient ?? supabase;
  const [phase, setPhase] = useState(S.BROWSER_CHECK);
  const [sessionNumber, setSessionNumber] = useState(1);
  const [triggerDevice, setTriggerDevice] = useState(DEFAULT_TRIGGER_DEVICE);
  const [ending, setEnding] = useState(false);   // true while a session-end save is in flight

  const preBaselinePeriodRef  = useRef(null);
  const postBaselinePeriodRef = useRef(null);
  const convergenceRef        = useRef(null);
  const pendingQuestStateRef  = useRef(null);
  const cascadeFiredRef       = useRef(false);
  const trialGraphsRef        = useRef([]);

  // ── Auth + role ──────────────────────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', userId ?? 'self'],
    queryFn: async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) return null;
      const { data } = await db
        .from('profiles').select('role, id').eq('id', user.id).single();
      return { ...data, id: user.id };
    },
  });

  // In study mode the participant id arrives as a prop; use it directly so the
  // session can start without waiting on a getUser() round-trip.
  const effectiveUserId = userId ?? profile?.id;

  const { data: avatar } = useQuery({
    queryKey: ['avatar', effectiveUserId],
    queryFn: async () => {
      const { data } = await db
        .from('avatars').select('*').eq('user_id', effectiveUserId).single();
      return data;
    },
    enabled: !!effectiveUserId,
  });

  const avatarProps = {
    skinColor: avatar?.skin_color ?? '#FDBCB4',
    eyeColor:  avatar?.eye_color  ?? '#4A90D9',
    species:   'human',
  };

  const belt    = useBeltConnection();
  const session = useBeltSession(effectiveUserId, db);
  const backup  = useStreamingBackup();
  const basePeriodMs = BASE_BREATH_SPEED_S * 1000;

  const recordTrialWithBackup = useCallback(async (trialRow) => {
    session.recordTrial(trialRow);
    await backup.flushAccel(belt.pendingAccelRef.current);
    await backup.flushHR(belt.pendingHRRef.current);
    belt.pendingAccelRef.current = [];
    belt.pendingHRRef.current = [];
  }, [session, backup, belt.pendingAccelRef, belt.pendingHRRef]);

  // ── FSM transitions ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== S.BROWSER_CHECK) return;
    if (!navigator.bluetooth) return;
    if (profileLoading || profile === undefined) return;
    if (!studyMode && !['lab', 'admin'].includes(profile?.role)) { setPhase(S.ACCESS_DENIED); return; }
    setPhase(S.BT_CONNECT);
  }, [phase, profile, profileLoading, studyMode]);

  useEffect(() => {
    if (phase === S.BT_CONNECT  && belt.btState  === 'CONNECTED') setPhase(S.COM_CONNECT);
  }, [belt.btState,  phase]);

  // On successful connect, auto-fire the 1–13 test cascade once so the RA can
  // verify the marks land. We no longer auto-advance — the RA confirms the
  // cascade and clicks Continue (or re-runs it) on the connect screen.
  useEffect(() => {
    if (belt.comState !== 'CONNECTED') { cascadeFiredRef.current = false; return; }
    if (phase === S.COM_CONNECT && !cascadeFiredRef.current) {
      cascadeFiredRef.current = true;
      belt.sendTestCascade();
    }
  }, [belt.comState, phase]);

  useEffect(() => {
    if (phase === S.CALIBRATING && belt.calibPhase === 'COMPLETE') setPhase(S.BASELINE_READY);
  }, [belt.calibPhase, phase]);

  // Code 4 — phase 2 start
  useEffect(() => {
    if (phase === S.PHASE2_RUNNING) belt.sendTrigger('4');
  }, [phase]);

  // Code 6 — phase 3 start
  useEffect(() => {
    if (phase === S.PHASE3_RUNNING) belt.sendTrigger('6');
  }, [phase]);

  // Start Supabase session once, at BASELINE_READY
  const sessionStartedRef = useRef(false);
  const sessionEndedRef   = useRef(false);
  useEffect(() => {
    if (phase === S.BASELINE_READY && !sessionStartedRef.current && effectiveUserId) {
      sessionStartedRef.current = true;
      session.startSession(studyId ?? null);
    }
  }, [phase, effectiveUserId]);

  // Centralised end-of-session save, shared by the normal post-baseline
  // completion and the early-exit button. Uploads raw signal, writes
  // belt_sessions + any not-yet-flushed belt_trials, closes game_sessions, and
  // fires code 13. Reads the current refs so it persists whatever is buffered at
  // the moment it runs (questState / postBaseline are null on an early exit).
  // Guarded by sessionEndedRef so it can't double-run.
  const finishSession = useCallback(async () => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setEnding(true);
    try {
      await session.endSession({
        calibState:           belt.mlrWeightsRef.current,
        questState:           pendingQuestStateRef.current,
        rawAccelRows:         belt.rawAccelRowsRef.current,
        rawHRRows:            belt.rawHRRowsRef.current,
        sessionNumber,
        triggerDevice,
        baselinePeriodMs:     preBaselinePeriodRef.current,
        postBaselinePeriodMs: postBaselinePeriodRef.current,
      });
      await belt.sendTrigger('13');   // code 13 — session end
    } catch (err) {
      console.error('finishSession:', err);
    } finally {
      belt.stopNotifications();
      setEnding(false);
      setPhase(S.SESSION_COMPLETE);
    }
  }, [session, belt, sessionNumber, triggerDevice]);

  // Testing-only graceful early exit: confirm, then save everything buffered and
  // jump to the summary, skipping any remaining phases. Gated by PILOT_MODE.
  const handleEarlyExit = useCallback(() => {
    if (ending || sessionEndedRef.current) return;
    const ok = window.confirm(
      'End the Breath Belt session now? Everything buffered — completed trials and '
      + 'raw signal — will be saved, and any remaining phases will be skipped.'
    );
    if (ok) finishSession();
  }, [ending, finishSession]);

  // Mid-session unmount: fire code 13 (session end) so the physio equipment
  // leaves session state. Async, fire-and-forget — chain stopNotifications after
  // so the serial write isn't truncated by an early port close.
  useEffect(() => () => {
    (async () => {
      if (sessionStartedRef.current && !sessionEndedRef.current) {
        try { await belt.sendTrigger('13'); } catch {}
      }
      belt.stopNotifications();
    })();
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function baselinePhaseMap(fsm) {
    if ([S.BASELINE_READY,      S.POST_BASELINE_READY     ].includes(fsm)) return 'READY';
    if ([S.BASELINE_RECORDING,  S.POST_BASELINE_RECORDING ].includes(fsm)) return 'RECORDING';
    if ([S.BASELINE_COMPLETE,   S.POST_BASELINE_COMPLETE  ].includes(fsm)) return 'COMPLETE';
    return 'READY';
  }

  // Early-exit control, injected into the active-session screens' Layout.
  const activeExit = PILOT_MODE
    ? <EarlyExitButton onClick={handleEarlyExit} ending={ending} />
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  if (!navigator.bluetooth) return <BrowserWarning />;

  if (phase === S.ACCESS_DENIED) {
    return (
      <Screen>
        <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)' }}>
          The Breath Belt study is only accessible to lab members.
        </p>
        <Btn onClick={() => navigate('/dashboard')}>Back to dashboard</Btn>
      </Screen>
    );
  }

  if (phase === S.BROWSER_CHECK && !profile) return <Screen title="Loading…" />;

  // ── Hardware connect ─────────────────────────────────────────────────────

  if (phase === S.BT_CONNECT) {
    return (
      <Layout title="Connect Polar H10">
        <Screen>
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 400 }}>
            Put on the Polar H10 belt — connector centred on chest, electrodes moistened.
          </p>
          {belt.btState === 'ERROR' && <Err>Connection failed. Check the belt and try again.</Err>}
          <Btn onClick={belt.connect} disabled={belt.btState === 'CONNECTING'}>
            {belt.btState === 'CONNECTING' ? 'Connecting…' : 'Connect to Polar H10'}
          </Btn>
        </Screen>
      </Layout>
    );
  }

  if (phase === S.COM_CONNECT) {
    const dev      = TRIGGER_DEVICES.find(d => d.value === triggerDevice);
    const isBiopac = !!dev && dev.address != null;

    // Connected — verify triggers before continuing. A 1–13 cascade fires
    // automatically on connect; the RA confirms all 13 marks in the recording
    // (and can re-send) before proceeding to session setup.
    if (belt.comState === 'CONNECTED') {
      return (
        <Layout title={isBiopac ? 'Parallel server ready' : 'COM port ready'}>
          <Screen>
            <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 420 }}>
              Connected to <strong style={{ color: 'var(--tx)' }}>{dev?.label ?? triggerDevice}</strong>.
            </p>
            <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 420 }}>
              {belt.testRunning
                ? 'Sending test cascade — watch the recording for marks 1 through 13…'
                : 'A test cascade of codes 1–13 was sent. Confirm all 13 marks appear in the recording, then continue.'}
            </p>
            <Btn secondary onClick={belt.sendTestCascade} disabled={belt.testRunning}>
              {belt.testRunning ? 'Sending 1–13…' : 'Send test cascade again'}
            </Btn>
            <Btn onClick={() => setPhase(S.SESSION_SETUP)} disabled={belt.testRunning}>
              Continue to session setup
            </Btn>
          </Screen>
        </Layout>
      );
    }

    return (
      <Layout title={isBiopac ? 'Check parallel server' : 'Connect COM port'}>
        <Screen>
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 400 }}>
            {isBiopac
              ? 'Confirm the local parallel-port server is running before starting triggers.'
              : 'Connect to the physio equipment COM port to enable trial triggers.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280 }}>
            <label style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)' }}>
              Trigger device
            </label>
            <select
              value={triggerDevice}
              onChange={e => setTriggerDevice(e.target.value)}
              disabled={belt.comState === 'CONNECTING'}
              style={{
                fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-md)',
                color: 'var(--tx)', background: 'var(--bgc)',
                border: '1px solid var(--bd)', borderRadius: 10,
                padding: '10px 14px', width: '100%',
              }}
            >
              {TRIGGER_DEVICES.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx3)', margin: 0 }}>
              Match the physio equipment on this testing computer.
            </p>
          </div>

          {belt.comState === 'ERROR' && (
            <Err>{belt.comMessage || (isBiopac ? 'Parallel server check failed. Try again.' : 'COM port connection failed. Try again.')}</Err>
          )}
          <Btn
            onClick={() => {
              belt.setTriggerDevice(triggerDevice);
              if (isBiopac) belt.connectBiopac(); else belt.connectCOM();
            }}
            disabled={belt.comState === 'CONNECTING'}
          >
            {belt.comState === 'CONNECTING'
              ? (isBiopac ? 'Checking…' : 'Connecting…')
              : (isBiopac ? 'Check parallel server' : 'Connect to COM port')}
          </Btn>
        </Screen>
      </Layout>
    );
  }

  // ── Session setup ─────────────────────────────────────────────────────────

  if (phase === S.SESSION_SETUP) {
    return (
      <Layout title="Session setup">
        <Screen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280 }}>
            <label style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)' }}>
              Session number
            </label>
            <input
              type="number" min={1} value={sessionNumber}
              onChange={e => setSessionNumber(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-md)',
                color: 'var(--tx)', background: 'var(--bgc)',
                border: '1px solid var(--bd)', borderRadius: 10,
                padding: '10px 14px', textAlign: 'center', width: '100%',
              }}
            />
            <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx3)', margin: 0 }}>
              Increment for each visit by the same participant.
            </p>

            <p style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx3)', margin: '12px 0 0' }}>
              Trigger device: <span style={{ fontFamily: 'Space Mono', color: 'var(--tx2)' }}>
                {TRIGGER_DEVICES.find(d => d.value === triggerDevice)?.label ?? triggerDevice}
              </span>
            </p>
          </div>
          <Btn onClick={async () => {
            belt.setTriggerDevice(triggerDevice);
            const ok = await backup.initBackup(effectiveUserId);
            if (!ok && backup.isAvailable) {
              const proceed = window.confirm(
                'Local CSV backup is not enabled (folder picker was cancelled). ' +
                'Continue without it? Cloud Supabase storage will still record raw data.'
              );
              if (!proceed) return;
            }
            setPhase(S.CALIB_READY);
          }}>Continue to calibration</Btn>
        </Screen>
      </Layout>
    );
  }

  // ── Calibration ──────────────────────────────────────────────────────────

  if (phase === S.CALIB_READY || phase === S.CALIBRATING) {
    return (
      <Layout title="Calibration">
        <CalibrationScreen
          calibPhase={belt.calibPhase}
          calibReviewData={belt.calibReviewData}
          avatarProps={avatarProps}
          breathPeriodMs={basePeriodMs}
          startCalibration={() => { belt.startCalibration(); setPhase(S.CALIBRATING); }}
          beginCalibCollection={belt.beginCalibCollection}
          acceptCalibration={belt.acceptCalibration}
          redoCalibration={belt.redoCalibration}
        />
      </Layout>
    );
  }

  // ── Pre-session baseline ──────────────────────────────────────────────────
  // Codes: 1 (session start) fired just before recording; 2/3 from BaselineScreen.

  if ([S.BASELINE_READY, S.BASELINE_RECORDING, S.BASELINE_COMPLETE].includes(phase)) {
    return (
      <Layout title="Natural baseline" earlyExit={activeExit}>
        <BaselineScreen
          phase={baselinePhaseMap(phase)}
          title="Natural baseline"
          durationMs={BASELINE_DURATION_MS}
          breathValueRef={belt.breathValueRef}
          sendTrigger={belt.sendTrigger}
          currentPhaseRef={belt.currentPhaseRef}
          currentTrialRef={belt.currentTrialRef}
          phaseLabel="baseline"
          triggerStart="2"
          triggerEnd="3"
          onStart={async () => {
            await belt.sendTrigger('1');   // code 1 — session start
            setPhase(S.BASELINE_RECORDING);
          }}
          onComplete={(periodMs) => {
            preBaselinePeriodRef.current = periodMs;
            setPhase(S.BASELINE_COMPLETE);
          }}
        />
        {phase === S.BASELINE_COMPLETE && (
          <div className="flex justify-center pb-8">
            <Btn onClick={() => setPhase(S.PHASE2_READY)}>Continue to paced trials</Btn>
          </div>
        )}
      </Layout>
    );
  }

  // ── Phase 2 ──────────────────────────────────────────────────────────────
  // Code 4 fired on entering PHASE2_RUNNING (useEffect above).
  // Code 5 fired in onComplete handler.

  if (phase === S.PHASE2_READY) {
    return (
      <Layout title="Phase 2 — Paced trials" earlyExit={activeExit}>
        <Screen>
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 400 }}>
            You will complete 9 trials following the avatar's breathing pace.
            Some trials may feel faster, slower, or the same as baseline.
          </p>
          <Btn onClick={() => setPhase(S.PHASE2_RUNNING)}>Begin trials</Btn>
        </Screen>
      </Layout>
    );
  }

  if (phase === S.PHASE2_RUNNING) {
    return (
      <Layout title="Phase 2 — Fixed trials" earlyExit={activeExit}>
        <FixedTrialsScreen
          avatarProps={avatarProps}
          breathValueRef={belt.breathValueRef}
          sendTrigger={belt.sendTrigger}
          currentPhaseRef={belt.currentPhaseRef}
          currentTrialRef={belt.currentTrialRef}
          getAndClearTrialSamples={belt.getAndClearTrialSamples}
          mlrWeightsRef={belt.mlrWeightsRef}
          recordTrial={recordTrialWithBackup}
          showSyncOverlay={PILOT_MODE}
          onComplete={async (trialsData, trialGraphs) => {
            trialGraphsRef.current = trialGraphs
            await belt.sendTrigger('5')  // code 5 — phase 2 end
            await session.flushTrials()  // persist phase-2 trials before continuing
            // The Phase 2 review screen is researcher feedback — skip it in
            // production (PILOT_MODE off) and go straight to Phase 3.
            setPhase(PILOT_MODE ? S.PHASE2_REVIEW : S.PHASE3_INTRO)
          }}
        />
      </Layout>
    );
  }

  if (phase === S.PHASE2_REVIEW) {
    return (
      <Layout title="Phase 2 — Review" earlyExit={activeExit}>
        <Phase2ReviewScreen
          trialGraphs={trialGraphsRef.current}
          onContinue={() => setPhase(S.PHASE3_INTRO)}
        />
      </Layout>
    );
  }

  // ── Phase 3 ──────────────────────────────────────────────────────────────
  // Code 6 fired on entering PHASE3_RUNNING (useEffect above).
  // Code 7 fired in onComplete handler.

  if (phase === S.PHASE3_INTRO) {
    return (
      <Layout title="Phase 3 — Detection thresholds" earlyExit={activeExit}>
        <Screen>
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 420 }}>
            Follow the avatar as before. After each trial, report whether the pace
            was <strong>faster</strong>, <strong>slower</strong>, or stayed the{' '}
            <strong>same</strong>. Then rate your confidence and how activated you feel.
          </p>
          <Btn onClick={() => setPhase(S.PHASE3_RUNNING)}>Begin</Btn>
        </Screen>
      </Layout>
    );
  }

  if (phase === S.PHASE3_RUNNING) {
    return (
      <Layout title="Phase 3 — Detection thresholds" earlyExit={activeExit}>
        <StaircaseScreen
          avatarProps={avatarProps}
          breathValueRef={belt.breathValueRef}
          sendTrigger={belt.sendTrigger}
          currentPhaseRef={belt.currentPhaseRef}
          currentTrialRef={belt.currentTrialRef}
          getAndClearTrialSamples={belt.getAndClearTrialSamples}
          mlrWeightsRef={belt.mlrWeightsRef}
          recordTrial={recordTrialWithBackup}
          showSyncOverlay={PILOT_MODE}
          savedQuestState={null}
          onComplete={async (trials, questState, convergence) => {
            await belt.sendTrigger('7');  // code 7 — phase 3 end
            convergenceRef.current     = convergence;
            pendingQuestStateRef.current = questState;
            await session.flushTrials();  // persist phase-3 trials before continuing
            setPhase(S.POST_BASELINE_READY);
          }}
        />
      </Layout>
    );
  }

  // ── Post-session baseline ─────────────────────────────────────────────────
  // Codes 8/9 from BaselineScreen. Code 13 (session end) fired after endSession.

  if ([S.POST_BASELINE_READY, S.POST_BASELINE_RECORDING, S.POST_BASELINE_COMPLETE].includes(phase)) {
    return (
      <Layout title="Post-session rest" earlyExit={activeExit}>
        <BaselineScreen
          phase={baselinePhaseMap(phase)}
          title="Post-session rest"
          durationMs={POST_BASELINE_DURATION_MS}
          breathValueRef={belt.breathValueRef}
          sendTrigger={belt.sendTrigger}
          currentPhaseRef={belt.currentPhaseRef}
          currentTrialRef={belt.currentTrialRef}
          phaseLabel="post_baseline"
          triggerStart="8"
          triggerEnd="9"
          onStart={() => setPhase(S.POST_BASELINE_RECORDING)}
          onComplete={async (periodMs) => {
            postBaselinePeriodRef.current = periodMs;
            await finishSession();
          }}
        />
        {phase === S.POST_BASELINE_COMPLETE && (
          <div className="flex justify-center pb-8">
            <Btn onClick={() => setPhase(S.SESSION_COMPLETE)}>View summary</Btn>
          </div>
        )}
      </Layout>
    );
  }

  // ── Session complete ──────────────────────────────────────────────────────

  if (phase === S.SESSION_COMPLETE) {
    return (
      <SessionComplete
        convergence={convergenceRef.current}
        sessionNumber={sessionNumber}
        preBaselinePeriodMs={preBaselinePeriodRef.current}
        postBaselinePeriodMs={postBaselinePeriodRef.current}
        studyMode={studyMode}
        onDone={studyMode && onSessionComplete ? onSessionComplete : () => navigate('/dashboard')}
      />
    );
  }

  return null;
}

// ── Layout helpers ────────────────────────────────────────────────────────

function Layout({ title, earlyExit, children }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="px-6 pt-8 pb-2">
          <h1 style={{ fontFamily: 'DM Serif Display', fontSize: 22, color: 'var(--tx)' }}>
            Breath Belt — {title}
          </h1>
        </div>
        {children}
      </div>
      {earlyExit}
    </div>
  );
}

// Testing-only graceful-exit control. Fixed bottom-right so it's reachable from
// any active-session screen without disturbing the centred study layout.
function EarlyExitButton({ onClick, ending }) {
  return (
    <button
      onClick={onClick}
      disabled={ending}
      style={{
        position:   'fixed', bottom: 16, right: 16, zIndex: 50,
        border:     '1px solid var(--bd)', borderRadius: 10,
        padding:    '8px 14px', cursor: ending ? 'default' : 'pointer',
        background: 'var(--bgc)', color: 'var(--tx2)',
        fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', fontWeight: 600,
        opacity:    ending ? 0.6 : 0.85,
      }}
    >
      {ending ? 'Saving…' : 'End session early'}
    </button>
  );
}

function Screen({ title, children }) {
  return (
    <div className="flex flex-col items-center gap-6 px-6 py-12">
      {title && (
        <h2 style={{ fontFamily: 'DM Serif Display', fontSize: 20, color: 'var(--tx)' }}>{title}</h2>
      )}
      {children}
    </div>
  );
}

function Btn({ onClick, disabled, secondary, children }) {
  const base = {
    border:     'none', borderRadius: 12, padding: '12px 28px',
    fontFamily: 'DM Sans', fontSize: 'var(--fs-body)', fontWeight: 600,
    cursor:     disabled ? 'default' : 'pointer',
  };
  const style = secondary
    ? { ...base,
        background: 'transparent',
        color:      disabled ? 'var(--tx3)' : 'var(--pkd)',
        border:     `1px solid ${disabled ? 'var(--bd)' : 'var(--pkbs)'}` }
    : { ...base,
        background: disabled ? 'var(--bd)' : 'var(--pk)',
        color:      disabled ? 'var(--tx3)' : '#fff' };
  return <button onClick={onClick} disabled={disabled} style={style}>{children}</button>;
}

function Err({ children }) {
  return (
    <p style={{ color: '#c0392b', fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)' }}>
      {children}
    </p>
  );
}
