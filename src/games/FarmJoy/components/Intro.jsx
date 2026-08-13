import GameIntro from '../../shared/GameIntro'

/**
 * Farm Joy's intro sits on the farm scene itself rather than the page ground,
 * so it takes GameIntro's dark tone. The three steps are the game's own
 * sentence broken apart — it previously ran as one paragraph with no card,
 * which was the only intro on the platform with no instructions in it.
 * (Reorganised 2026-08-13; wording is Farm Joy's own, pending Norm's copy pass.)
 */
export default function Intro({ onStart }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: '32px 24px',
      textAlign: 'center', gap: 20,
    }}>
      <GameIntro
        tone="dark"
        eyebrow="RADlab · Farm Joy"
        title="What do you want to grow?"
        lead="Pull plants from the field. Each one reveals a value."
        /* Soil emoji stand-in until veggie PNGs arrive */
        visual={<div style={{ fontSize: 64, lineHeight: 1, marginBottom: 20 }}>🌱</div>}
        steps={[
          { title: 'Pull a plant', body: 'Every plant in the field hides a value. Pull it up to see which one.' },
          { title: 'Keep or compost', body: 'Keep what feels right. Compost what doesn’t. There is no wrong answer here.' },
          { title: 'Narrow it down', body: 'Round by round the field thins, until what’s left is what you most want to cultivate — then harvest.' },
        ]}
        cta="Visit the farm"
        onStart={onStart}
      />
    </div>
  )
}
