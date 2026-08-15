import Sidelong from '../../games/Sidelong/Sidelong'

/**
 * Unauthenticated preview of the Sidelong game, following the same pattern as
 * the other `/dev/*` previews (AlongsidePreview). The game itself is behind
 * `ProtectedRoute`, so without this there is no way to look at the intro
 * screen, the night sky or the summary without signing in — which makes art
 * and copy passes needlessly slow.
 *
 * `session` is null here: the game already treats a missing user as "do not
 * write a game_sessions row" and plays exactly the same.
 */
export default function SidelongPreview() {
  return <Sidelong session={null} />
}
