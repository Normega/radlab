import { useState, useRef, useCallback } from 'react';
import { anagramPool } from '../data/anagrams';
import { logisticPercentile, ANAGRAM_MIDPOINT, ANAGRAM_K } from '../constants';

function fisherYates(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function scramble(word) {
  if (word.length === 1) return word;
  let shuffled;
  do {
    shuffled = fisherYates(word.split('')).join('');
  } while (shuffled === word);
  return shuffled;
}

function getLengthForSolves(solves) {
  const length = 3 + Math.floor(solves / 2);
  return Math.min(length, 12);
}

export function useAnagram() {
  const [score, setScore]         = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [scrambled, setScrambled] = useState('');
  const [input, setInput]         = useState('');
  const [feedback, setFeedback]   = useState(null); // 'correct' | 'wrong' | 'skip'

  const solvesRef   = useRef(0);
  const poolRef     = useRef({});
  const feedbackTimerRef = useRef(null);

  const showFeedback = useCallback((type) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback(type);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 800);
  }, []);

  const drawWord = useCallback((solveCount) => {
    const len = getLengthForSolves(solveCount);
    const pool = anagramPool[len] ?? anagramPool[3];
    if (!poolRef.current[len] || poolRef.current[len].length === 0) {
      poolRef.current[len] = fisherYates([...pool]);
    }
    const word = poolRef.current[len].pop();
    setCurrentWord(word);
    setScrambled(scramble(word));
    setInput('');
  }, []);

  // initialise first word
  const init = useCallback(() => {
    drawWord(0);
  }, [drawWord]);

  const submit = useCallback((value) => {
    const guess = value.trim().toLowerCase();
    if (!guess) return;
    if (guess === currentWord) {
      solvesRef.current += 1;
      setScore(s => s + 1);
      showFeedback('correct');
      drawWord(solvesRef.current);
      return 'correct';
    } else {
      showFeedback('wrong');
      setInput('');
      return 'wrong';
    }
  }, [currentWord, drawWord, showFeedback]);

  const skip = useCallback(() => {
    setScore(s => Math.max(0, s - 1));
    showFeedback('skip');
    drawWord(solvesRef.current);
    return 'skip';
  }, [drawWord, showFeedback]);

  const percentile = logisticPercentile(score, ANAGRAM_MIDPOINT, ANAGRAM_K);

  return {
    score, percentile,
    currentWord, scrambled,
    input, setInput,
    feedback,
    init, submit, skip,
    wordLength: getLengthForSolves(solvesRef.current),
  };
}
