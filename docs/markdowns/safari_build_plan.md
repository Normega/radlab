# Night Safari — build plan (v2, reviewed)

*Drafted 2026-09-26. Draft v1 was reviewed adversarially against the specs, CLAUDE.md, website.md
and the live Owl Barn code, then revised; the 17 review findings are folded in below. Claims about
the code were re-checked by hand: an untouched Skunk Den machine really scores ~85%, and Owl Barn
really labels windows 6–8 "long" regardless of the player's measured 8-tap speed.*

Sources: `I:\Shared drives\ComeSee\Safari\` — `NightSafari` Google Doc (the original concept),
`hub_platform_spec.md`, the six exhibit specs (use `skunkden_spec (1).md`; the plain
`skunkden_spec.md` and `fireflyfield_spec (2).md` are PDFs with the wrong extension),
`claude_design_brief.md`, `splat_character_spec.md`, `splatprompts.txt`, `Owls/owlbarn_todo.md`,
`Owls/RiskFlex.iqx` (Norm's 2013 Inquisit task, the canonical Owl Barn timing), reference art in
`Owls/`, `batcave inspo pics/`, and `ComeSee/Assets/racoons/splat/`.

---

## 1. Where things stand

| Piece | State |
|---|---|
| Specs | Complete for all six exhibits plus the hub, written April 2026 against an imagined platform: anonymous auth, `game_id`, `exhibit_bests`, `hub_state`, and its own profile and rank screens. None of those exist; the real conventions are `game_sessions.game_name`, ProtectedRoute + Ripple onboarding, and a per-game detail table with `dataset jsonb` (Breath Guardian §21a). |
| Owl Barn | ~70% built: `src/games/OwlBarn.jsx` (1036 lines, DOM/CSS + setTimeout) + `useOwlAudio.js` (Web Audio synthesis, sounds good). Uses RiskFlex's triangle wave. Calibration, mindfulness, results, persistence and art are stubs. Pulled from `GAMES` 2026-08-13; route still live. |
| Characters | Splat: a clean reference image + `Reference.svg`, an auto-trace of 784 flat paths with no groups (a drawing, not a rig). 6 of the 7 pose images carry a **DeeVid watermark**, so they are unusable as shipped art and their licence tier is unknown. No other animal has any art. |
| Backgrounds | Owl barn painterly/photoreal plate + draft (Midjourney-style). This does **not** match Splat's inked cartoon style. |
| Inspiration | Bat-cave folder is web images, several stock-watermarked (VectorStock etc.): mood reference only, never source material. |
| Audio | None beyond the Owl synthesis. |
| Constraints | `api/` is at the 12-function cap (no server-side generation endpoint). The dev site writes to production tables. |

---

## 2. Spec problems to fix *before* building (each would corrupt data or ship a broken game)

1. **The mindfulness pause loses data and its bonuses defeat it.** The data is saved only
   after the pause, so a player who closes the tab during an invited 60 s wait loses the session.
   The 30/60 s rewards also add points or subtract time in five exhibits. That is the
   "vending machine for waiting" the Come, See compendium §2 rejects: once found, everyone waits
   60 s every time, and it inflates the curator rank.
   **Fix:** create `game_sessions` on Begin; insert the result at GAME_OVER, *before* the pause;
   record pause duration as a separate later insert, counting only visible-tab time. The 30/60 s
   rewards stay, but only as experiences (animals arrive, glow) with no score effect.
2. **Owl Barn's research metric is mislabelled.** `curIsLong = winnum >= 6` marks windows
   "8-tap optimal" that are shorter than the player's own 8-tap time. It also ends after
   10 steps (~5–15 windows, less than one 18-window triangle cycle), and better players give fewer
   trials. RiskFlex ran 10 + 10 calibration trials and 108 test trials.
   **Fix:** "long" means `window_ms ≥ measured riskyWindow`, and both are logged. **Decided (D6):
   the barn has two corridors**: 10 hiding spots down the first, a turn at the far wall (a beat of
   rest, the camera swings), and 10 back along the second, 20 steps in all. A wrong count is a
   swoop, back 2 steps (D9).
   - At a typical mix this is ~25–40 windows, about 1.5–2 triangle cycles.
   - Windows-played still varies with skill, so the analysis uses per-window choice rates, not
     totals.
   - Every window logs `corridor`, `windownum` and cycle position.
3. **Owl Barn input holes.** A held spacebar auto-repeats into "taps" (no `e.repeat` filter):
   a free exploit that also poisons calibration. Two-thumb phone tapping ≠ spacebar. Timing runs
   on `setTimeout` while the hoot is Web Audio, so Bluetooth output latency (150–300 ms) silently
   shortens the real window.
   **Fix:** filter repeats; log input device; calibrate per session per device; schedule phase
   changes on the audio clock and log `outputLatency`; `touch-action:none` on the tap zone.
4. **"Playable with sound off" pools two different tasks.** In Owl Barn the silence *is* the cue;
   with sound off it is a visual timing task. iOS mutes Web Audio under the silent switch without
   telling anyone.
   **Fix:** a pre-game hearing check ("tap when you hear the hoot"), an explicit
   `cue_modality: audio | visual | both` recorded per session, and a legitimate visual mode for
   deaf and hard-of-hearing players. The same applies to Bat Cave.
5. **Skunk Den scores ~85% for doing nothing.** Sliders default to 5, which is already ~2 from
   every true value, and fruit ID is a match-to-sample with the swatch shown in the selector
   (ceiling for trichromats). For colour-blind players, strawberry/watermelon/peach and
   orange/mango/lemon collide. The ±1 per-session jitter adds irreducible error.
   **Fix:** sliders start blank or randomised and are scored against the untouched baseline;
   drop the jitter; give each fruit a pattern/glyph as well as a colour, using a CVD-checked
   palette; fruit ID is informational, not 30% of the score. Reframe the metric as
   **flavour-imagery agreement**, and later score it against the players' consensus rather than
   the designer's table.
6. **Raccoon hints contradict the preference shuffle.** The hints are fixed (Reginald's cheese
   pocket-square) while the preferences are random each session, so careful observers are misled
   about half the time.
   **Decided (D5): keep the hints, made true every session.** Each raccoon keeps a signature
   *slot* and a signature *gesture*; the session's shuffled preferences fill them.
   - **Like slot:** Reginald's pocket-square, Deb's behind-the-ear, Nana's brooch, Splat's hat.
     The slot holds a small sprite of one of that raccoon's liked foods: a cheese wedge, a fish
     skeleton, a wilted-veg sprig or a grub.
   - **Dislike gesture:** Reginald's handkerchief recoil, Deb's carrot-napkin sneer, Nana's
     barricaded cutlery, Splat pushing things away. It is aimed at one of that raccoon's disliked
     foods, which sits on or passes their place setting.
   - **Art cost:** 4 small food sprites reused across all four slots, plus the gestures in each
     puppet's animation set. Not 32 bespoke props.
   - **Data:** each session logs which hints were shown. `inference_score` gets a companion,
     `hint_only_score` (how well the hints alone would have done), so observation can be
     separated from sniffing.
7. **Bat Cave measures neither hearing nor much else.** Catching is clicking a moving visual ring;
   once caught, the dodge is a trivial "go opposite" rule; 5 rounds; speed changes across
   sessions; the ring is ~1.2:1 contrast.
   **Fix:** the sonar's *sound* carries the message (chirp side/pitch) and the ring is only
   decoration, with a visual-mode fallback flagged per item 4. ~12 rounds, speed in px/s
   normalised to the viewport, a contrast floor, and chirp side logged independently of attack side.
8. **Opossum's lag cue depends on refresh rate.** Per-frame lerp gives half the lag at 120 Hz.
   **Fix:** dt-based smoothing `k = 1 − exp(−rate·dt)`; log pointer type; warmth is a *visual* cue,
   so log it as one (or have a no-warmth condition). Touch is a separate condition. This exhibit is
   desktop-first for research.
9. **Sense labels overclaim.** The specs don't even agree: the ceremony gives the owl "sight", the
   profile files the owl under "integration". What each exhibit actually measures:

   | Exhibit | Fiction | Honest measure |
   |---|---|---|
   | Bat Cave | hearing | auditory lateralisation + use of intel (once item 7 is fixed) |
   | Owl Barn | hearing/rhythm | risk flexibility under temporal uncertainty (RiskFlex) |
   | Opossum Hut | touch | detection of visuomotor drag |
   | Raccoon Trash | smell | preference inference from feedback + memory |
   | Skunk Den | taste | flavour-imagery agreement |
   | Firefly Field | sight | spatial working memory |

   The *fiction* keeps its senses; the **exports and any player-facing chart use the honest
   labels** (CLAUDE.md rule 4). The "six-dimensional sensory fingerprint" radar is **cut**.
10. **Copy.** The humiliation lines ("We have caught a very slow human") will land on study
    participants, including low-mood samples. The comedy should be aimed at the animals'
    pomposity, never at the player's ability. Norm's voice pass happens before launch, as it did
    for Sidelong.

---

## 3. Decisions (answered by Norm 2026-09-26 unless marked open)

| # | Decision | Outcome |
|---|---|---|
| D1 | Guest play | **Account required.** Night Safari is a RADlab game like the others: behind ProtectedRoute, no anonymous auth. |
| D2 | Scores and ranks | Keep per-exhibit tiers and a curator rank, but no mindfulness bonuses (§2.1). "Mastered" = top two tiers. *(Recommendation, not contested.)* |
| D3 | Who makes images | **Route A: Claude generates and reviews** via a local image-API script (§4.3), with Norm/Gerold approving at contact-sheet checkpoints. |
| D4 | One style | Inked painterly characters on night-painted backgrounds, keyed off Splat. Regenerate the barn in that style. |
| D5 | Raccoon hints | **Keep the hints**, made consistent with each session's shuffled preferences (§2.6). |
| D6 | Owl Barn length | **Longer barn: two corridors** (§2.2). |
| D7 | Catalog | One "Night Safari" card → hub. Owl Barn's old route redirects. |
| D8 | Licensing | The Splat reference came from Midjourney on its lowest paid tier, which allows commercial use for organisations under the revenue cap. It may serve as a *reference input*. Norm is fine restarting, so the final cast is regenerated through the new pipeline for control and consistency. No DeeVid output ships. |
| D9 | Owl wrong count | **Swoop, back 2 steps** (spec behaviour; the code's no-penalty creep/freeze is replaced). |

---

## 4. Graphics

### 4.1 Style bible (the first art deliverable, one page)
- Look: "Studio Ghibli at midnight × deadpan nature documentary" (design brief). Inked characters with
  soft painterly fill; backgrounds painted in the same hand, **lit for night from the start**
  (moon upper-left, amber practicals). Grading day art darker afterwards flattens it.
- Per-exhibit palette from the specs (bat `#0a080f`, barn `#0d0905`, field `#080c14`, alley
  `#0c1018`, den `#120d08`, sky `#060a12`).
- **Legibility rule:** every character carries a moonlight rim so it reads on dark ground.
  Anything the player must *detect* has a stated minimum contrast. Review on a real phone at 50%
  brightness with Night Shift on.
- Character proportions: eyes ≥ 40% of the face; readable silhouette at 80 px.
- Do-nots from the brief: no pure black, no harsh white, no emoji in UI (the Firefly jar labels
  become drawn icons), no generic progress bars.

### 4.2 Characters are cut-out puppets, not pose libraries
A style reference keeps the style consistent but not the character; 20 generated reaction poses
of Reginald will drift. So each character is **one approved drawing split into parts** (body,
head, eyes, eyelids, pupils, mouth set, arms, tail, props), animated procedurally: bob, blink,
squash and stretch, recoil, spin, fall. The Splat Rive spec's state list (idle, delighted,
disgusted, irritated, impatient, falling, glowing, tasting) is the animation vocabulary either way.
- Parts are **vector (SVG → Path2D)** where the art allows, following the Alongside precedent:
  scale-free, tiny, and able to sway per-part. The existing Splat trace proves the look survives
  vectorisation; it needs rebuilding into named groups.
- Rive stays an upgrade path for hero characters if Gerold wants to take it on. It is not a
  dependency.
- Glows are **never baked into art**; they are drawn procedurally (Alongside rule). Recolourable
  parts (the skunk tail stripe) are a separate mask, so the HSL restoration is a runtime tint.
  One baby-skunk puppet, seven tints.

Cast: bat (2 variants), owl (2), mouse (player), mama opossum + baby, 4 raccoons, mama skunk + baby,
plus the Firefly finale reusing everyone. ~13 puppets.

### 4.3 Making the images
- **Route A (chosen, D3): local generation script** `scripts/safari/gen-art.mjs` calling an image
  API that accepts reference images, so the character stays consistent.
  - Claude writes the prompts, generates in batches, and reviews its own output by eye against the
    style bible.
  - Claude also checks each candidate on a mock night scene at phone size, and runs matte and
    contrast checks, before rejecting or keeping it.
  - Norm/Gerold see curated contact sheets only at checkpoints: style bible, each character's
    master drawing, and each exhibit's plate.
  - The key lives in `.env.local` as a non-`VITE_` variable. It is never deployed and never
    reaches `api/`, which is at the cap anyway.
  - The script enforces a spend cap and writes every prompt, seed and output to the manifest.
  - Outputs are kept in `ComeSee/Safari/art/` (candidates, picks, masters); only processed
    WebP/SVG enter the repo.
- **Route B (fallback): Norm/Gerold generate in Midjourney** from Claude's prompt pack.
- **Blender for structure (added 2026-09-26).** Blender MCP is set up (Blender 5.2.1 portable).
  The Owl Barn corridor test is in `ComeSee/Safari/art/blender_test_2026-09-26/` (`.blend` +
  renders + review sheet).
  - Poly Haven CC0 props and textures are fine for everything except characters.
  - The moon, rim and practical lights are real lights, so the style bible's lighting rule is
    enforced by the scene.
  - A transparent props layer renders directly, giving parallax without cut-outs.
  - A 1920 px plate comes out at ~45–60 KB as WebP q70–80, far under the 250 KB budget.
  - **Test findings:**
    - Hiding spots need ~0.85 m spacing, so a corridor is ~8.5 m.
    - Portrait (floor → rafters) is the natural phone frame; landscape needs a separate owl
      layer above.
    - Thin board gaps need art-directed shafts (EEVEE doesn't resolve them).
    - The burlap and door props need rework.
  - **Paint-over verdict (2026-09-26, `gpt-image-2` via `scripts/safari/gen-art.mjs`).**
    Comparison sheet: `owlbarn_method_comparison.jpg` in the test folder.
    - **Blender + paint-over is the method for gameplay plates.** It gives the inked, painterly
      night look while keeping every prop's position and scale, so game logic stays aligned.
      Owl silhouettes survive as placed.
    - **Pure generation is for one-off illustrations** (title cards, hub splash, cinematic
      frames). It is more atmospheric, but it invents its own layout and viewpoint, and the boot
      came out ambiguous. It cannot produce a continuing corridor, matching parallax layers or
      the location states.
    - **Next tests:**
      - paint the corridor as overlapping tiles and check the seams between neighbouring frames;
      - paint a transparent props layer;
      - lock one painted frame as the style reference for all later paint-overs, so style
        doesn't drift across the ~10 plates.
  - **Round 2 results (2026-09-26/27):** `owlbarn_tests_round2.jpg` in the test folder.
    - **One tall, wide plate per corridor, cropped responsively.** The camera is level with its
      framing shifted up, so the wall stays undistorted, and floorboards run along the corridor.
      Portrait shows floor to rafters; landscape shows a crop of the lower part. The trade-off:
      flatter than the tilted mouse-eye hero view.
    - **Seams are solved by masked chaining.** Tile k+1 receives tile k's painted overlap as a
      kept (masked) strip. The kept overlap differs by 3.7–6.5/255 on average, the junction step
      matches a normal column-to-column step, and the stitch shows no visible seam.
    - **Layout fidelity fails when a scene image is the style reference.** Its content leaks in:
      extra lanterns and windows appeared, and the hay bale and pot were deleted. It also fails
      on featureless, heavily hazed render regions, where the model invents structure.
    - **Fix, verified:** a scenery-free style swatch keeps the layout exact, but gives weaker ink.
    - **Props paint with `background: transparent`:** clean alpha, no halo on dark, moonlit rim.
    - **Prompts must list exactly the objects in the image.** A named-but-absent lantern was
      drawn in.
  - **The recipe for gameplay plates** (revised 2026-09-27 after the first full-corridor run;
    implemented in `scripts/safari/paint-corridor.py`):
    1. **Two plate renders per corridor.** A *paint input*: no haze, exposure +1.4, every
       structure visible; a dim, hazy render lets the model invent walls. And a normal
       *reference* render for comparison.
    2. **Style references:** the Splat sheet (ink) + a scenery-free palette swatch, both in
       `ComeSee/Safari/art/style/`. Never a scene image.
    3. **Paint every tile independently from the render.** Masked chaining (item 5 of the
       earlier recipe) is **withdrawn**: it made seams perfect, but the model then followed the
       painted strip and ignored the render in the rest of the tile. It invented a room corner,
       dropped the window and moved the floor line.
    4. **Join neighbours after painting.** Match each tile's colour statistics to its
       neighbour's in the 384 px overlap, then cross-fade. Because every tile follows the same
       render, structure lines up across the joins.
    5. **Prompts name nothing.** The plate prompt says only what things are made of. Naming a
       lantern, window or doorway for the corridor made the model paint one into every tile.
       Props are painted one at a time, and each prompt names exactly that prop.
    6. **Plates at high quality; props at medium.** At medium, the model follows the input image
       2–3× less closely (overlap error 10–15 against 4–7 per 255).
    7. **Anything that should read through an opening needs something behind it.** A window
       with nothing behind it was boarded over; with sky and moon behind it, it survives.
    8. **Props export from Blender with generous padding and haze hidden,** then are trimmed to
       their visible pixels. Tight bounding boxes clipped the boot, and the haze veil defeated
       the trim.
  - **Script notes:**
    - Requests must stream (`stream` + `partial_images`), because something on this network
      path drops connections that are silent for 60 s.
    - About 84 s per high-quality 1536×1024 image.
    - The ledger lives in `ComeSee/Safari/art/generated/ledger.jsonl`, with a cap of 400 images
      in total and 12 per run.
- Either way, **generate on flat mid-grey**, not white or dark, so matting inked fur doesn't leave
  halos on night scenes, and budget manual matte touch-ups for the hero characters.

### 4.4 Processing pipeline (Claude runs it; PIL + rembg + opencv are already installed)
`scripts/safari/process-art.py`: matte (rembg, then edge-decontaminate against grey) → trim →
per-exhibit night grade (light touch only) → resize to ≤ 1920 px for plates (DPR clamped, as in
Delve and Sidelong) → WebP → sprite atlas + `manifest.json` recording **provenance per asset**
(tool, prompt, seed, date, licence tier). Output is checked against a byte budget: plates ≤ 250 KB,
first load per exhibit ≤ 1.5 MB.

### 4.5 What is procedural (no art needed)
Sonar rings, bat eyes, vignettes, fireflies and firefly letterforms, smell waves, tap auras, dust
motes, moonlight shafts, grass (reuse Alongside's grasspack Path2D with per-blade sway, which also
makes the Opossum parting), glows and pulses, skunk slider levers and gauges (vector, custom
component), the 24 slider icons (SVG).

### 4.6 Asset budget (revised)
| Area | Raster plates | Puppets | Props / icons |
|---|---|---|---|
| Hub | 1 landscape map + 1 portrait diorama/list art | 6 completed-state vignettes (reuse puppets) | 6 location structures × lit/unlit via overlay |
| Bat Cave | 1 cave (3 depth layers) | bat ×2 | — |
| Owl Barn | 1 barn (3 layers, regenerated in style) | owl ×2, mouse | 10 hiding objects |
| Opossum | 1 field/sky | mama, baby | soil/pebble reveals ×3 |
| Raccoon | 1 alley + table | 4 raccoons | 4 foods, ~16 distractors, 3 cans (2 states); hint props if D5 = per-session |
| Skunk | 1 den | mama, baby | machine body, 10 fruits, 24 SVG icons |
| Firefly | procedural sky | (reuse all) | jar (tinted ×5), certificate parchment, seal |

≈ 10 plates, 13 puppets, ~70 props. Deliberately far fewer than a pose-library approach.

---

## 5. Audio

**v1 scope: ambience beds + SFX + synthesis. No music, no animalese voices.** The hub spec itself
defers music to a separate design conversation, and each of those two is its own project.
- **Shared `SafariAudio`**: one AudioContext created on the Begin gesture; buses for ambience and
  sfx; resume on `visibilitychange` and on the next gesture (iOS `interrupted` state after calls
  and backgrounding); fades across hub ↔ exhibit.
- **Synthesis** (existing precedent: owl hoots, Alongside's cellos, Tune's synth scenes): sonar
  chirps, chimes, tap pulses, drones, glow tones, machine hum, hoots.
- **Sampled foley** where synthesis sounds cheap (trash clatter, paper, wing flaps, grass, crickets,
  alley ambience). Sources restricted to **CC0**, or an AI SFX tool on a paid tier with commercial
  terms. Licence recorded per clip in the manifest. **BBC RemArc is out**: this is public-facing.
  CC-BY is allowed only with a credits page.
- **Delivery:** mono mp3, loudness-normalised to about −19 LUFS, in Storage
  `public-assets/safari-audio/` (Tune precedent). Close Tune's still-open item first: confirm
  Storage CORS for `decodeAudioData`.
- Timing-critical audio (Owl hoots, Bat chirps) is scheduled on `ctx.currentTime`; latency is
  logged (§2.3).

---

## 6. Architecture

- **Routes:** `/safari` (hub) and `/safari/:exhibit`, all `lazy()`, as a partitioned product area
  (the Lecture Lounge pattern): own chunk group, own `<ErrorBoundary label="Night Safari">`, own
  fullscreen chrome, own route guard. `UnlockGuard` gates Firefly on five completions.
- **Code:** `src/games/Safari/{hub,exhibits/<name>,shared}`. Shared pieces: `ExhibitShell` (intro
  via the platform's `GameIntro`, pause, results), `MindfulnessPause`, `ResultsCard`,
  `SafariAudio`, `Puppet` renderer, asset preloader ("The animals are getting ready.").
- **Engines:** new exhibits follow the Alongside/Sidelong pattern: an imperative canvas module, zero
  React state in the loop, dt-based simulation, a virtual clock, and synthetic input through the
  real input path. The `window.__safari_*` debug API ships **in dev builds only** (Sidelong shipped
  without it). **Owl Barn is a rewrite onto this pattern**, reusing `useOwlAudio`, not a port.
- **Layouts:** per-orientation LAYOUTS as in Breath Guardian; identical timing across layouts;
  record `layout`, `viewport`, `devicePixelRatio`, `pointerType`.
- **Persistence** (one migration, pattern `20260718_breath_guardian_sessions.sql`):
  - `game_sessions` row on Begin (`game_name = 'safari_<exhibit>'`, `is_test` for lab accounts).
  - `safari_exhibit_sessions`: `session_id`, `user_id`, `exhibit`, `study_id`, `schedule_id`
    (`ON DELETE SET NULL`, rule 1), `raw_score`, `tier`, `cue_modality`, `dataset jsonb`,
    `dataset_version`. Written at GAME_OVER behind `useSubmitLock` (rule 2).
  - `safari_pause_events`: `session_id`, `visible_ms`, a separate insert.
  - Insert-only: no UPDATE policy. Whether the two tables also join rule 5's `RESPONSE_TABLES` and
    triggers is Norm's call. It is game data, like `breath_guardian_sessions`, which isn't there.
  - RLS "own rows" + lab read. Progress read via an RPC or a `security_invoker = true` view
    (otherwise it bypasses RLS).
  - Same commit: an entry in `src/lib/studyExport.js`, both deletion cascades
    (`admin_delete_user`, `delete_own_account`), and a row in the migrations README manifest.
  - Per-trial data lives in `dataset` (Breath Guardian precedent), stated explicitly because
    cross-game queries on `trials` will not see Safari.
  - Bat Cave reads the player's previous session for speed calibration.
- **Mobile, per exhibit:**
  - Hub: a portrait list/diorama; the isometric map is desktop only (hub spec §14 anticipates this).
  - Owl: a full-screen tap zone.
  - Bat: tap targets ≥ 44 px.
  - Raccoon: tap-to-pick / tap-to-place instead of hover; minimum hit sizes on the pile.
  - Skunk: stacked levers with pointer capture; the legend becomes a drawer.
  - Opossum: desktop-first.
  - Firefly: the poem is paged in portrait.
- **Accessibility:** reduce-motion switch (no shake, no flashes); flashes stay under 3/s; every
  shimmer is optional; explicit visual mode (§2.4); CVD-safe fruit coding (§2.5).

---

## 7. Phasing: smallest playable slice first

Each slice goes: build on `dev` → agent playtest via the debug API (the §29b loop) → Norm reviews
on dev.radlab.zone → promote. The migration goes to `main` when it is applied (the Supabase rule).

| Slice | Contents | Why here |
|---|---|---|
| **0. Decisions** | D1–D8 answered; style-bible draft; licence check on existing art | Everything downstream depends on them |
| **A. Owl Barn, done properly** | Rewrite on the engine pattern with fixes §2.2–2.4, real calibration, pause/results, persistence + migration, placeholder art, plain list hub at `/safari` | 70% built already, and it proves the shell, persistence and audio clock |
| **Art track (parallel from A)** | Style bible → **Splat puppet test** in the alley at night on a phone → barn plate regenerated → mouse + owl puppets | Proves the character method before 13 puppets are built |
| **B. Bat Cave** | Audio-first sonar (§2.7), fully procedural visuals | Needs almost no raster art |
| **C. Skunk Den** | Fixed scoring (§2.5), vector levers, one skunk puppet with tint mask | Moderate art |
| **D. Opossum Hut** | dt-lerp, grasspack parting, desktop-first | Reuses Alongside grass |
| **E. Raccoon Trash Pile** | After D5; four puppets + prop set | Heaviest art, so last among the five |
| **F. Firefly Field + real hub** | Memory game, certificate PNG, illustrated hub map with location states; bus cinematic **skippable** (or deferred) | Needs every other character to exist |
| **G. Launch pass** | Norm's copy pass, cross-exhibit rank normalisation, catalog card, website.md section | — |

**Explicitly deferred:** music, animalese voices, anonymous auth, leaderboards, player-facing
sensory radar (cut), study-protocol assignment UI (the Experiment Builder can reference exhibits
later), shareable certificate beyond a PNG download.

---

## 8. Spec details kept (so nothing is silently dropped)
- **Owl Barn:** wrong count = swoop, back 2 steps (D9). The tier formula needs rederiving
  against the triangle wave and the two-corridor length.
- **Opossum:** give-up confirm; mama's escalation lines.
- **Skunk Den:** 45 s snarky lines.
- **Raccoon:** food fight below 0.
- **Firefly Field:** "New Zookeeper" certificate for players without a name.
- **Hub:** 4 location states; the Firefly path lighting up once.
