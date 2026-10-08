// Admin "Quick demo" mode: /games/<slug>?demo=1 (linked from /admin/games)
// cuts a game's session timer to DEMO_SECS so reviewers can reach the results
// screen without playing the full session. Games must ignore it in study mode.
export const DEMO_SECS = 20

// Task previews (website.md §25a) switch it on without a query string, so a
// short-timer preview link stays a plain /preview/<token>.
let override = false
export function setDemoOverride(on) { override = !!on }

export function isDemoMode() {
  return override || new URLSearchParams(window.location.search).get('demo') === '1'
}
