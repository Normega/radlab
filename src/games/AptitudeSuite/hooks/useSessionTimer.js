import { useRef, useState, useEffect } from 'react';
import { SESSION_DURATION_MS } from '../constants';

export function useSessionTimer({ onExpire, autoStart = false, durationMs = SESSION_DURATION_MS }) {
  const [secondsRemaining, setSecondsRemaining] = useState(durationMs / 1000);
  const [running, setRunning] = useState(false);
  const startTimeRef  = useRef(null);
  const intervalRef   = useRef(null);
  const expiredRef    = useRef(false);
  // Always call the latest onExpire without stale closure issues
  const onExpireRef   = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  function start() {
    if (running || expiredRef.current) return;
    startTimeRef.current = Date.now();
    setRunning(true);
  }

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, durationMs - elapsed);
      setSecondsRemaining(Math.ceil(remaining / 1000));
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(intervalRef.current);
        setRunning(false);
        onExpireRef.current?.();
      }
    }, 250);
    return () => clearInterval(intervalRef.current);
  }, [running, durationMs]);

  useEffect(() => {
    if (autoStart) start();
  }, []);

  function getElapsedMs() {
    if (!startTimeRef.current) return 0;
    return Date.now() - startTimeRef.current;
  }

  return { secondsRemaining, running, start, getElapsedMs };
}
