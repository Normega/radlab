// v1 — manifest of the variables each element type produces on step completion.
// Powers the variable picker in the display editor and documents the
// session-context naming convention:
//
//   {{<slot>}}                  — condition arm from draw_assignment (e.g. {{condition}})
//   {{slider.<slug>.value}}     — slider step output
//   {{vas.<slug>.value}}        — VAS step output
//   {{game.<slug>.<key>}}       — game onSessionComplete payload key
//
// Games list only what their onSessionComplete actually reports. When a game's
// payload changes, update it here so the picker stays honest.

export const GAME_OUTPUTS = {
  aptitude_suite: [
    'anagram_score', 'anagram_pct',
    'fluency_score', 'fluency_pct',
    'wordprobe_score', 'wordprobe_pct',
    'avg_pct', 'task_switch_count',
  ],
  word_max:  ['total_score', 'sets_completed', 'duration_ms'],
  color_max: ['avg_coverage', 'avg_precision', 'images_attempted', 'total_secs'],
  still_water: [],   // reports no outputs
  breath_belt: [],   // physio data lands in belt_sessions, not step outputs
}

/** Flat list of {{token}} strings for a set of games. */
export function gameVariableTokens(slugs = Object.keys(GAME_OUTPUTS)) {
  return slugs.flatMap(slug =>
    (GAME_OUTPUTS[slug] ?? []).map(key => `{{game.${slug}.${key}}}`)
  )
}
