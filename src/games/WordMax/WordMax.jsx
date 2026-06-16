import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  SESSION_DURATION_MS, NUM_SETS, MIN_WORD_LENGTH,
  DICTIONARY_URL, AMBER_THRESHOLD_S, RED_THRESHOLD_S,
  COLOR_SAFE, COLOR_WARN, COLOR_DANGER,
} from './constants';
import { sampleSets } from './data/letterSets';
import { useGameTimer } from './hooks/useGameTimer';
import { useLetterSet } from './hooks/useLetterSet';
import LetterTiles     from './components/LetterTiles';
import WordInput       from './components/WordInput';
import SetResults      from './components/SetResults';
import SessionComplete from './components/SessionComplete';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timerColor(secs) {
  if (secs <= RED_THRESHOLD_S)   return COLOR_DANGER;
  if (secs <= AMBER_THRESHOLD_S) return COLOR_WARN;
  return COLOR_SAFE;
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Screens ───────────────────────────────────────────────────────────────────

const SCREEN = { INTRO: 'INTRO', PLAYING: 'PLAYING', COMPLETE: 'COMPLETE' };

// ── Main component ────────────────────────────────────────────────────────────

export default function WordMax({ studyMode = false, userId: userIdProp = null, onSessionComplete = null, supabaseClient: supabaseClientProp = null }) {
  // Dictionary
  const wordSetRef        = useRef(null);
  const [dictLoading, setDictLoading] = useState(true);
  const [dictError,   setDictError]   = useState(null);

  // Game state
  const [screen,      setScreen]      = useState(SCREEN.INTRO);
  const [sets,        setSets]        = useState([]);          // sampled letter sets
  const [setIndex,    setSetIndex]    = useState(0);           // current set (0-based)
  const [results,     setResults]     = useState([]);          // completed set results
  const [input,       setInput]       = useState('');
  const [error,       setError]       = useState(null);
  const [timedOut,    setTimedOut]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState(null);
  const [checking,    setChecking]    = useState(false);

  // Tracks ms spent on the current set (for dwell_ms)
  const setStartMsRef = useRef(null);

  // ── Dictionary fetch ────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(DICTIONARY_URL)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => {
        wordSetRef.current = new Set(
          text.split('\n')
            .map(w => w.trim().toUpperCase())
            .filter(w => w.length >= MIN_WORD_LENGTH && w.length <= 10)
        );
        setDictLoading(false);
      })
      .catch(e => {
        setDictError(`Could not load dictionary: ${e.message}`);
        setDictLoading(false);
      });
  }, []);

  // ── Timer ───────────────────────────────────────────────────────────────────

  const handleExpire = useCallback(() => {
    // Pad remaining sets with nulls and go to results.
    setTimedOut(true);
    setResults(prev => {
      const filled = [...prev];
      // If a set was in progress, record it with null word.
      const currentSet = sets[setIndex];
      if (currentSet && filled.length <= setIndex) {
        filled.push({ set_id: currentSet.id, letters: currentSet.letters, word: null, score: 0, dwell_ms: Date.now() - (setStartMsRef.current ?? Date.now()) });
      }
      while (filled.length < NUM_SETS) {
        const s = sets[filled.length];
        if (s) filled.push({ set_id: s.id, letters: s.letters, word: null, score: 0, dwell_ms: null });
      }
      return filled;
    });
    setScreen(SCREEN.COMPLETE);
  }, [sets, setIndex]);

  const { secondsRemaining, start: startTimer, stop: stopTimer, startTimeRef } = useGameTimer({ onExpire: handleExpire });

  // ── Letter set hook ─────────────────────────────────────────────────────────

  const currentSet = sets[setIndex] ?? { id: 0, letters: [] };
  const { displayLetters, shuffle, getUsedIndices, remainingPool, isDrawable } =
    useLetterSet(currentSet.letters, currentSet.id);

  // ── Start session ───────────────────────────────────────────────────────────

  function handleStart() {
    const sampled = sampleSets(NUM_SETS);
    setSets(sampled);
    setSetIndex(0);
    setResults([]);
    setInput('');
    setError(null);
    setTimedOut(false);
    setSaveError(null);
    setSetStartMsRef(Date.now());
    setScreen(SCREEN.PLAYING);
    startTimer();
  }

  // helper — works around closure over setStartMsRef.current
  function setSetStartMsRef(ms) { setStartMsRef.current = ms; }

  // ── Submit word ─────────────────────────────────────────────────────────────

  // Checks local word set first (fast); falls back to Free Dictionary API for
  // words the static list misses (inflected forms, newer words, etc.).
  async function isKnownWord(word) {
    if (wordSetRef.current?.has(word)) return true;
    try {
      const r = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`
      );
      return r.ok;
    } catch {
      return false;
    }
  }

  async function handleSubmit() {
    const word = input.trim().toUpperCase();
    setError(null);

    if (word.length < MIN_WORD_LENGTH) {
      setError(`Minimum ${MIN_WORD_LENGTH} letters.`);
      return;
    }
    if (!isDrawable(word)) {
      setError('Word uses letters not in the set.');
      return;
    }

    setChecking(true);
    const valid = await isKnownWord(word);
    setChecking(false);

    if (!valid) {
      setError('Not a recognised word.');
      return;
    }

    const dwell_ms = Date.now() - (setStartMsRef.current ?? Date.now());
    const result = {
      set_id:   currentSet.id,
      letters:  currentSet.letters,
      word,
      score:    word.length,
      dwell_ms,
    };

    const newResults = [...results, result];
    setResults(newResults);

    if (setIndex + 1 >= NUM_SETS) {
      // All sets done — stop timer and go to results.
      stopTimer();
      setScreen(SCREEN.COMPLETE);
    } else {
      setSetIndex(i => i + 1);
      setInput('');
      setError(null);
      setSetStartMsRef(Date.now());
    }
  }

  // ── Save to Supabase on results screen mount ────────────────────────────────

  useEffect(() => {
    if (screen !== SCREEN.COMPLETE || results.length === 0) return;
    const elapsedMs     = startTimeRef.current
      ? Math.min(Date.now() - startTimeRef.current, SESSION_DURATION_MS)
      : SESSION_DURATION_MS;
    const setsCompleted = results.filter(r => r.word).length;
    const totalScore    = results.reduce((sum, r) => sum + (r.score || 0), 0);

    const db = supabaseClientProp ?? supabase;

    setSaving(true);

    const doInsert = (uid) => {
      db.from('word_max_sessions').insert({
        user_id:        uid,
        completed:      setsCompleted === NUM_SETS,
        timed_out:      timedOut,
        total_score:    totalScore,
        sets_completed: setsCompleted,
        duration_ms:    elapsedMs,
        set_results:    results,
      }).then(({ error: dbErr }) => {
        setSaving(false);
        if (dbErr) {
          setSaveError('Could not save session — data is safe locally.');
        } else if (onSessionComplete) {
          onSessionComplete({ total_score: totalScore, sets_completed: setsCompleted, duration_ms: elapsedMs });
        }
      });
    };

    if (userIdProp) {
      doInsert(userIdProp);
    } else {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) { setSaving(false); return; }
        doInsert(user.id);
      });
    }
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed display values ─────────────────────────────────────────────────

  const color       = timerColor(secondsRemaining);
  const pct         = (secondsRemaining / (SESSION_DURATION_MS / 1000)) * 100;
  const usedIndices = screen === SCREEN.PLAYING ? getUsedIndices(input) : [];
  const totalScore  = results.reduce((s, r) => s + (r.score || 0), 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (screen === SCREEN.COMPLETE) {
    return (
      <SessionComplete
        results={results}
        totalScore={totalScore}
        timedOut={timedOut}
        saving={saving}
        saveError={saveError}
        onPlayAgain={() => setScreen(SCREEN.INTRO)}
        onSessionComplete={onSessionComplete}
      />
    );
  }

  if (screen === SCREEN.INTRO) {
    return (
      <div style={S.centered}>
        <div style={S.introCard}>
          <h1 style={S.heading}>WordMax</h1>
          <p style={S.introBody}>
            You'll see <strong>5 sets of 10 letters</strong>. For each set, type one valid word
            using only those letters — each letter only as many times as it appears.
          </p>
          <p style={S.introBody}>
            Points equal word length. A <strong>5-minute timer</strong> runs across all 5 sets.
            Spending too long on one set risks running out of time.
          </p>
          <ul style={S.rules}>
            <li>Minimum word length: 4 letters</li>
            <li>One word per set</li>
            <li>Timer does not pause between sets</li>
          </ul>

          {dictLoading && (
            <p style={S.dictMsg}>Loading dictionary…</p>
          )}
          {dictError && (
            <p style={S.dictErr}>{dictError}</p>
          )}

          <button
            style={{ ...S.startBtn, opacity: dictLoading || dictError ? 0.4 : 1 }}
            disabled={dictLoading || !!dictError}
            onClick={handleStart}
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  // PLAYING screen
  return (
    <div style={S.playWrap}>
      {/* Timer bar */}
      <div style={S.timerBarBg}>
        <div style={{ ...S.timerBarFill, width: `${pct}%`, background: color }} />
      </div>

      <div style={S.playInner}>
        {/* Set label + countdown */}
        <div style={S.topRow}>
          <span style={S.setLabel}>Set {setIndex + 1} of {NUM_SETS}</span>
          <span style={{ ...S.countdown, color }}>{fmtTime(secondsRemaining)}</span>
        </div>

        {/* Letter tiles */}
        <LetterTiles displayLetters={displayLetters} usedIndices={usedIndices} />

        {/* Shuffle */}
        <button style={S.shuffleBtn} onClick={shuffle}>↺ shuffle letters</button>

        {/* Hint */}
        <p style={S.hint}>
          Use any letters from the set (each only once). Min {MIN_WORD_LENGTH} letters.
        </p>

        {/* Word input */}
        <WordInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          remainingPool={remainingPool}
          disabled={checking}
        />

        {/* Error / checking */}
        <div style={S.errorArea}>
          {checking && <p style={S.checkingMsg}>Checking…</p>}
          {!checking && error && <p style={S.errorMsg}>{error}</p>}
        </div>

        {/* Score strip */}
        <div style={S.scoreStrip}>
          <div style={S.metricCard}>
            <span style={S.metricVal}>{totalScore}</span>
            <span style={S.metricLabel}>Score so far</span>
          </div>
          <div style={S.metricCard}>
            <span style={S.metricVal}>{results.length}</span>
            <span style={S.metricLabel}>Sets done</span>
          </div>
        </div>

        {/* Completed sets */}
        <SetResults results={results} />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  // Intro
  centered:    { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '48px 16px', minHeight: '100vh', background: 'var(--bg)' },
  introCard:   { background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: '40px 36px', maxWidth: 480, width: '100%' },
  heading:     { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 30, fontWeight: 400, color: 'var(--tx)', margin: '0 0 16px' },
  introBody:   { fontSize: 15, color: 'var(--tx2)', margin: '0 0 12px', lineHeight: 1.65, fontFamily: '"DM Sans", system-ui, sans-serif' },
  rules:       { fontSize: 14, color: 'var(--tx2)', margin: '0 0 28px', paddingLeft: 20, lineHeight: 1.8, fontFamily: '"DM Sans", system-ui, sans-serif' },
  dictMsg:     { fontSize: 13, color: 'var(--tx3)', margin: '0 0 12px', fontFamily: '"DM Sans", system-ui, sans-serif' },
  dictErr:     { fontSize: 13, color: COLOR_DANGER, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', margin: '0 0 12px' },
  startBtn:    { width: '100%', background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans", system-ui, sans-serif' },

  // Play
  playWrap:    { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' },
  timerBarBg:  { height: 5, background: '#e5e7eb', flexShrink: 0 },
  timerBarFill:{ height: '100%', transition: 'width 0.25s linear, background 0.4s' },
  playInner:   { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '24px 16px', maxWidth: 600, margin: '0 auto', width: '100%' },
  topRow:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  setLabel:    { fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  countdown:   { fontFamily: '"Space Mono", monospace', fontSize: 22, fontWeight: 700, transition: 'color 0.4s' },
  shuffleBtn:  { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--tx2)', padding: 0, fontFamily: '"DM Sans", system-ui, sans-serif' },
  hint:        { fontSize: 13, color: 'var(--tx3)', margin: 0, fontFamily: '"DM Sans", system-ui, sans-serif' },
  errorArea:   { height: 20, width: '100%', maxWidth: 480 },
  errorMsg:    { fontSize: 13, color: COLOR_DANGER, margin: 0, fontFamily: '"DM Sans", system-ui, sans-serif' },
  checkingMsg: { fontSize: 13, color: 'var(--tx3)', margin: 0, fontFamily: '"DM Sans", system-ui, sans-serif' },
  scoreStrip:  { display: 'flex', gap: 16, justifyContent: 'center', width: '100%' },
  metricCard:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'var(--bgp)', borderRadius: 10, padding: '12px 24px' },
  metricVal:   { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 28, color: 'var(--pk)', lineHeight: 1 },
  metricLabel: { fontFamily: '"Space Mono", monospace', fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
};
