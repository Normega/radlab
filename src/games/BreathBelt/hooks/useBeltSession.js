import { useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

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
    if (error) { console.error('belt session start:', error); return null; }
    sessionIdRef.current = data.id;
    trialsRef.current    = [];
    return data.id;
  }, [userId]);

  const recordTrial = useCallback((trialRow) => {
    trialsRef.current.push(trialRow);
  }, []);

  const endSession = useCallback(async ({
    calibState,
    questState,
    rawAccelRows,
    rawHRRows,
    sessionNumber,
    baselinePeriodMs,
    postBaselinePeriodMs,
  }) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    // 1. Upload accel + HR as separate CSVs, mirroring the local backup naming.
    //    storage_path holds the base (no suffix); blobs land at base + '_accel.csv' / '_hr.csv'.
    const basePath  = `${userId}/${sessionId}`;
    const accelPath = `${basePath}_accel.csv`;
    const hrPath    = `${basePath}_hr.csv`;

    const accelUpload = supabase.storage.from('belt-sessions').upload(
      accelPath, new Blob([buildAccelCsv(rawAccelRows)], { type: 'text/csv' }), { upsert: true }
    );
    const hrUpload = supabase.storage.from('belt-sessions').upload(
      hrPath, new Blob([buildHRCsv(rawHRRows)], { type: 'text/csv' }), { upsert: true }
    );
    const [{ error: accelErr }, { error: hrErr }] = await Promise.all([accelUpload, hrUpload]);
    if (accelErr) console.error('belt accel storage upload:', accelErr);
    if (hrErr)    console.error('belt hr storage upload:',    hrErr);

    // 2. Insert belt_sessions row — calib metrics flattened from calibState JSON
    //    into the scalar columns added by belt_mlr_migration.sql.
    const { error: sessError } = await supabase.from('belt_sessions').insert({
      session_id:              sessionId,
      user_id:                 userId,
      calib_state:             calibState,
      storage_path:            basePath,
      quest_state:             questState ?? null,
      session_number:          sessionNumber ?? 1,
      baseline_period_ms:      baselinePeriodMs ?? null,
      post_baseline_period_ms: postBaselinePeriodMs ?? null,
      calib_model_label:       calibState?.modelLabel ?? null,
      calib_fit_r:             calibState?.fitR       ?? null,
      calib_lag_ms:            calibState?.lagMs      ?? null,
    });
    if (sessError) console.error('belt_sessions insert:', sessError);

    // 3. Insert belt_trials rows
    if (trialsRef.current.length) {
      const { error: trialError } = await supabase.from('belt_trials').insert(
        trialsRef.current.map(t => ({ ...t, session_id: sessionId, user_id: userId }))
      );
      if (trialError) console.error('belt_trials insert:', trialError);
    }

    // 4. Close game_sessions row
    await supabase
      .from('game_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);
  }, [userId]);

  return { sessionIdRef, startSession, recordTrial, endSession };
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
