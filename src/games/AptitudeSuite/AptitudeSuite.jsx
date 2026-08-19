import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase as globalSupabase } from '../../lib/supabase';
import { DEMO_SECS, isDemoMode } from '../../lib/demoMode';
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

export default function AptitudeSuite({
  session,
  userId:          userIdProp,
  studyId,
  studyMode = false,
  supabaseClient,
  onSessionComplete,
  isSimMode = false,
}) {
  const db = supabaseClient ?? globalSupabase;

  const [phase, setPhase] = useState('instructions'); // 'instructions' | 'active' | 'complete'
  const [saving, setSaving] = useState(false);

  const sessionIdRef    = useRef(null);
  const sessionStartRef = useRef(null);
  const lastActiveTask  = useRef(null);
  const taskSwitchCount = useRef(0);

  // Which subtask currently holds focus. All three boxes are on screen at once,
  // so this is the only observable signal of where the participant is working -
  // there is no page to leave, and therefore no navigation event to log.
  const focusedTask     = useRef(null);

  const anagram   = useAnagram();
  const fluency   = useFluency();
  const wordProbe = useWordProbe();

  // Keep latest scores/percentiles in refs so handleExpire is never stale
  const scoresRef = useRef({ anagram, fluency, wordProbe });
  scoresRef.current = { anagram, fluency, wordProbe };

  const userId = userIdProp ?? session?.user?.id ?? null;

  // ── Supabase helpers ──────────────────────────────────────────────────────

  async function createSessionRow() {
    const now = new Date().toISOString();
    sessionStartRef.current = Date.now();
    const { data, error } = await db
      .from('aptitude_sessions')
      .insert({
        user_id: userId,
        study_id: studyId ?? null,
        session_start: now,
        category_assigned: fluency.categoryKey,
        is_test: isSimMode,
      })
      .select('id')
      .single();
    if (error) { console.error('aptitude_sessions insert failed', error); return; }
    sessionIdRef.current = data.id;
    // Anchors the event timeline at elapsed_ms 0, so focus segments can be
    // closed against a known start the way ColourMax's page segments are.
    logEvent('aptitude_suite', 'session_start', null, null, null);
  }

  function logEvent(task, event_type, value, scoreAtTime, pctAtTime) {
    if (!sessionIdRef.current) return;
    const elapsed_ms = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0;
    db.from('aptitude_events').insert({
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
    const avg = (anagramPct + fluencyPct + wordprobePct) / 3;
    if (sessionIdRef.current) {
      const { error } = await db
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
    onSessionComplete?.({
      anagram_score:    anagramScore,
      anagram_pct:      anagramPct,
      fluency_score:    fluencyScore,
      fluency_pct:      fluencyPct,
      wordprobe_score:  wordprobeScore,
      wordprobe_pct:    wordprobePct,
      avg_pct:          +avg.toFixed(2),
      task_switch_count: taskSwitchCount.current,
    });
  }

  // ── Timer ─────────────────────────────────────────────────────────────────

  const handleExpire = useCallback(() => {
    // Closes the final focus segment. Logged before finalise so the timeline is
    // complete even if the session update later fails.
    logEvent('aptitude_suite', 'game_end', null, null, null);
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

  // Admin quick-demo (?demo=1) shortens the session; never honored in studies
  const demo  = !studyMode && !studyId && !isSimMode && isDemoMode();
  const timer = useSessionTimer({
    onExpire: handleExpire,
    ...(demo ? { durationMs: DEMO_SECS * 1000 } : {}),
  });

  // ── Begin ─────────────────────────────────────────────────────────────────

  async function handleBegin() {
    await createSessionRow();
    timer.start();
    setPhase('active');
  }

  // ── Sim mode auto-advance ─────────────────────────────────────────────────
  // Auto-begin on mount; auto-expire after a short delay so the study runner
  // can step through without manual interaction.

  useEffect(() => {
    if (!isSimMode) return;
    if (phase === 'instructions') handleBegin();
  }, [isSimMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSimMode || phase !== 'active') return;
    const t = setTimeout(() => handleExpire(), 800);
    return () => clearTimeout(t);
  }, [isSimMode, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Task interaction tracking ─────────────────────────────────────────────

  // Interaction-derived switch count. Deliberately unchanged: task_switch_count
  // is already stored, already in the preregistration, and already present in
  // the pilot data, so its meaning must stay comparable across the change.
  const handleInteract = useCallback((task) => {
    if (lastActiveTask.current && lastActiveTask.current !== task) {
      taskSwitchCount.current += 1;
    }
    lastActiveTask.current = task;
  }, []);

  // Focus-derived transitions. Each event names the subtask being entered and
  // carries the one being left, so per-subtask dwell is the gap between
  // consecutive events - the same reconstruction ColourMax's page_switch
  // supports. Repeat focus on the already-focused box is not an event.
  const handleFocusTask = useCallback((task) => {
    if (focusedTask.current === task) return;
    const from = focusedTask.current;
    focusedTask.current = task;
    logEvent(task, 'task_focus', JSON.stringify({ from, to: task }), null, null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Time with the tab backgrounded would otherwise be charged to whichever
  // subtask happened to hold focus. Bracketing it lets the analysis subtract it
  // rather than silently inflating one subtask's dwell.
  useEffect(() => {
    if (phase !== 'active') return;
    // Guard on the target: a focus event that bubbles up from an element would
    // otherwise be recorded as the whole window regaining focus, and the
    // analysis would subtract an away-interval that never happened.
    const onBlur  = (e) => { if (e.target === window) logEvent('aptitude_suite', 'window_blur',  null, null, null); };
    const onFocus = (e) => { if (e.target === window) logEvent('aptitude_suite', 'window_focus', null, null, null); };
    window.addEventListener('blur',  onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur',  onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

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
            margin: '0 0 1.25rem',
          }}>
            The Aptitude Suite
          </h1>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '16px',
            lineHeight: '1.65',
            color: 'var(--tx2)',
            margin: '0 0 1.75rem',
            textAlign: 'left',
          }}>
            You have 8 minutes to work across three tasks. Keep going until the time runs
            out and manage your time: you can switch between tasks freely. This assessment
            measures the following skills that distinguish high cognitive performance: verbal
            fluency, attention to detail, and mental flexibility. Each task scores you against
            other participants — aim for the top 10%. Your overall score is the average of
            your three percentile ranks.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem', textAlign: 'left' }}>
            {[
              {
                name: 'Unscramble',
                desc: 'Rearrange a set of mixed letters to guess the correct word. Complete as many as you can for more points.',
              },
              {
                name: 'Word Storm',
                desc: 'You\'ll be given a category — name as many items from that category as you can think of. There is no limit to how many you can name, as long as you can think of more!',
              },
              {
                name: 'Word Probe',
                desc: 'Guess a hidden 5-letter word in 6 tries. Tip: fewer guesses means a higher score, but only valid words count as guesses. After each guess, the letters will be coloured to guide your next move: green = correct letter, correct position · yellow = correct letter, wrong position · grey = incorrect letter.',
              },
            ].map(({ name, desc }) => (
              <div key={name} style={{
                background: 'var(--bg)',
                border: '1px solid var(--bd)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
              }}>
                <div style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--pk)',
                  marginBottom: '0.35rem',
                }}>
                  {name}
                </div>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '14px',
                  lineHeight: '1.55',
                  color: 'var(--tx2)',
                }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
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
              fontWeight: '600',
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
        {/* display:contents keeps these wrappers out of the grid layout - the
            boxes remain the grid items - while still receiving focus and
            pointer events as they bubble. Capture phase is used so a click
            anywhere in a box counts, not only on its input. */}
        <div style={{ display: 'contents' }}
             onFocusCapture={() => handleFocusTask('anagram')}
             onMouseDownCapture={() => handleFocusTask('anagram')}>
          <AnagramBox
            hook={anagramWithLog}
            onInteract={handleInteract}
            disabled={!timer.running}
          />
        </div>
        <div style={{ display: 'contents' }}
             onFocusCapture={() => handleFocusTask('wordprobe')}
             onMouseDownCapture={() => handleFocusTask('wordprobe')}>
          <WordProbeBox
            hook={wordProbeWithLog}
            onInteract={handleInteract}
            disabled={!timer.running}
          />
        </div>
        <div style={{ display: 'contents' }}
             onFocusCapture={() => handleFocusTask('fluency')}
             onMouseDownCapture={() => handleFocusTask('fluency')}>
          <FluencyBox
            hook={fluencyWithLog}
            onInteract={handleInteract}
            disabled={!timer.running}
          />
        </div>
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
