import { useRef, useCallback } from 'react'

// ── useStreamingBackup ────────────────────────────────────────────────────
//
// Parallel local CSV backup via File System Access API.
// Runs alongside Supabase writes — does not replace them.
// Degrades gracefully if API unavailable (non-Chrome) or user cancels picker.

export function useStreamingBackup() {
  const handlesRef   = useRef(null)
  const availableRef = useRef(typeof window !== 'undefined' && 'showDirectoryPicker' in window)

  const initBackup = useCallback(async (participantId) => {
    if (!availableRef.current) return false
    try {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' })
      const ts  = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
      const pfx = `${participantId}_${ts}`

      const accel  = await dir.getFileHandle(`${pfx}_accel.csv`,  { create: true })
      const hr     = await dir.getFileHandle(`${pfx}_hr.csv`,     { create: true })
      const trials = await dir.getFileHandle(`${pfx}_trials.csv`, { create: true })
      const quest  = await dir.getFileHandle(`${pfx}_quest.csv`,  { create: true })

      await _append(accel,  'phase,trial,packet_ts,sample_idx,x,y,z,pacer_radius\n')
      await _append(hr,     'phase,trial,timestamp,heart_rate\n')
      await _append(trials,
        'phase,trial,condition,base_period_s,change_period_s,start_ms,end_ms,' +
        'peak_error_ms,bt_baseline_period_ms,bt_condition_period_ms,' +
        'trial_r_baseline,trial_r_condition\n'
      )
      await _append(quest,  'trial,direction,delta_s,response,correct,confidence,arousal,posterior_mean_log,posterior_sd\n')

      handlesRef.current = { accel, hr, trials, quest }
      return true
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('Streaming backup unavailable:', err)
      return false
    }
  }, [])

  const flushAccel = useCallback(async (rows) => {
    if (!handlesRef.current || !rows.length) return
    const lines = rows.map(r =>
      [
        r.phase, r.trial, r.packetTimestamp, r.sampleIndex,
        r.x.toFixed(4), r.y.toFixed(4), r.z.toFixed(4),
        isNaN(r.pacerRadius) ? '' : r.pacerRadius.toFixed(4),
      ].join(',')
    ).join('\n') + '\n'
    await _append(handlesRef.current.accel, lines)
  }, [])

  const flushHR = useCallback(async (rows) => {
    if (!handlesRef.current || !rows.length) return
    const lines = rows.map(r =>
      [r.phase, r.trial, r.timestamp, r.heartRate].join(',')
    ).join('\n') + '\n'
    await _append(handlesRef.current.hr, lines)
  }, [])

  const appendTrial = useCallback(async (row) => {
    if (!handlesRef.current) return
    const line = [
      row.phase            ?? '',
      row.trial_number     ?? '',
      row.condition        ?? '',
      row.base_period_s    != null ? row.base_period_s.toFixed(3)    : '',
      row.change_period_s  != null ? row.change_period_s.toFixed(3)  : '',
      row.start_ms         ?? '',
      row.end_ms           ?? '',
      row.peak_error_ms    != null && isFinite(row.peak_error_ms) ? Math.round(row.peak_error_ms) : '',
      row.bt_baseline_period_ms  != null ? Math.round(row.bt_baseline_period_ms)  : '',
      row.bt_condition_period_ms != null ? Math.round(row.bt_condition_period_ms) : '',
      row.trial_r_baseline  != null ? row.trial_r_baseline.toFixed(4)  : '',
      row.trial_r_condition != null ? row.trial_r_condition.toFixed(4) : '',
    ].join(',') + '\n'
    await _append(handlesRef.current.trials, line)
  }, [])

  const appendQuest = useCallback(async (row) => {
    if (!handlesRef.current) return
    const line = [
      row.trial_number      ?? '',
      row.condition         ?? '',
      row.delta_s           != null ? row.delta_s.toFixed(4)           : '',
      row.response          ?? '',
      row.correct ? 1 : 0,
      row.confidence        ?? '',
      row.arousal           ?? '',
      row.posterior_mean_log != null ? row.posterior_mean_log.toFixed(4) : '',
      row.posterior_sd       != null ? row.posterior_sd.toFixed(4)       : '',
    ].join(',') + '\n'
    await _append(handlesRef.current.quest, line)
  }, [])

  const isAvailable = availableRef.current
  const isReady     = () => handlesRef.current !== null

  return { initBackup, flushAccel, flushHR, appendTrial, appendQuest, isAvailable, isReady }
}

async function _append(handle, text) {
  try {
    const file     = await handle.getFile()
    const writable = await handle.createWritable({ keepExistingData: true })
    await writable.seek(file.size)
    await writable.write(text)
    await writable.close()
  } catch (err) {
    console.error('Backup write error:', err)
  }
}
