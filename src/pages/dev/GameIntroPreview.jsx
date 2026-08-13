import GameIntro from '../../games/shared/GameIntro'
import Nav from '../../components/Nav'

/**
 * Dev-only preview of the shared game instruction screen in every shape the ten
 * games ask of it. Route: /dev/game-intros — guards with import.meta.env.DEV
 * like UiKit and VideoTest.
 *
 * The games themselves sit behind ProtectedRoute, so this is the only way to
 * eyeball all the variants side by side without ten logins.
 */
export default function GameIntroPreview() {
  if (!import.meta.env.DEV) return <div style={{ padding: 40 }}>Dev only.</div>

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={null} />
      <div style={S.page}>
        <h1 style={S.h1}>Game intros — shared GameIntro</h1>
        <p style={S.sub}>
          Every game&rsquo;s instruction screen, one component. Each panel below is the
          real thing with that game&rsquo;s props.
        </p>

        <Case label="Default — Delve">
          <GameIntro
            title="Delve."
            lead={<>An image waits behind haze.<br />This is a practice in letting attention settle — not in finding anything.</>}
            steps={[
              { title: 'Rest, don’t search', body: 'Let your cursor settle somewhere — or rest a finger on the screen. Held still, that spot slowly comes clear.' },
              { title: 'Movement reveals nothing', body: 'Quick scanning keeps the haze in place. There is no correct place to look.' },
              { title: 'Nothing to complete', body: 'What you’ve seen drifts back to haze after a while. Stay as long as you like — a quiet finish button waits in the corner.' },
            ]}
            onStart={() => {}}
          />
        </Case>

        <Case label="With a note under the card — Alongside">
          <GameIntro
            title="Alongside."
            lead={<>Something is moving through the meadow.<br />This is a practice in keeping company — not in catching anything.</>}
            steps={[
              { title: 'Hold to walk', body: 'Press and hold anywhere; you drift toward it. Let go to stop.' },
              { title: 'It cannot be caught', body: 'Go straight at the light and it scatters into mist and gathers again further off.' },
              { title: 'Walk beside it instead', body: 'Stay near, at its pace, and something settles between you.' },
            ]}
            note="Sound on, if you can — most of what tells you how you are doing is in it."
            onStart={() => {}}
          />
        </Case>

        <Case label="Per-step colours — Still Water">
          <GameIntro
            title="How are you arriving?"
            lead={<>Two quick questions about how you feel.<br />We&rsquo;ll combine your answers into one picture.</>}
            steps={[
              { numBg: '#FFF0B8', numColor: '#D88000', title: 'Sad to Excited', body: 'How good or energised are you feeling?' },
              { numBg: '#EDE0F4', numColor: '#804080', title: 'Calm to Tense',  body: 'How settled or on-edge are you feeling?' },
            ]}
            onStart={() => {}}
          />
        </Case>

        <Case label="Icons instead of numbers — Pond Watch">
          <GameIntro
            maxWidth={460}
            title={<>Watch the pond.<br />React to ducks.</>}
            lead={<>One creature means go, everything else means hold.<br />Your brain will try to answer for you.</>}
            steps={[
              { icon: <Blob c="#e8c47a" />, title: 'Duck → respond', body: 'Press space or tap the button.' },
              { icon: <Blob c="#8fb8d8" />, title: 'Anything else → wait', body: 'Heron, frog, fish, or ripple — stay still.' },
            ]}
            note="60 trials · about 5 minutes"
            cta="Start watching"
            onStart={() => {}}
          />
        </Case>

        <Case label="Dark tone — Farm Joy" dark>
          <GameIntro
            tone="dark"
            eyebrow="RADlab · Farm Joy"
            title="What do you want to grow?"
            lead="Pull plants from the field. Each one reveals a value."
            visual={<div style={{ fontSize: 64, lineHeight: 1, marginBottom: 20 }}>🌱</div>}
            steps={[
              { title: 'Pull a plant', body: 'Every plant in the field hides a value. Pull it up to see which one.' },
              { title: 'Keep or compost', body: 'Keep what feels right. Compost what doesn’t.' },
              { title: 'Narrow it down', body: 'Round by round the field thins — then harvest.' },
            ]}
            cta="Visit the farm"
            onStart={() => {}}
          />
        </Case>

        <Case label="Header only, CTA elsewhere — Contact">
          <GameIntro
            title="Contact."
            lead="Your Ripple is waiting. Begin breathing to make contact."
            ctaHidden
          />
        </Case>
      </div>
    </div>
  )
}

function Blob({ c }) {
  return <span style={{ width: 60, height: 60, borderRadius: '50%', background: c, flexShrink: 0, display: 'block' }} />
}

function Case({ label, dark = false, children }) {
  return (
    <section style={S.case}>
      <p style={S.caseLabel}>{label}</p>
      <div style={{ ...S.stage, background: dark ? '#2b3a21' : 'var(--bg)' }}>
        {children}
      </div>
    </section>
  )
}

const S = {
  page:      { maxWidth: 900, margin: '0 auto', padding: '32px 24px 80px' },
  h1:        { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 8px' },
  sub:       { fontSize: 14, color: 'var(--tx2)', margin: '0 0 32px', lineHeight: 1.5 },
  case:      { marginBottom: 28 },
  caseLabel: { fontFamily: '"Space Mono", monospace', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 10px' },
  stage:     { border: '1px solid var(--bd)', borderRadius: 12, padding: 28, display: 'flex', justifyContent: 'center' },
}
