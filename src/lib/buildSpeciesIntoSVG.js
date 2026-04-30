import { SPECIES } from './avatar-species'

const NS = 'http://www.w3.org/2000/svg'

function mk(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  if (parent) parent.appendChild(el)
  return el
}

// SPECIES descriptors use camelCase (matching React JSX); setAttribute needs kebab SVG names.
function toSvgAttr(k) {
  return k.replace(/([A-Z])/g, m => '-' + m.toLowerCase())
}

function descToEl({ tag, key, ...attrs }) {
  const el = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(toSvgAttr(k), v)
  return el
}

// Inject species-specific defs + elements into an imperatively-built SVG.
//
// Call AFTER headEl is already appended to svg, BEFORE brows/eyes/mouth/blush.
// Mutates headEl rx/ry, inserts behindG before headEl, inserts frontG after headEl.
// Returns noseMouthEls (array|null) — caller appends to appropriate container.
export function buildSpeciesIntoSVG({ species, p, skin, skinLt, skinDk, mouthC, defs, headEl, svg }) {
  const sp    = SPECIES[species] ?? SPECIES.human
  const furId = `${p}fur`

  headEl.setAttribute('rx', String(sp.headRx))
  headEl.setAttribute('ry', String(sp.headRy))

  if (sp.texture === 'fur') {
    const ff = mk('filter', { id: furId, x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs)
    mk('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.11 0.11', numOctaves: '4', result: 'peltNoise' }, ff)
    const dl = mk('feDiffuseLighting', { in: 'peltNoise', surfaceScale: '3', result: 'diffLight' }, ff)
    dl.setAttribute('lighting-color', '#A9A9A9')
    mk('feDistantLight', { azimuth: '225', elevation: '60' }, dl)
    const sl = mk('feSpecularLighting', { in: 'peltNoise', specularConstant: '0.3', specularExponent: '8', result: 'specLight' }, ff)
    sl.setAttribute('lighting-color', '#ffffff')
    mk('fePointLight', { x: '100', y: '60', z: '120' }, sl)
    const merge = mk('feMerge', { result: 'mergedLight' }, ff)
    mk('feMergeNode', { in: 'diffLight' }, merge)
    mk('feMergeNode', { in: 'specLight' }, merge)
    mk('feComposite', { in: 'mergedLight', in2: 'SourceGraphic', operator: 'in', result: 'peltedBase' }, ff)
    mk('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.21', numOctaves: '2', seed: '15', result: 'shagNoise' }, ff)
    const dm = mk('feDisplacementMap', { in: 'peltedBase', in2: 'shagNoise', scale: '5' }, ff)
    dm.setAttribute('xChannelSelector', 'R')
    dm.setAttribute('yChannelSelector', 'G')
  }

  if (sp.texture === 'scales' && sp.scaleMethod === 'arcs') {
    const pat = mk('pattern', { id: `${p}scl`, x: '0', y: '0', width: '14', height: '10', patternUnits: 'userSpaceOnUse' }, defs)
    mk('path', { d: 'M 0 10 Q 7 2 14 10', fill: 'none', stroke: skinDk, 'stroke-width': '1.4', opacity: '0.7' }, pat)
    mk('path', { d: 'M -7 5 Q 0 -3 7 5',  fill: 'none', stroke: skinDk, 'stroke-width': '1.4', opacity: '0.7' }, pat)
    const hclip = mk('clipPath', { id: `${p}hclip` }, defs)
    mk('ellipse', { cx: '100', cy: '105', rx: String(sp.headRx), ry: String(sp.headRy) }, hclip)
  }

  if (sp.texture === 'scales' && sp.scaleMethod === 'tile') {
    const stlf = mk('filter', { id: `${p}stlf`, x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs)
    mk('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.08 0.04', numOctaves: '2', seed: '7', result: 'tileNoise' }, stlf)
    const tdm = mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'tileNoise', scale: '6' }, stlf)
    tdm.setAttribute('xChannelSelector', 'R')
    tdm.setAttribute('yChannelSelector', 'G')
    const pat = mk('pattern', { id: `${p}stl`, x: '0', y: '0', width: '18', height: '13', patternUnits: 'userSpaceOnUse' }, defs)
    mk('path', { d: 'M 0 13 Q 4 7 9 13 Q 13 7 18 13', fill: skinDk, 'fill-opacity': '0.18', stroke: skinDk, 'stroke-width': '0.9', opacity: '0.8' }, pat)
    mk('path', { d: 'M -9 6 Q -4 0 1 6 Q 5 0 10 6 Q 14 0 19 6', fill: skinDk, 'fill-opacity': '0.12', stroke: skinDk, 'stroke-width': '0.7', opacity: '0.6' }, pat)
    const hclip = mk('clipPath', { id: `${p}hclip` }, defs)
    mk('ellipse', { cx: '100', cy: '105', rx: String(sp.headRx), ry: String(sp.headRy) }, hclip)
  }

  const behindDescs = sp.behind({ skin, skinLit: skinLt, skinDark: skinDk, furFilterId: furId })
  const frontDescs  = sp.front({ skin, skinLit: skinLt, skinDark: skinDk, furFilterId: furId })

  let textureEl = null
  if (sp.texture === 'fur') {
    textureEl = mk('ellipse', {
      cx: '100', cy: '105', rx: String(sp.headRx), ry: String(sp.headRy),
      fill: skin, filter: `url(#${furId})`, opacity: String(sp.textureOpacity),
      'pointer-events': 'none',
    })
  } else if (sp.texture === 'scales' && sp.scaleMethod === 'arcs') {
    textureEl = mk('ellipse', {
      cx: '100', cy: '105', rx: String(sp.headRx), ry: String(sp.headRy),
      fill: `url(#${p}scl)`, 'clip-path': `url(#${p}hclip)`, opacity: '1.0',
      'pointer-events': 'none',
    })
  } else if (sp.texture === 'scales' && sp.scaleMethod === 'tile') {
    textureEl = mk('ellipse', {
      cx: '100', cy: '105', rx: String(sp.headRx), ry: String(sp.headRy),
      fill: `url(#${p}stl)`, 'clip-path': `url(#${p}hclip)`,
      filter: `url(#${p}stlf)`, opacity: '1.0', 'pointer-events': 'none',
    })
  }

  // behind group: between halos/rings and head
  const behindG = document.createElementNS(NS, 'g')
  behindDescs.forEach(d => behindG.appendChild(descToEl(d)))
  svg.insertBefore(behindG, headEl)

  // front group: texture overlay + horns, immediately after head
  const frontG = document.createElementNS(NS, 'g')
  if (textureEl) frontG.appendChild(textureEl)
  frontDescs.forEach(d => frontG.appendChild(descToEl(d)))
  svg.insertBefore(frontG, headEl.nextSibling)

  const noseMouthEls = sp.noseMouth
    ? sp.noseMouth({ skin, skinLit: skinLt, skinDark: skinDk, mouthC }).map(descToEl)
    : null

  return { noseMouthEls }
}
