import { useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

// ── useBeltSession ────────────────────────────────────────────────────────
//
// Manages game_sessions row lifecycle and belt-specific data writes.
// Raw accel + HR rows go to Supabase Storage (belt-sessions bucket).
// Trial rows go to belt_trials table.
// Session metadata goes to belt_sessions table.
//
// Belt-sessions Storage bucket must be created in Supabase dashboard
// before first use (private, not public).

export function useBeltSession(userId) {
  const sessionIdRef = useRef(null);
  const trialsRef    = useRef([]);

  const startSession = useCallback(async (studyId = null) => {
    const { data, error } = await supabase
      .from('game_sessions')
      .insert({
        user_id:    userId,
        game_name:  'breath_belt',
        study_id:   studyId,
        is_test:    false,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('belt_session start:', error);
      return null;
    }
    sessionIdRef.current = data.id;
    trialsRef.current    = [];
    return data.id;
  }, [userId]);

  // Call once per trial (both phase 2 and phase 3)
  const recordTrial = useCallback((trialRow) => {
    trialsRef.current.push(trialRow);
  }, []);

  // Call at session end — flush everything to Supabase
  const endSession = useCallback(async ({
    calibState,
    questState,        // serialised 2-staircase posteriors (null if no phase 3)
    rawAccelRows,
    rawHRRows,
  }) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    // ── 1. Upload raw data to Storage ──────────────────────────────────
    const csv = `=== ACCEL ===\n${buildAccelCsv(rawAccelRows)}\n\n=== HR ===\n${buildHRCsv(rawHRRows)}`;
    const storagePath = `${userId}/${sessionId}_raw.csv`;
    const { error: storageError } = await supabase.storage
      .from('belt-sessions')
      .upload(storagePath, new Blob([csv], { type: 'text/csv' }), { upsert: true });
    if (storageError) console.error('belt storage upload:', storageError);

    // ── 2. Insert belt_sessions row ────────────────────────────────────
    const { error: sessError } = await supabase.from('belt_sessions').insert({
      session_id:   sessionId,
      user_id:      userId,
      calib_state:  calibState,
      storage_path: storagePath,
      quest_state:  questState ?? null,
    });
    if (sessError) console.error('belt_sessions insert:', sessError);

    // ── 3. Insert belt_trials rows ─────────────────────────────────────
    if (trialsRef.current.length) {
      const rows = trialsRef.current.map(t => ({
        ...t,
        session_id: sessionId,
        user_id:    userId,
      }));
      const { error: trialError } = await supabase.from('belt_trials').insert(rows);
      if (trialError) console.error('belt_trials insert:', trialError);
    }

    // ── 4. Close game_sessions row ─────────────────────────────────────
    await supabase
      .from('game_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);
  }, [userId]);

  return { sessionIdRef, startSession, recordTrial, endSession };
}

// ── CSV builders ──────────────────────────────────────────────────────────

function buildAccelCsv(rows) {
  const header = 'phase,trial,packet_timestamp,sample_index,x,y,z';
  const body   = rows.map(r =>
    [r.phase, r.trial, r.packetTimestamp, r.sampleIndex, r.x, r.y, r.z].join(',')
  ).join('\n');
  return `${header}\n${body}`;
}

function buildHRCsv(rows) {
  const header = 'phase,trial,timestamp,heart_rate';
  const body   = rows.map(r =>
    [r.phase, r.trial, r.timestamp, r.heartRate].join(',')
  ).join('\n');
  return `${header}\n${body}`;
}
