import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useBeltConnection } from './hooks/useBeltConnection';
import { useBeltSession } from './hooks/useBeltSession';
import BrowserWarning from './components/BrowserWarning';
import CalibrationScreen from './components/CalibrationScreen';
import BaselineScreen from './components/BaselineScreen';
import FixedTrialsScreen from './components/FixedTrialsScreen';
import StaircaseScreen from './components/StaircaseScreen';
import SessionComplete from './components/SessionComplete';
import BaselineReviewScreen from './components/BaselineReviewScreen';
import Phase2ReviewScreen from './components/Phase2ReviewScreen';
import { BASELINE_DURATION_MS, POST_BASELINE_DURATION_MS, BASE_BREATH_SPEED_S } from './constants';
import SynchronyBar from './components/SynchronyBar';
import { useStreamingBackup } from './hooks/useStreamingBackup';

// ── COM trigger vocabulary ─────────────────────────────────────────────────
// All codes 0–12, within 2^32 constraint.
//
//  0   session end
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
  BASELINE_REVIEW:         'BASELINE_REVIEW',
  PHASE2_READY:            'PHASE2_READY',
  PHASE2_RUNNING:          'PHASE2_RUNNING',
  PHASE2_REVIEW:           'PHASE2_REVIEW',
  PHASE2_COMPLETE:         'PHASE2_COMPLETE',
  PHASE3_INTRO:            'PHASE3_INTRO',
  PHASE3_RUNNING:          'PHASE3_RUNNING',
  POST_BASELINE_READY:     'POST_BASELINE_READY',
  POST_BASELINE_RECORDING: 'POST_BASELINE_RECORDING',
  POST_BASELINE_COMPLETE:  'POST_BASELINE_COMPLETE',
  SESSION_COMPLETE:        'SESSION_COMPLETE',
};

export default function BreathBelt({ studyMode = false, userId, studyId, onSessionComplete }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(S.BROWSER_CHECK);
  const [sessionNumber, setSessionNumber] = useState(1);

  const preBaselinePeriodRef  = useRef(null);
  const preBaselineSamplesRef = useRef([]);
  const postBaselinePeriodRef = useRef(null);
  const convergenceRef        = useRef(null);
  const pendingQuestStateRef  = useRef(null);
  const phase2ReviewRef       = useRef([]);

  // ── Auth + role ──────────────────────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles').select('role, id').eq('id', user.id).single();
      return { ...data, id: user.id };
    },
  });

  const { data: avatar } = useQuery({
    queryKey: ['avatar', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avatars').select('*').eq('user_id', profile.id).single();
      return data;
    },
    enabled: !!profile?.id,
  });

  const avatarProps = {
    skinColor: avatar?.skin_color ?? '#FDBCB4',
    eyeColor:  avatar?.eye_color  ?? '#4A90D9',
    species:   'human',
  };

  const belt    = useBeltConnection();
  const session = useBeltSession(profile?.id);
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
  }, [phase, profile, profileLoading]);

  useEffect(() => {
    if (phase === S.BT_CONNECT  && belt.btState  === 'CONNECTED') setPhase(S.COM_CONNECT);
  }, [belt.btState,  phase]);

  useEffect(() => {
    if (phase === S.COM_CONNECT && belt.comState === 'CONNECTED') setPhase(S.SESSION_SETUP);
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
  useEffect(() => {
    if (phase === S.BASELINE_READY && !sessionStartedRef.current) {
      sessionStartedRef.current = true;
      session.startSession();
    }
  }, [phase]);

  useEffect(() => () => { belt.stopNotifications(); }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function baselinePhaseMap(fsm) {
    if ([S.BASELINE_READY,      S.POST_BASELINE_READY     ].includes(fsm)) return 'READY';
    if ([S.BASELINE_RECORDING,  S.POST_BASELINE_RECORDING ].includes(fsm)) return 'RECORDING';
    if ([S.BASELINE_COMPLETE,   S.POST_BASELINE_COMPLETE  ].includes(fsm)) return 'COMPLETE';
    return 'READY';
  }

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
    return (
      <Layout title="Connect COM port">
        <Screen>
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 400 }}>
            Connect to the physio equipment COM port to enable trial triggers.
          </p>
          {belt.comState === 'ERROR' && <Err>COM port connection failed. Try again.</Err>}
          <Btn onClick={belt.connectCOM} disabled={belt.comState === 'CONNECTING'}>
            {belt.comState === 'CONNECTING' ? 'Connecting…' : 'Connect to COM port'}
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
          </div>
          <Btn onClick={async () => { await backup.initBackup(profile?.id); setPhase(S.CALIB_READY); }}>Continue to calibration</Btn>
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
      <Layout title="Natural baseline">
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
          onComplete={(periodMs, samples) => {
            preBaselinePeriodRef.current  = periodMs;
            preBaselineSamplesRef.current = samples ?? [];
            setPhase(S.BASELINE_COMPLETE);
          }}
        />
        {phase === S.BASELINE_COMPLETE && (
          <div className="flex justify-center pb-8">
            <Btn onClick={() => setPhase(S.BASELINE_REVIEW)}>Review signal →</Btn>
          </div>
        )}
      </Layout>
    );
  }

  // ── Baseline signal review ───────────────────────────────────────────────

  if (phase === S.BASELINE_REVIEW) {
    return (
      <Layout title="Baseline review">
        <BaselineReviewScreen
          samples={preBaselineSamplesRef.current}
          periodMs={preBaselinePeriodRef.current}
          onContinue={() => setPhase(S.PHASE2_READY)}
        />
      </Layout>
    );
  }

  // ── Phase 2 ──────────────────────────────────────────────────────────────
  // Code 4 fired on entering PHASE2_RUNNING (useEffect above).
  // Code 5 fired in onComplete handler.

  if (phase === S.PHASE2_READY) {
    return (
      <Layout title="Phase 2 — Paced trials">
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
      <Layout title="Phase 2 — Fixed trials">
        <FixedTrialsScreen
          avatarProps={avatarProps}
          breathValueRef={belt.breathValueRef}
          sendTrigger={belt.sendTrigger}
          currentPhaseRef={belt.currentPhaseRef}
          currentTrialRef={belt.currentTrialRef}
          getPacerRadiusFnRef={belt.getPacerRadiusFnRef}
          setPacerContext={belt.setPacerContext}
          clearPacerContext={belt.clearPacerContext}
          recordTrial={recordTrialWithBackup}
          onComplete={async (_trialsData, reviewData) => {
            await belt.sendTrigger('5');  // code 5 — phase 2 end
            phase2ReviewRef.current = reviewData ?? [];
            setPhase(S.PHASE2_REVIEW);
          }}
        />
      </Layout>
    );
  }

  if (phase === S.PHASE2_REVIEW) {
    return (
      <Layout title="Phase 2 — review">
        <Phase2ReviewScreen
          reviewData={phase2ReviewRef.current}
          onContinue={() => setPhase(S.PHASE2_COMPLETE)}
        />
      </Layout>
    );
  }

  if (phase === S.PHASE2_COMPLETE) {
    return (
      <Layout title="Phase 2 complete">
        <Screen>
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 400 }}>
            Fixed trials complete. Phase 3 uses an adaptive staircase to find your
            detection thresholds for faster and slower breathing.
          </p>
          <Btn onClick={() => setPhase(S.PHASE3_INTRO)}>Continue to staircase</Btn>
        </Screen>
      </Layout>
    );
  }

  // ── Phase 3 ──────────────────────────────────────────────────────────────
  // Code 6 fired on entering PHASE3_RUNNING (useEffect above).
  // Code 7 fired in onComplete handler.

  if (phase === S.PHASE3_INTRO) {
    return (
      <Layout title="Phase 3 — Detection thresholds">
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
      <>
        <Layout title="Phase 3 — Detection thresholds">
          <StaircaseScreen
            avatarProps={avatarProps}
            breathValueRef={belt.breathValueRef}
            sendTrigger={belt.sendTrigger}
            currentPhaseRef={belt.currentPhaseRef}
            currentTrialRef={belt.currentTrialRef}
            getPacerRadiusFnRef={belt.getPacerRadiusFnRef}
            setPacerContext={belt.setPacerContext}
            clearPacerContext={belt.clearPacerContext}
            recordTrial={recordTrialWithBackup}
            savedQuestState={null}
            onComplete={async (trials, questState, convergence) => {
              await belt.sendTrigger('7');  // code 7 — phase 3 end
              convergenceRef.current     = convergence;
              pendingQuestStateRef.current = questState;
              setPhase(S.POST_BASELINE_READY);
            }}
          />
        </Layout>
        <SynchronyBar quality={belt.syncQuality} visible />
      </>
    );
  }

  // ── Post-session baseline ─────────────────────────────────────────────────
  // Codes 8/9 from BaselineScreen. Code 0 (session end) fired after endSession.

  if ([S.POST_BASELINE_READY, S.POST_BASELINE_RECORDING, S.POST_BASELINE_COMPLETE].includes(phase)) {
    return (
      <Layout title="Post-session rest">
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
            await session.endSession({
              calibState:           belt.mlrWeightsRef.current,
              questState:           pendingQuestStateRef.current,
              rawAccelRows:         belt.rawAccelRowsRef.current,
              rawHRRows:            belt.rawHRRowsRef.current,
              sessionNumber,
              baselinePeriodMs:     preBaselinePeriodRef.current,
              postBaselinePeriodMs: periodMs,
              calibModelLabel:      belt.mlrWeightsRef.current?.modelLabel,
              calibFitR:            belt.mlrWeightsRef.current?.fitR,
              calibLagMs:           belt.mlrWeightsRef.current?.lagMs,
            });
            await belt.sendTrigger('0');  // code 0 — session end
            belt.stopNotifications();
            setPhase(S.SESSION_COMPLETE);
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
        onDone={studyMode && onSessionComplete ? onSessionComplete : () => navigate('/dashboard')}
        studyMode={studyMode}
      />
    );
  }

  return null;
}

// ── Layout helpers ────────────────────────────────────────────────────────

function Layout({ title, children }) {
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
    </div>
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

function Btn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:   disabled ? 'var(--bd)' : 'var(--pk)',
      color:        disabled ? 'var(--tx3)' : '#fff',
      border:       'none', borderRadius: 12, padding: '12px 28px',
      fontFamily:   'DM Sans', fontSize: 'var(--fs-body)', fontWeight: 600,
      cursor:       disabled ? 'default' : 'pointer',
    }}>
      {children}
    </button>
  );
}

function Err({ children }) {
  return (
    <p style={{ color: '#c0392b', fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)' }}>
      {children}
    </p>
  );
}
