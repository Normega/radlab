import { useEffect, useRef } from 'react';

// ── Color helpers (duplicated here so this component is self-contained) ───
function h2r(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function r2h(r, g, b) {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}
function lgt(hex, a) { const [r, g, b] = h2r(hex); return r2h(r + a, g + a, b + a); }
function drk(hex, a) { return lgt(hex, -a); }
function mix(a, b, t) {
  const [r1, g1, b1] = h2r(a), [r2, g2, b2] = h2r(b);
  return r2h(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
function lerp(a, b, t) { return a + (b - a) * t; }

const NS = 'http://www.w3.org/2000/svg';
function mk(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

const RING_BASE_RADIUS   = 72;
const RING_MAX_RADIUS    = 140;
const AURA_MAX_OPACITY   = 0.35; // Ebb & Flow: subtler than First Contact's 0.60

// ── Neutral resting position — module-level so both the RAF loop and the
//    imperative controlRef API can call it without a closure dependency. ──────
function applyNeutral(elems) {
  elems.svg.style.transform = 'scale(1)';
  elems.lLid.setAttribute('d', 'M 60 91 Q 76 94 92 91 A 17 17 0 0 0 60 91 Z');
  elems.rLid.setAttribute('d', 'M 108 91 Q 124 94 140 91 A 17 17 0 0 0 108 91 Z');
  elems.lLsh.setAttribute('d', 'M 60 91 Q 76 94 92 91');
  elems.rLsh.setAttribute('d', 'M 108 91 Q 124 94 140 91');
  elems.bL.setAttribute('opacity', '0.42');
  elems.bR.setAttribute('opacity', '0.42');
  elems.browL.setAttribute('transform', 'translate(0,0)');
  elems.browR.setAttribute('transform', 'translate(0,0)');
}

// ── AvatarBreathPacer ─────────────────────────────────────────────────────
//
// Renders the avatar SVG imperatively and animates it via requestAnimationFrame.
// All animation uses setAttribute — NO CSS keyframes (Safari bug prevention).
// Scale is applied via svg.style.transform — Safari-compatible.
//
// Props:
//   skinColor      — hex string
//   eyeColor       — hex string
//   scaleAmplitude — 0.02 (empath) | 0.12 (listener) | 0.25 (beginner)
//   getPhase       — function returning 0.0–1.0 within current breath cycle
//   paused         — static boolean (used by GetReadyScreen); for dynamic
//                    imperative control use controlRef instead
//   controlRef     — optional ref; populated with { resetToNeutral(), resumeAnimation() }
//                    both operate synchronously on the RAF loop without going through React
//   size           — px width/height of the SVG (default 240)

export default function AvatarBreathPacer({
  skinColor      = '#FDBCB4',
  eyeColor       = '#4A90D9',
  scaleAmplitude = 0.25,
  getPhase,
  paused         = false,
  controlRef,
  size           = 240,
  auraIntensity  = 0,   // 0.0–1.0 from profiles.deeper_contact_last_sync; 0 = invisible
}) {
  const containerRef    = useRef(null);
  const rafRef          = useRef(null);
  const elemsRef        = useRef(null);
  const scaleAmpRef     = useRef(scaleAmplitude);
  const pausedRef       = useRef(paused);
  const frameRef        = useRef(null);
  const auraIntensityRef = useRef(auraIntensity);

  useEffect(() => { scaleAmpRef.current = scaleAmplitude; }, [scaleAmplitude]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { auraIntensityRef.current = auraIntensity; }, [auraIntensity]);

  useEffect(() => {
    if (!containerRef.current) return;

    // ── Derive colors from skin/eye ──────────────────────────────────────
    const skin   = skinColor;
    const skinDk = drk(skin, 18);
    const skinLt = lgt(skin, 28);
    const blushC = mix(skin, '#FF8FAB', 0.45);
    const iris   = eyeColor;
    const irisDp = drk(iris, 30);
    const irisLt = lgt(iris, 35);
    const mouthC = drk(mix(skin, '#C06070', 0.5), 18);

    // Unique prefix for gradient/filter/clip IDs (prevents collisions)
    const p = 'abp' + Math.random().toString(36).slice(2, 6);

    // ── Build SVG ────────────────────────────────────────────────────────
    const svg = mk('svg', { viewBox: '0 0 200 185', width: String(size), height: String(size) });
    svg.style.display = 'block';
    svg.style.willChange = 'transform';
    svg.style.transformOrigin = '50% 52%';

    const defs = mk('defs', {}, svg);

    // Head gradient
    const hg = mk('radialGradient', { id: `${p}hG`, cx: '38%', cy: '30%', r: '68%' }, defs);
    mk('stop', { offset: '0%',   'stop-color': skinLt }, hg);
    mk('stop', { offset: '60%',  'stop-color': skin   }, hg);
    mk('stop', { offset: '100%', 'stop-color': skinDk }, hg);

    // Iris gradient
    const ig = mk('radialGradient', { id: `${p}iG`, cx: '35%', cy: '30%', r: '65%' }, defs);
    mk('stop', { offset: '0%',   'stop-color': irisLt }, ig);
    mk('stop', { offset: '55%',  'stop-color': iris   }, ig);
    mk('stop', { offset: '100%', 'stop-color': irisDp }, ig);

    // Sclera gradient
    const sg = mk('radialGradient', { id: `${p}sG`, cx: '40%', cy: '30%', r: '60%' }, defs);
    mk('stop', { offset: '0%',   'stop-color': '#ffffff' }, sg);
    mk('stop', { offset: '100%', 'stop-color': '#F0EBE8' }, sg);

    // Blush blur filter
    const bf = mk('filter', { id: `${p}bF` }, defs);
    mk('feGaussianBlur', { stdDeviation: '1.4' }, bf);

    // Eye shadow filter
    const ef = mk('filter', { id: `${p}eF` }, defs);
    const fds = mk('feDropShadow', { dx: '0', dy: '1', stdDeviation: '1.5' }, ef);
    fds.setAttribute('flood-color', skinDk);
    fds.setAttribute('flood-opacity', '0.25');

    // Clip paths
    const lcp = mk('clipPath', { id: `${p}lC` }, defs);
    mk('circle', { cx: '76', cy: '100', r: '17' }, lcp);
    const rcp = mk('clipPath', { id: `${p}rC` }, defs);
    mk('circle', { cx: '124', cy: '100', r: '17' }, rcp);

    // ── Aura rings — rendered BEFORE head so they appear behind it ────────
    // Fixed ambient effect driven by auraIntensityRef (seeded from last Deeper Contact session).
    const rings = [0, 1, 2].map(() =>
      mk('circle', {
        cx: '100', cy: '105',
        r:  String(RING_BASE_RADIUS),
        fill: 'none',
        stroke: '#FDBCB4',
        'stroke-width': '1.5',
        opacity: '0',
      }, svg)
    );

    // ── Face elements ────────────────────────────────────────────────────
    mk('ellipse', { cx: '100', cy: '105', rx: '64', ry: '68', fill: `url(#${p}hG)` }, svg);

    const browL = mk('path', {
      d: 'M 60 82 Q 76 77 90 81',
      stroke: skinDk, 'stroke-width': '3.5',
      fill: 'none', 'stroke-linecap': 'round', opacity: '0.65',
    }, svg);
    const browR = mk('path', {
      d: 'M 110 81 Q 124 77 140 82',
      stroke: skinDk, 'stroke-width': '3.5',
      fill: 'none', 'stroke-linecap': 'round', opacity: '0.65',
    }, svg);

    // Left eye
    mk('circle', { cx: '76', cy: '100', r: '17', fill: `url(#${p}sG)`, filter: `url(#${p}eF)` }, svg);
    mk('circle', { cx: '76', cy: '101', r: '12', fill: `url(#${p}iG)`, clipPath: `url(#${p}lC)` }, svg);
    mk('circle', { cx: '76', cy: '101', r: '7',  fill: '#0D0D0D',       clipPath: `url(#${p}lC)` }, svg);
    mk('circle', { cx: '70', cy: '102', r: '3.5', fill: 'white', opacity: '0.95' }, svg);
    mk('circle', { cx: '79', cy: '108', r: '1.8', fill: 'white', opacity: '0.65' }, svg);
    const lLid = mk('path', { d: 'M 60 91 Q 76 94 92 91 A 17 17 0 0 0 60 91 Z', fill: skin }, svg);
    const lLsh = mk('path', { d: 'M 60 91 Q 76 94 92 91', stroke: skinDk, 'stroke-width': '2.2', fill: 'none', 'stroke-linecap': 'round', opacity: '0.6' }, svg);

    // Right eye
    mk('circle', { cx: '124', cy: '100', r: '17', fill: `url(#${p}sG)`, filter: `url(#${p}eF)` }, svg);
    mk('circle', { cx: '124', cy: '101', r: '12', fill: `url(#${p}iG)`, clipPath: `url(#${p}rC)` }, svg);
    mk('circle', { cx: '124', cy: '101', r: '7',  fill: '#0D0D0D',       clipPath: `url(#${p}rC)` }, svg);
    mk('circle', { cx: '118', cy: '102', r: '3.5', fill: 'white', opacity: '0.95' }, svg);
    mk('circle', { cx: '127', cy: '108', r: '1.8', fill: 'white', opacity: '0.65' }, svg);
    const rLid = mk('path', { d: 'M 108 91 Q 124 94 140 91 A 17 17 0 0 0 108 91 Z', fill: skin }, svg);
    const rLsh = mk('path', { d: 'M 108 91 Q 124 94 140 91', stroke: skinDk, 'stroke-width': '2.2', fill: 'none', 'stroke-linecap': 'round', opacity: '0.6' }, svg);

    // Mouth
    mk('path', { d: 'M 82 145 Q 100 149 118 145', stroke: mouthC, 'stroke-width': '2.2', fill: 'none', 'stroke-linecap': 'round' }, svg);

    // Blush
    const bL = mk('ellipse', { cx: '62',  cy: '120', rx: '16', ry: '8', fill: blushC, opacity: '0.42', filter: `url(#${p}bF)` }, svg);
    const bR = mk('ellipse', { cx: '138', cy: '120', rx: '16', ry: '8', fill: blushC, opacity: '0.42', filter: `url(#${p}bF)` }, svg);

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(svg);

    elemsRef.current = { svg, rings, lLid, lLsh, rLid, rLsh, bL, bR, browL, browR };

    // ── RAF animation loop ───────────────────────────────────────────────
    function frame() {
      if (!elemsRef.current) return;
      const { svg, rings, lLid, lLsh, rLid, rLsh, bL, bR, browL, browR } = elemsRef.current;

      const phase    = getPhase ? getPhase() : 0;
      const auraInt  = auraIntensityRef.current;

      // Aura rings — fixed ambient intensity, invisible if auraIntensity = 0
      for (let i = 0; i < 3; i++) {
        const ringPhase = (phase + i / 3) % 1.0;
        const radius    = RING_BASE_RADIUS + ringPhase * (RING_MAX_RADIUS - RING_BASE_RADIUS);
        const opacity   = Math.max(0, auraInt * AURA_MAX_OPACITY * (1 - ringPhase));
        rings[i].setAttribute('r',       radius.toFixed(1));
        rings[i].setAttribute('opacity', opacity.toFixed(3));
      }

      // When paused: snap to neutral on every frame (idempotent, instant)
      if (pausedRef.current) {
        applyNeutral(elemsRef.current);
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      const bT = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;

      // Scale — whole SVG expands on inhale
      const s = 1 + scaleAmpRef.current * bT;
      svg.style.transform = `scale(${s.toFixed(4)})`;

      // Eyelids — droop on exhale (99.5), open on inhale (88)
      const ey = lerp(99.5, 88, bT).toFixed(1);
      lLid.setAttribute('d', `M 60 91 Q 76 ${ey} 92 91 A 17 17 0 0 0 60 91 Z`);
      rLid.setAttribute('d', `M 108 91 Q 124 ${ey} 140 91 A 17 17 0 0 0 108 91 Z`);
      lLsh.setAttribute('d', `M 60 91 Q 76 ${ey} 92 91`);
      rLsh.setAttribute('d', `M 108 91 Q 124 ${ey} 140 91`);

      // Blush — more intense on exhale (0.62), lighter on inhale (0.22)
      const bop = lerp(0.62, 0.22, bT).toFixed(2);
      bL.setAttribute('opacity', bop);
      bR.setAttribute('opacity', bop);

      // Brows — rise on inhale (−2.5), lower on exhale (+2.5)
      const dy = lerp(2.5, -2.5, bT).toFixed(1);
      browL.setAttribute('transform', `translate(0,${dy})`);
      browR.setAttribute('transform', `translate(0,${dy})`);

      rafRef.current = requestAnimationFrame(frame);
    }

    // Store frame so resumeAnimation can restart it without a closure on the build effect
    frameRef.current = frame;

    // ── Imperative control API ───────────────────────────────────────────
    // resetToNeutral: synchronously kills RAF + writes neutral attrs.
    //   Must be called from the same synchronous task as any state change
    //   to guarantee the RAF is dead before the next paint.
    // resumeAnimation: clears the paused flag and restarts RAF.
    //   Call startBreath() BEFORE this so getPhase() reads a fresh cycleStartRef
    //   on the very first frame.
    if (controlRef) {
      controlRef.current = {
        resetToNeutral() {
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          if (elemsRef.current) applyNeutral(elemsRef.current);
          pausedRef.current = true;
        },
        resumeAnimation() {
          pausedRef.current = false;
          if (!rafRef.current && elemsRef.current && frameRef.current) {
            rafRef.current = requestAnimationFrame(frameRef.current);
          }
        },
      };
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      elemsRef.current = null;
      frameRef.current = null;
      if (controlRef) controlRef.current = null;
    };
  // Re-build if colors change (new avatar loaded)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skinColor, eyeColor, size]);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    />
  );
}
