import { useRef, useState, useCallback } from 'react';
import { SESSION_DURATION_MS } from '../constants';

// Ref-based countdown following the platform pattern (no setState for interval/startTime).
// Returns secondsRemaining for display; start/stop for lifecycle control.
export function useGameTimer({ onExpire, durationMs = SESSION_DURATION_MS }) {
  const startTimeRef = useRef(null);
  const intervalRef  = useRef(null);
  const onExpireRef  = useRef(onExpire);
  onExpireRef.current = onExpire;

  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.ceil(durationMs / 1000)
  );

  const start = useCallback(() => {
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed    = Date.now() - startTimeRef.current;
      const remainingMs = Math.max(0, durationMs - elapsed);
      setSecondsRemaining(Math.ceil(remainingMs / 1000));
      if (remainingMs <= 0) {
        clearInterval(intervalRef.current);
        onExpireRef.current?.();
      }
    }, 250);
  }, [durationMs]);

  // Returns elapsed ms at the moment of stopping.
  const stop = useCallback(() => {
    clearInterval(intervalRef.current);
    if (!startTimeRef.current) return 0;
    return Date.now() - startTimeRef.current;
  }, []);

  return { secondsRemaining, start, stop, startTimeRef };
}
