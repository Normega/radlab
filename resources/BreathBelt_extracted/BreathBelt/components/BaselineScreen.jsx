import { useEffect, useRef, useState } from 'react';
import AvatarBreathPacer from '../../EbbAndFlow/components/AvatarBreathPacer';
import { useBreathCycle } from '../../EbbAndFlow/useBreathCycle';
import BeltSyncRing from './BeltSyncRing';
import { BASELINE_DURATION_MS } from '../constants';

// ── BaselineScreen ─────────────────────────────────────────────────────────
//
// 60-second natural free-breathing baseline.
// Avatar is present but NOT pacing — it freezes at neutral (paused=true).
// BeltSyncRing shows live belt signal so researcher can monitor quality.
// COM trigger '1' fires at recording start, '0' at recording end.
// onComplete() fires when the 60 s timer ends.

export default function BaselineScreen({
  phase,           // 'BASELINE_READY' | 'BASELINE_RECORDING' | 'BASELINE_COMPLETE'
  avatarProps,
  breathValueRef,
  sendTrigger,
  currentPhaseRef,
  currentTrialRef,
  onStart,         // () => void — called when researcher clicks "Begin"
  onComplete,      // () => void — called when timer ends
}) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef    = useRef(null);
  const intervalRef = useRef(null);
  const { getPhase } = useBreathCycle(); // unused cycle — just to satisfy AvatarBreathPacer prop
  const avatarSize = 240;

  useEffect(() => {
    if (phase !== 'BASELINE_RECORDING') return;

    // Label raw rows
    currentPhaseRef.current = 'baseline';
    currentTrialRef.current = -1;

    // COM trigger: baseline start
    sendTrigger('1');

    // Countdown tick
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed(Math.min(Date.now() - start, BASELINE_DURATION_MS));
    }, 500);

    // End timer
    timerRef.current = setTimeout(async () => {
      clearInterval(intervalRef.current);
      await sendTrigger('0');
      currentPhaseRef.current = 'idle';
      onComplete();
    }, BASELINE_DURATION_MS);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timerRef.current);
    };
  }, [phase]);

  const secondsLeft = Math.ceil((BASELINE_DURATION_MS - elapsed) / 1000);
  const progress    = elapsed / BASELINE_DURATION_MS;

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-8" style={{ maxWidth: 480, margin: '0 auto' }}>

      {/* Avatar + ring (ring always visible — baseline shows real belt signal) */}
      <div style={{ position: 'relative', width: avatarSize, height: avatarSize }}>
        <BeltSyncRing breathValueRef={breathValueRef} avatarSize={avatarSize} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <AvatarBreathPacer
            {...avatarProps}
            scaleAmplitude={0.25}
            getPhase={getPhase}
            paused={true}   // avatar frozen — participant breathes naturally
            size={avatarSize}
          />
        </div>
      </div>

      {phase === 'BASELINE_READY' && (
        <>
          <div className="text-center">
            <p style={{ color: 'var(--tx)', fontSize: 'var(--fs-body)', marginBottom: 8 }}>
              <strong>Natural breathing baseline</strong>
            </p>
            <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>
              Sit comfortably and breathe naturally for 60 seconds.
              The avatar will stay still — this is not a pacing task.
              The orange ring shows your belt signal.
            </p>
          </div>
          <button
            onClick={onStart}
            className="px-6 py-3 rounded-xl font-medium"
            style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
          >
            Begin baseline recording
          </button>
        </>
      )}

      {phase === 'BASELINE_RECORDING' && (
        <>
          <ProgressArc progress={progress} secondsLeft={secondsLeft} />
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>
            Breathe naturally. Recording in progress.
          </p>
        </>
      )}

      {phase === 'BASELINE_COMPLETE' && (
        <p className="text-center" style={{ color: 'var(--tx)', fontSize: 'var(--fs-body)' }}>
          Baseline complete.
        </p>
      )}
    </div>
  );
}

// Simple arc progress indicator
function ProgressArc({ progress, secondsLeft }) {
  const r  = 40;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * progress;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bd)" strokeWidth={6} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(255,140,60,0.8)"
          strokeWidth={6}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <span style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-md)', color: 'var(--tx2)' }}>
        {secondsLeft}s
      </span>
    </div>
  );
}
