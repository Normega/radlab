# Claude Code Spec — Avatar "Ears & Species" Feature (v3)
**Project:** RADlab (`radlab.vercel.app`)
**Page:** `/profile/avatar`
**Feature:** "Ears & Species" unlock — a new selectable option in the "unlocked by exploring" panel

> **v3 notes:** All SVG coordinates, filter parameters, and texture values are finalised — do not adjust them. They were dialled in visually using a purpose-built editor. Implement exactly as specified.

---

## 1. Goal

Let users choose a **species** for their avatar. Species changes the avatar's head shape, adds a surface texture (fur or scales), constrains the available skin/eye color picker options, and adds species-specific SVG features (ears, fins, horns). The selected species is persisted to Supabase.

The user's chosen skin tone and eye color remain the primary color drivers. Species adds texture on top and narrows — but does not replace — the color picker.

| Key | Display name | Texture | Features |
|-----|-------------|---------|----------|
| `human` | Human | smooth | none |
| `wolf` | Wolf | fur (diffuse+specular) | pointed ears; wolf muzzle + nose |
| `cat` | Cat | fur (diffuse+specular) | triangular ears; inverted triangle nose; whiskers |
| `dragon` | Dragon | scales (arc pattern) | swept horns; dark keratin color |
| `fish` | Mermaid/Merman | scales (tile+noise) | curved side fins |

---

## 2. Existing Avatar — What Claude Code Needs to Know

The avatar is a **programmatically built SVG** (200 × 185 viewBox, rendered at 192 × 192px). Elements are created with a helper `mk(tag, attrs, parent)` that calls `createElementNS`. Key variables:

```
head        — <ellipse cx="100" cy="105" rx="64" ry="68">
browL/browR — <path> eyebrows at approximately y=82–85
lLid/rLid   — <path> animated eyelids
lLsh/rLsh   — <path> eyelid shadow lines
bL/bR       — <ellipse> blush marks cx="62/138" cy="120"
```

Gradients in `<defs>`:
- `dcHG` — radialGradient head fill (3 stops: `skinLt → skin → skinDk`)
- `dcIG` — radialGradient iris fill
- `dcSG` — radialGradient sclera

Colors derived from user picker selections:
```js
const SKIN = '#FDBCB4'  // user-selected
const EYE  = '#4A90D9'  // user-selected
// derived:
skinDk = drk(SKIN, 18)
skinLt = lgt(SKIN, 28)
blushC = mix(SKIN, '#FF8FAB', 0.45)
mouthC = drk(mix(SKIN, '#C06070', 0.5), 18)
inC    = mix(SKIN, '#FF9EAD', 0.45)   // inner ear pink
```

**Species never overrides SKIN or EYE.** It adds texture and constrains picker options only.

The breath animation runs in a `requestAnimationFrame` loop. Species elements must be inserted into the SVG before the loop starts.

---

## 3. Species Config Object

Create `lib/avatar-species.ts`:

```ts
type TextureType = 'smooth' | 'fur' | 'scales'
type FurMethod   = 'diffuse' | 'directional' | 'specular' | 'combined'
type ScaleMethod = 'arcs' | 'tile'

type SpeciesDef = {
  id: string
  label: string
  emoji: string
  texture: TextureType
  furMethod?: FurMethod       // fur species only
  scaleMethod?: ScaleMethod   // scale species only
  headRx: number
  headRy: number
  textureOpacity: number
  allowedSkinKeys: string[] | null
  allowedEyeKeys:  string[] | null
}
```

Values — implement exactly:

```ts
export const SPECIES: Record<string, SpeciesDef> = {
  human: {
    id: 'human', label: 'Human', emoji: '🧑',
    texture: 'smooth',
    headRx: 64, headRy: 68,
    textureOpacity: 0,
    allowedSkinKeys: null, allowedEyeKeys: null,
  },
  wolf: {
    id: 'wolf', label: 'Wolf', emoji: '🐺',
    texture: 'fur', furMethod: 'combined',
    headRx: 62, headRy: 70,
    textureOpacity: 0.65,
    allowedSkinKeys: ['grey', 'cool-taupe', 'blue-grey', 'warm-white'],
    allowedEyeKeys:  ['amber', 'green', 'yellow', 'pale-blue'],
  },
  cat: {
    id: 'cat', label: 'Cat', emoji: '🐱',
    texture: 'fur', furMethod: 'combined',
    headRx: 62, headRy: 65,
    textureOpacity: 0.45,
    allowedSkinKeys: ['warm-cream', 'orange', 'tawny', 'warm-grey'],
    allowedEyeKeys:  ['green', 'gold', 'hazel', 'warm-amber'],
  },
  dragon: {
    id: 'dragon', label: 'Dragon', emoji: '🐉',
    texture: 'scales', scaleMethod: 'arcs',
    headRx: 68, headRy: 66,
    textureOpacity: 1.0,
    allowedSkinKeys: ['teal', 'blue-green', 'deep-green', 'purple'],
    allowedEyeKeys:  ['gold', 'amber', 'pale-yellow', 'red-orange'],
  },
  fish: {
    id: 'fish', label: 'Mermaid', emoji: '🐟',
    texture: 'scales', scaleMethod: 'tile',
    headRx: 60, headRy: 70,
    textureOpacity: 1.0,
    allowedSkinKeys: ['blue', 'teal', 'aqua', 'cool-purple'],
    allowedEyeKeys:  ['violet', 'purple', 'deep-blue', 'blue-green'],
  },
}
```

---

## 4. SVG Geometry — Finalised Coordinates

All paths were dialled in visually. Implement exactly as written. Right-side features use `transform="translate(200,0) scale(-1,1)"` **except for filtered paths** (wolf/cat ears) — those must use explicitly mirrored coordinates computed in JS (`mirrorX = 200 - x` for every x value). This is required because `feDiffuseLighting` normals break under coordinate-system mirroring and produce a black result.

### Mirror helper (required for wolf/cat ears)

```js
function mirrorPath(d) {
  const mx = x => (200 - parseFloat(x)).toFixed(1)
  return d
    .replace(/M\s*([\d.]+)\s+([\d.]+)/g, (_, x, y) => `M ${mx(x)} ${y}`)
    .replace(/L\s*([\d.]+)\s+([\d.]+)/g, (_, x, y) => `L ${mx(x)} ${y}`)
    .replace(/Q\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/g,
      (_, cx, cy, x, y) => `Q ${mx(cx)} ${cy} ${mx(x)} ${y}`)
}
```

### Wolf

```
Head:   rx=62 ry=70
Ears:   anchorY=68  (feature meets head at this Y level)

Left outer ear:
M 45.4 68 L 54 5 L 88.4 55.7 Z

Left inner ear (fill: mix(SKIN,'#FF9EAD',0.45), opacity=0.53):
M 50.3 54.1 L 54 16.3 L 79.6 43.2 Z

Right ear: mirrorPath() — do NOT use SVG transform
```

Wolf-specific face features (replace generic nose/mouth for wolf only):
```
Muzzle patch:  <ellipse cx="100" cy="140" rx="26" ry="20" fill=lgt(SKIN,18) opacity="0.85"/>
Nose:          <ellipse cx="100" cy="154" rx="13" ry="9" fill="#1a100a"/>
Nose highlight:<ellipse cx="95" cy="150" rx="4" ry="2.5" fill="white" opacity="0.22"/>
Nostril crease:<path d="M 91 156 Q 100 160 109 156" stroke="#0d0806" stroke-width="1.2"/>
Centre line:   <path d="M 100 118 L 100 146"> (fur direction mark, skinDk stroke, opacity 0.5)
Jowl left:     <path d="M 88 136 Q 82 148 86 157" stroke=skinDk stroke-width="1.8" opacity="0.7"/>
Jowl right:    <path d="M 112 136 Q 118 148 114 157" stroke=skinDk stroke-width="1.8" opacity="0.7"/>
```

### Cat

```
Head:   rx=62 ry=65
Ears:   anchorY=69

Left outer ear:
M 46.4 69 L 54 24 L 72.4 61.8 Z

Left inner ear (fill: mix(SKIN,'#FF9EAD',0.45), opacity=0.53):
M 50.7 59.1 L 54 32.1 L 61.9 53.5 Z

Right ear: mirrorPath() — do NOT use SVG transform
```

Cat-specific face features (replace generic nose/mouth for cat only):
```
Nose (inverted triangle, fill=mix(SKIN,'#D06080',0.55)):
  <path d="M 95 113 L 100 121 L 105 113 Z"/>
Philtrum:
  <path d="M 96 121 Q 100 125 104 121" stroke=mouthC stroke-width="1.2"/>
Whiskers (catNoseY=117, start x=68/132 from center, end at ±15% beyond rx=62):
  Left:  3 lines from x=68 to x≈29, fanning at y=112, y=117, y=123
  Right: mirror at x=132 to x≈171
  stroke=skinDk, stroke-width 0.7–0.85, opacity 0.5–0.6
```

### Dragon

```
Head:   rx=68 ry=66
Horns:  anchorY=58

Left horn (fill=drk(mix(SKIN,'#200800',0.6),10) — dark keratin, not skin-toned):
M 63 58 Q 61 35 71 12 Q 81 35 79 58 Z

Right horn: transform="translate(200,0) scale(-1,1)"  ← SVG transform OK for horns (no filter)
```

### Fish

```
Head:   rx=60 ry=70
Fins:   anchorY=38

Left fin:
M 76.6 38 Q 98 -5 102 5 Q 108 19 96.6 50.6 Z

Right fin: transform="translate(200,0) scale(-1,1)"  ← SVG transform OK for fins (no filter)
```

---

## 5. Texture Implementation

### DOM insertion order (critical)

```
<g id="dc-species-behind">   ← ears/fins — inserted BEFORE head ellipse
<ellipse (head)>
<g id="dc-species-front">    ← texture overlay + horns + face marks — inserted AFTER head
[eyes, brows, nose, mouth]
```

On species change: clear both groups, rebuild both.

### Fur filter (wolf and cat — same filter)

All parameters are finalised. Implement this exact filter:

```xml
<filter id="dc-fur-f" x="-30%" y="-30%" width="160%" height="160%">
  <!-- Pelt pass: noise treated as bump map via diffuse lighting -->
  <feTurbulence type="fractalNoise" baseFrequency="0.11 0.11"
                numOctaves="4" result="peltNoise"/>
  <feDiffuseLighting in="peltNoise" lighting-color="#A9A9A9"
                     surfaceScale="3" result="diffLight">
    <feDistantLight azimuth="225" elevation="60"/>
  </feDiffuseLighting>
  <!-- Specular pass: sharp highlights for surface sheen -->
  <feSpecularLighting in="peltNoise" lighting-color="#ffffff"
                      specularConstant="0.3" specularExponent="8" result="specLight">
    <fePointLight x="100" y="60" z="120"/>
  </feSpecularLighting>
  <!-- Merge both lighting passes -->
  <feMerge result="mergedLight">
    <feMergeNode in="diffLight"/>
    <feMergeNode in="specLight"/>
  </feMerge>
  <!-- Clip merged lighting to source shape -->
  <feComposite in="mergedLight" in2="SourceGraphic" operator="in" result="peltedBase"/>
  <!-- Edge pass: coarse noise displaces the pelted result outward for ragged silhouette -->
  <feTurbulence type="fractalNoise" baseFrequency="0.21"
                numOctaves="2" seed="15" result="shagNoise"/>
  <feDisplacementMap in="peltedBase" in2="shagNoise"
                     scale="5" xChannelSelector="R" yChannelSelector="G"/>
</filter>
```

Apply to ears (wolf/cat outer ear paths, in `dc-species-behind`) AND the head overlay ellipse (in `dc-species-front`):

```js
// Outer ear — apply filter directly to path element
mk('path', { d: outerEarPath, fill: SKIN, stroke: skinDk,
             'stroke-width': 0.5, filter: 'url(#dc-fur-f)' }, behindGroup)
// Head overlay
mk('ellipse', { cx:100, cy:105, rx: sp.headRx, ry: sp.headRy,
                fill: SKIN, filter: 'url(#dc-fur-f)',
                opacity: sp.textureOpacity, 'pointer-events':'none' }, frontGroup)
```

Wolf outer ear opacity: 0.65. Cat outer ear opacity: 0.45.

**Critical:** right-side wolf/cat ears must use `mirrorPath()` — not SVG transform — because the filter's diffuse lighting normals produce black output under coordinate-system mirroring.

### Scale texture — dragon (arc pattern)

```xml
<pattern id="dc-scales-arcs" x="0" y="0" width="14" height="10"
         patternUnits="userSpaceOnUse">
  <path d="M 0 10 Q 7 2 14 10" fill="none" stroke="SKIN_DK"
        stroke-width="1.4" opacity="0.7"/>
  <path d="M -7 5 Q 0 -3 7 5" fill="none" stroke="SKIN_DK"
        stroke-width="1.4" opacity="0.7"/>
</pattern>
<clipPath id="dc-head-clip">
  <ellipse cx="100" cy="105" rx="HEADRX" ry="HEADRY"/>
</clipPath>
```

Replace `SKIN_DK` at runtime via `setAttribute`. Update clipPath `rx`/`ry` on species change.

Overlay ellipse: `fill="url(#dc-scales-arcs)"`, `clip-path="url(#dc-head-clip)"`, `opacity=1.0`.

### Scale texture — fish (tile + noise)

```xml
<filter id="dc-scales-tile-f" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.08 0.04"
                numOctaves="2" seed="7" result="tileNoise"/>
  <feDisplacementMap in="SourceGraphic" in2="tileNoise"
                     scale="6" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<pattern id="dc-scales-tile" x="0" y="0" width="18" height="13"
         patternUnits="userSpaceOnUse">
  <path d="M 0 13 Q 4 7 9 13 Q 13 7 18 13"
        fill="SKIN_DK" fill-opacity="0.18" stroke="SKIN_DK"
        stroke-width="0.9" opacity="0.8"/>
  <path d="M -9 6 Q -4 0 1 6 Q 5 0 10 6 Q 14 0 19 6"
        fill="SKIN_DK" fill-opacity="0.12" stroke="SKIN_DK"
        stroke-width="0.7" opacity="0.6"/>
</pattern>
```

Overlay ellipse: `fill="url(#dc-scales-tile)"`, `clip-path="url(#dc-head-clip)"`,
`filter="url(#dc-scales-tile-f)"`, `opacity=1.0`.

---

## 6. Color Picker Constraints

Read the existing skin tone and eye color picker implementation before touching this.

- When a non-human species is active, filter picker options to `allowedSkinKeys` / `allowedEyeKeys`
- If the current selection is outside the allowed subset, auto-shift to the nearest allowed value by hue distance and re-derive all computed colors normally
- Show a small label near the picker (e.g. "Wolf palette") explaining the constraint
- Restoring human restores all options

Do not remove the picker — constrain it in place.

---

## 7. Avatar Rendering Changes

1. **SKIN / EYE** — do not change how these are sourced
2. **Head shape** — `setAttribute('rx', sp.headRx)` and `setAttribute('ry', sp.headRy)` on the head ellipse
3. **Two groups** — `dc-species-behind` (before head) and `dc-species-front` (after head, before face features). Clear and rebuild both on species change.
4. **Nose/mouth** — wolf and cat replace the generic nose/mouth with species-specific elements (see Section 4). Dragon and fish keep the generic nose/mouth.
5. **Animation loop** — no changes needed

---

## 8. UI — Species Selector

In the "unlocked by exploring" panel, add an "Ears & Species" subsection:

- Horizontal scroll row of species cards
- Each card: emoji + label, selected state via existing active token
- `human` always available; others show 🔒 and are non-interactive until unlocked
- Match visual pattern of existing unlock options exactly

---

## 9. Supabase Persistence

Read schema before creating anything.

1. Store selected species in the existing avatar config column (e.g. `profiles.avatar_config -> species`)
2. Unlock rows for four non-human species — match existing unlock key naming convention
3. On mount: fetch species + unlocks, initialise avatar, mark locked/unlocked cards
4. On select: optimistic update → upsert → rollback + toast on error

---

## 10. File Audit Checklist

Before writing any code:

- [ ] Avatar page component — state management, SVG mount pattern
- [ ] Skin/eye picker implementation — option storage, selection application
- [ ] Supabase client — auth pattern, query style
- [ ] DB schema — `profiles`, unlock/feature tables
- [ ] Unlock panel component — visual and data patterns
- [ ] Design system tokens — use only existing tokens in new UI

---

## 11. Acceptance Criteria

- [ ] Species change immediately re-renders head shape, texture, and extras — no reload
- [ ] Fur texture visible on wolf and cat; ragged edge displacement present
- [ ] Scale texture visible on dragon and fish; color adapts to skin tone
- [ ] Wolf muzzle, nose, and jowl lines render correctly; generic nose/mouth suppressed
- [ ] Cat inverted triangle nose and whiskers render correctly; generic nose/mouth suppressed
- [ ] Dragon horns use dark keratin color, not skin tone
- [ ] No visible gap between ears/fins and head
- [ ] Right-side wolf/cat ears use mirrorPath() — no black ear from filter+transform conflict
- [ ] Breath animation continues uninterrupted through species change
- [ ] SKIN/EYE picker selection preserved across species change; picker constrained appropriately
- [ ] Species persists across page reloads
- [ ] Locked species show lock indicator and are non-interactive
- [ ] All UI uses existing design tokens
- [ ] No TypeScript errors; no console errors
- [ ] Mobile-responsive horizontal scroll

---

## 12. Out of Scope

- Unlock mechanism (how users earn species)
- Animated species transitions
- Body/torso features
- Combined species-aware palette picker
