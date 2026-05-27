import { useState, useCallback } from 'react';
import { categories } from '../data/categories';
import { logisticPercentile, FLUENCY_MIDPOINT, FLUENCY_K } from '../constants';

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function pickCategory() {
  const keys = Object.keys(categories);
  return keys[Math.floor(Math.random() * keys.length)];
}

export function useFluency() {
  const [categoryKey]   = useState(() => pickCategory());
  const [score, setScore]       = useState(0);
  const [submitted, setSubmitted] = useState([]); // canonical whitelist words accepted
  const [input, setInput]       = useState('');
  const [feedback, setFeedback] = useState(null); // null | 'valid' | 'invalid' | 'duplicate'

  const category = categories[categoryKey];
  const wordList = category?.words ?? [];

  const submit = useCallback((raw) => {
    const guess = raw.trim().toLowerCase();
    if (!guess) return null;

    // Check already submitted
    if (submitted.includes(guess)) {
      setFeedback('duplicate');
      setTimeout(() => setFeedback(null), 1200);
      setInput('');
      return 'duplicate';
    }

    // Find closest match within Levenshtein-1
    let match = null;
    for (const word of wordList) {
      if (levenshtein(guess, word) <= 1) {
        match = word;
        break;
      }
    }

    if (!match) {
      setFeedback('invalid');
      setTimeout(() => setFeedback(null), 1200);
      setInput('');
      return 'invalid';
    }

    // Check if canonical form already accepted
    if (submitted.includes(match)) {
      setFeedback('duplicate');
      setTimeout(() => setFeedback(null), 1200);
      setInput('');
      return 'duplicate';
    }

    setSubmitted(prev => [...prev, match]);
    setScore(s => s + 1);
    setFeedback('valid');
    setTimeout(() => setFeedback(null), 800);
    setInput('');
    return 'valid';
  }, [submitted, wordList]);

  const percentile = logisticPercentile(score, FLUENCY_MIDPOINT, FLUENCY_K);

  return {
    score, percentile,
    categoryKey,
    categoryLabel: category?.label ?? '',
    submitted,
    input, setInput,
    feedback,
    submit,
  };
}
