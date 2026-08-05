# Alongside — drawn-asset inventory (for higher-quality art)

Source of truth: `public/prototypes/alongside.html` (everything below is currently drawn procedurally with canvas primitives — no image files exist yet). Written 2026-08-03.

## Global specs an artist needs first

| Property | Value |
|---|---|
| World size | 2600 × 1800 px |
| Camera | follows the player, **no zoom** — 1 world unit = 1 CSS pixel |
| Typical viewport | ~1280 × 720 (mobile ~390 × 780) |
| Time of day | night, always |
| Ground | vertical gradient `#0a0e1c` → `#0d1220` |
| Ambient light | one soft moonlight pool, radial, centred world (1300, 720), radius 900, `rgba(70,84,120,0.16)` |
| DPR | capped at 2 → **author at 2× the listed pixel sizes** |

**Projection is mixed 3/4 top-down (JRPG-style), and this is the single most important note.** Upright things (grass, trees, flowers, mushrooms) are drawn from the side, rising from a baseline — so they want a **bottom-centre anchor**. Flat things (stones, the pond) are drawn as ellipses seen from above with a ~0.6 vertical squash — so they want a **centre anchor** and should be painted pre-squashed.

**Palette discipline.** The whole meadow is desaturated blue-grey. The only saturated colour in the game belongs to light sources: teal foxfire, green glowworms, yellow-green fireflies, the player's warm gold, the wisp's cool blue. Body art should stay dark and neutral so the code's glow layers read on top.

**Deliver glow separately.** Anything that lights up is animated by the code (intensity rises when the player and wisp visit a site together, and pulses on its own otherwise). So for each glowing asset, supply **two files**: an unlit body (normal alpha) and an additive glow layer. Baking the glow into the body will break the "sites light when visited together" mechanic.

---

## 1. Scatter dressing — high instance counts, needs an atlas

| # | Asset | Count | Current size | Current colour | Motion |
|---|---|---|---|---|---|
| 1 | **Grass tuft** | 420 | 2–5 blades, 8–24 px tall | `rgba(52,66,72,0.75)` | sways ±2 px; ripples hard (±6 px at 7 Hz) within 70 px of a moving player |
| 2 | **Stone** | 26 | rx 6–22, ry = 0.62 × rx | `rgb(34–48, 40–52, 58–68)` | static |
| 3 | **Wild flower (closed)** | 70 | 1.5 px dot → 3.7 px when the meadow blooms | `rgba(150,140,190,0.25)` → brighter/larger at the ending | opens only during the finale |

**Asks:** 4–6 grass-tuft variants (~40 × 32 px, bottom-centre anchor); 4 stone variants (~48 × 32 px, pre-squashed, centre anchor); one flower in **closed** and **open** states (~16 × 16 px).

⚠️ The grass ripple is the game's main "you are moving through a real place" cue. If tufts become sprites, the sway must come from per-instance rotation/skew about the base, or a 3–5 frame sway strip — not from redrawing curves. 420 instances means one atlas, not 420 draws of separate images.

---

## 2. Savoring sites — four set pieces, the destinations of the tour

| # | Asset | Composition | Current size | Colour |
|---|---|---|---|---|
| 4 | **Foxfire mushrooms** | 9 caps scattered in a 220 × 160 cluster | cap r 3.2 px, stem 1.6 × 5 px, glow r 26 | body `rgb(90–150,120–235,110–190)`, glow `rgba(120,235,190)` |
| 5 | **Pond** | basin + rim + moon-glint + expanding ripples | ellipse 150 × 86; glint 26 × 9 rotated 0.3 rad, offset (+30, −10) | water `rgba(24,34,58,0.9)`, rim `rgba(140,170,220)`, glint `rgba(200,214,245)` |
| 6 | **Sleeping flowers** | 12 blooms in a 260 × 180 cluster, 5 petals each | petal 2.5–5 × 1.2–2.6 px, opens 0 → 1 | `rgba(190–240,150–210,210)` |
| 7 | **Glowtree** | trunk + 2 branches + 14 glowworms | trunk 7 px wide, 120 px tall; branches reach (+48,−108) and (−52,−118); canopy worms in a 120 × 130 area | bark `rgba(58,52,76)`, worms `rgba(180,240,150)` |

**Asks:** mushroom ~24 × 28 (+ glow); pond basin ~340 × 200 with a soft edge (+ moon-glint sprite + a ripple-ring sprite that scales); flower with a 4–6 frame **open** sequence (~32 × 32) since the opening is watched closely; tree silhouette ~180 × 220, bottom-centre anchor (+ a glowworm dot/glow).

---

## 3. The clearing — currently invisible, and probably should not be

| # | Asset | Notes |
|---|---|---|
| 8 | **Clearing** | World (1222, 936), radius 160. **Nothing is drawn here at all** — yet it is where the wisp settles and where the whole ending happens. A flattened-grass ring, a bare earth patch, or a circle of paler growth would give the finale a place. ~360 × 240, centre anchor. |

---

## 4. Actors

| # | Asset | Current form | Size | Colour |
|---|---|---|---|---|
| 9 | **The wisp** (companion) | radial heart-glow + hard core + 14 orbiting veil particles | glow r 46, core r 3.4, particles 1.5 px orbiting at r 8–18 (elliptical, 1 : 0.8) | `rgba(190,220,255)` → `rgba(150,190,250)`, core `rgba(235,244,255)` |
| 10 | **The traveller** (player) | radial glow + core | glow r 34, core r 3.6 | `rgba(255,226,170)` → `rgba(255,200,130)` |
| 11 | **Player trail** | 26 fading dots behind the player | r 7, alpha ≤ 0.06 | `rgba(230,220,180)` |

The wisp has four states art must survive: **jitter** (position noise that shrinks as the bond grows — stability is the reward, not brightness), **mist** (dissolves, veil expands ×1→4, alpha halves, reforms elsewhere), **nestle** (settles lower and dims by 35% while waiting for you to be still), and a **look** beat (a faint lean toward the player).

If either becomes a creature rather than a light, keep them **readable at 8 px** — they are frequently near the screen edge in the dark, and the mist state must still read as "dispersed" rather than "gone".

---

## 5. Fireflies — the only sign of the bond

| # | Asset | Count | Size | Colour |
|---|---|---|---|---|
| 12 | **Bond firefly** | 0–14, spaced along the player↔wisp line | r 2.1, blinking | `rgba(215,255,170)` |
| 13 | **Ending firefly** | 22, orbiting the player after the wisp dissolves | r 1.8, blinking | `rgba(215,255,170)` |

These carry the entire relationship signal — there is no meter anywhere in the game — and the visual QA pass already flagged them as easy to miss. Slightly larger or softer-haloed art would help; anything ornate would not.

---

## 6. Full-screen layers — keep these as code, not art

| # | Layer | Why |
|---|---|---|
| 14 | Vignette | resolution-dependent radial gradient |
| 15 | Moonlight pool | must track world coordinates as the camera moves |
| 16 | Meadow-bloom tint | `rgba(120,140,190,0.10)`, animated over the finale |

---

## Suggested priority

1. **Grass tufts** — 420 instances covering every frame; the single biggest lift in perceived quality.
2. **Glowtree and pond** — the two set pieces with the most screen area.
3. **The wisp and the traveller** — the emotional centre, but also the riskiest to over-design; a light may beat a creature.
4. **Mushrooms, sleeping flowers, stones, wild flowers.**
5. **The clearing** — new art for a location that currently has none.
6. **Fireflies** — small, but they carry the bond.
