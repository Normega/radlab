// Export columns for a sensing-pause record (SensingPauseOffer, Sense Foraging
// Study 2b's behavioural criterion). The record is one object per offer; left to
// the generic flattening it became a single JSON cell, which nobody can analyse
// in a spreadsheet. Here each recorded fact gets its own column, named by what it
// is, with durations in seconds.
//
// Nothing is derived: whether a pause "counts" (taken, >= 20 s on the page, time
// away under half) is the preregistration's rule, applied in the analysis, not a
// fact the platform recorded.

export function isSensingPauseRecord(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
    && v.v === 1 && 'slot' in v && 'choice' in v
}

const secs = ms => (ms == null || ms === '' ? '' : Math.round(Number(ms) / 100) / 10)

// [column suffix, value] pairs, in a fixed order so every participant's row has
// the same columns whether or not they took the pause.
export function sensingPauseColumns(rec) {
  const p = rec?.pause ?? null
  return [
    ['choice', rec?.choice ?? ''],
    ['decision_s', secs(rec?.decision_ms)],
    ['decline_reason', rec?.decline_reason ?? ''],
    ['total_s', secs(p?.total_ms)],
    ['on_page_s', secs(p?.on_page_ms)],
    ['unfocused_s', secs(p?.unfocused_ms)],
    ['hidden_s', secs(p?.hidden_ms)],
    ['hidden_episodes', p?.hidden_episodes ?? ''],
    ['unfocused_episodes', p?.unfocused_episodes ?? ''],
    ['taps', p?.taps ?? ''],
    ['keys', p?.keys ?? ''],
    ['scrolls', p?.scrolls ?? ''],
    ['ended_by', p?.ended_by ?? ''],
    ['nudged', p == null ? '' : (p.nudged === true ? 1 : 0)],
    ['note', rec?.note ?? ''],
    ['setting', rec?.setting ?? ''],
    ['tired', rec?.tired ?? ''],
    ['device', rec?.device ?? ''],
    ['viewport_w', rec?.viewport_w ?? ''],
    ['local_hour', rec?.local_hour ?? ''],
    ['button_side', rec?.pause_button_side ?? ''],
    ['slot', rec?.slot ?? ''],
  ]
}
