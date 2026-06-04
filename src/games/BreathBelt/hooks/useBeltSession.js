import { useRef, useCallback } from 'react';
import { supabase as globalSupabase } from '../../../lib/supabase';

// `client` is the participant-authenticated Supabase client in a study session
// (so RLS auth.uid() = user_id is satisfied); falls back to the global client
// for normal self-serve play.
export function useBeltSession(userId, client) {
  const db = client ?? globalSupabase;
  const sessionIdRef        = useRef(null);
  const trialsRef           = useRef([]);
  const flushedCountRef     = useRef(0);   // how many of trialsRef have been written to Supabase
  const participantEidRef   = useRef(null); // participant_external_id set at startSession

  const startSession = useCallback(async (studyId = null, externalId = null) => {
    const { data, error } = await db
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
    if (error) { console.error('belt session start:', error); return null; }
    sessionIdRef.current      = data.id;
    trialsRef.current         = [];
    flushedCountRef.current   = 0;
    participantEidRef.current = externalId ?? null;
    return data.id;
  }, [userId, db]);

  const recordTrial = useCallback((trialRow) => {
    trialsRef.current.push(trialRow);
  }, []);

  // Incrementally persist any not-yet-written trials. Call at phase boundaries
  // so a crash or timeout mid-session still leaves completed trials in Supabase.
  // INSERT-only (belt_trials has no UPDATE policy); the flushedCount cursor only
  // advances on success, so a failed flush is retried at the next checkpoint /
  // at endSession — and nothing is ever double-inserted.
  const flushTrials = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const pending = trialsRef.current.slice(flushedCountRef.current);
    if (!pending.length) return;
    const { error } = await db.from('belt_trials').insert(
      pending.map(t => ({ ...t, session_id: sessionId, user_id: userId, participant_external_id: participantEidRef.current }))
    );
    if (error) { console.error('belt_trials flush:', error); return; }
    flushedCountRef.current += pending.length;
  }, [userId, db]);

  const endSession = useCallback(async ({
    calibState,
    questState,
    rawAccelRows,
    rawHRRows,
    sessionNumber,
    baselinePeriodMs,
    postBaselinePeriodMs,
    triggerDevice,
    participantExternalId,
    convergence,
    sessionStartEpochMs,
    phase2StartMs,
    phase2EndMs,
    phase3StartMs,
    phase3EndMs,
  }) => {
    // Prefer the value passed at endSession (most up-to-date); fall back to
    // what was set at startSession in case the caller doesn't re-pass it.
    const eid = participantExternalId ?? participantEidRef.current ?? null;
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    // 1. Upload accel + HR as separate CSVs, mirroring the local backup naming.
    //    storage_path holds the base (no suffix); blobs land at base + '_accel.csv' / '_hr.csv'.
    const basePath  = `${userId}/${sessionId}`;
    const accelPath = `${basePath}_accel.csv`;
    const hrPath    = `${basePath}_hr.csv`;

    const accelUpload = db.storage.from('belt-sessions').upload(
      accelPath, new Blob([buildAccelCsv(rawAccelRows)], { type: 'text/csv' }), { upsert: true }
    );
    const hrUpload = db.storage.from('belt-sessions').upload(
      hrPath, new Blob([buildHRCsv(rawHRRows)], { type: 'text/csv' }), { upsert: true }
    );
    const [{ error: accelErr }, { error: hrErr }] = await Promise.all([accelUpload, hrUpload]);
    if (accelErr) console.error('belt accel storage upload:', accelErr);
    if (hrErr)    console.error('belt hr storage upload:',    hrErr);

    // 2. Insert belt_sessions row — calib metrics flattened from calibState JSON
    //    into the scalar columns added by belt_mlr_migration.sql.
    const { error: sessError } = await db.from('belt_sessions').insert({
      session_id:               sessionId,
      user_id:                  userId,
      participant_external_id:  eid,
      calib_state:              calibState,
      storage_path:             basePath,
      quest_state:              questState ?? null,
      session_number:           sessionNumber ?? 1,
      trigger_device:           triggerDevice ?? null,
      baseline_period_ms:       baselinePeriodMs ?? null,
      post_baseline_period_ms:  postBaselinePeriodMs ?? null,
      calib_model_label:        calibState?.modelLabel ?? null,
      calib_fit_r:              calibState?.fitR       ?? null,
      calib_lag_ms:             calibState?.lagMs      ?? null,
      thresh_faster_log10:      convergence?.faster != null ? Math.log10(convergence.faster.meanDeltaSec) : null,
      thresh_slower_log10:      convergence?.slower != null ? Math.log10(convergence.slower.meanDeltaSec) : null,
      thresh_sd_faster:         convergence?.faster?.sd ?? null,
      thresh_sd_slower:         convergence?.slower?.sd ?? null,
      session_start_epoch_ms:   sessionStartEpochMs ?? null,
      phase2_start_ms:          phase2StartMs ?? null,
      phase2_end_ms:            phase2EndMs   ?? null,
      phase3_start_ms:          phase3StartMs ?? null,
      phase3_end_ms:            phase3EndMs   ?? null,
    });
    if (sessError) console.error('belt_sessions insert:', sessError);

    // 3. Insert any belt_trials not already flushed at a phase boundary.
    const remaining = trialsRef.current.slice(flushedCountRef.current);
    if (remaining.length) {
      const { error: trialError } = await db.from('belt_trials').insert(
        remaining.map(t => ({ ...t, session_id: sessionId, user_id: userId, participant_external_id: eid }))
      );
      if (trialError) console.error('belt_trials insert:', trialError);
      else flushedCountRef.current += remaining.length;
    }

    // 4. Close game_sessions row
    await db
      .from('game_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);
  }, [userId, db]);

  return { sessionIdRef, startSession, recordTrial, flushTrials, endSession };
}

function fmtNum(v, digits = 4) {
  return (v == null || Number.isNaN(v)) ? '' : Number(v).toFixed(digits);
}

function buildAccelCsv(rows) {
  const header = 'phase,trial,packet_timestamp,sample_index,x,y,z,pacer_radius';
  const body   = rows.map(r =>
    [r.phase, r.trial, r.packetTimestamp, r.sampleIndex,
     fmtNum(r.x), fmtNum(r.y), fmtNum(r.z), fmtNum(r.pacerRadius)].join(',')
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
