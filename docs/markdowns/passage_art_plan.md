# Passage — art plan

> Started 2026-09-28. Companion to `passage_design.md`. Status: **pipeline proven with a stand-in
> figure; style not yet chosen.** Nothing here replaces the grey-box art in the prototype yet.

## What the art has to do

- **Pre-rendered sprites from Blender, drawn on canvas 2D.** No three.js. (Decided 2026-09-27.)
- **Rooms are 640×360 logical**, authored at 2× (1280×720), with background plates rendered wider
  (780×360 logical) so wide phones show more wall, not black bars.
- **The figure is recoloured live, in six ways:** the player's avatar colours, then earth, fire,
  air and water. It also floods from one colouring to the next (the absorption animation), and the
  tint builds part-way with each matching breath. So the figure cannot be painted in fixed colours.
- **Element effects stay procedural**: flames, drips, motes, streamlines, the kites, the flood.
  Art supplies bodies and places; code supplies anything that breathes.
- **The dream is built from the bedroom.** One set of bedroom objects is modelled once, then
  rendered plainly for the waking scenes and remixed into dream-corridor pieces: drawers become
  ledges, bookshelves become pillars, the desk lamp becomes torchlight.

## What the spike proved (2026-09-28)

`scripts/passage-art/render_spike.py` and `tint_proof.cjs`:

- **Headless Blender works.** `blender -b --factory-startup --python render_spike.py -- OUTDIR`
  renders on Blender 5.2.1 with EEVEE in ~5 s per 128×192 frame, with a transparent background.
  **Use the command line, not the MCP add-on, for batch renders.** The add-on drives the one
  open Blender window, which other sessions (Night Safari) also use; when this was written it held
  their cave scene. The add-on is for look-dev you want to watch, in a separate `.blend`.
- **Neutral render + region mask → any palette.** Two renders per frame from the same camera:
  - a *beauty* render in light neutral greys, which carries all the light and shade;
  - a flat *mask* render (skin = red, tunic = green, legs = blue, hair = white).

  Multiplying the beauty by the palette colour chosen by the mask gave avatar, earth, fire, air and
  water versions of one render, with the lighting intact (`tint_proof.png` in the spike output).
  In the game this is computed **once per palette at load** into cached sheets, not per frame. The
  flood between two colourings is already drawn as two cached palettes with a clip, which is how
  the prototype does it now.
- **Camera recipe**: orthographic, looking along +Y (the figure faces +X, screen right),
  `sensor_fit = VERTICAL`, `ortho_scale = figure height × 192 / 160` (the figure fills ~160 px of a
  192 px cell at 2×). Warm key light from upper front-left (the lamp), cool rim from behind, and a
  soft front fill.

## The pipeline

1. **Source of truth**: `passage.blend` in a Drive folder (proposed `ComeSee/Passage/art/`, beside
   Safari's), plus render and pack scripts in `scripts/passage-art/` in the repo.
2. **Character**: modelled in Blender and rigged with Rigify. The head must be big enough for the
   avatar to sit on it naturally (settle this in the first blockout). Every frame renders three
   outputs:
   - `beauty` (neutral),
   - `mask` (regions),
   - a **head anchor**: the head bone's 2D position and rotation, exported as JSON. In profile
     frames the game draws the side-view head built from the avatar settings there; in the seated
     front-facing frames it composites the real `BaseAvatar` SVG face.
3. **Animation clips**, at 12 fps, which gives PoP's slightly stepped fluidity and halves the frame
   count:

   | Clip | Frames | Notes |
   |---|---|---|
   | idle | 8 | loop, a small breath |
   | walk | 12 | loop |
   | start / stop | 4 + 4 | |
   | jump (up, apex, fall, land) | 10 | |
   | teeter | 10 | loop: leaning over, arms wheeling |
   | turn and sit | 10 | profile → front-facing, cross-legged |
   | seated breath | 9 | **scrubbed by breath fullness**, not played by time (the Breath Guardian 42-frame-sheet trick) |
   | stand up | 8 | |
   | float | 8 | loop, over the pit |
   | to liquid / from liquid | 8 + 8 | the rivulet itself stays procedural |
   | desk: type, sip, nod off, wake | 6, 10, 12, 10 | the opening and the ending |

   That's ~150 frames × 2 renders ≈ 12 minutes of render time. Motion source: **Mixamo clips
   retargeted onto the Rigify rig give the fluid, rotoscope-like movement PoP was known for**, but
   downloading them needs Norm's Adobe login. The alternative is hand-keyed motion: slower to make,
   stiffer to watch.
4. **Packing**: the render script writes frames; a headless-Chrome pack step (puppeteer-core is
   already in the repo, `sharp` is not) packs them into WebP atlases of at most 2048×2048 (iOS
   memory), with JSON for frame rects and anchors.
5. **Rooms**: a **modular kit** rendered orthographically:
   - floor drawer-front segment, ceiling (the underside of a desk);
   - bookshelf pillar, lamp sconce, the high shelf;
   - doorway, pit edge and spikes, dresser with its floor-level pipe;
   - earth wall slab, cobweb veil.

   **Each room is laid out in Blender from the same geometry numbers the level uses**, generated by
   a script from the room definitions, so art and collision cannot drift apart. Each room renders
   as one plate at 1560×720, in two layers: a dark body layer and a separate glow layer. The code
   pulses the glow with the element's breath, so light must never be baked into the bodies. This is
   the same rule Alongside's art follows (website.md §29b).
6. **Bedroom set**: desk, chair, monitor, lamp, window, plant, glass of water, clock. Rendered at
   dusk (dull) and in the morning (warm), plus the changed-object variants the ending needs (the
   new leaf, the open window).
7. **Materials**: Poly Haven textures and HDRIs (free, CC0: wood, plaster, rock, fabric). Poly Pizza
   or Sketchfab props only if a model would be a big saving, and credit their creators (CC-BY). No
   paid 3D generators are enabled on this Blender install.
8. **Optional AI paint-over, for room plates only**, following the Night Safari pipeline (Blender
   render → gpt-image-2 paint-over, with its spend ledger and prompt rules; see that project's
   memory). **Never for the character**: frame-to-frame consistency matters more than any single
   painted frame.

## Build order, with review points

| Step | What | Norm reviews |
|---|---|---|
| A | **Style frames**: the earth room plate plus a character still, in 2–3 looks (see Decisions) | picks a look |
| B | Character blockout at game scale, head proportion with an avatar composited on | head and body proportion |
| C | Rig, then walk, idle and teeter, dropped into the prototype in place of the drawn figure | on the phone |
| D | Remaining clips (sit, seated breath, jump, float, liquid, desk) | |
| E | Kit, then the eight room plates generated from the level definitions | on the phone |
| F | Obstacle assets with glow layers; bedroom at dusk and in the morning, with variants | |

## Decisions needed

1. **Look.** Three candidates, to show as style frames in step A:
   - *clean toon-shaded 3D*: flat colour bands, crisp outlines; it reads well small and tints
     perfectly;
   - *soft lit 3D*: like the spike, but with real materials; a pre-rendered, dreamlike look;
   - *painterly*: room plates painted over (Safari's method), with the character in toon-shaded 3D.
2. **Mixamo**: will you download the clips (Adobe login), or should motion be hand-keyed?
3. **Size lock**: 640×360 rooms, figure ~80 px logical (a 64×96 cell, rendered at 2×). Step B's
   renders depend on this.
4. **Where the art lives**: `ComeSee/Passage/art/` on the Shared Drive (proposed).

## Risks

- **Shared Blender window**: batch work goes through the command line (above). If look-dev ever
  uses the add-on, it gets its own `.blend`, never a file another session has open.
- **Atlas size on iPhone**: keep each atlas at or below 2048², and split by clip group if needed.
- **Recolour edges**: region-mask antialiasing can fringe where colours meet. At 2× this didn't
  show in the spike; check again on the real model with thin details (hair, fingers).
