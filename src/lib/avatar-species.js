// Two DOM groups per species:
//   behind({ skin, skinLit, skinDark, furFilterId }) → descriptors inserted BEFORE head
//   front({ skin, skinLit, skinDark, furFilterId })  → descriptors inserted AFTER head
//                                                       (texture overlay handled by BaseAvatar;
//                                                        front is for horns, face marks, etc.)
//
// noseMouth({ skin, skinLit, skinDark, mouthC }) → descriptors replacing the generic mouth.
//   null = keep the generic mouth.
//
// allowedSkinKeys / allowedEyeKeys — label strings from SKIN_COLORS / EYE_COLORS.
//
// Right-side wolf/cat ears use mirrorPath(), not SVG transform="scale(-1,1)".
// feDiffuseLighting normals produce black output under coordinate-system mirroring.
// Dragon horns and fish fins are unfiltered and safely use SVG transform.

function mirrorPath(d) {
  const mx = x => (200 - parseFloat(x)).toFixed(1)
  return d
    .replace(/M\s*([\d.]+)\s+([\d.]+)/g,
      (_, x, y) => `M ${mx(x)} ${y}`)
    .replace(/L\s*([\d.]+)\s+([\d.]+)/g,
      (_, x, y) => `L ${mx(x)} ${y}`)
    .replace(/Q\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/g,
      (_, cx, cy, x, y) => `Q ${mx(cx)} ${cy} ${mx(x)} ${y}`)
}

function mixC(hexA, hexB, t) {
  const n1 = parseInt(hexA.replace('#', ''), 16)
  const n2 = parseInt(hexB.replace('#', ''), 16)
  const ch = s => Math.max(0, Math.min(255,
    Math.round(((n1 >> s) & 255) + (((n2 >> s) & 255) - ((n1 >> s) & 255)) * t)
  ))
  return '#' + [16, 8, 0].map(ch).map(v => v.toString(16).padStart(2, '0')).join('')
}

function darkenC(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16)
  const ch = s => Math.max(0, Math.min(255, ((n >> s) & 255) - amt))
  return '#' + [16, 8, 0].map(ch).map(v => v.toString(16).padStart(2, '0')).join('')
}

export const SPECIES = {
  human: {
    id: 'human', label: 'Human', emoji: '🧑',
    texture: 'smooth',
    headRx: 64, headRy: 68,
    textureOpacity: 0,
    allowedSkinKeys: null,
    allowedEyeKeys:  null,
    behind:    () => [],
    front:     () => [],
    noseMouth: null,
  },

  wolf: {
    id: 'wolf', label: 'Wolf', emoji: '🐺',
    texture: 'fur', furMethod: 'combined',
    headRx: 62, headRy: 70,
    textureOpacity: 0.65,
    allowedSkinKeys: ['Porcelain', 'Lavender', 'Sky', 'Dusk', 'Ocean', 'Periwinkle'],
    allowedEyeKeys:  ['Hazel', 'Sky Blue', 'Forest', 'Dark Green', 'Amber', 'Teal', 'Ember', 'Moss'],
    behind: ({ skin, skinDark, furFilterId }) => {
      const lOuter = 'M 45.4 68 L 54 5 L 88.4 55.7 Z'
      const lInner = 'M 50.3 54.1 L 54 16.3 L 79.6 43.2 Z'
      const inC    = mixC(skin, '#FF9EAD', 0.45)
      return [
        { tag: 'path', key: 'lEarO', d: lOuter,             fill: skin, stroke: skinDark, strokeWidth: '0.5', filter: `url(#${furFilterId})`, opacity: '0.65' },
        { tag: 'path', key: 'lEarI', d: lInner,             fill: inC,  opacity: '0.53' },
        { tag: 'path', key: 'rEarO', d: mirrorPath(lOuter), fill: skin, stroke: skinDark, strokeWidth: '0.5', filter: `url(#${furFilterId})`, opacity: '0.65' },
        { tag: 'path', key: 'rEarI', d: mirrorPath(lInner), fill: inC,  opacity: '0.53' },
      ]
    },
    front: () => [],
    noseMouth: ({ skinLit, skinDark }) => [
      { tag: 'ellipse', key: 'muzzle',     cx: '100', cy: '140', rx: '26', ry: '20',  fill: skinLit,   opacity: '0.85' },
      { tag: 'ellipse', key: 'nose',       cx: '100', cy: '154', rx: '13', ry: '9',   fill: '#1a100a' },
      { tag: 'ellipse', key: 'noseHi',     cx: '95',  cy: '150', rx: '4',  ry: '2.5', fill: 'white',   opacity: '0.22' },
      { tag: 'path',    key: 'nostrils',   d: 'M 91 156 Q 100 160 109 156', stroke: '#0d0806', strokeWidth: '1.2', fill: 'none' },
      { tag: 'path',    key: 'centreLine', d: 'M 100 118 L 100 146', stroke: skinDark, strokeWidth: '1',   fill: 'none', opacity: '0.5',  strokeLinecap: 'round' },
      { tag: 'path',    key: 'jowlL',      d: 'M 88 136 Q 82 148 86 157', stroke: skinDark, strokeWidth: '1.8', fill: 'none', opacity: '0.7',  strokeLinecap: 'round' },
      { tag: 'path',    key: 'jowlR',      d: 'M 112 136 Q 118 148 114 157', stroke: skinDark, strokeWidth: '1.8', fill: 'none', opacity: '0.7', strokeLinecap: 'round' },
    ],
  },

  dragon: {
    id: 'dragon', label: 'Dragon', emoji: '🐉',
    texture: 'scales', scaleMethod: 'arcs',
    headRx: 68, headRy: 66,
    textureOpacity: 1.0,
    allowedSkinKeys: ['Lavender', 'Sky', 'Mint', 'Dusk', 'Ocean', 'Jade', 'Periwinkle'],
    allowedEyeKeys:  ['Warm Brown', 'Hazel', 'Amber', 'Ember'],
    behind: () => [],
    // Horns in front so they appear over the scales texture overlay
    front: ({ skin }) => {
      const hornFill = darkenC(mixC(skin, '#200800', 0.6), 10)
      const lHorn = 'M 63 58 Q 61 35 71 12 Q 81 35 79 58 Z'
      return [
        { tag: 'path', key: 'lHorn', d: lHorn, fill: hornFill },
        { tag: 'path', key: 'rHorn', d: lHorn, fill: hornFill, transform: 'translate(200,0) scale(-1,1)' },
      ]
    },
    noseMouth: null,
  },

  cat: {
    id: 'cat', label: 'Cat', emoji: '🐱',
    texture: 'fur', furMethod: 'combined',
    headRx: 62, headRy: 65,
    textureOpacity: 0.45,
    allowedSkinKeys: ['Porcelain', 'Peach', 'Sand', 'Honey', 'Caramel', 'Chestnut', 'Buttercup', 'Rose'],
    allowedEyeKeys:  ['Warm Brown', 'Hazel', 'Forest', 'Dark Green', 'Amber', 'Teal', 'Ember', 'Moss'],
    behind: ({ skin, skinDark, furFilterId }) => {
      const lOuter = 'M 46.4 69 L 54 24 L 72.4 61.8 Z'
      const lInner = 'M 50.7 59.1 L 54 32.1 L 61.9 53.5 Z'
      const inC    = mixC(skin, '#FF9EAD', 0.45)
      return [
        { tag: 'path', key: 'lEarO', d: lOuter,             fill: skin, stroke: skinDark, strokeWidth: '0.5', filter: `url(#${furFilterId})`, opacity: '0.45' },
        { tag: 'path', key: 'lEarI', d: lInner,             fill: inC,  opacity: '0.53' },
        { tag: 'path', key: 'rEarO', d: mirrorPath(lOuter), fill: skin, stroke: skinDark, strokeWidth: '0.5', filter: `url(#${furFilterId})`, opacity: '0.45' },
        { tag: 'path', key: 'rEarI', d: mirrorPath(lInner), fill: inC,  opacity: '0.53' },
      ]
    },
    front: () => [],
    noseMouth: ({ skin, skinDark, mouthC }) => {
      const noseFill = mixC(skin, '#D06080', 0.55)
      return [
        { tag: 'path', key: 'nose',     d: 'M 95 113 L 100 121 L 105 113 Z', fill: noseFill },
        { tag: 'path', key: 'philtrum', d: 'M 96 121 Q 100 125 104 121', stroke: mouthC, strokeWidth: '1.2', fill: 'none', strokeLinecap: 'round' },
        // Whiskers — 3 lines each side fanning from x=68/132 to ≈29/171
        { tag: 'line', key: 'wL1', x1: '68', y1: '112', x2: '29', y2: '109', stroke: skinDark, strokeWidth: '0.7',  opacity: '0.5' },
        { tag: 'line', key: 'wL2', x1: '68', y1: '117', x2: '29', y2: '117', stroke: skinDark, strokeWidth: '0.85', opacity: '0.6' },
        { tag: 'line', key: 'wL3', x1: '68', y1: '123', x2: '29', y2: '125', stroke: skinDark, strokeWidth: '0.7',  opacity: '0.5' },
        { tag: 'line', key: 'wR1', x1: '132', y1: '112', x2: '171', y2: '109', stroke: skinDark, strokeWidth: '0.7',  opacity: '0.5' },
        { tag: 'line', key: 'wR2', x1: '132', y1: '117', x2: '171', y2: '117', stroke: skinDark, strokeWidth: '0.85', opacity: '0.6' },
        { tag: 'line', key: 'wR3', x1: '132', y1: '123', x2: '171', y2: '125', stroke: skinDark, strokeWidth: '0.7',  opacity: '0.5' },
      ]
    },
  },

  fish: {
    id: 'fish', label: 'Mermaid', emoji: '🐟',
    texture: 'scales', scaleMethod: 'tile',
    headRx: 60, headRy: 70,
    textureOpacity: 1.0,
    allowedSkinKeys: ['Lavender', 'Sky', 'Mint', 'Dusk', 'Ocean', 'Jade', 'Periwinkle'],
    allowedEyeKeys:  ['Deep Blue', 'Forest', 'Dark Green', 'Purple', 'Teal', 'Steel', 'Violet', 'Moss'],
    // Fins are unfiltered — SVG transform is safe here
    behind: ({ skin }) => {
      const lFin = 'M 76.6 38 Q 98 -5 102 5 Q 108 19 96.6 50.6 Z'
      return [
        { tag: 'path', key: 'lFin', d: lFin, fill: skin, opacity: '0.85' },
        { tag: 'path', key: 'rFin', d: lFin, fill: skin, opacity: '0.85', transform: 'translate(200,0) scale(-1,1)' },
      ]
    },
    front:     () => [],
    noseMouth: null,
  },
}

export const SPECIES_ORDER = ['human', 'wolf', 'dragon', 'cat', 'fish']
