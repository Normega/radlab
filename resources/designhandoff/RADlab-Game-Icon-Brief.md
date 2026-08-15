# RADlab — Game Icon Generation Brief

**For:** an external image/vector generation service, or an illustrator working from prompts.
**Deliverable:** 12 icons, one per game, as SVG (primary) and PNG (fallback).
**Reference implementation:** `src/games/shared/GameIcon.jsx` in the RADlab repo — a complete hand-drawn set already exists and is reviewable at `/dev/game-icons`. Treat it as the *floor*, not the target: the brief below is what to beat.

---

## 0. Read this before the per-game prompts

**These twelve are a set, not twelve pictures.** The single most common failure mode is twelve individually attractive icons that do not sit together in a row. Every constraint in §1 exists to prevent that, and §5 is the check. If a per-game prompt in §3 conflicts with §1, §1 wins.

**On SVG.** Most text-to-image models cannot produce usable SVG — they produce raster, and auto-tracing it yields hundreds of paths, stray strokes and off-palette anti-aliasing colours. Either use a service with genuine vector output (Recraft's vector mode, Kittl, SVG.io, Illustrator's generative vectors) or generate raster and have a human redraw. **Auto-traced output will fail §5 and is not acceptable.**

---

## 1. House style — prepend to every prompt

> Flat vector icon, single scene, centred inside a circle. Filled shapes only — no outlines, no strokes, no line art. No gradients except where explicitly requested. No drop shadows, no 3D, no bevels, no photorealism, no texture, no perspective. No text, letters, or numbers anywhere. Soft, warm, friendly, calm; hand-drawn feeling but geometrically clean. The subject fills roughly 70% of the circle and is optically centred. Background is a solid soft-pink circular plate `#FBEAF3`, and nothing extends past the edge of that circle.

**Negative prompt** (use verbatim where the service supports one):

```
outline, stroke, line art, border, sketch, gradient mesh, 3d, isometric, bevel,
emboss, drop shadow, glow effect, photorealistic, photograph, texture, grain,
noise, perspective, text, letters, numbers, watermark, signature, ui mockup,
app screenshot, busy, cluttered, realistic fur, realistic feathers
```

### Why "no strokes" is non-negotiable

The same drawing is used at **116px** (game card), **60px** (instruction screen) and **24px** (badge). A 1.5px stroke drawn for the badge becomes a 7px slab at card size. Fills scale exactly; strokes do not. Any stroke in a delivered SVG must be converted to a filled path.

---

## 2. Technical requirements for the SVG

| Requirement | Value |
|---|---|
| viewBox | `0 0 48 48` — exactly this, no other coordinate space |
| Canvas | Square; the visible plate is a circle `cx=24 cy=24 r=24` |
| Clipping | **All content clipped to that circle.** Scene icons run edge-to-edge by construction and will otherwise spill into a rectangle |
| Fills | Flat solid colours only, from the per-game palette. `fill-opacity` is allowed for haze and glow |
| Strokes | **None.** Convert every stroke to a filled path before delivery |
| Paths | Aim for ≤ 14 top-level shapes. More than ~25 means it was auto-traced |
| Forbidden | `<text>`, `<image>`, `<filter>`, `<foreignObject>`, embedded raster, CSS classes, inline `style` attributes |
| ids | If a `<clipPath>`/`<mask>`/gradient is needed, its id must be unique per file — these get inlined into a page where duplicate ids collide |
| Minimum feature | Nothing thinner than **2 units** on the 48 grid, or it disappears at badge size |
| File size | Under 4 KB each |

**PNG fallback:** 512×512, transparent background outside the plate circle, plus a 48×48 export for eyeballing badge legibility.

---

## 3. The twelve prompts

Each block is copy-paste ready. Prepend §1, append the §1 negative prompt.

---

### 1. Still Water — *Emotion check-in*

*The game: two quick questions place how you feel on a mood wheel — Sad↔Excited on one axis, Calm↔Tense on the other.*

```
A circular mood wheel seen face-on: a pale ring with two straight bars crossing
at its centre in an X, one warm gold and one deep purple, and a single small
crimson marker dot resting off-centre in the upper right of the wheel. Calm,
diagrammatic, softly coloured.
```

- **Palette:** ring `#E8D0E0`, inner face `#FDF6FA`, gold axis `#C4A000`, purple axis `#804080`, marker `#C04A82`
- **Must avoid:** reading as a pinwheel, a fan, a compass rose, or a "no entry" sign. The two bars are axes, not blades — keep them even in width and do not taper or curve them.
- **Note:** the two axis colours are meaningful and are taken from the game's own diagram. Do not substitute.

---

### 2. Face Read — *Emotion recognition*

*The game: a face animates from neutral into an expression, and you name the feeling and its intensity.*

```
A simple round human face mid-expression, warm light-brown skin, two dark oval
eyes, two angled eyebrows giving a clear readable emotion, and a small open
mouth. Friendly and gentle, not comic, not a smiley-face emoji.
```

- **Palette:** skin `#F2C9A4`, brows `#8A5A3A`, eyes `#1C1C1E`, mouth `#A8452F`
- **Must avoid:** an emoji or smiley; a perfectly neutral face (the game is *about* the expression, so the brows must carry a feeling); exaggerated cartoon features.
- **Note:** ambiguous-but-present emotion is ideal — the player's task is to name it.

---

### 3. Contact — *Breath sync*

*The game: you breathe together with your "Ripple", a small creature that comes alive the more you sync with it.*

```
A small round teal creature with a rounded body and a slightly smaller head,
two large dark friendly eyes with tiny white highlights, surrounded by two
concentric soft translucent teal halos radiating outward like a calm pulse.
Serene, alive, welcoming.
```

- **Palette:** body `#3F9EA8`, head `#4FB3BA`, halos `#4FB3BA` at 16% and 24% opacity, eyes `#0F3B40`, highlights `#FFFFFF`
- **Must avoid:** limbs, arms, legs, a face that reads as human; a jellyfish; anything sharp or spiky. The halo is calm breath, not an energy blast or a wifi symbol.

---

### 4. Ebb & Flow — *Breath sync · Interoception*

*The game: you follow your Ripple's breathing rhythm, and report when the rhythm subtly changes.*

```
Two horizontal wave bands stacked one above the other, spanning the full width
of the circle. The upper wave is deeper and darker blue with tall smooth
crests; the lower wave is a paler blue and noticeably shallower, its crests
gentler. Calm water, smooth curves, no foam or detail.
```

- **Palette:** upper wave `#4A92C8`, lower wave `#8FC0DD`
- **Must avoid:** identical waves — the difference between the two is the entire subject, since the game is about noticing a change in rhythm. Also avoid: an audio waveform, an equaliser, a sine graph, a sea with a horizon or sky.

---

### 5. Drift — *Time perception · Felt duration*

*The game: a tone marks the start of an interval and a second tone marks the end; you then reproduce that duration from felt sense alone.*

```
A thick lilac ring, open in the centre, with two solid deep-purple dots sitting
on the ring itself — one at the top, one at the lower right — and a small faint
dot at the very centre. The two dots read as the two ends of a stretch of time
marked out along the ring.
```

- **Palette:** ring `#B9A6E0`, marker dots `#6E56A8`, centre dot `#6E56A8` at 40% opacity
- **Must avoid:** a clock face, clock hands, numerals, an hourglass, a stopwatch, a progress bar, a loading spinner. The game is about *felt* duration, not measured time — anything instrument-like is wrong.
- **Note:** the ring must be a genuine annulus (transparent centre), not a filled disc with a pink circle on top, because it is also used without the plate.

---

### 6. Pond Watch — *Go / No-Go · Reaction time*

*The game: a duck appears and you hit the key; a heron or a frog appears and you must not.*

```
A plump pink duck in side profile facing right, sitting on water: rounded body,
round head, small darker bill, one small dark eye, a small pointed tail at the
back. Below it, two thin curved ripple lines suggesting still water. Cheerful
and simple.
```

- **Palette:** body and head `#F068A4`, tail `#E04090`, bill `#C04A82`, eye `#1C1C1E`, ripples `#C04A82` at 30–45% opacity
- **Must avoid:** a rubber bath duck; a realistic mallard with plumage detail; wings, feet, or feather texture.
- **Note:** **this one must match the duck already inside the game** (`Duck` in `src/games/PondWatch.jsx`) — the player sees the icon seconds before the real thing. Copy its proportions and its pink.

---

### 7. Delve — *Attention · Sense foraging*

*The game: an image waits behind haze. Rest your attention in one place and that place slowly clears; what you have already seen fades back.*

```
A soft landscape — warm cream sky, a small amber sun in the upper right, two
layers of rolling green hills — seen through a veil of pale mauve haze that
covers the whole scene. In one soft-edged patch, off-centre and low, the haze
has thinned and the hills below show through clearly. The cleared patch has no
hard edge and no outline; it simply fades.
```

- **Palette:** sky `#F0E0C8`, sun `#E8A848`, upper hills `#7A9A58`, lower hills `#4F6B3C`, haze `#CFC4CD` at ~88% opacity
- **Must avoid:** **concentric rings, a bullseye, a target, a spotlight cone, a magnifying glass, a camera aperture, or crosshairs.** Delve is a practice in *not* aiming at things; anything that reads as a target inverts the game's meaning. This is the mistake the existing hand-drawn version made on its first attempt.
- **Known hard part:** this subject does not survive 24px — see §4.

---

### 8. Tune — *Attention · Sense foraging*

*The game: a world of sound in a soft haze. Rest near one voice and it clarifies and steps forward while the others recede.*

```
Six or fewer soft round points of violet light scattered across the circle. One
of them, upper right, is larger, saturated and clearly in focus, wrapped in two
concentric soft halos. The others are small, pale and faded into the
background. The contrast between the one clear point and the dimmed rest is the
whole subject.
```

- **Palette:** focused point `#5F49BC`, its halos `#8F7FD8` at 22% and 30% opacity, dimmed points `#8F7FD8` at 28–42% opacity
- **Must avoid:** a speaker, a musical note, a headphone, an audio waveform, an equaliser, sound-wave arcs, a microphone. Tune is not about *audio* — it is about one thing coming forward as the rest softens back. Any literal sound symbol is a rejection.

---

### 9. Alongside — *Attention · Sense foraging*

*The game: a creature of light drifts through a night meadow. It cannot be caught, but it can be kept company.*

```
A night meadow: a dark green rolling ground across the lower half, with three
slender tapering grass blades rising from it in a lighter green. Above and to
the right floats a single small warm cream point of light with two soft
concentric halos around it. Quiet, nocturnal, gentle.
```

- **Palette:** ground `#2F4A34`, grass blades `#3D6042`, mote core `#FDF6D8`, halos `#F2E7B0` at 22% and 40% opacity
- **Must avoid:** a firefly with a visible insect body, wings, or legs; a lantern; a star with points; a moon. The light is a mote, not a creature you can see the shape of — that is the point.
- **Note:** grass blades must be tapered filled shapes that keep their points when enlarged, not strokes.

---

### 10. Farm Joy — *Values clarification*

*The game: you pull plants from a field; each one reveals a value; you keep what feels right and compost what doesn't.*

```
A young plant lifted out of the soil, root and all: a straight green stem with
two leaves at the top angled in opposite directions, and a pale tan root system
of two or three tapering strands trailing below. Behind and across the middle,
a band of brown soil. The plant is clearly out of the ground and being looked
at.
```

- **Palette:** soil `#7A5A3A`, stem `#4F7A3A`, leaves `#6AA04A` and `#7BB257`, roots `#C9A15E`
- **Must avoid:** a potted houseplant; a plant still growing in the ground with no root visible; a tree; a flower; a vegetable.
- **Note:** the exposed **root is the subject**. A leaf above soil says "gardening"; a plant with its root showing says "you took it out to look at it", which is what the game does with a value.

---

### 11. Owl Barn — *Hearing · Rhythm · Strategy* (in development)

*The game: you cross a dark barn while owls hoot overhead, reading the silences between calls.*

```
An owl's face seen head-on, filling most of the circle: a large round tawny
face, two very large pale round eyes with big dark pupils, two small triangular
ear tufts at the top, a small downward triangular beak between the eyes, and a
slightly lighter brow band across the top of the face. Watchful and calm, not
menacing.
```

- **Palette:** face `#C9A15E`, brow band `#D9B675`, eye discs `#F4EAD6`, pupils `#1C1C1E`, tufts and beak `#9A7B45`
- **Must avoid:** a whole owl with body, wings or perch (it becomes mush at small sizes); a cat's face — keep the tufts small and the beak clearly visible; anything spooky or Halloween-ish.

---

### 12. Breath Guardian — *Breath regulation · Boundaries* (in development)

*The game: you hold to breathe in and raise a shield; you release to breathe out and let the world back through.*

```
A single heraldic shield shape, flat slate blue, pointed at the bottom and
straight across the top. A pale blue smooth wave passes horizontally through
the middle of the shield, entering one edge and leaving the other, clipped to
the shield's outline so it reads as passing through rather than sitting on top.
```

- **Palette:** shield `#5B7FA8`, wave `#A8C8E0` at ~85% opacity
- **Must avoid:** a crest, emblem, heraldic charge, cross, or badge detail on the shield; armour; a sword; a barrier that the wave bounces off. The wave must pass *through* — the game is about letting the world in, not blocking it.

---

## 4. Known hard cases — please read

Three of these subjects are scenes rather than objects, and **scenes do not survive the 24px badge size**. This was confirmed in the existing hand-drawn set: Delve is illegible at 24px after three redraws, and Alongside and Tune are weak there.

If you can solve this, that is the highest-value thing in this brief. Two acceptable approaches:

1. **A second, simplified drawing per icon for badge size** — same palette and subject, radically fewer shapes. Deliver as `<slug>-sm.svg`.
2. **Redesign those three around an object rather than a scene**, keeping the meaning. Proposals welcome — but Delve must not become a target/bullseye/lens, and Tune must not become a musical note or speaker (see their prompts).

The other nine are expected to work at all three sizes from a single drawing.

---

## 5. Acceptance checklist

Each icon is rejected if any of these fail.

- [ ] `viewBox="0 0 48 48"`; all content clipped to the circle `cx=24 cy=24 r=24`; nothing spills past it
- [ ] Zero `stroke` attributes; zero `<text>`, `<image>`, `<filter>`, `<foreignObject>`
- [ ] ≤ ~14 shapes; no auto-trace artefacts (hundreds of tiny paths, near-duplicate colours)
- [ ] Colours match the per-game palette exactly — no anti-aliasing colours introduced
- [ ] Any `clipPath`/`mask`/gradient id is unique across the twelve files
- [ ] Legible at 24px (except the three noted in §4) — check by exporting at 48×48 and viewing at 50%
- [ ] Works with the pink plate **and** with it removed
- [ ] Nothing thinner than 2 units on the 48 grid
- [ ] Under 4 KB

**And the set-level check, which matters more than any single icon:** render all twelve in one row at 24px. Neighbouring icons must be distinguishable at a glance, and no icon should dominate. If three of them are soft coloured blobs, the set has failed even if each is individually fine.

---

## 6. Context the generator may find useful

- The icons sit on a warm pinkish-white site (`#FCF0F5`) next to DM Serif Display headings. The register is **calm, warm, a little playful, serious science underneath** — not corporate, not childish, not clinical.
- Several of these games are contemplative practices with no score and no win state. Icons should not look competitive, gamified, or achievement-like. No stars, trophies, badges, streaks, or progress indicators.
- Full design system, including the colour tokens and type scale: `radlab.zone/brand`.
