import { useState } from 'react'

/*
 * /brand — the RADlab design system and brand assets, in one hidden, unlinked page.
 *
 * Source of truth for the tokens below: src/index.css (:root) and tailwind.config.js,
 * which mirror resources/designhandoff/RADlab-Onboarding-Redesign-V1-Dev-Spec.md §1,
 * the gate rulings in design-audit/DRIFT-REPORT.md §9, and the 2026-08-26 adoption of
 * the expanded Figma system (Brand_Aug26_2026.fig, "RADLAB Official Design System").
 * website.md §9 summarises the same set in prose. If you change a token, change it in
 * all of those places.
 *
 * The 2026-08-26 adoption took the Figma expansion's additions (semantic colour layer,
 * named type styles, spacing scale, effects, layout containers) but kept four settled
 * rulings where the Figma conflicted: the 12px type floor (no Body/XS 10px), the
 * 12/24/50% radii rule (no radius/sm 8px), the six-step type scale (no 24px steps),
 * and the translucent rgba border tokens (no opaque border aliases). See the
 * "Implementation status" section below and docs/markdowns/brand_enforcement_plan.md.
 *
 * The "Implementation status" section is deliberately honest about what the live
 * site does versus what the system specifies — see design-audit/DRIFT-REPORT-2026-08-12.md
 * for the measurements behind those numbers. Keep them in sync or delete them; a
 * stale compliance claim is worse than none.
 */

const SERIF = "'DM Serif Display', Georgia, serif"
const SANS  = "'DM Sans', system-ui, sans-serif"
const MONO  = "'Space Mono', 'Courier New', monospace"

// Primitives — the raw values. Semantic tokens below alias these; use the semantic
// token in code, the primitive name when talking to design.
const PRIMITIVES = [
  { name: 'pink/50',     hex: '#FCF0F5', token: '--bg' },
  { name: 'pink/100',    hex: '#FBEAF3', token: '--bgp' },
  { name: 'pink/500',    hex: '#F068A4', token: '--pk' },
  { name: 'pink/700',    hex: '#C04A82', token: '--pkd' },
  { name: 'neutral/0',   hex: '#FFFFFF', token: '--bgc' },
  { name: 'neutral/400', hex: '#ABADB0', token: '--gy' },
  { name: 'neutral/600', hex: '#6B6C70', token: '--tx2' },
  { name: 'neutral/900', hex: '#1C1C1E', token: '--tx' },
  { name: 'red/50',      hex: '#FCEBEB', token: '--err-bg' },
  { name: 'red/300',     hex: '#F09595', token: '--err-bd' },
  { name: 'red/700',     hex: '#A32D2D', token: '--err-tx' },
]

// Semantic layer (2026-08-26 expansion) — role-named aliases onto the primitives.
const SEMANTIC_GROUPS = [
  {
    group: 'Background',
    items: [
      { name: 'Base',    alias: 'pink/50',     css: '#FCF0F5', token: '--bg',     use: 'Page background' },
      { name: 'Surface', alias: 'neutral/0',   css: '#FFFFFF', token: '--bgc',    use: 'Cards, modals, inputs' },
      { name: 'Tint',    alias: 'pink/100',    css: '#FBEAF3', token: '--bgp',    use: 'Subtle section fills' },
      { name: 'Error',   alias: 'red/50',      css: '#FCEBEB', token: '--err-bg', use: 'Error box fill' },
    ],
  },
  {
    group: 'Text',
    items: [
      { name: 'Main',        alias: 'neutral/900', css: '#1C1C1E', token: '--tx',     use: 'Headings and body copy' },
      { name: 'Secondary',   alias: 'neutral/600', css: '#6B6C70', token: '--tx2',    use: 'Supporting copy' },
      { name: 'Muted',       alias: 'neutral/400', css: '#ABADB0', token: '--gy',     use: 'Placeholders, disabled text' },
      { name: 'Accent',      alias: 'pink/700',    css: '#C04A82', token: '--pkd',    use: 'Links, text on pink grounds' },
      { name: 'Accent Soft', alias: 'pink/500',    css: '#F068A4', token: '--pk',     use: 'Decorative accent text' },
      { name: 'On Action',   alias: 'neutral/0',   css: '#FFFFFF', token: '--bgc',    use: 'Text on filled CTAs' },
      { name: 'Error',       alias: 'red/700',     css: '#A32D2D', token: '--err-tx', use: 'Error message text' },
    ],
  },
  {
    group: 'Action',
    items: [
      { name: 'Default',  alias: 'pink/500',    css: '#F068A4', token: '--pk',  use: 'CTA fill, active accents' },
      { name: 'Emphasis', alias: 'pink/700',    css: '#C04A82', token: '--pkd', use: 'Hover and pressed states' },
      { name: 'Disabled', alias: 'neutral/400', css: '#ABADB0', token: '--gy',  use: 'Inactive controls' },
    ],
  },
  {
    group: 'Icon',
    items: [
      { name: 'Default',   alias: 'neutral/600', css: '#6B6C70', token: '--tx2', use: 'Standard icons' },
      { name: 'Accent',    alias: 'pink/700',    css: '#C04A82', token: '--pkd', use: 'Active or highlighted icons' },
      { name: 'On Action', alias: 'neutral/0',   css: '#FFFFFF', token: '--bgc', use: 'Icons on filled CTAs' },
    ],
  },
  {
    group: 'Overlay',
    items: [
      { name: 'Scrim', alias: 'neutral/400 @ 55%', css: 'rgba(171,173,176,0.55)', token: '--ov-scrim', use: 'Locked or gated content' },
      { name: 'Wash',  alias: 'pink/50 @ 70%',     css: 'rgba(252,240,245,0.70)', token: '--ov-wash',  use: 'Hover wash over cards' },
    ],
  },
]

// Borders keep the translucent supplements — the 2026-08-26 ruling declined the
// Figma expansion's opaque border aliases so borders keep blending over any ground.
const BORDER_TOKENS = [
  { token: '--bd',     value: 'rgba(180, 100, 140, 0.13)', label: 'Border — default',     use: 'Default card and panel border' },
  { token: '--bds',    value: 'rgba(180, 100, 140, 0.25)', label: 'Border — strong',      use: 'Emphasised dividers, menus' },
  { token: '--pkb',    value: 'rgba(240, 104, 164, 0.18)', label: 'Border — pink subtle', use: 'Tinted panels, avatar rings' },
  { token: '--pkbs',   value: 'rgba(240, 104, 164, 0.35)', label: 'Border — pink strong', use: 'Outline buttons, active edges' },
  { token: '--err-bd', value: '#F09595',                   label: 'Border — error',       use: 'Error box border (opaque, red/300)' },
]

// Named type styles (2026-08-26 expansion), constrained to the six-step scale
// 12 / 14 / 16 / 20 / 28 / 36 — plus Display/Hero, the one sanctioned exception.
// Not adopted from the Figma: Heading/3 24, Body/XL Emphasis 24 (off-scale),
// Body/XS 10 (below the 12px floor).
const TYPE_BLOCKS = [
  {
    family: 'DM Serif Display',
    role: 'Display',
    stack: SERIF,
    weights: '400 only — the family ships one weight; never declare heavier',
    steps: [
      { name: 'Display/Hero', px: 72, weight: 400, sample: 'How sharp is your mind?', role: 'Homepage hero. One per site — the sanctioned exception to the scale' },
      { name: 'Heading/1',    px: 36, weight: 400, sample: 'Meet your Ripple',        role: 'Page titles and the RADlab wordmark' },
      { name: 'Heading/2',    px: 28, weight: 400, sample: 'Still Water',             role: 'Serif focal text: game titles, auth headings, standout lines' },
      { name: 'Heading/4',    px: 20, weight: 400, sample: 'Weekly reflection',       role: 'Card and inline titles' },
    ],
  },
  {
    family: 'DM Sans',
    role: 'Body',
    stack: SANS,
    weights: '400 and 600',
    steps: [
      { name: 'Body/L Emphasis', px: 16, weight: 600, sample: 'Dashboard',                       role: 'Button labels, nav items, table row labels' },
      { name: 'Body/L',          px: 16, weight: 400, sample: 'Ears & species',                  role: 'Body copy in cards and list rows' },
      { name: 'Body/M',          px: 14, weight: 400, sample: 'example@email.com',               role: 'Values in key–value rows and field content' },
      { name: 'Body/S Emphasis', px: 12, weight: 600, sample: 'Rename',                          role: 'Inline links and checkbox labels' },
      { name: 'Body/S',          px: 12, weight: 400, sample: 'It takes one minute to reset.',   role: 'Helper and description text beneath headings' },
    ],
  },
  {
    family: 'Space Mono',
    role: 'Label',
    stack: MONO,
    weights: '400 (700 for game and admin data readouts only)',
    steps: [
      { name: 'Label/XL Bold', px: 20, weight: 700, sample: 'DAILY REMINDERS ON', role: 'Data readouts and onboarding emphasis. Use sparingly' },
      { name: 'Label/XL',      px: 20, weight: 400, sample: 'TODAY’S CHECK-IN',   role: 'Page-level section eyebrow labels' },
      { name: 'Label/L',       px: 14, weight: 400, sample: 'ACCOUNT DETAILS',    role: 'Section-level eyebrow labels' },
      { name: 'Label/M',       px: 12, weight: 400, sample: 'UNLOCKED',           role: 'Card-level eyebrow labels and metadata' },
    ],
  },
]

// Spacing scale (2026-08-26 expansion): the only legal values for padding and gaps.
const SPACE_STEPS = [4, 8, 16, 24, 32, 40, 48, 64]

// Layout containers (2026-08-26 expansion), drawn proportionally to a 1440 frame.
const CONTAINERS = [
  { name: 'container/lg · 1120px', width: 1120, token: '--container-lg', note: 'Grids and data: Games, Dashboard, About. Leaves 160px per side at 1440.' },
  { name: 'container/sm · 840px',  width: 840,  token: '--container-sm', note: 'Forms and prose: Account, My Ripple, Onboarding. Leaves 300px per side at 1440.' },
  { name: 'full-bleed · 1440px',   width: 1440, token: null,             note: 'Navigation only. Spans the full width and aligns to neither container.' },
]

const BREAKPOINTS = [
  { range: '≥ 1280',     gutter: 'flex', note: 'Designed state. Containers at full width; the gutter absorbs the remainder.' },
  { range: '768 – 1279', gutter: '32',   note: 'Both containers go fluid. Game cards 2-up. Dashboard panels stack.' },
  { range: '< 768',      gutter: '16',   note: 'Single column throughout. Nav collapses to a menu.' },
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
// instance is currently hand-styled, which is where new drift enters. The
// 2026-08 Figma expansion redesigned most of these across eight component
// sections plus revised Account/Games/Dashboard test screens.
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

function CopyableSwatch({ token, name, hex }) {
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
        {name}
        <span className="brand-swatch__use">{token}</span>
      </span>
    </button>
  )
}

function SemanticCard({ name, alias, css, token, use }) {
  return (
    <div className="brand-sem-card">
      <div className="brand-sem-card__chip" style={{ background: css }} />
      <span className="brand-sem-card__name">{name}</span>
      <span className="brand-sem-card__alias">→ {alias} · {token}</span>
      <span className="brand-sem-card__use">{use}</span>
    </div>
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
          The colour, type, spacing, shape and layout rules the platform is built on, plus
          the logo and crest files for press, partners and collaborators. This page
          isn&rsquo;t linked from the site &mdash; bookmark or share the URL directly.
        </p>
      </div>

      {/* ── Colour ─────────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Colour</h2>
        <p className="brand-section-note">
          Two layers. <strong>Primitives</strong> are the raw values, named for what they are.
          <strong> Semantic tokens</strong> alias a primitive and are named for what they do
          &mdash; code should reach for the semantic token (<code>var(--pk)</code>, Tailwind{' '}
          <code>bg-primary</code>), so a value can change in one place. Click any primitive
          to copy its hex.
        </p>

        <p className="brand-subheading">Primitives &mdash; raw values</p>
        <div className="brand-swatch-grid">
          {PRIMITIVES.map((c) => <CopyableSwatch key={c.name} {...c} />)}
        </div>

        {SEMANTIC_GROUPS.map((g) => (
          <div key={g.group}>
            <p className="brand-subheading">{g.group}</p>
            <div className="brand-sem-grid">
              {g.items.map((item) => <SemanticCard key={g.group + item.name} {...item} />)}
            </div>
          </div>
        ))}

        <p className="brand-subheading">Borders &mdash; translucent by ruling</p>
        <p className="brand-section-note">
          Border tokens stay translucent so they blend over any ground &mdash; the 2026-08-26
          adoption declined the Figma expansion&rsquo;s opaque border aliases. Shown as borders
          rather than fills. CSS vars only, no Tailwind keys.
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
          text-muted &mdash; use <code>--gy</code> in new code. <strong>Still missing:</strong>{' '}
          success and warning semantics &mdash; error is the only status set, which is why
          admin status colours are currently invented per surface.
        </p>
      </section>

      {/* ── Type styles ────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Type styles</h2>
        <p className="brand-section-note">
          Named styles on the shared scale <strong>12 / 14 / 16 / 20 / 28 / 36 px</strong>,
          150% line-height, 0% letter-spacing. <strong>12px is a hard floor</strong> (WCAG);
          nothing participant-facing goes smaller. <code>Display/Hero</code> is the one
          sanctioned exception to the scale &mdash; one per site. Samples render at true size.
          Not adopted from the 2026-08 Figma expansion: <code>Heading/3</code> and{' '}
          <code>Body/XL Emphasis</code> (24px is off-scale) and <code>Body/XS</code> (10px is
          below the floor).
        </p>

        {TYPE_BLOCKS.map((block) => (
          <div key={block.family} className="brand-type-block">
            <p className="brand-type-block__family">{block.role} &mdash; {block.family}</p>
            <p className="brand-type-block__stack">{block.weights}</p>
            {block.steps.map((step) => (
              <div key={step.name} className="brand-type-row">
                <span
                  className="brand-type-row__sample"
                  style={{ fontFamily: block.stack, fontSize: step.px, fontWeight: step.weight }}
                >
                  {step.sample}
                </span>
                <span className="brand-type-row__meta">
                  {step.name} · {step.px}px · {step.weight}
                  <span className="brand-type-row__role">{step.role}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* ── Spacing ────────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Spacing</h2>
        <p className="brand-section-note">
          Eight steps, and <strong>only these eight values are legal for padding and gaps</strong>.
          Available as CSS custom properties (<code>var(--sp-16)</code>). Adopted 2026-08-26;
          existing surfaces migrate opportunistically.
        </p>
        <div className="brand-space-rows">
          {SPACE_STEPS.map((px) => (
            <div key={px} className="brand-space-row">
              <span className="brand-space-row__name">space/{px}</span>
              <div className="brand-space-row__bar" style={{ width: px }} />
              <span className="brand-space-row__px">{px}px</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Shape ──────────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Shape</h2>
        <p className="brand-section-note">
          Radius encodes clickability. <strong>24px means you can click it</strong>; 12px means
          you cannot; 50% is avatars and dots. Nothing else, so the affordance stays legible
          &mdash; the 2026-08-26 adoption declined an 8px small radius for this reason.
          Available as Tailwind <code>rounded-btn</code> and <code>rounded-card</code>.
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

        <p className="brand-subheading">Strokes</p>
        <div>
          <div className="brand-stroke-row">
            <span className="brand-stroke-row__name">stroke/hairline · 1px</span>
            <div className="brand-stroke-row__line" style={{ height: 1 }} />
          </div>
          <div className="brand-stroke-row">
            <span className="brand-stroke-row__name">stroke/strong · 2px</span>
            <div className="brand-stroke-row__line" style={{ height: 2 }} />
          </div>
        </div>
      </section>

      {/* ── Effects ────────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Effects</h2>
        <p className="brand-section-note">
          One shadow and two overlays. Anything else is off-system.
        </p>
        <div className="brand-fx-grid">
          <div className="brand-fx-card">
            <div className="brand-fx-card__stage">
              <div className="brand-fx-card__demo brand-fx-card__demo--elevated">Hovered card</div>
            </div>
            <span className="brand-fx-card__name">Elevation/Hover</span>
            <span className="brand-fx-card__note">
              Even drop shadow, 0/0/20 at 12% (<code>var(--sh-hover)</code>). The only shadow
              in the system.
            </span>
          </div>
          <div className="brand-fx-card">
            <div className="brand-fx-card__stage">
              <div className="brand-fx-card__demo">
                Card content
                <div className="brand-fx-card__veil" style={{ background: 'var(--ov-wash)' }} />
              </div>
            </div>
            <span className="brand-fx-card__name">Overlay/Wash</span>
            <span className="brand-fx-card__note">
              Pink wash at 70% (<code>var(--ov-wash)</code>) over a hovered card. Content stays
              legible beneath it.
            </span>
          </div>
          <div className="brand-fx-card">
            <div className="brand-fx-card__stage">
              <div className="brand-fx-card__demo">
                Locked content
                <div className="brand-fx-card__veil" style={{ background: 'var(--ov-scrim)' }} />
              </div>
            </div>
            <span className="brand-fx-card__name">Overlay/Scrim</span>
            <span className="brand-fx-card__note">
              Grey wash at 55% (<code>var(--ov-scrim)</code>) over locked or gated content.
            </span>
          </div>
        </div>
      </section>

      {/* ── Layout ─────────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Layout</h2>
        <p className="brand-section-note">
          Content sits in one of two centred containers; the gutter is whatever space remains,
          not a fixed value. Diagrams are proportional to a 1440px frame. Adopted 2026-08-26 as
          the target &mdash; live pages still vary (see Implementation status).
        </p>
        {CONTAINERS.map((c) => (
          <div key={c.name}>
            <p className="brand-layout-caption">{c.name}{c.token ? <> · <code>var({c.token})</code></> : null}</p>
            <div className="brand-layout-diagram">
              <div className="brand-layout-diagram__inner" style={{ width: `${(c.width / 1440) * 100}%` }}>
                {c.width}px
              </div>
            </div>
            <p className="brand-layout-note">{c.note}</p>
          </div>
        ))}
        <div className="brand-rules-box">
          <p className="brand-rules-box__title">The two rules that always apply</p>
          <p className="brand-rules-box__body">
            Content never exceeds its container width. &middot; The gutter never drops below 16px.
          </p>
        </div>

        <p className="brand-subheading">Breakpoints &middot; gutter</p>
        <div>
          {BREAKPOINTS.map((b) => (
            <div key={b.range} className="brand-bp-row">
              <span className="brand-bp-row__range">{b.range}</span>
              <span className="brand-bp-row__gutter">{b.gutter}</span>
              <span className="brand-bp-row__note">{b.note}</span>
            </div>
          ))}
        </div>
        <p className="brand-section-note" style={{ marginTop: 12 }}>
          Breakpoint values are developer-facing and intentionally not stored as design tokens.
        </p>
      </section>

      {/* ── Components ─────────────────────────────────────────────────────── */}
      <section className="lab-section">
        <h2 className="brand-heading">Components</h2>
        <p className="brand-section-note">
          Shared primitives live in <code>src/components/ui/</code> and are rendered in every
          variant at <code>/dev/ui-kit</code>. The second list is designed in Figma but has no
          shared implementation, so each live instance is hand-styled &mdash; the main route by
          which new drift enters. The 2026-08 Figma expansion redesigned these across eight
          component sections with revised Account, Games and Dashboard screens; build-out order
          is in <code>docs/markdowns/brand_enforcement_plan.md</code>.
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
          Drift measured 2026-08-27 by <code>npm run audit:design</code>{' '}
          (<code>scripts/design-audit.mjs</code>, 374 files), which now also runs as a ratchet:
          <code> audit:design:check</code> fails any change that pushes a count above the
          committed <code>design-audit/baseline.json</code>. Sanctioned content — game artwork,
          avatar colour palettes, talk-deck graphics — is reported but never ratcheted. The
          2026-08-12 hand-run audit remains in <code>design-audit/</code>; its counts used
          different exclusions and are not 1:1 comparable.
        </p>

        <Gap title="The 2026-08-26 expansion — adopted with four exclusions">
          The expanded Figma system (&ldquo;RADLAB Official Design System&rdquo;) contributed
          the semantic colour layer, named type styles, the spacing scale, effects and layout
          containers. Four of its proposals conflicted with settled rulings and were declined
          (Norm, 2026-08-26): <code>Body/XS</code> at 10px (below the 12px floor),{' '}
          <code>radius/sm</code> at 8px (radius encodes clickability), 24px type steps
          (off the six-step scale), and opaque border aliases (borders stay translucent).
          Precedence is unchanged: where Figma and the written spec disagree, the written
          spec wins.
        </Gap>

        <Gap title="Type scale — 64% compliant and ratcheted">
          Of 1,676 font-size declarations in ratcheted scope, 1,072 land on the six steps.
          The 13&nbsp;&rarr;&nbsp;14 migration completed 2026-08-27 (324 replacements; 13px
          site-wide is now <strong>zero</strong>, locked by the ratchet). 374 declarations
          still sit below the 12px floor and 230 elsewhere off-scale, concentrated in admin.
          These counts grew for months while the rule was documented but untooled &mdash; the
          ratchet now fails any commit that increases them.
        </Gap>

        <Gap title="Colour — token layer sound, literals not cleaned up">
          187 occurrences hard-code a token value instead of referencing it &mdash; cosmetic
          rather than visible drift. 540 hexes are genuinely off-palette; the single worst
          file is admin&rsquo;s TrainingUpload (68), and the bulk are admin status tints
          awaiting success and warning semantics.
        </Gap>

        <Gap title="Weights — fully migrated">
          <code>font-weight: 500</code> is at zero occurrences site-wide, down from 135 — in CSS
          and in SVG presentation attributes alike. The last four hid as <code>fontWeight="500"</code>{' '}
          on Still Water&rsquo;s wheel diagram, where a CSS-shaped search could not see them; they
          were the only ones left (2026-08-13). Only 400/600 are loaded for DM Sans, matching the
          spec. Eight uses of weight 800 remain in one game, where the browser synthesises a faux
          bold.
        </Gap>

        <Gap title="Radii — carried by the primitives">
          24px went from 3 uses to 38 as the button primitives landed (2026-08-12). The long
          tail of 8/10/16px cards persists &mdash; 579 off-system radius declarations in
          ratcheted scope &mdash; and migrates opportunistically, now without being allowed
          to grow.
        </Gap>

        <Gap title="Spacing & layout — scale adopted, not yet implemented">
          The spacing scale and the two shared containers exist as tokens as of 2026-08-26, but
          no page uses them yet: Dashboard is 1100px wide, Games 1024, About 1200, Talks 960,
          this page 900. Moving between pages still shifts the content column, and 1,712
          off-scale padding/gap/margin values mark the migration&rsquo;s starting line.
          Migration order is in <code>docs/markdowns/brand_enforcement_plan.md</code> — this
          stops being an open design question and becomes ordinary unfinished work.
        </Gap>

        <Gap title="Precedence — the written spec is authoritative">
          Where the Figma and the written spec disagree, <strong>the written spec wins</strong>{' '}
          (Norm, 2026-08-12; reaffirmed 2026-08-26). Per-screen CSS still wins over both where a
          screen deliberately differs &mdash; the About page&rsquo;s Large Hero was the standing
          example, now formalised as <code>Display/Hero</code>.
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
