import PrimaryCTA from '../../components/ui/PrimaryCTA'

/**
 * GameIntro — the shared instruction screen for every game on the platform.
 *
 * The layout is the one Delve and Tune settled on, which six games had already
 * converged on independently (Delve, Tune, Alongside, Drift, Still Water, Face
 * Read) — as six copy-pasted blocks with their styles inlined, so they drifted
 * apart in the details and carried the same off-scale sizes six times over.
 * Four more (Pond Watch, Ebb & Flow, Farm Joy, First Contact) had each invented
 * their own. This is the one copy (Norm, 2026-08-13).
 *
 *   banner?   ← redirect note when UnlockGuard bounced the player here
 *   eyebrow   ← mono, uppercase; defaults to the house line
 *   title     ← serif, the game's own sentence
 *   lead      ← two lines: what this is, and what it is not
 *   visual?   ← the game's own illustration, if it has one
 *   steps     ← the numbered card; the instructions proper
 *   note?     ← a quiet line under the card (headphones, session length)
 *   CTA       ← PrimaryCTA, so the button obeys the 24px clickable rule
 *
 * Everything is a design token and every size is a step of the 12/14/16/20/28/36
 * scale — the copies were on 13px titles, 13px leads and #888 body text. See
 * /brand for the system this now conforms to.
 *
 * Variations the ten games actually need, and nothing more:
 *   - steps take an `icon` instead of a number (Pond Watch's duck and heron)
 *   - steps take their own `numBg`/`numColor` (Still Water's two axes are
 *     colour-coded to the wheel behind them, which is meaning, not decoration)
 *   - `visual` is a free slot, so it can hold a stats row and a mode selector
 *     (Ebb & Flow) as easily as an SVG
 *   - `tone="dark"` for a game whose intro sits on its own scene (Farm Joy)
 *   - `ctaHidden` while a profile loads (First Contact)
 */
export default function GameIntro({
  banner,
  eyebrow = 'RADlab · Come, See',
  title,
  lead,
  visual,
  steps = [],
  note,
  cta = 'Begin →',
  onStart,
  ctaHidden = false,
  ctaDisabled = false,
  tone = 'light',
  maxWidth = 380,
}) {
  const t = tone === 'dark' ? DARK : LIGHT

  return (
    <div style={{ maxWidth, textAlign: 'center', padding: '0 16px', width: '100%' }}>
      {banner}

      {eyebrow && <p style={{ ...S.eyebrow, color: t.eyebrow }}>{eyebrow}</p>}
      <h1 style={{ ...S.h1, color: t.title }}>{title}</h1>
      {lead && <p style={{ ...S.lead, color: t.lead }}>{lead}</p>}

      {visual}

      {steps.length > 0 && (
        <div style={{ ...S.card, background: t.cardBg, boxShadow: t.cardShadow }}>
          {steps.map((step, i) => (
            <div key={step.title ?? i} style={S.row}>
              {step.icon ?? (
                <div style={{ ...S.num, background: step.numBg ?? t.numBg, color: step.numColor ?? t.numColor }}>
                  {step.n ?? i + 1}
                </div>
              )}
              <div>
                <div style={{ ...S.stepTitle, color: t.stepTitle }}>{step.title}</div>
                <div style={{ ...S.stepBody, color: t.stepBody }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {note && <p style={{ ...S.note, color: t.lead }}>{note}</p>}

      {!ctaHidden && (
        <PrimaryCTA onClick={onStart} disabled={ctaDisabled} style={S.cta}>
          {cta}
        </PrimaryCTA>
      )}
    </div>
  )
}

const S = {
  eyebrow:   { fontFamily: '"Space Mono", monospace', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' },
  h1:        { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 28, fontWeight: 400, margin: '0 0 8px', lineHeight: 1.2 },
  lead:      { fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' },

  card:      { borderRadius: 12, padding: '16px 18px', marginBottom: 20, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 },
  row:       { display: 'flex', gap: 12, alignItems: 'flex-start' },
  num:       { borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: '"Space Mono", monospace', fontSize: 12, fontWeight: 700 },
  stepTitle: { fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 14, fontWeight: 600, marginBottom: 2 },
  stepBody:  { fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 12, lineHeight: 1.5 },

  note:      { fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 12, lineHeight: 1.5, margin: '0 0 18px' },
  cta:       { width: '100%', fontSize: 14, padding: '13px 16px' },
}

const LIGHT = {
  eyebrow:   'var(--gy)',
  title:     'var(--tx)',
  lead:      'var(--tx2)',
  cardBg:    'var(--bgc)',
  cardShadow:'0 2px 18px rgba(180,120,160,0.10)',
  numBg:     'var(--bgp)',
  numColor:  'var(--pk)',
  stepTitle: 'var(--tx)',
  stepBody:  'var(--tx2)',
}

// For a game whose intro sits on its own scene rather than the page ground.
const DARK = {
  eyebrow:   'rgba(255,255,255,0.55)',
  title:     '#fff',
  lead:      'rgba(255,255,255,0.85)',
  cardBg:    'rgba(255,255,255,0.10)',
  cardShadow:'none',
  numBg:     'rgba(255,255,255,0.18)',
  numColor:  '#fff',
  stepTitle: '#fff',
  stepBody:  'rgba(255,255,255,0.75)',
}
