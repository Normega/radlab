// Admin "Quick demo" mode: /games/<slug>?demo=1 (linked from /admin/games)
// cuts a game's session timer to DEMO_SECS so reviewers can reach the results
// screen without playing the full session. Games must ignore it in study mode.
export const DEMO_SECS = 20

export function isDemoMode() {
  return new URLSearchParams(window.location.search).get('demo') === '1'
}
