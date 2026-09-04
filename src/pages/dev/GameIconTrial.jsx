import Nav from '../../components/Nav'
import GameIcon, { GAME_ICONS } from '../../games/shared/GameIcon'
import GameIntro from '../../games/shared/GameIntro'
import { GAMES, DEV_GAMES } from '../../data/games'

/**
 * Dev-only review of the whole game-icon set at the three sizes they're used
 * at, plus in the two real contexts. Route: /dev/game-icons.
 *
 * The 24px column and the no-plate row are the point — a set that only works at
 * 116px on its own tinted disc has not been tested.
 */
const ALL = [...GAMES, ...DEV_GAMES].filter(g => GAME_ICONS[g.slug])

export default function GameIconTrial() {
  if (!import.meta.env.DEV) return <div style={{ padding: 40 }}>Dev only.</div>

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={null} />
      <div style={S.page}>
        <h1 style={S.h1}>Game icons</h1>
        <p style={S.sub}>
          All {ALL.length}, in catalog order. Each takes its palette from its own game&rsquo;s art
          rather than the brand pink, so the set is checked for adjacent-hue separation rather
          than sitting on one ramp.
        </p>

        <p style={S.label}>The set at badge size — the row that decides it</p>
        <div style={{ ...S.panel, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {ALL.map(g => <GameIcon key={g.slug} slug={g.slug} size={24} />)}
          <span style={S.spacer} />
          {ALL.map(g => <GameIcon key={g.slug + '-np'} slug={g.slug} size={24} plate={false} />)}
        </div>

        <p style={S.label}>Sizes — 116 (card slot) · 60 (instruction step) · 24 (badge)</p>
        <div style={S.panel}>
          {ALL.map(g => (
            <div key={g.slug} style={S.row}>
              <div style={S.rowMeta}>
                <div style={S.rowTitle}>{g.title}</div>
                <div style={S.rowNote}>{g.badge ?? 'in development'}</div>
              </div>
              <div style={S.sizes}>
                <GameIcon slug={g.slug} size={116} />
                <GameIcon slug={g.slug} size={60} />
                <GameIcon slug={g.slug} size={24} />
                <GameIcon slug={g.slug} size={60} plate={false} />
              </div>
            </div>
          ))}
        </div>

        <p style={S.label}>On the tinted ground, as a card grid would sit</p>
        <div style={{ ...S.panel, background: 'var(--bgp)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {ALL.map(g => (
            <div key={g.slug} style={S.card}>
              <GameIcon slug={g.slug} size={64} />
              <div style={S.cardTitle}>{g.title}</div>
              <div style={S.cardTag}>{g.badge ?? 'In development'}</div>
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
              visual={<div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}><GameIcon slug="pond_watch" size={88} /></div>}
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
  sub:       { fontSize: 14, color: 'var(--tx2)', margin: '0 0 32px', lineHeight: 1.5, maxWidth: 640 },
  label:     { fontFamily: '"Space Mono", monospace', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx2)', margin: '28px 0 10px' },
  panel:     { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24 },
  spacer:    { width: 24, display: 'inline-block' },
  row:       { display: 'flex', alignItems: 'center', gap: 24, padding: '14px 0', borderTop: '1px solid var(--bd)' },
  rowMeta:   { width: 190, flexShrink: 0 },
  rowTitle:  { fontSize: 14, fontWeight: 600, color: 'var(--tx)' },
  rowNote:   { fontSize: 12, color: 'var(--tx2)', lineHeight: 1.4 },
  sizes:     { display: 'flex', alignItems: 'center', gap: 20 },
  card:      { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16, width: 150, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' },
  cardTitle: { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 28, color: 'var(--tx)', lineHeight: 1.2 },
  cardTag:   { fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'var(--tx2)', lineHeight: 1.4 },
}
