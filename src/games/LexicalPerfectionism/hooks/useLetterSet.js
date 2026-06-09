import { useState, useEffect, useCallback, useRef } from 'react';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Manages display state for one letter set.
// resetKey: pass currentSetIndex — changing it resets displayLetters for the new set.
export function useLetterSet(letters, resetKey) {
  const lettersRef = useRef(letters);
  lettersRef.current = letters;

  const [displayLetters, setDisplayLetters] = useState(() => shuffleArray(letters));

  useEffect(() => {
    setDisplayLetters(shuffleArray([...lettersRef.current]));
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const shuffle = useCallback(() => {
    setDisplayLetters(prev => shuffleArray([...prev]));
  }, []);

  // Returns display-order indices consumed by typedValue (greedy left-to-right).
  // Used by LetterTiles to determine which tiles to fade.
  const getUsedIndices = useCallback((typedValue) => {
    const used    = new Array(displayLetters.length).fill(false);
    const indices = [];
    for (const ch of typedValue.toUpperCase()) {
      for (let i = 0; i < displayLetters.length; i++) {
        if (!used[i] && displayLetters[i] === ch) {
          used[i] = true;
          indices.push(i);
          break;
        }
      }
    }
    return indices;
  }, [displayLetters]);

  // Returns a counts map of letters still available after consuming prefix.
  // Used by WordInput to block keypresses for unavailable letters.
  const remainingPool = useCallback((prefix) => {
    const counts = {};
    for (const l of displayLetters) counts[l] = (counts[l] || 0) + 1;
    for (const ch of prefix.toUpperCase()) {
      if (counts[ch] > 0) counts[ch]--;
    }
    return counts;
  }, [displayLetters]);

  // Checks whether word can be drawn from the canonical letter set.
  // Uses lettersRef so validation is always against the correct (unshuffled) multiset.
  const isDrawable = useCallback((word) => {
    const counts = {};
    for (const l of lettersRef.current) counts[l] = (counts[l] || 0) + 1;
    for (const ch of word.toUpperCase()) {
      if (!counts[ch]) return false;
      counts[ch]--;
    }
    return true;
  }, []); // lettersRef is always current; no dep needed

  return { displayLetters, shuffle, getUsedIndices, remainingPool, isDrawable };
}
