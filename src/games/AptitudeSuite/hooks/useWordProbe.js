import { useState, useRef, useCallback } from 'react';
import { wordProbeAnswers } from '../data/wordProbeAnswers';
import { wordProbeValid } from '../data/wordProbeValid';
import { logisticPercentile, WORDPROBE_MIDPOINT, WORDPROBE_K } from '../constants';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns array of {letter, status} where status: 'green'|'yellow'|'gray'
function scoreGuess(guess, answer) {
  const result = Array(5).fill(null).map((_, i) => ({ letter: guess[i], status: 'gray' }));
  const answerRemaining = answer.split('');

  // Pass 1: greens
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      result[i].status = 'green';
      answerRemaining[i] = null;
    }
  }
  // Pass 2: yellows
  for (let i = 0; i < 5; i++) {
    if (result[i].status === 'green') continue;
    const idx = answerRemaining.indexOf(guess[i]);
    if (idx !== -1) {
      result[i].status = 'yellow';
      answerRemaining[idx] = null;
    }
  }
  return result;
}

export function useWordProbe() {
  const [score, setScore]       = useState(0);
  const [guesses, setGuesses]   = useState([]); // [{letter,status}[]]
  const [input, setInput]       = useState('');
  const [answer, setAnswer]     = useState(() => {
    const pool = shuffle([...wordProbeAnswers]);
    return pool[0];
  });
  const [feedback, setFeedback] = useState(null); // null | 'invalid_word' | 'round_over'
  const [showReveal, setShowReveal] = useState(false);
  const [revealWord, setRevealWord] = useState('');
  const [roundSolved, setRoundSolved] = useState(false);

  const poolRef = useRef(null);
  const revealTimerRef = useRef(null);

  function getPool() {
    if (!poolRef.current || poolRef.current.length === 0) {
      poolRef.current = shuffle([...wordProbeAnswers]);
    }
    return poolRef.current;
  }

  const nextRound = useCallback((currentAnswer, solved) => {
    setRevealWord(currentAnswer);
    setRoundSolved(solved);
    setShowReveal(true);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      setShowReveal(false);
      setRoundSolved(false);
      const pool = getPool();
      const next = pool.pop();
      setAnswer(next);
      setGuesses([]);
      setInput('');
    }, 2000);
  }, []);

  const submit = useCallback((raw) => {
    const guess = raw.trim().toLowerCase();
    if (guess.length !== 5) return null;

    if (!wordProbeValid.has(guess)) {
      setFeedback('invalid_word');
      setTimeout(() => setFeedback(null), 1200);
      return 'guess_invalid';
    }

    const scored = scoreGuess(guess, answer);
    const newGuesses = [...guesses, scored];
    setGuesses(newGuesses);
    setInput('');

    // Partial credit: every valid guess earns 1 point, so genuine attempts move the
    // score even when the round is never solved. Solving pays 2*(7 - guesses) on top,
    // which keeps the ordering strictly monotone and preserves the speed incentive:
    // solve-on-1 = 13, solve-on-6 = 8, fail-after-6 = 6.
    // Before this, 14/20 pilot participants scored exactly 0 while 11 of them were
    // actively guessing — see docs/markdowns/sandy_study3_methods.md 1.8.
    setScore(s => s + 1);

    const solved = scored.every(g => g.status === 'green');
    if (solved) {
      const pts = 2 * (7 - newGuesses.length); // guess 1 = 12 pts, guess 6 = 2 pts
      setScore(s => s + pts);
      nextRound(answer, true);
      return 'round_solve';
    }
    if (newGuesses.length >= 6) {
      nextRound(answer, false);
      return 'round_fail';
    }
    return 'guess_valid';
  }, [answer, guesses, nextRound]);

  const percentile = logisticPercentile(score, WORDPROBE_MIDPOINT, WORDPROBE_K);

  return {
    score, percentile,
    guesses, input, setInput,
    answer,
    feedback,
    showReveal, revealWord, roundSolved,
    submit,
    guessCount: guesses.length,
  };
}
