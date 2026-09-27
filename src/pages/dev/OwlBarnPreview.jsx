import OwlBarn from '../../games/Safari/owlbarn/OwlBarn'

/**
 * Unauthenticated preview of the Night Safari Owl Barn, on the pattern of the
 * other `/dev/*` game previews (SidelongPreview). `session` is null, so the
 * game plays exactly the same and writes nothing.
 */
export default function OwlBarnPreview() {
  return <OwlBarn session={null} />
}
