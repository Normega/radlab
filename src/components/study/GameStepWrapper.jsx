import AptitudeSuite from '../../games/AptitudeSuite/AptitudeSuite'
import BreathBelt    from '../../games/BreathBelt/BreathBelt'

const GAME_COMPONENTS = {
  aptitude_suite: AptitudeSuite,
  breath_belt:    BreathBelt,
}

export default function GameStepWrapper({ slug, enrollment, onComplete }) {
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
      userId={enrollment.user_id}
      studyId={enrollment.study_id}
      onSessionComplete={result => onComplete({ game_slug: slug, ...result })}
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
