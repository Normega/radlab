import Alongside from '../../games/Alongside/Alongside'

/**
 * Unauthenticated preview of the Alongside game, following the same pattern as
 * the other `/dev/*` previews. The game itself is behind `ProtectedRoute`, so
 * without this there is no way to look at the intro screen, the meadow or the
 * summary without signing in — which makes art and copy passes needlessly slow.
 *
 * `session` is null here: the game already treats a missing user as "do not
 * write a game_sessions row" and plays exactly the same.
 */
export default function AlongsidePreview() {
  return <Alongside session={null} />
}
