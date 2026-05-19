import { useEffect } from 'react';
import AvatarBreathPacer from '../../EbbAndFlow/components/AvatarBreathPacer';
import { useBreathCycle } from '../../EbbAndFlow/useBreathCycle';
import BeltSyncRing from './BeltSyncRing';
import { BASE_BREATH_SPEED_S } from '../constants';

const BASE_MS = BASE_BREATH_SPEED_S * 1000;

// ── CalibrationScreen ──────────────────────────────────────────────────────
//
// Handles calibPhase sub-states: PHASE_1, PHASE_2, REVIEW, FAILED.
// Avatar breathes continuously at BASE speed throughout.
// BeltSyncRing is hidden during PHASE_1 (no calib yet) and shown in PHASE_2+.
// onComplete() called when calibPhase === 'COMPLETE' (parent BreathBelt.jsx
// should watch calibPhase and transition FSM state there).

export default function CalibrationScreen({
  calibPhase,
  avatarProps,         // { skinColor, eyeColor, species }
  breathValueRef,
  startCalibration,
  redoPhase2,
  resetCalibration,
  acceptCalibration,
}) {
  const { getPhase, reset } = useBreathCycle();

  // Keep the breath cycle running continuously during calibration
  useEffect(() => {
    reset();
    // No cleanup needed — CalibrationScreen unmounts when parent transitions away
  }, []);

  const showRing  = ['PHASE_2', 'REVIEW'].includes(calibPhase);
  const avatarSize = 240;

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-8" style={{ maxWidth: 480, margin: '0 auto' }}>

      {/* Avatar + ring */}
      <div style={{ position: 'relative', width: avatarSize, height: avatarSize }}>
        {showRing && (
          <BeltSyncRing breathValueRef={breathValueRef} avatarSize={avatarSize} />
        )}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <AvatarBreathPacer
            {...avatarProps}
            scaleAmplitude={0.25}
            getPhase={getPhase}
            size={avatarSize}
          />
        </div>
      </div>

      {/* Per-phase UI */}
      {calibPhase === 'NONE' && (
        <CalibReady onStart={startCalibration} />
      )}
      {calibPhase === 'PHASE_1' && (
        <CalibPhase1 />
      )}
      {calibPhase === 'PHASE_2' && (
        <CalibPhase2 />
      )}
      {calibPhase === 'REVIEW' && (
        <CalibReview
          onAccept={acceptCalibration}
          onRedoPhase2={redoPhase2}
          onReset={resetCalibration}
        />
      )}
      {calibPhase === 'FAILED' && (
        <CalibFailed onReset={resetCalibration} />
      )}
    </div>
  );
}

// ── Sub-screens ───────────────────────────────────────────────────────────

function CalibReady({ onStart }) {
  return (
    <>
      <div className="text-center">
        <p style={{ color: 'var(--tx)', fontSize: 'var(--fs-body)', marginBottom: 8 }}>
          The avatar will breathe at a steady pace. Follow along — breathe in as it
          expands, out as it contracts.
        </p>
        <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>
          Phase 1 (3 breaths) measures your signal silently.
          Phase 2 (3 breaths) shows the orange ring so you can check tracking quality.
        </p>
      </div>
      <button
        onClick={onStart}
        className="px-6 py-3 rounded-xl font-medium"
        style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
      >
        Begin calibration
      </button>
    </>
  );
}

function CalibPhase1() {
  return (
    <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)' }}>
      Breathe in as the avatar expands, out as it contracts.
      <br />
      <span style={{ color: 'var(--tx3)', fontSize: 'var(--fs-body-sm)' }}>
        Measuring signal — 3 breaths
      </span>
    </p>
  );
}

function CalibPhase2() {
  return (
    <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)' }}>
      Keep breathing with the avatar.
      <br />
      <span style={{ color: 'rgba(255,140,60,0.9)', fontSize: 'var(--fs-body-sm)', fontWeight: 600 }}>
        The orange ring now shows your breathing.
      </span>
      {' '}
      <span style={{ color: 'var(--tx3)', fontSize: 'var(--fs-body-sm)' }}>
        Check that it tracks your inhale and exhale — 3 breaths
      </span>
    </p>
  );
}

function CalibReview({ onAccept, onRedoPhase2, onReset }) {
  return (
    <>
      <p className="text-center" style={{ color: 'var(--tx)', fontSize: 'var(--fs-body)' }}>
        Does the orange ring track your breathing accurately?
      </p>
      <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 320 }}>
        <button
          onClick={onAccept}
          className="px-5 py-3 rounded-xl font-medium w-full"
          style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
        >
          ✓ Looks good — continue
        </button>
        <button
          onClick={onRedoPhase2}
          className="px-5 py-3 rounded-xl w-full"
          style={{
            background: 'transparent',
            border: '1px solid var(--bds)',
            color: 'var(--tx)',
            fontSize: 'var(--fs-body)',
          }}
        >
          ↺ Redo feedback phase
        </button>
        <button
          onClick={onReset}
          className="px-5 py-3 rounded-xl w-full"
          style={{
            background: 'transparent',
            border: '1px solid var(--bds)',
            color: 'var(--tx2)',
            fontSize: 'var(--fs-body-sm)',
          }}
        >
          ⟳ Full recalibration
        </button>
      </div>
    </>
  );
}

function CalibFailed({ onReset }) {
  return (
    <>
      <p className="text-center" style={{ color: '#c0392b', fontSize: 'var(--fs-body)' }}>
        Calibration failed — signal too weak to detect breathing.
        <br />
        <span style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>
          Check that the belt electrodes are wet and the strap is snug against the skin.
        </span>
      </p>
      <button
        onClick={onReset}
        className="px-5 py-3 rounded-xl font-medium"
        style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
      >
        Retry calibration
      </button>
    </>
  );
}
