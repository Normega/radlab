import AptitudeSuite from '../../games/AptitudeSuite/AptitudeSuite'
import BreathBelt    from '../../games/BreathBelt/BreathBelt'
import StillWater    from '../../games/StillWater/StillWater'

const GAME_COMPONENTS = {
  aptitude_suite: AptitudeSuite,
  breath_belt:    BreathBelt,
  still_water:    StillWater,
}

export default function GameStepWrapper({ slug, enrollment, onComplete, supabaseClient, isSimMode = false }) {
  const GameComponent = GAME_COMPONENTS[slug]

  if (!GameComponent) {
    return (
      <div style={S.err}>
        Unknown game: <code>{slug}</code>. Check the protocol configuration.
      </div>
    )
  }

  return (
    <GameComponent
      studyMode
      userId={enrollment.profile_id ?? enrollment.user_id}
      studyId={enrollment.studies?.id ?? enrollment.study_id}
      externalId={enrollment.external_id}
      onSessionComplete={result => onComplete({ game_slug: slug, ...result })}
      supabaseClient={supabaseClient}
      isSimMode={isSimMode}
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
