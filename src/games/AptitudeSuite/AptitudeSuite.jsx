import { useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useSessionTimer } from './hooks/useSessionTimer';
import { useAnagram } from './hooks/useAnagram';
import { useFluency } from './hooks/useFluency';
import { useWordProbe } from './hooks/useWordProbe';
import GlobalAverage from './components/GlobalAverage';
import SessionTimer from './components/SessionTimer';
import AnagramBox from './components/AnagramBox';
import FluencyBox from './components/FluencyBox';
import WordProbeBox from './components/WordProbeBox';
import SessionComplete from './components/SessionComplete';

export default function AptitudeSuite({ session }) {
  const [phase, setPhase] = useState('instructions'); // 'instructions' | 'active' | 'complete'
  const [saving, setSaving] = useState(false);

  const sessionIdRef    = useRef(null);
  const sessionStartRef = useRef(null);
  const lastActiveTask  = useRef(null);
  const taskSwitchCount = useRef(0);

  const anagram   = useAnagram();
  const fluency   = useFluency();
  const wordProbe = useWordProbe();

  // Keep latest scores/percentiles in refs so handleExpire is never stale
  const scoresRef = useRef({ anagram, fluency, wordProbe });
  scoresRef.current = { anagram, fluency, wordProbe };

  const userId = session?.user?.id ?? null;

  // ── Supabase helpers ──────────────────────────────────────────────────────

  async function createSessionRow() {
    const now = new Date().toISOString();
    sessionStartRef.current = Date.now();
    const { data, error } = await supabase
      .from('aptitude_sessions')
      .insert({
        user_id: userId,
        session_start: now,
        category_assigned: fluency.categoryKey,
        is_test: false,
      })
      .select('id')
      .single();
    if (error) { console.error('aptitude_sessions insert failed', error); return; }
    sessionIdRef.current = data.id;
  }

  function logEvent(task, event_type, value, scoreAtTime, pctAtTime) {
    if (!sessionIdRef.current) return;
    const elapsed_ms = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0;
    supabase.from('aptitude_events').insert({
      session_id: sessionIdRef.current,
      task,
      event_type,
      value: value ?? null,
      score_at_time: scoreAtTime,
      pct_at_time: pctAtTime,
      elapsed_ms,
    }).then(({ error }) => {
      if (error) console.error('aptitude_events insert failed', error);
    });
  }

  async function finaliseSession(anagramScore, anagramPct, fluencyScore, fluencyPct, wordprobeScore, wordprobePct) {
    if (!sessionIdRef.current) return;
    const avg = (anagramPct + fluencyPct + wordprobePct) / 3;
    const { error } = await supabase
      .from('aptitude_sessions')
      .update({
        session_end: new Date().toISOString(),
        anagram_score: anagramScore,
        fluency_score: fluencyScore,
        wordprobe_score: wordprobeScore,
        anagram_pct: anagramPct,
        fluency_pct: fluencyPct,
        wordprobe_pct: wordprobePct,
        avg_pct: avg.toFixed(2),
        task_switch_count: taskSwitchCount.current,
      })
      .eq('id', sessionIdRef.current);
    if (error) console.error('aptitude_sessions update failed', error);
  }

  // ── Timer ─────────────────────────────────────────────────────────────────

  const handleExpire = useCallback(() => {
    setSaving(true);
    const { anagram: a, fluency: f, wordProbe: w } = scoresRef.current;
    finaliseSession(
      a.score, a.percentile,
      f.score, f.percentile,
      w.score, w.percentile,
    ).finally(() => {
      setSaving(false);
      setPhase('complete');
    });
  }, []);

  const timer = useSessionTimer({ onExpire: handleExpire });

  // ── Begin ─────────────────────────────────────────────────────────────────

  async function handleBegin() {
    await createSessionRow();
    timer.start();
    setPhase('active');
  }

  // ── Task interaction tracking ─────────────────────────────────────────────

  const handleInteract = useCallback((task) => {
    if (lastActiveTask.current && lastActiveTask.current !== task) {
      taskSwitchCount.current += 1;
    }
    lastActiveTask.current = task;
  }, []);

  // Wrap submit callbacks to also fire log events
  const anagramWithLog = {
    ...anagram,
    submit: (val) => {
      const result = anagram.submit(val);
      if (result === 'correct')      logEvent('anagram', 'solve',       val, anagram.score + 1, anagram.percentile);
      else if (result === 'wrong')   logEvent('anagram', 'wrong_guess', val, anagram.score,     anagram.percentile);
      return result;
    },
    skip: () => {
      const result = anagram.skip();
      logEvent('anagram', 'skip', null, Math.max(0, anagram.score - 1), anagram.percentile);
      return result;
    },
  };

  const fluencyWithLog = {
    ...fluency,
    submit: (val) => {
      const result = fluency.submit(val);
      const evtType =
        result === 'valid'     ? 'submit_valid' :
        result === 'invalid'   ? 'submit_invalid' :
        result === 'duplicate' ? 'submit_duplicate' : null;
      if (evtType) logEvent('fluency', evtType, val, fluency.score + (result === 'valid' ? 1 : 0), fluency.percentile);
      return result;
    },
  };

  const wordProbeWithLog = {
    ...wordProbe,
    submit: (val) => {
      const result = wordProbe.submit(val);
      const evtType =
        result === 'guess_valid'  ? 'guess_valid' :
        result === 'guess_invalid'? 'guess_invalid' :
        result === 'round_solve'  ? 'round_solve' :
        result === 'round_fail'   ? 'round_fail' : null;
      if (evtType) logEvent('wordprobe', evtType, val, wordProbe.score, wordProbe.percentile);
      return result;
    },
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'complete') {
    return (
      <SessionComplete
        anagramScore={anagram.score}    anagramPct={anagram.percentile}
        fluencyScore={fluency.score}    fluencyPct={fluency.percentile}
        categoryLabel={fluency.categoryLabel}
        wordprobeScore={wordProbe.score} wordprobePct={wordProbe.percentile}
        taskSwitchCount={taskSwitchCount.current}
        submitted={!saving}
      />
    );
  }

  if (phase === 'instructions') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}>
        <div style={{
          background: 'var(--bgc)',
          border: '1px solid var(--bd)',
          borderRadius: '20px',
          padding: '3rem 2.5rem',
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
        }}>
          <h1 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '2.5rem',
            fontWeight: '400',
            color: 'var(--tx)',
            margin: '0 0 1.5rem',
          }}>
            The Aptitude Suite
          </h1>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '16px',
            lineHeight: '1.65',
            color: 'var(--tx2)',
            margin: '0 0 2.5rem',
          }}>
            You have 10 minutes to work across three tasks. Each task scores you against
            other participants — aim for the top 10%. Manage your time: you can switch
            between tasks freely. Your overall score is the average of your three percentile ranks.
          </p>
          <button
            onClick={handleBegin}
            style={{
              padding: '0.75rem 2.5rem',
              background: 'var(--pk)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Begin
          </button>
        </div>
      </div>
    );
  }

  // Active phase
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: '1.5rem 1rem 2rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '1100px',
        margin: '0 auto 1.5rem',
      }}>
        <div style={{ width: '120px' }} />
        <GlobalAverage
          pct1={anagram.percentile}
          pct2={fluency.percentile}
          pct3={wordProbe.percentile}
        />
        <div style={{ width: '120px', display: 'flex', justifyContent: 'flex-end' }}>
          <SessionTimer secondsRemaining={timer.secondsRemaining} />
        </div>
      </div>

      {/* Task grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.25rem',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
        className="aptitude-grid"
      >
        <AnagramBox
          hook={anagramWithLog}
          onInteract={handleInteract}
          disabled={!timer.running}
        />
        <FluencyBox
          hook={fluencyWithLog}
          onInteract={handleInteract}
          disabled={!timer.running}
        />
        <WordProbeBox
          hook={wordProbeWithLog}
          onInteract={handleInteract}
          disabled={!timer.running}
        />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .aptitude-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
