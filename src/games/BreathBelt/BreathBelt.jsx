import { useState, useEffect, useRef } from 'react';
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
import { BASELINE_DURATION_MS, POST_BASELINE_DURATION_MS } from './constants';

// ── FSM states ─────────────────────────────────────────────────────────────
const S = {
  BROWSER_CHECK:          'BROWSER_CHECK',
  ACCESS_DENIED:          'ACCESS_DENIED',
  BT_CONNECT:             'BT_CONNECT',
  COM_CONNECT:            'COM_CONNECT',
  SESSION_SETUP:          'SESSION_SETUP',         // session number entry
  CALIB_READY:            'CALIB_READY',
  CALIBRATING:            'CALIBRATING',
  BASELINE_READY:         'BASELINE_READY',
  BASELINE_RECORDING:     'BASELINE_RECORDING',
  BASELINE_COMPLETE:      'BASELINE_COMPLETE',
  PHASE2_READY:           'PHASE2_READY',
  PHASE2_RUNNING:         'PHASE2_RUNNING',
  PHASE2_COMPLETE:        'PHASE2_COMPLETE',
  PHASE3_INTRO:           'PHASE3_INTRO',
  PHASE3_RUNNING:         'PHASE3_RUNNING',
  POST_BASELINE_READY:    'POST_BASELINE_READY',
  POST_BASELINE_RECORDING:'POST_BASELINE_RECORDING',
  POST_BASELINE_COMPLETE: 'POST_BASELINE_COMPLETE',
  SESSION_COMPLETE:       'SESSION_COMPLETE',
};

export default function BreathBelt() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(S.BROWSER_CHECK);

  // Session metadata entered at SESSION_SETUP
  const [sessionNumber, setSessionNumber] = useState(1);

  // Period estimates from baselines
  const preBaselinePeriodRef  = useRef(null);
  const postBaselinePeriodRef = useRef(null);
  const convergenceRef        = useRef(null);
  const questStateRef         = useRef(null); // stashed from PHASE3 onComplete, consumed at session end

  // ── Auth + role ──────────────────────────────────────────────────────────
  const { data: profile } = useQuery({
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

  // ── Browser + role check ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== S.BROWSER_CHECK) return;
    if (!navigator.bluetooth) return; // stays on BROWSER_CHECK → renders BrowserWarning
    if (profile?.role !== 'lab') { setPhase(S.ACCESS_DENIED); return; }
    setPhase(S.BT_CONNECT);
  }, [phase, profile]);

  useEffect(() => {
    if (phase === S.BT_CONNECT  && belt.btState  === 'CONNECTED') setPhase(S.COM_CONNECT);
  }, [belt.btState,  phase]);

  useEffect(() => {
    if (phase === S.COM_CONNECT && belt.comState === 'CONNECTED') setPhase(S.SESSION_SETUP);
  }, [belt.comState, phase]);

  useEffect(() => {
    if (phase === S.CALIBRATING && belt.calibPhase === 'COMPLETE') setPhase(S.BASELINE_READY);
  }, [belt.calibPhase, phase]);

  // Start Supabase session on entering BASELINE_READY
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
    // Maps FSM state → generic 'READY'|'RECORDING'|'COMPLETE' for BaselineScreen
    if ([S.BASELINE_READY,      S.POST_BASELINE_READY     ].includes(fsm)) return 'READY';
    if ([S.BASELINE_RECORDING,  S.POST_BASELINE_RECORDING ].includes(fsm)) return 'RECORDING';
    if ([S.BASELINE_COMPLETE,   S.POST_BASELINE_COMPLETE  ].includes(fsm)) return 'COMPLETE';
    return 'READY';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!navigator.bluetooth) return <BrowserWarning />;

  if (phase === S.ACCESS_DENIED) {
    return (
      <Screen title="Access restricted">
        <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)' }}>
          The Breath Belt study is only accessible to lab members.
        </p>
        <Btn onClick={() => navigate('/dashboard')}>Back to dashboard</Btn>
      </Screen>
    );
  }

  if (phase === S.BROWSER_CHECK && !profile) {
    return <Screen title="Loading…" />;
  }

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

  // ── Session setup — session number entry ─────────────────────────────────

  if (phase === S.SESSION_SETUP) {
    return (
      <Layout title="Session setup">
        <Screen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280 }}>
            <label style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)', color: 'var(--tx2)' }}>
              Session number
            </label>
            <input
              type="number"
              min={1}
              value={sessionNumber}
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
          <Btn onClick={() => setPhase(S.CALIB_READY)}>
            Continue to calibration
          </Btn>
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
          avatarProps={avatarProps}
          breathValueRef={belt.breathValueRef}
          startCalibration={() => { belt.startCalibration(); setPhase(S.CALIBRATING); }}
          redoPhase2={belt.redoPhase2}
          resetCalibration={() => { belt.resetCalibration(); setPhase(S.CALIB_READY); }}
          acceptCalibration={belt.acceptCalibration}
        />
      </Layout>
    );
  }

  // ── Pre-session baseline ─────────────────────────────────────────────────

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
          onStart={() => setPhase(S.BASELINE_RECORDING)}
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
          recordTrial={session.recordTrial}
          onComplete={() => setPhase(S.PHASE2_COMPLETE)}
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
      <Layout title="Phase 3 — Detection thresholds">
        <StaircaseScreen
          avatarProps={avatarProps}
          breathValueRef={belt.breathValueRef}
          sendTrigger={belt.sendTrigger}
          currentPhaseRef={belt.currentPhaseRef}
          currentTrialRef={belt.currentTrialRef}
          recordTrial={session.recordTrial}
          savedQuestState={null}
          onComplete={(trials, questState, convergence) => {
            convergenceRef.current  = convergence;
            questStateRef.current   = questState;
            setPhase(S.POST_BASELINE_READY);
            // endSession called after post-baseline completes
          }}
        />
      </Layout>
    );
  }

  // ── Post-session baseline ─────────────────────────────────────────────────

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
          onStart={() => setPhase(S.POST_BASELINE_RECORDING)}
          onComplete={async (periodMs) => {
            postBaselinePeriodRef.current = periodMs;
            setPhase(S.POST_BASELINE_COMPLETE);
            await session.endSession({
              calibState:           belt.calibStateRef.current,
              questState:           questStateRef.current,
              rawAccelRows:         belt.rawAccelRowsRef.current,
              rawHRRows:            belt.rawHRRowsRef.current,
              sessionNumber,
              baselinePeriodMs:     preBaselinePeriodRef.current,
              postBaselinePeriodMs: periodMs,
            });
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
        onDone={() => navigate('/dashboard')}
      />
    );
  }

  return null;
}

// ── Small layout + button helpers ─────────────────────────────────────────

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
        <h2 style={{ fontFamily: 'DM Serif Display', fontSize: 20, color: 'var(--tx)' }}>
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

function Btn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background:   disabled ? 'var(--bd)' : 'var(--pk)',
        color:        disabled ? 'var(--tx3)' : '#fff',
        border:       'none',
        borderRadius: 12,
        padding:      '12px 28px',
        fontFamily:   'DM Sans',
        fontSize:     'var(--fs-body)',
        fontWeight:   600,
        cursor:       disabled ? 'default' : 'pointer',
      }}
    >
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
