import { useRef } from 'react';
import { BUFFER_SIZE } from './constants';

export function useBreathSync() {
  const buffer = useRef([]);

  function addCycleSync(syncScore) {
    buffer.current = [...buffer.current, syncScore].slice(-BUFFER_SIZE);
  }

  function getRollingMean() {
    if (buffer.current.length === 0) return 0;
    return buffer.current.reduce((a, b) => a + b, 0) / buffer.current.length;
  }

  function getBufferLength() {
    return buffer.current.length;
  }

  function reset() {
    buffer.current = [];
  }

  return { addCycleSync, getRollingMean, getBufferLength, reset };
}
