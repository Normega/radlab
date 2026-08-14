import Nav from '../../components/Nav'
import { TRIAL_ICONS } from '../../games/shared/GameIcon'
import GameIntro from '../../games/shared/GameIntro'

/**
 * Dev-only trial of three game icons at the three sizes they'd actually be used
 * at, plus in the two real contexts (a card row and an instruction screen).
 * Route: /dev/game-icons.
 *
 * The point is the 24px column and the no-plate row — a set that only works at
 * 116px on its own tinted disc has not been tested.
 */
export default function GameIconTrial() {
  if (!import.meta.env.DEV) return <div style={{ padding: 40 }}>Dev only.</div>

  // JSX needs a capitalised binding — TRIAL_ICONS[0].Icon inline renders nothing.
  const PondIcon = TRIAL_ICONS[0].Icon

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={null} />
      <div style={S.page}>
        <h1 style={S.h1}>Game icons — trial of three</h1>
        <p style={S.sub}>
          One harvested from existing game art, one abstract, one figurative. Shown at every
          size they would be used at, with and without the tinted plate, on both grounds.
        </p>

        <p style={S.label}>Sizes — 116 (card slot) · 60 (instruction step) · 24 (badge)</p>
        <div style={S.panel}>
          {TRIAL_ICONS.map(({ slug, title, note, Icon }) => (
            <div key={slug} style={S.row}>
              <div style={S.rowMeta}>
                <div style={S.rowTitle}>{title}</div>
                <div style={S.rowNote}>{note}</div>
              </div>
              <div style={S.sizes}>
                <Icon size={116} />
                <Icon size={60} />
                <Icon size={24} />
              </div>
            </div>
          ))}
        </div>

        <p style={S.label}>No plate — do they hold their own shape?</p>
        <div style={{ ...S.panel, display: 'flex', gap: 32, alignItems: 'center' }}>
          {TRIAL_ICONS.map(({ slug, Icon }) => <Icon key={slug} size={72} plate={false} />)}
          {TRIAL_ICONS.map(({ slug, Icon }) => <Icon key={slug + '-s'} size={24} plate={false} />)}
        </div>

        <p style={S.label}>On the tinted ground, as a card row would sit</p>
        <div style={{ ...S.panel, background: 'var(--bgp)', display: 'flex', gap: 24, alignItems: 'center' }}>
          {TRIAL_ICONS.map(({ slug, title, Icon }) => (
            <div key={slug} style={S.card}>
              <Icon size={64} />
              <div style={S.cardTitle}>{title}</div>
              <div style={S.cardTag}>Attention · Timing</div>
            </div>
          ))}
        </div>

        <p style={S.label}>In an instruction screen, at step size</p>
        <div style={S.panel}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GameIntro
              maxWidth={460}
              title={<>Watch the pond.<br />React to ducks.</>}
              lead={<>One creature means go, everything else means hold.<br />Your brain will try to answer for you.</>}
              visual={<div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}><PondIcon size={88} /></div>}
              steps={[
                { title: 'Duck → respond', body: 'Press space or tap the button.' },
                { title: 'Anything else → wait', body: 'Heron, frog, fish, or ripple — stay still.' },
              ]}
              note="60 trials · about 5 minutes"
              cta="Start watching"
              onStart={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  page:      { maxWidth: 900, margin: '0 auto', padding: '32px 24px 80px' },
  h1:        { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 8px' },
  sub:       { fontSize: 14, color: 'var(--tx2)', margin: '0 0 32px', lineHeight: 1.5, maxWidth: 620 },
  label:     { fontFamily: '"Space Mono", monospace', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx2)', margin: '28px 0 10px' },
  panel:     { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24 },
  row:       { display: 'flex', alignItems: 'center', gap: 24, padding: '16px 0', borderTop: '1px solid var(--bd)' },
  rowMeta:   { width: 200, flexShrink: 0 },
  rowTitle:  { fontSize: 14, fontWeight: 600, color: 'var(--tx)' },
  rowNote:   { fontSize: 12, color: 'var(--tx2)', lineHeight: 1.4 },
  sizes:     { display: 'flex', alignItems: 'center', gap: 20 },
  card:      { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16, width: 160, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' },
  cardTitle: { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 20, color: 'var(--tx)' },
  cardTag:   { fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'var(--tx2)' },
}
