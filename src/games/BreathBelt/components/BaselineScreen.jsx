import { useEffect, useRef, useState } from 'react';
import AvatarBreathPacer from '../../EbbAndFlow/components/AvatarBreathPacer';
import { useBreathCycle } from '../../EbbAndFlow/useBreathCycle';
import BeltSyncRing from './BeltSyncRing';
import { estimateBreathPeriodMs } from '../breathUtils';

const SAMPLE_MS = 40;

// ── BaselineScreen ─────────────────────────────────────────────────────────
//
// Reusable for both pre-session (BASELINE_*) and post-session (POST_BASELINE_*)
// baselines. Parent maps its FSM states to the generic phase prop.
//
// Props:
//   phase       — 'READY' | 'RECORDING' | 'COMPLETE'
//   title       — e.g. "Natural baseline" or "Post-session rest"
//   durationMs  — recording duration in ms
//   breathValueRef, sendTrigger, currentPhaseRef, currentTrialRef
//   phaseLabel  — raw data phase tag (e.g. 'baseline' or 'post_baseline')
//   onStart     — () => void
//   onComplete  — (periodMs: number | null) => void  — period estimate from epoch

export default function BaselineScreen({
  phase,
  title,
  durationMs,
  breathValueRef,
  sendTrigger,
  currentPhaseRef,
  currentTrialRef,
  phaseLabel,
  onStart,
  onComplete,
}) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef    = useRef(null);
  const intervalRef = useRef(null);
  const sampleRef   = useRef(null);
  const samplesRef  = useRef([]);
  const { getPhase } = useBreathCycle();
  const avatarSize = 240;

  useEffect(() => {
    if (phase !== 'RECORDING') return;

    // Label raw rows
    currentPhaseRef.current = phaseLabel;
    currentTrialRef.current = -1;
    samplesRef.current = [];

    // COM trigger: start
    sendTrigger('1');

    // Sample breathValueRef for period estimation
    sampleRef.current = setInterval(() => {
      samplesRef.current.push(breathValueRef.current ?? 0);
    }, SAMPLE_MS);

    // Countdown tick
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed(Math.min(Date.now() - start, durationMs));
    }, 500);

    // End timer
    timerRef.current = setTimeout(async () => {
      clearInterval(sampleRef.current);
      clearInterval(intervalRef.current);
      await sendTrigger('0');
      currentPhaseRef.current = 'idle';
      const periodMs = estimateBreathPeriodMs(samplesRef.current, SAMPLE_MS);
      onComplete(periodMs);
    }, durationMs);

    return () => {
      clearInterval(sampleRef.current);
      clearInterval(intervalRef.current);
      clearTimeout(timerRef.current);
    };
  }, [phase]);

  const secondsLeft = Math.ceil((durationMs - elapsed) / 1000);
  const progress    = elapsed / durationMs;

  return (
    <div
      className="flex flex-col items-center gap-6 px-6 py-8"
      style={{ maxWidth: 480, margin: '0 auto' }}
    >
      {/* Avatar frozen + ring always visible */}
      <div style={{ position: 'relative', width: avatarSize, height: avatarSize }}>
        <BeltSyncRing breathValueRef={breathValueRef} avatarSize={avatarSize} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <AvatarBreathPacer
            scaleAmplitude={0.25}
            getPhase={getPhase}
            paused={true}
            size={avatarSize}
          />
        </div>
      </div>

      {phase === 'READY' && (
        <>
          <div className="text-center">
            <p style={{ color: 'var(--tx)', fontSize: 'var(--fs-body)', marginBottom: 8, fontWeight: 600 }}>
              {title}
            </p>
            <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>
              Sit comfortably and breathe naturally for {durationMs / 1000} seconds.
              The avatar will stay still — this is not a pacing task.
              The orange ring shows your belt signal.
            </p>
          </div>
          <button
            onClick={onStart}
            className="px-6 py-3 rounded-xl font-medium"
            style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
          >
            Begin recording
          </button>
        </>
      )}

      {phase === 'RECORDING' && (
        <>
          <ProgressArc progress={progress} secondsLeft={secondsLeft} />
          <p className="text-center" style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>
            Breathe naturally. Recording in progress.
          </p>
        </>
      )}

      {phase === 'COMPLETE' && (
        <p className="text-center" style={{ color: 'var(--tx)', fontSize: 'var(--fs-body)' }}>
          {title} complete.
        </p>
      )}
    </div>
  );
}

function ProgressArc({ progress, secondsLeft }) {
  const r             = 40;
  const cx            = 50;
  const cy            = 50;
  const circumference = 2 * Math.PI * r;
  const dash          = circumference * progress;

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
