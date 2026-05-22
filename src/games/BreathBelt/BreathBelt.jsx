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

// ── FSM states ─────────────────────────────────────────────────────────────
const S = {
  BROWSER_CHECK:       'BROWSER_CHECK',
  ACCESS_DENIED:       'ACCESS_DENIED',
  BT_CONNECT:          'BT_CONNECT',
  COM_CONNECT:         'COM_CONNECT',
  CALIB_READY:         'CALIB_READY',
  CALIBRATING:         'CALIBRATING',
  BASELINE_READY:      'BASELINE_READY',
  BASELINE_RECORDING:  'BASELINE_RECORDING',
  BASELINE_COMPLETE:   'BASELINE_COMPLETE',
  PHASE2_READY:        'PHASE2_READY',
  PHASE2_RUNNING:      'PHASE2_RUNNING',
  PHASE2_COMPLETE:     'PHASE2_COMPLETE',
  PHASE3_INTRO:        'PHASE3_INTRO',
  PHASE3_RUNNING:      'PHASE3_RUNNING',
  SESSION_COMPLETE:    'SESSION_COMPLETE',
  ERROR:               'ERROR',
};

// ── BreathBelt ─────────────────────────────────────────────────────────────
//
// Lab-only route: /games/breath-belt
// Requires profiles.role === 'lab'. Non-lab users see an access denied screen.
//
// Phase flow:
//   BROWSER_CHECK → BT_CONNECT → COM_CONNECT
//   → CALIB_READY → CALIBRATING (CalibrationScreen manages sub-states)
//   → BASELINE_READY → BASELINE_RECORDING → BASELINE_COMPLETE
//   → PHASE2_READY → PHASE2_RUNNING (9 fixed trials)
//   → PHASE2_COMPLETE → PHASE3_INTRO → PHASE3_RUNNING (QUEST until converged)
//   → SESSION_COMPLETE

export default function BreathBelt() {
  const navigate  = useNavigate();
  const [phase, setPhase] = useState(S.BROWSER_CHECK);
  const convergenceRef = useRef(null);

  // Auth + role check
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      return { ...data, id: user.id };
    },
  });

  // Avatar props
  const { data: avatar } = useQuery({
    queryKey: ['avatar', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('avatars').select('*').eq('user_id', profile.id).single();
      return data;
    },
    enabled: !!profile?.id,
  });

  const avatarProps = {
    skinColor: avatar?.skin_color  ?? '#FDBCB4',
    eyeColor:  avatar?.eye_color   ?? '#4A90D9',
    species:   'human',
    hairStyle: avatar?.hair_style  ?? 'none',
    hairColor: avatar?.hair_color  ?? '#784421',
  };

  // Belt connection
  const belt = useBeltConnection();

  // Session
  const session = useBeltSession(profile?.id);

  // ── Browser check ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== S.BROWSER_CHECK) return;
    if (!navigator.bluetooth) {
      // Stay on BROWSER_CHECK — component renders BrowserWarning
      return;
    }
    if (profile && profile.role !== 'lab') {
      setPhase(S.ACCESS_DENIED);
      return;
    }
    if (profile) {
      setPhase(S.BT_CONNECT);
    }
  }, [phase, profile]);

  // ── Advance BT → COM → CALIB on hardware state changes ──────────────────
  useEffect(() => {
    if (phase === S.BT_CONNECT && belt.btState === 'CONNECTED') {
      setPhase(S.COM_CONNECT);
    }
  }, [belt.btState, phase]);

  useEffect(() => {
    if (phase === S.COM_CONNECT && belt.comState === 'CONNECTED') {
      setPhase(S.CALIB_READY);
    }
  }, [belt.comState, phase]);

  // ── Advance CALIBRATING → BASELINE_READY when calibration accepted ───────
  useEffect(() => {
    if (phase === S.CALIBRATING && belt.calibPhase === 'COMPLETE') {
      setPhase(S.BASELINE_READY);
    }
  }, [belt.calibPhase, phase]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => { belt.stopNotifications(); };
  }, []);

  // ── Supabase session start (once, when entering BASELINE_READY) ──────────
  const sessionStartedRef = useRef(false);
  useEffect(() => {
    if (phase === S.BASELINE_READY && !sessionStartedRef.current) {
      sessionStartedRef.current = true;
      session.startSession();
    }
  }, [phase]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!navigator.bluetooth) return <BrowserWarning />;

  if (phase === S.ACCESS_DENIED || (profile && profile.role !== 'lab')) {
    return (
      <Screen title="Access restricted">
        <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)' }}>
          The Breath Belt study is only accessible to lab members.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-5 py-3 rounded-xl"
          style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
        >
          Back to dashboard
        </button>
      </Screen>
    );
  }

  if (phase === S.BROWSER_CHECK && !profile) {
    return <Screen title="Loading…" />;
  }

  if (phase === S.BT_CONNECT) {
    return (
      <Screen title="Connect Polar H10">
        <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 400, textAlign: 'center' }}>
          Put on the Polar H10 belt — connector centred on the chest, electrodes moistened.
          Click Connect when ready.
        </p>
        {belt.btState === 'ERROR' && (
          <p style={{ color: '#c0392b', fontSize: 'var(--fs-body-sm)' }}>
            Connection failed. Check the belt and try again.
          </p>
        )}
        <button
          onClick={belt.connect}
          disabled={belt.btState === 'CONNECTING'}
          className="px-6 py-3 rounded-xl font-medium"
          style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
        >
          {belt.btState === 'CONNECTING' ? 'Connecting…' : 'Connect to Polar H10'}
        </button>
      </Screen>
    );
  }

  if (phase === S.COM_CONNECT) {
    return (
      <Screen title="Connect COM port">
        <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 400, textAlign: 'center' }}>
          Connect to the physio equipment COM port to enable trial triggers.
        </p>
        {belt.comState === 'ERROR' && (
          <p style={{ color: '#c0392b', fontSize: 'var(--fs-body-sm)' }}>
            COM port connection failed. Try again.
          </p>
        )}
        <button
          onClick={belt.connectCOM}
          disabled={belt.comState === 'CONNECTING'}
          className="px-6 py-3 rounded-xl font-medium"
          style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
        >
          {belt.comState === 'CONNECTING' ? 'Connecting…' : 'Connect to COM port'}
        </button>
      </Screen>
    );
  }

  if (phase === S.CALIB_READY || phase === S.CALIBRATING) {
    return (
      <Layout title="Calibration">
        <CalibrationScreen
          calibPhase={belt.calibPhase}
          avatarProps={avatarProps}
          breathValueRef={belt.breathValueRef}
          startCalibration={() => {
            belt.startCalibration();
            setPhase(S.CALIBRATING);
          }}
          redoPhase2={belt.redoPhase2}
          resetCalibration={() => {
            belt.resetCalibration();
            setPhase(S.CALIB_READY);
          }}
          acceptCalibration={belt.acceptCalibration}
        />
      </Layout>
    );
  }

  if ([S.BASELINE_READY, S.BASELINE_RECORDING, S.BASELINE_COMPLETE].includes(phase)) {
    return (
      <Layout title="Natural baseline">
        <BaselineScreen
          phase={phase}
          avatarProps={avatarProps}
          breathValueRef={belt.breathValueRef}
          sendTrigger={belt.sendTrigger}
          currentPhaseRef={belt.currentPhaseRef}
          currentTrialRef={belt.currentTrialRef}
          onStart={() => setPhase(S.BASELINE_RECORDING)}
          onComplete={() => setPhase(S.BASELINE_COMPLETE)}
        />
        {phase === S.BASELINE_COMPLETE && (
          <div className="flex justify-center pb-8">
            <button
              onClick={() => setPhase(S.PHASE2_READY)}
              className="px-6 py-3 rounded-xl font-medium"
              style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
            >
              Continue to paced trials
            </button>
          </div>
        )}
      </Layout>
    );
  }

  if (phase === S.PHASE2_READY) {
    return (
      <Layout title="Paced trials — Phase 2">
        <Screen>
          <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 400, textAlign: 'center' }}>
            You will now complete 9 trials. Follow the avatar's breathing pace.
            Some trials may feel faster, slower, or the same as baseline.
          </p>
          <button
            onClick={() => setPhase(S.PHASE2_RUNNING)}
            className="px-6 py-3 rounded-xl font-medium"
            style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
          >
            Begin trials
          </button>
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
          <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 400, textAlign: 'center' }}>
            Fixed trials complete. Phase 3 will use an adaptive staircase to find your
            detection threshold for faster and slower breathing.
          </p>
          <button
            onClick={() => setPhase(S.PHASE3_INTRO)}
            className="px-6 py-3 rounded-xl font-medium"
            style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
          >
            Continue to staircase
          </button>
        </Screen>
      </Layout>
    );
  }

  if (phase === S.PHASE3_INTRO) {
    return (
      <Layout title="Phase 3 — Detection thresholds">
        <Screen>
          <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', maxWidth: 420, textAlign: 'center' }}>
            Follow the avatar as before. After each trial, report whether the
            pace was <strong>faster</strong>, <strong>slower</strong>, or stayed the <strong>same</strong>.
            Rate your confidence and how activated you feel. The session ends when
            enough trials have been collected.
          </p>
          <button
            onClick={() => setPhase(S.PHASE3_RUNNING)}
            className="px-6 py-3 rounded-xl font-medium"
            style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
          >
            Begin
          </button>
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
          onComplete={async (trials, questState, convergence) => {
            convergenceRef.current = convergence;
            await session.endSession({
              calibState:  belt.calibStateRef.current,
              questState,
              rawAccelRows: belt.rawAccelRowsRef.current,
              rawHRRows:    belt.rawHRRowsRef.current,
            });
            belt.stopNotifications();
            setPhase(S.SESSION_COMPLETE);
          }}
        />
      </Layout>
    );
  }

  if (phase === S.SESSION_COMPLETE) {
    return (
      <SessionComplete
        convergence={convergenceRef.current}
        onDone={() => navigate('/dashboard')}
      />
    );
  }

  return null;
}

// ── Small layout helpers ──────────────────────────────────────────────────

function Layout({ title, children }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-lg mx-auto">
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

