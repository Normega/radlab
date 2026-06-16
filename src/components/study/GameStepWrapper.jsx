import AptitudeSuite from '../../games/AptitudeSuite/AptitudeSuite'
import BreathBelt    from '../../games/BreathBelt/BreathBelt'
import ColorMax      from '../../games/ColorMax/ColorMax'
import StillWater    from '../../games/StillWater/StillWater'
import WordMax       from '../../games/WordMax/WordMax'
import { usePhysioContext } from './PhysioContext'

const GAME_COMPONENTS = {
  aptitude_suite: AptitudeSuite,
  breath_belt:    BreathBelt,
  color_max:      ColorMax,
  still_water:    StillWater,
  word_max:       WordMax,
}

// Games that should receive the physio context when it is available
const PHYSIO_AWARE_SLUGS = new Set(['breath_belt', 'still_water'])

export default function GameStepWrapper({ slug, enrollment, onComplete, supabaseClient, isSimMode = false }) {
  const physio = usePhysioContext()   // null if not inside a PhysioProvider
  const GameComponent = GAME_COMPONENTS[slug]

  if (!GameComponent) {
    return (
      <div style={S.err}>
        Unknown game: <code>{slug}</code>. Check the protocol configuration.
      </div>
    )
  }

  const physioProps = PHYSIO_AWARE_SLUGS.has(slug) ? { physio: physio ?? null } : {}

  return (
    <GameComponent
      studyMode
      userId={enrollment.profile_id ?? enrollment.user_id}
      studyId={enrollment.studies?.id ?? enrollment.study_id}
      externalId={enrollment.external_id}
      onSessionComplete={result => onComplete({ game_slug: slug, ...result })}
      supabaseClient={supabaseClient}
      isSimMode={isSimMode}
      {...physioProps}
    />
  )
}

const S = {
  err: {
    padding: 40,
    textAlign: 'center',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    color: '#e04',
    fontSize: 14,
  },
}
