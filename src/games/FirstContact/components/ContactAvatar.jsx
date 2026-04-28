import { useEffect, useRef } from 'react';
import { SYNC_THRESHOLD, SCALE_AMPLITUDE } from '../constants';

// ── Color helpers ─────────────────────────────────────────────────────────
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

const HEAD_RADIUS      = 64;
const HALO_MULTIPLIERS = [1.10, 1.15, 1.20, 1.25, 1.28, 1.31, 1.35];
const HALO_OPACITIES   = [0.35, 0.28, 0.22, 0.17, 0.13, 0.10, 0.07];

// ── ContactAvatar ─────────────────────────────────────────────────────────
//
// Props:
//   skinColor       — hex
//   eyeColor        — hex
//   getPhase        — () => 0.0–1.0 within breath cycle
//   syncLevel       — 0.0–1.0 rolling mean; drives ghost reveal + aura
//   isFirstContact  — true = ghost reveal mode (features fade in with sync)
//   isComplete      — true = all features full opacity regardless
//   controlRef      — optional; populated with { resetToNeutral(), resumeAnimation() }
//   size            — px (default 240)
//
// Rendering rules:
//   Ghost mode (isFirstContact && !isComplete): featuresG opacity interpolates with syncLevel
//   Normal / complete: featuresG opacity = 1.0
//
// SVG draw order: aura rings → head ellipse → features group
// All animation via requestAnimationFrame + setAttribute (no CSS keyframes on SVG).

export default function ContactAvatar({
  skinColor      = '#FDBCB4',
  eyeColor       = '#4A90D9',
  getPhase,
  syncLevel      = 0,
  isFirstContact = true,
  isComplete     = false,
  controlRef,
  size           = 240,
}) {
  const containerRef     = useRef(null);
  const rafRef           = useRef(null);
  const elemsRef         = useRef(null);
  const frameRef         = useRef(null);
  const pausedRef        = useRef(true);   // start paused — INTRO is static

  const syncLevelRef      = useRef(syncLevel);
  const isFirstContactRef = useRef(isFirstContact);
  const isCompleteRef     = useRef(isComplete);

  useEffect(() => { syncLevelRef.current = syncLevel; },           [syncLevel]);
  useEffect(() => { isFirstContactRef.current = isFirstContact; }, [isFirstContact]);
  useEffect(() => { isCompleteRef.current = isComplete; },         [isComplete]);

  // Re-build SVG when colors or size change
  useEffect(() => {
    if (!containerRef.current) return;

    const skin   = skinColor;
    const skinDk = drk(skin, 18);
    const skinLt = lgt(skin, 28);
    const blushC = mix(skin, '#FF8FAB', 0.45);
    const iris   = eyeColor;
    const irisDp = drk(iris, 30);
    const irisLt = lgt(iris, 35);
    const mouthC = drk(mix(skin, '#C06070', 0.5), 18);
    const p      = 'ca' + Math.random().toString(36).slice(2, 6);

    const svg = mk('svg', { viewBox: '0 0 200 185', width: String(size), height: String(size) });
    svg.style.display       = 'block';
    svg.style.willChange    = 'transform';
    svg.style.transformOrigin = '50% 52%';

    const defs = mk('defs', {}, svg);

    // Gradients + filters
    const hg = mk('radialGradient', { id: `${p}hG`, cx: '38%', cy: '30%', r: '68%' }, defs);
    mk('stop', { offset: '0%',   'stop-color': skinLt }, hg);
    mk('stop', { offset: '60%',  'stop-color': skin   }, hg);
    mk('stop', { offset: '100%', 'stop-color': skinDk }, hg);

    const ig = mk('radialGradient', { id: `${p}iG`, cx: '35%', cy: '30%', r: '65%' }, defs);
    mk('stop', { offset: '0%',   'stop-color': irisLt }, ig);
    mk('stop', { offset: '55%',  'stop-color': iris   }, ig);
    mk('stop', { offset: '100%', 'stop-color': irisDp }, ig);

    const sg = mk('radialGradient', { id: `${p}sG`, cx: '40%', cy: '30%', r: '60%' }, defs);
    mk('stop', { offset: '0%',   'stop-color': '#ffffff' }, sg);
    mk('stop', { offset: '100%', 'stop-color': '#F0EBE8' }, sg);

    const bf = mk('filter', { id: `${p}bF` }, defs);
    mk('feGaussianBlur', { stdDeviation: '1.4' }, bf);

    const ef = mk('filter', { id: `${p}eF` }, defs);
    const fds = mk('feDropShadow', { dx: '0', dy: '1', stdDeviation: '1.5' }, ef);
    fds.setAttribute('flood-color',   skinDk);
    fds.setAttribute('flood-opacity', '0.25');

    const lcp = mk('clipPath', { id: `${p}lC` }, defs);
    mk('circle', { cx: '76', cy: '100', r: '17' }, lcp);
    const rcp = mk('clipPath', { id: `${p}rC` }, defs);
    mk('circle', { cx: '124', cy: '100', r: '17' }, rcp);

    // ── Halo rings — static concentric circles rendered BEFORE head ─────────
    // Filled with skin colour, no stroke. Scale with the SVG CSS transform.
    const halos = HALO_MULTIPLIERS.map(mult =>
      mk('circle', {
        cx: '100', cy: '105',
        r: (HEAD_RADIUS * mult).toFixed(1),
        fill: skin,
        opacity: '0',
      }, svg)
    );

    // ── Head (always full opacity) ─────────────────────────────────────────
    mk('ellipse', { cx: '100', cy: '105', rx: '64', ry: '68', fill: `url(#${p}hG)` }, svg);

    // ── Features group — opacity controlled for ghost reveal mode ─────────
    const featuresG = mk('g', { opacity: '0.08' }, svg);

    const browL = mk('path', {
      d: 'M 60 82 Q 76 77 90 81',
      stroke: skinDk, 'stroke-width': '3.5',
      fill: 'none', 'stroke-linecap': 'round', opacity: '0.65',
    }, featuresG);
    const browR = mk('path', {
      d: 'M 110 81 Q 124 77 140 82',
      stroke: skinDk, 'stroke-width': '3.5',
      fill: 'none', 'stroke-linecap': 'round', opacity: '0.65',
    }, featuresG);

    // Left eye
    mk('circle', { cx: '76', cy: '100', r: '17', fill: `url(#${p}sG)`, filter: `url(#${p}eF)` }, featuresG);
    mk('circle', { cx: '76', cy: '101', r: '12', fill: `url(#${p}iG)`, 'clip-path': `url(#${p}lC)` }, featuresG);
    mk('circle', { cx: '76', cy: '101', r: '7',  fill: '#0D0D0D',       'clip-path': `url(#${p}lC)` }, featuresG);
    mk('circle', { cx: '70', cy: '102', r: '3.5', fill: 'white', opacity: '0.95' }, featuresG);
    mk('circle', { cx: '79', cy: '108', r: '1.8', fill: 'white', opacity: '0.65' }, featuresG);
    const lLid = mk('path', { d: 'M 60 91 Q 76 94 92 91 A 17 17 0 0 0 60 91 Z', fill: skin }, featuresG);
    const lLsh = mk('path', { d: 'M 60 91 Q 76 94 92 91', stroke: skinDk, 'stroke-width': '2.2', fill: 'none', 'stroke-linecap': 'round', opacity: '0.6' }, featuresG);

    // Right eye
    mk('circle', { cx: '124', cy: '100', r: '17', fill: `url(#${p}sG)`, filter: `url(#${p}eF)` }, featuresG);
    mk('circle', { cx: '124', cy: '101', r: '12', fill: `url(#${p}iG)`, 'clip-path': `url(#${p}rC)` }, featuresG);
    mk('circle', { cx: '124', cy: '101', r: '7',  fill: '#0D0D0D',       'clip-path': `url(#${p}rC)` }, featuresG);
    mk('circle', { cx: '118', cy: '102', r: '3.5', fill: 'white', opacity: '0.95' }, featuresG);
    mk('circle', { cx: '127', cy: '108', r: '1.8', fill: 'white', opacity: '0.65' }, featuresG);
    const rLid = mk('path', { d: 'M 108 91 Q 124 94 140 91 A 17 17 0 0 0 108 91 Z', fill: skin }, featuresG);
    const rLsh = mk('path', { d: 'M 108 91 Q 124 94 140 91', stroke: skinDk, 'stroke-width': '2.2', fill: 'none', 'stroke-linecap': 'round', opacity: '0.6' }, featuresG);

    // Mouth
    mk('path', { d: 'M 82 145 Q 100 149 118 145', stroke: mouthC, 'stroke-width': '2.2', fill: 'none', 'stroke-linecap': 'round' }, featuresG);

    // Blush
    const bL = mk('ellipse', { cx: '62',  cy: '120', rx: '16', ry: '8', fill: blushC, opacity: '0.42', filter: `url(#${p}bF)` }, featuresG);
    const bR = mk('ellipse', { cx: '138', cy: '120', rx: '16', ry: '8', fill: blushC, opacity: '0.42', filter: `url(#${p}bF)` }, featuresG);

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(svg);

    elemsRef.current = { svg, halos, featuresG, lLid, lLsh, rLid, rLsh, bL, bR, browL, browR };

    // ── RAF loop ──────────────────────────────────────────────────────────
    function frame() {
      if (!elemsRef.current) return;
      const { svg, halos, featuresG, lLid, lLsh, rLid, rLsh, bL, bR, browL, browR } = elemsRef.current;

      const isFC    = isFirstContactRef.current;
      const isComp  = isCompleteRef.current;
      const syncLvl = syncLevelRef.current;
      const phase   = getPhase ? getPhase() : 0;

      // Feature group opacity — ghost mode fades in with sync
      const featureOpacity = (isFC && !isComp)
        ? Math.min(1, 0.08 + (syncLvl / SYNC_THRESHOLD) * (1 - 0.08))
        : 1.0;
      featuresG.setAttribute('opacity', featureOpacity.toFixed(3));

      // Halo rings — progressive appearance in 5% steps above 50% sync
      const numRings = Math.min(7, Math.floor(Math.max(0, syncLvl - 0.50) / 0.05));
      for (let i = 0; i < 7; i++) {
        halos[i].setAttribute('opacity', i < numRings ? String(HALO_OPACITIES[i]) : '0');
      }

      if (pausedRef.current) {
        // Neutral breath position — applied every frame while paused
        svg.style.transform = 'scale(1)';
        lLid.setAttribute('d', 'M 60 91 Q 76 94 92 91 A 17 17 0 0 0 60 91 Z');
        rLid.setAttribute('d', 'M 108 91 Q 124 94 140 91 A 17 17 0 0 0 108 91 Z');
        lLsh.setAttribute('d', 'M 60 91 Q 76 94 92 91');
        rLsh.setAttribute('d', 'M 108 91 Q 124 94 140 91');
        bL.setAttribute('opacity', '0.42');
        bR.setAttribute('opacity', '0.42');
        browL.setAttribute('transform', 'translate(0,0)');
        browR.setAttribute('transform', 'translate(0,0)');
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      // Breath animation cues (identical to AvatarBreathPacer)
      const bT = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;

      svg.style.transform = `scale(${(1 + SCALE_AMPLITUDE * bT).toFixed(4)})`;

      const ey = lerp(99.5, 88, bT).toFixed(1);
      lLid.setAttribute('d', `M 60 91 Q 76 ${ey} 92 91 A 17 17 0 0 0 60 91 Z`);
      rLid.setAttribute('d', `M 108 91 Q 124 ${ey} 140 91 A 17 17 0 0 0 108 91 Z`);
      lLsh.setAttribute('d', `M 60 91 Q 76 ${ey} 92 91`);
      rLsh.setAttribute('d', `M 108 91 Q 124 ${ey} 140 91`);

      const bop = lerp(0.62, 0.22, bT).toFixed(2);
      bL.setAttribute('opacity', bop);
      bR.setAttribute('opacity', bop);

      const dy = lerp(2.5, -2.5, bT).toFixed(1);
      browL.setAttribute('transform', `translate(0,${dy})`);
      browR.setAttribute('transform', `translate(0,${dy})`);

      rafRef.current = requestAnimationFrame(frame);
    }

    frameRef.current = frame;

    // ── Imperative control API ────────────────────────────────────────────
    if (controlRef) {
      controlRef.current = {
        resetToNeutral() {
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          if (elemsRef.current) {
            const { svg, halos, featuresG, lLid, lLsh, rLid, rLsh, bL, bR, browL, browR } = elemsRef.current;
            const fop = (isFirstContactRef.current && !isCompleteRef.current)
              ? Math.min(1, 0.08 + (syncLevelRef.current / SYNC_THRESHOLD) * (1 - 0.08))
              : 1.0;
            svg.style.transform = 'scale(1)';
            lLid.setAttribute('d', 'M 60 91 Q 76 94 92 91 A 17 17 0 0 0 60 91 Z');
            rLid.setAttribute('d', 'M 108 91 Q 124 94 140 91 A 17 17 0 0 0 108 91 Z');
            lLsh.setAttribute('d', 'M 60 91 Q 76 94 92 91');
            rLsh.setAttribute('d', 'M 108 91 Q 124 94 140 91');
            bL.setAttribute('opacity', '0.42');
            bR.setAttribute('opacity', '0.42');
            browL.setAttribute('transform', 'translate(0,0)');
            browR.setAttribute('transform', 'translate(0,0)');
            featuresG.setAttribute('opacity', fop.toFixed(3));
            halos.forEach(h => h.setAttribute('opacity', '0'));
          }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skinColor, eyeColor, size]);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    />
  );
}
