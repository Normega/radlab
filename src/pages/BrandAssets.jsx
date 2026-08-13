import { useState } from 'react'

/*
 * /brand — the RADlab design system and brand assets, in one hidden, unlinked page.
 *
 * Source of truth for the tokens below: src/index.css (:root) and tailwind.config.js,
 * which mirror resources/designhandoff/RADlab-Onboarding-Redesign-V1-Dev-Spec.md §1
 * and the gate rulings in design-audit/DRIFT-REPORT.md §9. website.md §9 summarises
 * the same set in prose. If you change a token, change it in all of those places.
 *
 * The "Implementation status" section is deliberately honest about what the live
 * site does versus what the system specifies — see design-audit/DRIFT-REPORT-2026-08-12.md
 * for the measurements behind those numbers. Keep them in sync or delete them; a
 * stale compliance claim is worse than none.
 */

const SERIF = "'DM Serif Display', Georgia, serif"
const SANS  = "'DM Sans', system-ui, sans-serif"
const MONO  = "'Space Mono', 'Courier New', monospace"

// The eight tokens of the core palette (Dev Spec §1.1).
const CORE_COLORS = [
  { token: '--bg',  tw: 'base',            hex: '#FCF0F5', label: 'Base',             use: 'Page background' },
  { token: '--bgc', tw: 'surface',         hex: '#FFFFFF', label: 'Surface',          use: 'Cards, modals, inputs' },
  { token: '--bgp', tw: 'tint',            hex: '#FBEAF3', label: 'Tint',             use: 'Subtle section fills' },
  { token: '--pk',  tw: 'primary',         hex: '#F068A4', label: 'Primary',          use: 'CTA fill, active accents' },
  { token: '--pkd', tw: 'primary-dark',    hex: '#C04A82', label: 'Primary dark',     use: 'Hover and pressed states' },
  { token: '--tx',  tw: 'text-main',       hex: '#1C1C1E', label: 'Text — main',      use: 'Headings and body copy' },
  { token: '--tx2', tw: 'text-secondary',  hex: '#6B6C70', label: 'Text — secondary', use: 'Supporting copy' },
  { token: '--gy',  tw: 'text-muted',      hex: '#ABADB0', label: 'Text — muted',     use: 'Placeholders, disabled text' },
]

// Semantic set — promoted from the auth-page error boxes (DRIFT-REPORT §9 Q2).
const SEMANTIC_COLORS = [
  { token: '--err-bg', tw: 'error-bg',     hex: '#FCEBEB', label: 'Error — background', use: 'Error box fill' },
  { token: '--err-bd', tw: 'error-border', hex: '#F09595', label: 'Error — border',     use: 'Error box border' },
  { token: '--err-tx', tw: 'error-text',   hex: '#A32D2D', label: 'Error — text',       use: 'Error message text' },
]

// Sanctioned supplements: the eight core tokens define no border colours, so these
// four exist to stop every surface inventing its own. No Tailwind keys — CSS vars only.
const BORDER_TOKENS = [
  { token: '--bd',   value: 'rgba(180, 100, 140, 0.13)', label: 'Border — default',     use: 'Default card and panel border' },
  { token: '--bds',  value: 'rgba(180, 100, 140, 0.25)', label: 'Border — strong',      use: 'Emphasised dividers, menus' },
  { token: '--pkb',  value: 'rgba(240, 104, 164, 0.18)', label: 'Border — pink subtle', use: 'Tinted panels, avatar rings' },
  { token: '--pkbs', value: 'rgba(240, 104, 164, 0.35)', label: 'Border — pink strong', use: 'Outline buttons, active edges' },
]

// Type scale (Dev Spec §1.2): three families, three steps each, drawn from the
// shared scale 12 / 14 / 16 / 20 / 28 / 36.
const TYPE_BLOCKS = [
  {
    family: 'DM Serif Display',
    role: 'Display',
    stack: SERIF,
    weights: '400 only — the family ships one weight; never declare heavier',
    sample: 'Regulatory & Affective Dynamics',
    steps: [
      { px: 36, weight: 400, role: 'Hero / modal title' },
      { px: 28, weight: 400, role: 'Section / results title' },
      { px: 20, weight: 400, role: 'Card / inline title' },
    ],
  },
  {
    family: 'DM Sans',
    role: 'Body',
    stack: SANS,
    weights: '400 and 600',
    sample: 'The quick brown fox studies affective regulation.',
    steps: [
      { px: 16, weight: '400 / 600', role: 'Default body copy' },
      { px: 14, weight: '400 / 600', role: 'Secondary body, nav links, CTA labels, eyebrows' },
      { px: 12, weight: '400 / 600', role: 'Captions and fine print' },
    ],
  },
  {
    family: 'Space Mono',
    role: 'Utility',
    stack: MONO,
    weights: '400 (700 for game and admin data readouts only)',
    sample: 'PRINCIPAL INVESTIGATOR · 00:42:18 · TAG',
    steps: [
      { px: 20, weight: 400, role: 'Large numeric display — timer, stat' },
      { px: 14, weight: 400, role: 'Inline data values' },
      { px: 12, weight: 400, role: 'Tags, role labels, timestamps' },
    ],
  },
]

const LOGOS = [
  { file: '/RADlab_Logo.svg',       label: 'RADlab logo — dark background',  note: 'White outline. Use only on dark backgrounds.', bg: '#1C1C1E' },
  { file: '/RADlab_Logo_light.svg', label: 'RADlab logo — light background', note: 'Default for the UI. Use this everywhere unless the background is dark.', bg: '#FFFFFF' },
]

const CRESTS = [
  { file: '/RADlab_Logo_light.svg', label: 'RADlab crest', bg: '#FFFFFF' },
  { file: '/UofT_Logo.svg', label: 'University of Toronto crest', bg: '#FFFFFF' },
]

const OTHER_MARKS = [
  { file: '/HQlogo.png', label: 'HQ mark' },
  { file: '/HQlogo.only.png', label: 'HQ mark — icon only' },
  { file: '/HQlogo_square.png', label: 'HQ mark — square' },
  { file: '/favicon.svg', label: 'Favicon' },
]

const FONTS = [
  {
    family: 'DM Serif Display',
    weights: '400',
    use: 'Headings, section titles, game titles',
    stack: SERIF,
    href: 'https://fonts.google.com/specimen/DM+Serif+Display',
  },
  {
    family: 'DM Sans',
    weights: '400, 600',
    use: 'Body copy, UI, nav links, CTAs',
    stack: SANS,
    href: 'https://fonts.google.com/specimen/DM+Sans',
  },
  {
    family: 'Space Mono',
    weights: '400, 700',
    use: 'Labels, chips, data readouts',
    stack: MONO,
    href: 'https://fonts.google.com/specimen/Space+Mono',
  },
]

// Components that exist as shared primitives in src/components/ui/.
const BUILT_COMPONENTS = [
  ['Button/PrimaryCTA',      'BgPink · BgWhite · Inactive'],
  ['Button/SecondaryCTA',    'BgNoFill outline'],
  ['ButtonNav',              'Active · Inactive'],
  ['EyebrowLabel',           'BgPink · BgWhite · NoBg'],
  ['FillableBox',            'Text input — Inactive · Active'],
  ['Checkbox',               'Active · Inactive'],
  ['CredentialsBox',         'Login and signup form container'],
  ['NavigationIcon',         'Close · Back'],
  ['OnboardingNavigation',   'OnlyL · OnlyR · BothButtons'],
]

// Designed in Figma, with no shared primitive in src/components/ui/ — each live
// instance is currently hand-styled, which is where new drift enters.
const UNBUILT_COMPONENTS = [
  ['Header',          'Designed as one component; the live site mounts Nav.jsx per page in 20+ files'],
  ['ToggleSwitch',    'Added to Figma late; /account ships its own'],
  ['ToggleSetting',   'Row wrapper for a labelled toggle'],
  ['SettingOptions',  'Grouped settings block'],
  ['Dropdown',        'No shared select anywhere in the app'],
  ['Question',        'SingleSelect · Scale — onboarding demographics'],
  ['InfoBox / InfoCard / BenefitCard / OnboardingInfo', 'Marketing and onboarding content cards'],
  ['GameCard / GameCard(PlayNow) / GamesCarousel / GameImage', 'Games catalog surfaces'],
  ['RADLabLogo',      'Ships as an SVG asset, not a component'],
  ['Icon',            'Pattern · Pencil · Clock'],
]

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function CopyableSwatch({ token, tw, hex, label, use }) {
  const [copied, setCopied] = useState(false)
  // Pick whichever ink actually contrasts better, rather than painting white with
  // a shadow everywhere — half this palette is near-white. 0.179 is the crossover
  // where WCAG contrast against black overtakes contrast against white.
  const ink = luminance(hex) > 0.179 ? 'var(--tx)' : '#FFFFFF'

  function copy() {
    navigator.clipboard.writeText(hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button onClick={copy} className="brand-swatch" style={{ background: hex, color: ink }} title={`Copy ${hex}`}>
      <span className="brand-swatch__hex">{copied ? 'copied!' : hex}</span>
      <span className="brand-swatch__label">
        {label}<br />{token}{tw ? ` · ${tw}` : ''}
        <span className="brand-swatch__use">{use}</span>
      </span>
    </button>
  )
}

function AssetCard({ file, label, note, bg }) {
  return (
    <div className="brand-asset-card">
      <div className="brand-asset-card__preview" style={{ background: bg ?? 'var(--bg)' }}>
        <img src={file} alt={label} />
      </div>
      <div className="brand-asset-card__meta">
        <span className="brand-asset-card__label">{label}</span>
        {note && <span className="brand-asset-card__note">{note}</span>}
        <a href={file} download className="brand-asset-card__download">Download {file.split('.').pop().toUpperCase()}</a>
      </div>
    </div>
  )
}

function StatusRow({ name, note, built }) {
  return (
    <li className="brand-list__row">
      <span className="brand-list__name">{name}</span>
      <span className="brand-list__note">{note}</span>
      <span className={`brand-status brand-status--${built ? 'built' : 'pending'}`}>
        {built ? 'in code' : 'Figma only'}
      </span>
    </li>
  )
}

function Gap({ title, children }) {
  return (
    <div className="brand-gap">
      <p className="brand-gap__title">{title}</p>
      <p className="brand-gap__body">{children}</p>
    </div>
  )
}

export default function BrandAssets() {
  return (
    <div className="lab-page brand-page">
      <div className="brand-page__header">
        <h1 className="brand-page__title">RADlab Design System</h1>
        <p className="brand-page__subtitle">
          The colour, type and shape rules the platform is built on, plus the logo and crest
          files for press, partners and collaborators. This page isn&rsquo;t linked from the
          site &mdash; bookmark or share the URL directly.
        </p>
      </div>

      {/* ── Colour ─────────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Colour</h2>
        <p className="brand-section-note">
          Click any swatch to copy its hex. Each is available as a CSS custom property
          (<code>var(--pk)</code>) and, for the core and semantic sets, as a Tailwind key
          (<code>bg-primary</code>). Prefer the token over the literal &mdash; the point of
          a token is that it can be changed in one place.
        </p>

        <p className="brand-subheading">Core palette &mdash; the eight</p>
        <div className="brand-swatch-grid">
          {CORE_COLORS.map((c) => <CopyableSwatch key={c.token} {...c} />)}
        </div>

        <p className="brand-subheading">Semantic &mdash; errors</p>
        <p className="brand-section-note">
          The only semantic set that exists. There are no success, warning or info tokens,
          which is why admin status colours are currently invented per surface.
        </p>
        <div className="brand-swatch-grid">
          {SEMANTIC_COLORS.map((c) => <CopyableSwatch key={c.token} {...c} />)}
        </div>

        <p className="brand-subheading">Borders &mdash; sanctioned supplements</p>
        <p className="brand-section-note">
          Translucent, so they are shown as borders rather than fills. These are not part of
          the original eight; they were added because the palette defines no border colour and
          every surface was otherwise inventing one.
        </p>
        <div className="brand-border-grid">
          {BORDER_TOKENS.map((b) => (
            <div key={b.token} className="brand-border-card" style={{ border: `1px solid ${b.value}` }}>
              <span className="brand-border-card__name">{b.label}</span>
              <span className="brand-border-card__value">{b.token}</span>
              <span className="brand-border-card__value">{b.value}</span>
              <span className="brand-border-card__use">{b.use}</span>
            </div>
          ))}
        </div>

        <p className="brand-section-note" style={{ marginTop: 20 }}>
          <strong>Deprecated:</strong> <code>--tx3</code> was a near-duplicate muted grey
          (<code>#A8A9AD</code>). It now resolves to <code>#ABADB0</code> and is an alias of
          text-muted &mdash; use <code>--gy</code> in new code.
        </p>
      </section>

      {/* ── Type scale ─────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Type scale</h2>
        <p className="brand-section-note">
          Six steps &mdash; <strong>12 / 14 / 16 / 20 / 28 / 36 px</strong> &mdash; shared across
          three families, each drawing three of them. 150% line-height, 0% letter-spacing.
          <strong> 12px is a hard floor</strong> (WCAG); nothing on a participant-facing surface
          should be smaller. The one sanctioned exception is the About page&rsquo;s Large Hero.
          Samples below are rendered at their true size.
        </p>

        {TYPE_BLOCKS.map((block) => (
          <div key={block.family} className="brand-type-block">
            <p className="brand-type-block__family">{block.role} &mdash; {block.family}</p>
            <p className="brand-type-block__stack">{block.weights}</p>
            {block.steps.map((step) => (
              <div key={step.px} className="brand-type-row">
                <span
                  className="brand-type-row__sample"
                  style={{ fontFamily: block.stack, fontSize: step.px, fontWeight: 400 }}
                >
                  {block.sample}
                </span>
                <span className="brand-type-row__meta">
                  {step.px}px · {step.weight}
                  <span className="brand-type-row__role">{step.role}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* ── Shape ──────────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Shape</h2>
        <p className="brand-section-note">
          Radius encodes clickability. <strong>24px means you can click it</strong>; 12px means
          you cannot. Nothing else, so that the affordance stays legible. Available as Tailwind
          <code> rounded-btn</code> and <code>rounded-card</code>.
        </p>
        <div className="brand-radii">
          <div className="brand-radii__item">
            <div className="brand-radii__demo"><button className="brand-demo-btn" type="button" tabIndex={-1}>Primary CTA</button></div>
            <span className="brand-radii__caption">24px &mdash; clickable</span>
          </div>
          <div className="brand-radii__item">
            <div className="brand-radii__demo"><button className="brand-demo-btn brand-demo-btn--outline" type="button" tabIndex={-1}>Secondary</button></div>
            <span className="brand-radii__caption">24px &mdash; clickable</span>
          </div>
          <div className="brand-radii__item">
            <div className="brand-radii__demo"><span className="brand-demo-label">Eyebrow label</span></div>
            <span className="brand-radii__caption">12px &mdash; not clickable</span>
          </div>
          <div className="brand-radii__item">
            <div className="brand-radii__demo"><div className="brand-demo-card">Card / panel</div></div>
            <span className="brand-radii__caption">12px &mdash; container</span>
          </div>
          <div className="brand-radii__item">
            <div className="brand-radii__demo"><div className="brand-demo-avatar" /></div>
            <span className="brand-radii__caption">50% &mdash; avatars, dots</span>
          </div>
        </div>
      </section>

      {/* ── Components ─────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Components</h2>
        <p className="brand-section-note">
          Shared primitives live in <code>src/components/ui/</code> and are rendered in every
          variant at <code>/dev/ui-kit</code>. The second list is designed in Figma but has no
          shared implementation, so each live instance is hand-styled &mdash; the main route by
          which new drift enters.
        </p>

        <p className="brand-subheading">Built</p>
        <ul className="brand-list">
          {BUILT_COMPONENTS.map(([name, note]) => (
            <StatusRow key={name} name={name} note={note} built />
          ))}
        </ul>

        <p className="brand-subheading">Designed, not yet shared</p>
        <ul className="brand-list">
          {UNBUILT_COMPONENTS.map(([name, note]) => (
            <StatusRow key={name} name={name} note={note} built={false} />
          ))}
        </ul>
      </section>

      {/* ── Honest status ──────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Implementation status</h2>
        <p className="brand-section-note">
          What the system specifies is above; what the codebase actually does is below.
          Measured 2026-08-12 by regex inventory over 337 source files
          (<code>design-audit/DRIFT-REPORT-2026-08-12.md</code>). Game-internal artwork is a
          sanctioned exception throughout and is excluded where noted.
        </p>

        <Gap title="Type scale — 44% compliant, and slipping">
          Of ~1,985 font-size declarations, 876 land on the six steps. 13px alone accounts for
          401, despite a ruling to migrate 13&nbsp;&rarr;&nbsp;14; 372 declarations sit below the
          12px floor, concentrated in admin. Both numbers have grown since the July audit,
          because the rule is documented but not enforced by tooling.
        </Gap>

        <Gap title="Colour — token layer sound, literals not cleaned up">
          803 occurrences hard-code one of the token values instead of referencing it. That is
          cosmetic rather than visible drift. Genuinely off-palette values outside the games
          are down to 82 occurrences, nearly all admin status tints awaiting a semantic set.
        </Gap>

        <Gap title="Weights — fully migrated">
          <code>font-weight: 500</code> is at zero occurrences site-wide, down from 135; only
          400/600 are loaded for DM Sans, matching the spec. Eight uses of weight 800 remain in
          one game, where the browser synthesises a faux bold.
        </Gap>

        <Gap title="Radii — carried by the primitives">
          24px went from 3 uses to 38 as the button primitives landed. The long tail of 8/10/16px
          cards persists in admin and game chrome and migrates opportunistically.
        </Gap>

        <Gap title="Spacing — no scale exists yet">
          The system defines colour, type and shape, but <strong>no spacing or layout scale</strong>.
          Consequently the main pages do not share a container: Dashboard is 1100px wide,
          Games 1024, About 1200, Talks 960, this page 900. Moving between them shifts the
          content column. This is an open design question, not a violation.
        </Gap>

        <Gap title="Precedence — the written spec is authoritative">
          Where the Figma Style Tile and the written spec disagree, <strong>the written spec
          wins</strong> (Norm, 2026-08-12). The tile&rsquo;s Body table lists
          12&nbsp;/&nbsp;14&nbsp;/&nbsp;12 with its roles copied from the Display table above it;
          the spec says 16&nbsp;/&nbsp;14&nbsp;/&nbsp;12, which is what this page and the code
          follow, and the current Figma has it corrected. Per-screen CSS still wins over both
          where a screen deliberately differs &mdash; the About page&rsquo;s Large Hero is the
          standing example.
        </Gap>

        <Gap title="One stale pointer">
          The developer spec names a Figma <code>Demo</code> page as the source of truth for
          navigation wiring. That page is no longer in the file, so a navigation question can no
          longer be settled by following the spec there.
        </Gap>
      </section>

      {/* ── Assets ─────────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Logos</h2>
        <p className="brand-section-note">
          Never redraw the mark &mdash; always use one of these files.
        </p>
        <div className="brand-asset-grid">
          {LOGOS.map((l) => <AssetCard key={l.file} {...l} />)}
        </div>
      </section>

      <section className="lab-section">
        <h2 className="brand-heading">Crests</h2>
        <div className="brand-asset-grid">
          {CRESTS.map((c) => <AssetCard key={c.file} {...c} />)}
        </div>
      </section>

      <section className="lab-section">
        <h2 className="brand-heading">Other marks</h2>
        <div className="brand-asset-grid">
          {OTHER_MARKS.map((m) => <AssetCard key={m.file} {...m} />)}
        </div>
      </section>

      <section className="lab-section">
        <h2 className="brand-heading">Font files</h2>
        <p className="brand-section-note">
          Sourced from Google Fonts via <code>@fontsource</code> &mdash; no local font files ship
          with the site. Click a family name to get it from Google Fonts.
        </p>
        <div className="brand-font-list">
          {FONTS.map((f) => (
            <div key={f.family} className="brand-font-row">
              <div className="brand-font-row__meta">
                <a href={f.href} target="_blank" rel="noopener noreferrer" className="brand-font-row__name">{f.family}</a>
                <span className="brand-font-row__detail">Weights {f.weights} &middot; {f.use}</span>
              </div>
              <div className="brand-font-row__specimen" style={{ fontFamily: f.stack }}>Aa Bb Cc 123</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
