# Kitewright: Game Design Document v3 (LOCKED)

*Game director, round 3 (final). 2026-11-01. This version replaces v2 and is locked for the prototype build. Decisions D1–D42 still hold unless a decision in §13 amends them. D43 onward are new in this round. §14 lists every round-3 critique item and what was done with it.*

---

## 1. Pitch

You are an apprentice in a kite workshop on a windy hill. Each plan pinned to the workshop wall is a way of breathing. You hold one control while you breathe in and another while you breathe out, and your breath builds the kite one spar per phase. A plan is learned when you can build its kite from memory. Each kite you learn joins the line of kites flying on the hill.

Kitewright is a sibling of Kite 2.0. Kite 2.0 is the open field, where you fly whatever breath comes. Kitewright is the workshop at the edge of that field, where you learn plans. It is a doing game: a craft skill with a clear target, much like learning a knot.

## 2. Pillars

1. **The breath is the kite.** A plan is a target `{inh, hold, exh, rest}`, and Kite 2.0's spar geometry turns it into a kite shape. The game has no other way of showing a breath.
2. **Fit, never more.** Mastery means matching the shape. Going longer, slower, deeper or faster earns nothing. Error counts the same in both directions, and nothing a player does can win back a breath that did not fit (D48).
3. **Off-shape kites still fly.** A kite that misses the plan gets no red, no miss sound and no score. Its spars are simply left unstitched.
4. **Guidance fades.** You learn with a full guide, practise with turn cues only, then fly from memory.
5. **Safety is part of the structure.** Holds are capped. Nothing is fast. Every round is followed by rest. "stop" and "dizzy or short of air" are on screen at all times.
6. **Describe the shape, don't promise effects.** Any statement about what a pattern does lives only on an optional card, worded no more strongly than the evidence allows (§11).

## 3. Controls and input model

| Input | In-breath | Out-breath | Pause / rest | Stop |
|---|---|---|---|---|
| Keyboard | hold **↑** or **I** | hold **↓** or **O** | hold nothing | **Esc** |
| Pointer / touch | hold left pad "breathe in" (↑ glyph) | hold right pad "breathe out" (↓ glyph) | hold nothing | Stop button (top right) |

- **The rule of the press:** "press when your breath turns, not when the kite does." The game scores durations, never onsets, so a steady lag behind the guide costs nothing.
- **Parser.** The prototype carries an inline copy of `normalizeSegments` and `parseBreaths` from `F:\gits\radlab_project\radlab\src\games\Kite\breathShapes.js`. The copy is verbatim, with a header comment naming that file. It keeps `MERGE_GAP_MS = 300` and `MIN_HOLD_MS = 300` (D3).
- **Segment log.** `{phase:'in'|'out'|'pause', t0, t1}` in milliseconds on the breath clock (below).
  - Live mode: `t = e.timeStamp − pausedTotal` (the same timebase as `performance.now()`).
  - `step()` mode: injected events carry breath-clock time.
  - Recording starts at the first confirmed in-press of each phase of play (baseline, each round, each loose interlude).
- **Two clocks (D63).**
  - `breathNow = performance.now() − pausedTotal`, never clamped. It drives the segment log, spar lengths, the guide schedule, the bead, rings, pose D, round and load caps, and the game tween lane.
  - A clamped `dt` (≤ 50 ms) drives decoration only: wind, clouds, flight, tails, springs.
  - `step(ms)` advances both clocks by `ms`, substepping decoration at ≤ 16.7 ms.
- **Key rules.**
  - `keydown` events with `e.repeat` are ignored.
  - When both controls are down, the last one pressed wins.
  - **Rollover (D60).** When the overriding control is released, the game falls back to the still-held control **only if the overriding press lasted under 300 ms** (a slip, which the parser already heals). Otherwise the overridden control is dead until it is released and pressed again, and the open phase is a pause.
  - A window `blur` releases everything. On touch, `pointercancel` counts as a release.
  - A `visibilitychange` to hidden closes the open segment and enters PAUSED.
- **Confirmation (D44).** An in- or out-press is *confirmed* when its hold reaches 300 ms (`CONFIRM_MS`). A press released before then is a slip and confirms nothing. A breath **closes when the next in-press is confirmed**, and is scored with `rest` measured to that press's `t0` (the parser already does this). The closing code takes `parseBreaths(log).at(-2)` once the new in is confirmed, never `.at(-1)` on its own. Launch, cycle counting, help, "not my breath", stitches and round end all key on confirmation.
- **Closing the last breath of a round.** It closes at the next confirmed in-press, or by timeout at `restStart + target.rest + 2 s`. Its rest is scored one-sided whichever way it closed (D45): a short rest can be off, a long one counts the same as on-target.
- **Caps on held keys (D59).** When an in- or out-key has been held for target + 2 s, `drift.overKey` shows. At `KEY_MAX_S = 12` s, the open breath closes unscored and the game enters PAUSED, as with idle.
- **Focus and reach.** Stop and "dizzy or short of air" are the first two Tab stops. Esc opens the stop screen, and the stop screen focuses "dizzy or short of air" first, so that exit is always two keys away.
- **What the input measures.** It records the player's own report of when each breath turns, accurate to about 1 ms on the key. It does not measure depth, airflow, heart rate or calm, and nothing in the game claims otherwise (D17).

## 4. Pattern library and progression (whole game)

Each chapter is one plan page, played as Learn, then Echo, then Fly. Chapters unlock in order, and any unlocked page can be replayed. On replay the page offers all three tiers and defaults to the first one not yet starred.

| Ch | Plan id | in / pause / out / rest (s) | Breaths/min | Kite name | Sizes | World change on stamp | "What we know" card |
|---|---|---|---|---|---|---|---|
| 0 | `natural` | free, not scored | own | your own kite | n/a | none | none |
| 1 | `even_4` | 4 / 0 / 4 / 0 | 7.5 | **the needle** | 4; smaller 3.5, 3 | windsock | shape only |
| 2 | `box_3` | **3 / 3 / 3 / 3** | 5 | **the square sail** | 3; smaller 2.5, 2; another size `box_4` (4 / 4 / 4 / 4, 6 cycles max) | bunting on the roof | the box card (§10.10) |
| 3 | `exhale_4_6` | 4 / 0 / 6 / 0 | 6 | the long-tail | 4/6; another size `exhale_4_8` (4 / 0 / 8 / 0, 5 a minute) | a second spool | the long-tail card (below) |
| 4 | `coherent_5` | 5 / 0 / 5 / 0 | 6 | the drifter | 5; another size 5.5 | a weathervane | claim 2, reworded (below) |
| 5 | `sigh_easy`, `sigh` | 2 + sip / 0 / 4 or 6 / 1 | about 7.7, about 6 | the two-step (needs `parseSips`) | `sigh` is another size of `sigh_easy` | a drying line of sails | the sigh card (below, D27 amended) |
| 6 | `dart_4_3` | 4 / 0 / 3 / 0 | 8.6 | the tall dart | 4/3; smaller 3/2.25 | a ladder to the loft | **none** (claim 6) |
| 7 | `478_half` | 2 / 3.5 / 4 / 0 | 6.3 | the heron | as listed | a heron vane on the ridge | **none** (no sleep claim) |

**Another size, never "next" (D57).** A larger size (`box_4`, `exhale_4_8`, `coherent_5.5`, `sigh`) becomes *available* after any ★ at the base size, so nobody meets a 4 s pause cold. It earns no stamp, no kite and no world change, and the page lists it as "another size", never "next" or "harder".

**Cards for later chapters (full game only, D53/A7).**
- **About breathing practice** (a general card reached from the workshop wall, never from a plan): "In trials, a few minutes of daily breathing practice was followed by small drops in how stressed people felt." (claim 3; Fincham et al. 2023, doi:10.1038/s41598-022-27247-y.) It is tied to no pattern.
- **The drifter:** "While you breathe about 6 times a minute, your heart rate rises and falls more with each breath. This game can't measure that." (Laborde et al. 2022, doi:10.1016/j.neubiorev.2022.104711.)
- **The long-tail:** "One trial of 66 people found that people felt less anxious in a stressful moment after a short session of long out-breaths than after breathing normally. Studies disagree on whether a longer out-breath does more than an even one." (McAllister et al. 2026, doi:10.1016/j.cpnec.2026.100360; Meehan & Shaffer 2024, doi:10.1007/s10484-024-09637-2.)
- **The two-step:** "A trial of 47 students found one minute of cyclic sighing lowered anxiety in a stressful moment more than doing nothing. The research is still small." (Riedl et al. 2026, doi:10.1080/10615806.2026.2659809.) It must not say sighing beats box breathing.

**Excluded for good (D6, D25):** full 4-7-8 (7 s hold), `bright_3_2`, any fast round, any retention round, any hyperventilation round.

**Hold cap:** 4 s in every target anywhere in the game.

**Baseline (D23 as amended by D52).** Chapter 0 records 4 natural breaths each session. If the mean baseline cycle is under 5 s, the plan page preselects one size smaller; the player can choose any size. The baseline never rescales a plan and is never stored.

**Species rule (D64).** Each species is told apart by silhouette and pattern, never by hue: square sail, quartered with ink seams and square tail bows; needle, a single centre seam; long-tail, a chevron tail; drifter, banded fabric; two-step, a double bow; tall dart, a notched tip; heron, a long neck streamer.

**Session caps (all chapters):**
- at most 180 s of patterned breathing per round
- at most 12 min of patterned breathing per page load
- a 20 s break between rounds, shown as a countdown; pressing during it is optional (Norm, 2026-11-02)
- once the 12 min are used, only loose kites are offered

**Tier stars.** One mastered round at a tier earns that tier's star. A replay can start at any tier.

## 5. Mastery and rewards

**Tolerance (D15 as amended by D46):** `tolFor(t) = t > 0 ? max(0.6 s, 0.20 × t) : 0.5 s`. Every Square size is ±0.6 s; a 4 s phase is ±0.8 s; a zero-target phase is ±0.5 s.

**One breath:**
- **fit:** all four phases within tolerance, and not fast.
- **fast:** the in- and out-breaths are rushed: `inh + exh < 0.7 × target (inh + exh)` **and** the cycle is under 0.7 × the target cycle (D47).
- **short still:** the pause and rest together are under half their target. This is the usual sign of air hunger at slow paces, so it brings a "smaller" offer, never "slower".
- **well off:** fast, or any phase error greater than 2 × tolerance.

**One round:**
- 6 cycles at every tier (D16). Nothing ever extends a round (D48).
- The first breath is the settle-in and is not scored. A settle-in also follows any pause, stop or size change.
- A breath closed by a pause, stop, size change or cap is unscored, still flies, and does not count as a cycle.
- **Mastered:** of the last 5 breaths in the mastery window (status `fit`, `off` or `dropped`), at least 4 exist and at least 4 are `fit`. Learn, Echo and Fly use the same rule.

**Stars (D19):**
- ★ = a Learn round mastered (pencilled on the page, drawn as an outline)
- ★★ = an Echo round mastered (pencilled)
- ★★★ = a Fly round mastered, and **only this one is stamped** (filled)

A star never counts length, speed, depth or size. The stamp records the size it was earned at ("3 s"), and size adds no credit.

**What the stamp gives:**
1. the stamped plan page
2. the plan's kite, in its species fabric, flying for good on its tether post on the hill line
3. one world change per plan

The stamp sequence is in §10.3 (B9). There are no streaks, no leaderboard and no "keep going". The only counts shown are "k of s" and per-side medians in the ending sentences.

**Help (Echo and Fly only; at most once per round).** Two well-off scored breaths in a row bring the full guide back for the next two breaths, starting at the press that closed the second of them. Those two breaths are `helped`, are not scored, and do not extend the round. The smaller-kite button glints at the same moment. **A round in which help fired ends "not yet" by construction:** the two well-off breaths stay in the mastery window and no extension makes room. The player gets the guide back and a shorter road out, not more breathing for a result that cannot change.

**"not my breath".** Tapping it marks the most recent closed breath `dropped`. A dropped breath keeps its slot in the mastery window as not-fit and extends nothing, so the button can never improve a result. It only leaves that kite out of the logbook and the ending numbers. It is available from a scored breath's close until the next breath closes, or, after the last breath of a round, until the END page comes forward.

## 6. Safety

- **Intro card:**
  - a seated reminder
  - the dizziness and tingling lines (Researcher A's claim 5, split across two lines word for word, D20)
  - the air-hunger line `intro.safe3` (D49)
- **Always visible:**
  - **stop (Esc)**, which opens the stop screen; the round continues on resume
  - **dizzy or short of air**, which ends patterned play for this page load with no "are you sure" (only loose kites remain)
- **Stop screen:** the three safety lines, then "dizzy or short of air" (focused first), "carry on", "finish for today".
- **Dizzy screen:** rest guidance, the claim-5 lines, a line for air hunger, and one step beyond waiting: "if it hasn't passed in 10 minutes, ask someone for help." The 10 minutes is a practical threshold Researcher A chose, not a figure from a study (D49).
- **Holds and pauses:**
  - No target pause or rest is longer than 4 s (3 s in the prototype).
  - Ten seconds with no key down auto-pauses the round. The open breath closes unscored and still flies.
  - A pause that reaches target + 2 s shows "breathe out whenever you're ready." A rest that reaches target + 2 s shows "breathe in whenever you're ready." An in- or out-key held to target + 2 s shows "let go whenever you're ready." "Let go" always means releasing a key (D50).
  - An in- or out-key held for 12 s closes the breath unscored and pauses the round (D59).
- **Fast breathing:** two fast breaths in a row show "slower is fine. smaller is fine too." (at size 2: "slower is fine. stop any time.")
- **Air hunger:** two short-still breaths in a row show "short of air? a smaller square fits." (at size 2: "short of air? stop and breathe normally.") and glint the smaller button.
- **Sizing:** the size is chosen on the plan page before Learn, preselected smaller when the baseline is quicker than 5 s a breath (D52). "smaller kite" stays available at any moment and costs nothing.
- **Caps:** 180 s of patterned breathing per round and 12 min per load, both checked every tick (D59). "one more round" appears only if a full 180 s round still fits inside the 12 min.
- **Pacing:** the guide never speeds up, never slows down, never waits and never follows the player (D21, D43).
- **Small breaths:** `learn.go` asks for small, easy breaths before the first scored breath; `learn.p2` ("small breaths are fine. it's the timing.") shows at the cycle-2 press of Learn and again at the cycle-2 press of Fly. It addresses the mild over-breathing Marchant 2025 found at 6 breaths a minute. `learn.p1` ("no clamping") keeps the pause and rest from becoming strained holds. The demonstrating mentor shows the breath as a small apron swell, never a shoulder lift (D53).
- **Eyes-closed play** is not invited in the prototype. Every safety cue is visual, so an eyes-closed mode waits for the full game and an audible safety channel made of fixed spoken lines, never a tone tied to fit (D54).
- **Safety captions** sit in a separate `role="status"` region announced before any other caption.
- **Data:** at most one localStorage key is written, and nothing is sent. There is no breath log on disk (D13).

## 7. Characters and world

**Palette.** The character designer's table unchanged: Kite 2.0's sky (`#86c0e6`, `#bfe0f2`, `#e3f0f2`), meadow and ink (`#1f2a3d`), `KITE_COLORS`, and senseforaging denim for the mentor. No colour ever carries a meaning: no red, and no green or grey used as a signal. Every signal is carried by ink, shape or position, and every signal graphic is at least 3:1 against what is behind it (D61).

**The mentor (internal name "Hollis", D28).**
- The name appears nowhere the player can see. The mentor never names themselves.
- Short, broad, older, standing behind the bench. Cloth cap and round spectacles.
- **No mouth and no brows**, only two dot eyes, so the face cannot react to accuracy. Minimums in device px: eye dot r ≥ 1.5, lens stroke ≥ 1.25 px in ink, eyes 30% inside the lens toward the gaze side.
- Construction follows the designer's unit-`u` spec: bell torso, apron with a spar in the pocket, layer order as given.
- **Gaze rule:** carried mainly by a 6° head turn plus the lens offset. During scored breaths the mentor's head is turned to the bench work, never to the live kite. During the Learn demo the head turns to the ghost, because the ghost is their plan. `state()` exposes the head angle for tests.

| Pose | Used in | Behaviour |
|---|---|---|
| A, sighting a spar | intro, plan page, Echo | pans 3u, then still for 6–10 s |
| B, stitching a sail | Fly | needle hand rises 8u in 0.8 s, then still for 5–12 s at a random interval |
| C, winding a spool | baseline, loose kites, ending | one orbit every 2.5 s for 3–5 turns, then a pause |
| D, demonstrating | Learn only | the mentor breathes the plan **on the guide clock**, never on the player: the apron front swells (horizontal scale `1 + 0.03·f` about the waist centre). Shoulders and head stay still. |

- Pose D is baked as **3 sprites**: legs and bench-occluded base; torso and apron (the only scaled layer); head with cap, spectacles and shoulders. Three `drawImage` calls.
- There are no pleased, worried or watching poses. Idle motions last 0.8–2.5 s, followed by random stills of 5–12 s. Only pose D is locked to the breath.
- **Pose changes:** every 8–14 s from a seeded schedule, 900 ms. The outgoing pose stays at α 1, the incoming pose is drawn on top from α 0 → 1, then the outgoing pose is dropped (no see-through mid-fade). A change is blocked for 1 s around any glint, ring or launch; a blocked change is deferred to the next free window and skipped if it has waited more than 4 s.

**Shed and hill (1280×720 reference):**
- Designer's layout: shed at x 40–470, bench from x 120 to 700, mentor at x ≈ 260, build frame at x ≈ 600 with the hub at (600, 330).
- Three plans pinned on the wall, the Square in the centre. Each wall plan is a miniature ghost at scale 0.2, redrawn at the current size.
- The hill ridge is a quadratic from (760, 520) to (1280, 470) in `#d3e7c2`, with **8 tether posts**. Empty posts show only the faint post, with no "missing" silhouette.

**Layout and scale (D22):**
- **Landscape:** the 1280×720 layout scaled uniformly by `k = min(W/1280, H/720)` and centred. `S = 43.2·k` px per second of breath.
- **Portrait:** the designer's 390×844 layout scaled by `k' = min(W/390, H/844)`. Hill band y 0–150, hub at (195, 380), bench strip y 560–700, pads at y 716–828 (two pads 171×112 with 16 px gutters). `S = 29.25·k'`.
- S is computed on resize only and **never depends on plan size**, so a smaller plan really is a smaller kite.
- Later chapters clamp S so that `(inh + exh + 2)·S ≤ 0.75·H`.
- Kite 2.0's `spars()` is used unchanged for finished kites: `CAP_S = 9`, `FLOOR_UP = 0.4`, `FLOOR_SIDE = 0.55`.

**Sky placement (D29):**
- **Round kites:** kites launched during baseline, rounds and loose interludes fly at scale 0.36 in the open sky (landscape x 480–1240, y 50–170; portrait y 160–280 at scale 0.3). Strings run to a peg on the frame crossbar. At the end of each phase of play they drift off to the right over 3 s.
- **Hill-line kites (D64):** each kite is fitted to its own slot rather than a fixed scale: `scale = min(0.4, slotW/width_px, slotH/(height_px + tail_px))` for the kite's bounding box at S. Landscape slots are 60×90 px at y 200–320. Portrait lays the 8 posts out as two staggered rows of 4 (y 40 and y 105) with slots 40×70 px and a 0.3 scale ceiling. On the hill line, flight ampX is clamped to 4 px and tails to 30 px.

**Fabric and outlines:**
- Live and round kites use Kite 2.0 fabric, coloured by kite index in `KITE_COLORS` order. The colour is identity, never rank.
- **Every kite gets an ink outline**, never one in the kite colour: α 0.55 while building, α 0.45 once launched, at least 1.25 device px after scaling (D61).
- **Square-sail species fabric:** quartered by the cross spars (top-left and bottom-right `tint(c,.55)`, the other two quarters `c`, with `c = #e2557f`), the cross spars drawn as 1.5 px ink seams at α 0.6, and filled ink-outlined square tail bows (5 px at hill scale). The species reads by its seams and bows, not its hue. This fabric appears only on the stamped kite, the wall plan and the hill line.

**Text layers (D61).** All captions, safety lines, the plan page, buttons and the ending are DOM text. The canvas has `role="img"` with an aria-label updated after each breath ("kite 3: in 3.1, pause 2.9, out 3.2, rest 2.9 seconds"). The end picture's tiles carry a visually hidden list of the same numbers.

## 8. Animation and feedback

The animator's round-1 spec stands, with the changes below.

- **Spars grow linearly**, from the frame of the press: drawn length = `min(CAP_S, breathNow − t0)·S`, never eased. When a side phase ends shorter than its floor, its spar eases out to the floor over 120 ms. The bead uses this same growth rule, so it always sits where a live tip would be.
  - The live tip is a white dot of r 5 px with a 2 px **ink** ring at α 0.85 and a 1 px kite-colour ring outside it. It never pulses.
  - The halo is a wide `rgba(255,255,255,.5)` underlay stroke under the spar strokes. There is **no shadowBlur** (D30).
  - Sail fill alpha is `0.10 + 0.12·f`, with τ = 1.6 s rising and 2.2 s falling.
- **The drawn kite matches the parsed kite.** The renderer runs `normalizeSegments` on the **closed** segments only and appends the open segment raw, undemoted. The open segment is provisional: a slip stub pulls back over 200 ms once it is released under 300 ms; a same-phase re-press within 300 ms carries on the same spar.

  Self-test: at launch, per-spar **seconds** exposed by `state()` equal `parseBreaths()` within 1 ms (pixels are not compared; 1 px ≈ 23 ms).
- **Ghost (a plan, not a judgement). Its geometry never moves (D62).**
  - outline dashed `[6,5]`, 2 px, ink at α 0.65 (3.4:1 on the darkest sky)
  - fill `rgba(255,255,255, 0.16 + 0.08·f)`: the only part of the ghost that swells
  - spars dashed `[2,4]`, 1.5 px, ink at α 0.45
  - a 6 px end-tick at each tip, with the plan number beside it in 12 px weight 600 full ink, over a 3 px `rgba(255,255,255,.7)` stroke
  - no per-second ticks
  - on entering Learn or a size change, a dash reveal runs in breath order, 300 ms per spar

  **Ghost visibility (D18 as amended by D55):**
  - Learn: ghost plus guide.
  - Echo: static ghost, no bead, no swell.
  - Fly: hidden while you breathe. After each breath, a logbook tile shows the plan against your kite (below). The small wall plan is always visible. The help guide brings the ghost back for its two breaths.
- **Guide (Learn, and the help guide).**
  - **The bead is the head of the current phase's ghost spar** (D62). It moves from the hub to that spar's tip by the spar growth rule, linear in time, on the same line the live spar grows along. Bead: r 5 px, white at α 0.9 with a 1.5 px ink ring, pre-baked glow sprite.
  - At each turn the bead fades out at the end-tick over 120 ms while a new bead fades in at the hub. It never travels across the kite.
  - **Fullness drives the fill and pose D only:** `f = (1−cos πp)/2` during in, 1 during the pause, `(1+cos πp)/2` during out, 0 during the rest.
  - 400 ms before each turn, the next ghost spar brightens from α 0.65 to 0.90.
  - There is no separate pause arc (D31).
- **Echo turn cue (D61, D62):**
  - a bell (when bells are on)
  - a ring **at the next spar's end-tick**, ink α 0.8 → 0, 2.5 px, radius 8 → 22 px over 600 ms, over a 4 px white underlay
  - the next ghost spar brightens from 0.65 to 1.0 and widens to 3 px for 400 ms
  - In the first Echo cycle only, the bead also runs at α 0.4 as a handoff.
  - With bells on, the visual cue fires at `turnT + (ac.outputLatency || 0)` so sight and sound land together. With bells off it fires at `turnT`.
- **Stitches (Learn and Echo).** A spar is judged once the parser confirms it: release + 300 ms for in and out, the next confirmed press for pause and rest.
  - A phase in tolerance gets 6 ink cross-stitches (6 px, 1.5 px, 45°, ink α 0.75) laid hub-outward 40 ms apart, then an 18 px white highlight at α 0.8 that runs the spar over 500 ms as decoration.
  - The rest spar is judged at the launch, so its stitches appear as a 200 ms fade on the departing kite, with no travelling highlight.
  - A phase out of tolerance gets nothing.
  - The stitches are **silent**, so no one hears a score (D32).
- **Launch (D44):**
  - At confirmation of the next in-press (press + 300 ms) the finished kite launches on a quadratic arc pushed downwind (+0.15 W, −0.10 H) over 1.4 s with Kite 2.0's easeInOut, scaling 1 → 0.36. There is no pre-launch lift. The new kite draws on top.
  - At launch the finished kite is baked to an offscreen sprite at DPR; only its tail and string stay vector (D66).
  - Flight uses `personality()` unchanged. The Square at 3/3/3/3 classifies as **float**, at about 0.34 rad/s. Hill kites fly at 0.6× frequency.
- **Fly knowledge of results (D55).** At press + 900 ms after each closed Fly breath, one **44 px logbook tile** fades in over 300 ms at the logbook spot on the bench and stays until the next tile replaces it. The tile overlays the plan (dashed ink α 0.65) under the player's kite (solid ink outline α 0.85, kite-colour fill), both at one shared scale chosen so the plan fills 70% of the tile and clipped to the tile, with ink stitch ticks on the matched spars. A dropped breath's tile fades out over 200 ms. The full strip of the round's tiles is built out of view and revealed only at END.
- **Timing around the press.** In-play captions start at press + 1000 ms. Rest stitches at press + 300. Tiles at press + 900. Nothing else starts at the press except the new spar and the breeze.
- **The breath that closes a round (D68)** builds and flies as a loose kite (Kite 2.0 fabric, unscored). A timeout close launches the finished kite at the timeout instant with the normal arc.
- **Idle life:**
  - Wind `w(t) = 0.6 + 0.25 sin(2πt/23) + 0.15 sin(2πt/37 + 1.3)`, never coupled to breath or accuracy.
  - Clouds move by `dt`, never by a fixed step per frame.
  - Mentor pose changes as in §7.
- **Camera:** always still (D33).
- **Reduced motion** (`prefers-reduced-motion` or the in-game toggle):
  - Kept: spar growth and the bead.
  - Removed: the fill swell, the travelling highlight (stitches fade in over 200 ms instead), the launch arc (fade out 400 ms, fade in at the slot 400 ms), the plan page and stamp travel (fades only) and the bunting spring.
  - Changed: rings become a static ink dot r 6 pulsing α 0.4 → 0.9 over 600 ms, flight amplitude drops to 0.3×, and clouds move at 25% speed.
- **Tweens (D63).** No CSS transitions or animations. A tween table writes `style.opacity` and `transform` each frame, only when a value changes. Game tweens (captions, page, stamp, tiles) run on the breath clock and freeze when it pauses; overlay tweens (stop, dizzy, paused screens) run on their own clamped lane. `step()` advances both.
- **Frame budget:**
  - at most 6 ms of main-thread work per frame on a mid-range phone; DPR capped at 2
  - static background (sky, sun, meadow, hill, shed, posts) on its own canvas underneath, redrawn only on resize
  - pre-baked sprites for mentor poses, clouds, glows and every finished kite, each drawn with one `drawImage`
  - no gradients created inside `draw()`; no `shadowBlur`, `ctx.filter`, or CSS or SVG blur
  - about 150 path ops per frame, and no allocation in the hot loop
  - rAF and the breath clock stop when `document.hidden`
  - anything below α 0.01 is skipped
- **Audio (D32, D43, D63):**
  - **The player's breath gets Kite 2.0's breeze only**: `breezeOn` while a key is held, silent in pauses. The breeze is not affected by the bells toggle.
  - **Bells belong to the plan's clock only.** The player's presses never ring a bell. The anchor in-turn of a round, of a resumed round, of a size change and of the help guide is **silent**; bells start at that cycle's pause-turn. After the last cycle's rest-turn no further in-turn bell rings.
  - Turn bells use Kite 2.0's `bell(f, when, 0.05, 2.2)` at fixed pitches from Kite 2.0's D-major pentatonic `SCALE`: in-turn `SCALE[5]` 293.66 Hz; pause-turn `SCALE[7]` 369.99 Hz; out-turn `SCALE[3]` 220.0 Hz; rest-turn `SCALE[1]` 164.81 Hz.
  - Each bell is scheduled at most 150 ms ahead, at `ac.currentTime + (turnT − breathNow)/1000`. On PAUSED, STOPPED, DIZZY or a size change: stop scheduling, ramp the bell bus gain to 0 over 80 ms, disconnect pending nodes, and restore the gain on resume.
  - Every launched kite gets the same soft two-note chord at level 0.03, which carries no information about fit.
  - The stamp has one bell, `bell(SCALE[0], t, 0.04, 2.2)` (146.83 Hz), no louder than a turn bell.
  - Sound is off until the first press after "begin". The single toggle is "bells on / bells off".
  - Every test browser runs with `--mute-audio` (D14).

## 9. Voice and copy rules

- The mentor talks about the kite, the plan and their own job, never about the player's performance.
- Banned words: good, great, well done, nice, almost, try, again, wrong, miss, fail, keep going, better, best, and anything that sounds like a score.
- Feedback is about the thing on the bench: "the kite builds when you breathe", never "you were late".
- **One name per phase**, matching Kite 2.0's `STATE_WORDS` (unchanged) under the kite: `breathing in`, `pause`, `breathing out`, `resting`. Copy says "in", "pause", "out", "rest". "Equal" describes the Square's sides everywhere. "Let go" means releasing a key, and only that.
- The phase word is rendered as in Kite 2.0 at opacity 0.9 (14 px in portrait).
- Stage text is lowercase, as in Kite 2.0.
- Length limits: in-play lines at most 8 words. Screen, interlude and round-start lines at most 12 words.
- **Captions (D34):** DOM text, at least 16 px on phone and 18 px in landscape, full ink on a `rgba(255,255,255,.78)` plate (radius 12, padding 8/16). They fade in over 600 ms, hold 4.8 s, fade out over 600 ms: 6 s in all. One mentor caption slot is used at a time, in an `aria-live="polite"` region. Safety lines use a separate `role="status"` region.
- **Timing:** in-play lines start at press + 1000 ms. The `drift.over*` lines are the exception: they fire mid-phase at the moment their threshold is crossed.
- **Priority** when two lines are due: safety, then help, then drift, then flavour. `learn.p1` and `learn.p2` count as safety. Help and drift lines are rate-limited to one per 20 s each. A flavour line that finds the slot full waits for it to clear and is dropped if it has waited 6 s.
- **Naming (D35):** the mentor says only "the square" and "the square sail". The plan page and the "What we know" card each say "also called box breathing" once.
- **Numbers:** `{n}` sizes render as digits ("3", "2.5", "2"). Player-facing numbers describe the plan or report the player's own kites; nothing shows a rate or precision for the player to beat (D56). Errors are quantised to whole ms before any rounding, and ending medians round to the nearest 0.1 s.
- **Evidence:** no effect claim appears in mentor dialogue or on the plan page. The optional "What we know" card states the evidence at its own strength, with numbers (D51).
- Exits say what they do. No button that says "finish" leads to more breathing (D65).

---

## 10. PROTOTYPE LEVEL: Chapter 2, "The Square Sail" (`box_3`, 3 / 3 / 3 / 3)

**File:** `public/prototypes/kitewright.html`, one self-contained file in the house pattern (see `hive.html` and `thaw.html`). It needs an entry in `public/prototypes/index.html` and a website.md §29b entry (D13). The name check is cleared for the prototypes index (D58).

**Nominal length:** about 6 min. Patterned breathing is 3 rounds × 6 cycles × 4n s: 216 s at size 3, 180 s at 2.5, 144 s at 2. No round is ever extended.

### 10.1 Constants

```js
const PH = ['inh','hold','exh','rest']
const SIZES = { 3: {inh:3,hold:3,exh:3,rest:3}, 2.5: {inh:2.5,hold:2.5,exh:2.5,rest:2.5}, 2: {inh:2,hold:2,exh:2,rest:2} }
const q = x => Math.round(x * 1000) / 1000                     // quantise seconds to whole ms
const tolFor = t => t > 0 ? Math.max(0.6, 0.20 * t) : 0.5      // D46
const CYCLES = 6, ROUND_CAP_MS = 180000, LOAD_CAP_MS = 720000
const IDLE_PAUSE_MS = 10000, OVERRUN_S = 2, TIMEOUT_EXTRA_S = 2, KEY_MAX_S = 12
const CONFIRM_MS = 300                                         // = MIN_HOLD_MS
const LOOSE_MIN_MS = 20000                                     // Nov 2: a plain 20 s, no breath count
const BASELINE_N = 4, BASELINE_MAX_MS = 60000, BASELINE_LAST_REST_S = 2.5   // Kite 2.0's LAST_REST_S
const PRESELECT_SMALLER_BELOW_S = 5                            // baseline mean cycle
const BELL_LOOKAHEAD_MS = 150, BELL_FADE_MS = 80
const CAPTION_DELAY_MS = 1000, TILE_DELAY_MS = 900, NOTMINE_FINAL_MS = 1000
const STAR = { learn: 1, echo: 2, fly: 3 }
// deleted in v3: PULL_FORWARD_MS, MAX_EXT
```

### 10.2 States

```
INTRO → BASELINE → PLAN → LEARN_INTRO → ROUND(learn) → LOOSE(1) → ECHO_INTRO → ROUND(echo)
      → LOOSE(2) → FLY_INTRO → ROUND(fly) → END(stamp | open)
END(open) --btn.moreEcho--> ROUND(echo) → END
END(open) --btn.moreFly---> ROUND(fly)  → END
END(*)    --btn.loose--> FREE (loose kites, never ends by itself)
END(*)    --btn.end----> DONE --btn.loose--> FREE
Overlays, from any state:
  PAUSED  (10 s no key, a key held 12 s, or tab hidden)
  STOPPED (Esc / btn.stop)
  DIZZY   (btn.dizzy) → DONE; afterwards only FREE is reachable this page load
```

END(stamp) means the round just played was a mastered Fly round. END(open) is every other ending. Both names are internal.

### 10.3 Beat-by-beat

Times are relative to the start of each beat. Every "press" below means a **confirmed** press (held 300 ms); its time is the press's `t0`.

**On load.** If localStorage holds `square.stamped`, the square sail already flies on hill post 1, the bunting is up, and the wall plan shows its stars. Otherwise the hill line shows 8 empty posts.

**B0. INTRO** (player-paced, about 25 s)

| t | What happens |
|---|---|
| 0.0 | The sky, shed and hill line are drawn. The mentor is in pose A. The wall shows the Square plan in the centre. The intro card fades in over 600 ms. |
| 0.0 | The card holds, in order: `intro.1`, `intro.2`, `intro.2b`, `intro.3`, `intro.press`, `intro.seat`, `intro.safe1`, `intro.safe2`, `intro.safe3`, then `btn.begin`. A link, "what we know", opens the card in §10.10. |
| on `btn.begin` | The card fades out over 600 ms. The audio context is created on this gesture. → B1 |

**B1. BASELINE** (about 25 s; at most 60 s)

- Mentor in pose C. No ghost, no guide, no bells.
- `base.1` shows at beat start.
- Recording starts at the first press. Each breath builds a live kite and launches it at the next confirmed in-press, as in Kite 2.0.
- The 4th breath closes at a confirmed in-press, or once its rest reaches 2.5 s.
- After 60 s, the beat closes with whatever breaths exist.
  - With 1 or more breaths, show `base.end`. The mean baseline breath is pinned on the wall beside the Square plan as a 28 px tile labelled "your own kite": its shape only, no rate (D56).
  - With 0 breaths, show `drift.idle` and wait for a press. Pressing starts the baseline over.
- **Preselect (D52):** if the mean baseline cycle is under 5 s, size 2.5 is preselected for B2; otherwise size 3. With no baseline breaths, size 3. The baseline is **not stored and rescales nothing**.
- Round kites drift off. → B2

**B2. PLAN** (player-paced)

- The plan page eases forward from the wall onto the bench (translateY −24 → 0, α 0 → 1, 700 ms). Mentor in pose A.
- The page shows the plan text (§10.4) and a size chooser: three buttons, "3 s", "2.5 s", "2 s", under the label "kite size", with the preselected size marked. Below them, `size.air`.
- The page says `plan.how` above the button, the phase word reads "pick a size, then “start”", and the mentor says `plan.go` 1.2 s in (Norm, 2026-11-02: it was not clear how to begin).
- Button `btn.show`. On tap, the page eases back to the wall (500 ms) and the chosen size becomes `n`. → B3

**B3. LEARN_INTRO** (about 6 + 4n + 1.4 s; about 20 s at size 3)

| t | Event |
|---|---|
| 0.0 | Mentor in pose D, head turned to the ghost. Ghost dash reveal at size n (4 × 300 ms). Caption `learn.demo` (`learn.demom` if bells are off). |
| 6.0 | The **demo cycle** starts. Scripted segments go through the same renderer: in 6–(6+n), pause, out, pause, each n s. Demo bells ring at 6, 6+n, 6+2n and 6+3n (the plan's clock). The bead walks. Caption `learn.0`. |
| 6 + 2n | Caption `learn.0b`. |
| 6 + 4n | Scripted in-press. The demo kite launches, then fades out at the top of the sky over 1.4 s. **Self-test:** it parses to exactly n / n / n / n. |
| 6 + 4n + 1.4 | Caption `learn.go` (`learn.gom` if bells are off). The ghost stays, with the bead parked at the hub. Wait for the player's first confirmed in-press. → B4 |

**B4. ROUND(learn)** (6 cycles; about 6·4n s plus the close)

- The guide anchors at the player's first confirmed in-press (`c0` = its `t0`; cycle 1 = settle-in) and runs as in §10.5. The anchor in-turn is silent.
- Ghost, bead, fill swell, turn bells.
- Stitches per spar (§8).
- Mentor in pose D, breathing on the guide clock.
- Lines: `learn.p2` at the cycle-2 press, `learn.p1` at the cycle-4 press.
- Help never fires in Learn.
- The round ends when 6 cycles are recorded. The final breath closes at the next confirmed in-press, or by timeout at rest = n + 2 s. A closing in-breath becomes the first loose kite of B5.
- At round end, run `endRound()`. If mastered and ★ is new, a pencilled ★ appears on the wall plan with no line and no sound.
- → B5

**B5. LOOSE(1)** (at least 20 s)

| t | Event |
|---|---|
| 0.0 (round close) | Ghost α → 0 over 800 ms. Bench warms (+0.04 overlay) over 1.2 s. Mentor in pose C. |
| 1.0 | Caption `loose.1`. |
| 7.5 | Caption `loose.f1`. |
| any | Free breaths build and fly, recorded but not scored. |
| 0.0–20 | The break panel shows from the start: "a short break · N s" counting down, with `btn.carry` disabled (Norm, 2026-11-02: how long do I breathe freely?). |
| 20 s | Caption `loose.ready`; the panel says it too, and `btn.carry`, `tog.bells` and `btn.back` (only if the player sized down during the round) are live. |
| on `btn.carry` | Round kites drift off. → B6 |

**B6. ECHO_INTRO, then ROUND(echo)**

- `echo.0` (`echo.0m` if bells are off) shows at beat start. The ghost reappears as a static outline (300 ms fade). Mentor in pose A.
- The guide anchors at the first confirmed in-press (silent anchor).
- Cycle 1: bead at α 0.4, bells and rings.
- Cycles 2–6: bells and rings only, with no bead and no swell.
- Lines: `echo.p1` (`echo.p1m`) at the cycle-2 press; `echo.p2` (`echo.p2m`) at the cycle-4 press.
- Help may fire (§10.6).
- At round end, a pencilled ★★ appears if mastered and new. → B7

**B7. LOOSE(2)** — the same as B5, with `loose.f2` at 7.5 s in place of `loose.f1`.

**B8. FLY_INTRO, then ROUND(fly)**

- At beat start: `fly.0`.
- The ghost fades out. No bead, no bells, no rings. Mentor in pose B.
- The round anchors at the first confirmed in-press (cycle 1 = settle-in).
- After each breath closes: a logbook tile at press + 900 (§8). No ghost on the kite.
- Lines: `fly.p1` at the cycle-1 press, `learn.p2` at the cycle-2 press.
- Help may fire. The help guide shows the ghost and bead (and bells if on) for the two helped breaths, anchored at the press that closed the triggering breath, then fades over 1200 ms.
- At round end → B9.

**B9. END**

`t = 0` is the release of the in-breath that closed the last breath, or 6 s after that close, whichever comes first. For a timeout close, `t = 0` is the timeout. The pads stay live: later breaths fly as loose kites. The last breath's "not my breath" window stays open until t = 1.0; a tap in it marks the breath `dropped` and re-runs `endRound()` before END renders.

END(stamp) timeline:

| t | Event |
|---|---|
| 1.0 | The plan page eases forward (translateY −24 → 0, α 0 → 1, 700 ms). Caption `master.1`. |
| 1.8 | The stamp glides 40 px along the bench toward the page over 600 ms. The mentor's pose does not change. Button `btn.stamp` appears and waits with no timeout. *(If the page was already stamped on an earlier visit, the inked stamp is shown instead, with no button and no bell, and the timeline continues at tap + 4.7.)* |
| on tap | The stamp lowers (400 ms easeInOutQuad), squashes to 0.96 for 120 ms and inks to α 0.85 over 250 ms. One bell, `bell(SCALE[0], t, 0.04, 2.2)`. The page shows filled ★★★ and "{n} s". |
| tap + 0.8 | The square-sail kite lifts off the page on a 2.4 s arc to hill post 1 and flies there for good. Caption `master.2`. |
| tap + 3.2 | Bunting: 9 pennants along the roof edge in `KITE_COLORS` order, unfurling 150 ms apart on a damped spring (0.25 rad, ω 6, ζ 0.5). |
| tap + 4.7 | The logbook strip is revealed and the ending sentence fades in over 1.2 s (§10.9). Then buttons `btn.loose` and `btn.end`. |

END(open): the same timeline without the stamp. The page comes forward showing any pencilled ★ or ★★, the logbook strip (if a Fly round was played) and the ending sentences, then:
- `btn.moreEcho` and `btn.moreFly`, shown only if `patternedMs + ROUND_CAP_MS ≤ LOAD_CAP_MS`, DIZZY was not used, and END was not reached through the stop screen. They become enabled once 20 s have passed since the round closed or 3 loose breaths have flown, whichever is first.
- `tog.bells`, `btn.loose`, `btn.end`.
- After one more round, END runs again. Only a Fly round can stamp.

**B10. DONE and FREE**

- `btn.end` → DONE: the end picture stays, the pads go inactive, caption `end.later`, button `btn.loose`.
- `btn.loose` → FREE: loose kites with no plan, no guide and no end. Mentor in pose C.

**The still end picture:**
- the plan page (left)
- the Fly round's logbook strip, at most 6 tiles of 44 px with 8 px gutters, dropped breaths left out (centre)
- the "your own kite" baseline tile (right, small)
- no chart and no numbers other than the sentences

### 10.4 Lines

`{}` marks a value filled in at runtime. This is the full text for the build. Lines marked *(v3)* are new or changed in this round. Researcher A signed off every line that survives from v2 (D37); the *(v3)* lines are either A's own wording or copy-only, and A re-reads them before the index entry is published (D70).

**Intro**

| id | text |
|---|---|
| intro.1 | this is the workshop. every plan on the wall is a breath. |
| intro.2 *(v3)* | hold “breathe in” (↑ or I) as you breathe in. |
| intro.2b *(v3)* | hold “breathe out” (↓ or O) as you breathe out. |
| intro.3 *(v3)* | let go of both for the pause and the rest. |
| intro.press | press when your breath turns, not when the kite does. |
| intro.seat | sit down for this one, somewhere steady. |
| intro.safe1 | if you feel dizzy, light-headed or tingly, stop and breathe normally. |
| intro.safe2 *(v3)* | these are common signs of breathing more air than your body needs. |
| intro.safe3 *(v3)* | if you feel short of air or uneasy, stop and breathe normally. |
| btn.begin | begin |

**Baseline and plan page**

| id | text |
|---|---|
| base.1 | first, just your own breath. four of them, any shape. |
| base.end | that's your own kite. i'll pin it by the plan. |
| size.label *(v3)* | kite size |
| size.air *(v3)* | short of air at any point? pick a smaller kite. |
| btn.show *(Nov 2)* | start |
| plan.how *(Nov 2)* | tap start: i'll fly one first so you can watch, then it's your turn. |
| plan.go *(Nov 2)* | pick a size, then tap “start”. i'll fly one first so you can watch. |

**Learn**

| id | text |
|---|---|
| learn.demo | listen for the four bells. |
| learn.demom *(v3)* | watch the light walk the four sides. |
| learn.0 *(v3)* | here's the square. in for {n}, pause for {n}. |
| learn.0b *(v3)* | out for {n}, rest for {n}. four equal sides. |
| learn.go *(Nov 2)* | your turn. small, easy breaths. hold “breathe in” as your next one begins; the bells keep time. |
| learn.gom *(Nov 2)* | your turn. small, easy breaths. hold “breathe in” as your next one begins; the light keeps time. |
| learn.p2 | small breaths are fine. it's the timing. *(cycle 2 of Learn; cycle 2 of Fly)* |
| learn.p1 *(v3)* | the pause and rest are soft. no clamping. *(cycle 4 of Learn)* |

**Loose kites**

| id | text |
|---|---|
| loose.1 *(Nov 2)* | round's done. a 20-second break: breathe your own way. no need to press anything. |
| loose.f1 | i'm restringing an old one. no hurry. |
| loose.f2 | these ones don't need a plan. |
| loose.ready *(Nov 2)* | ready when you are. stay as long as you like. |
| btn.carry *(Nov 2)* | next round · turn cues (after Learn) / next round · from memory (after Echo) |
| btn.carry | carry on |
| btn.back *(v3)* | back to the {n} s square |

**Echo**

| id | text |
|---|---|
| echo.0 *(v3)* | this time, just the bells. press when your breath turns. |
| echo.0m *(v3)* | this time, just the rings. press when your breath turns. |
| echo.p1 | four bells, four turns. |
| echo.p1m *(v3)* | four rings, four turns. |
| echo.p2 *(v3)* | the bells keep the plan's time. |
| echo.p2m *(v3)* | each ring marks where the next side ends. |

**Fly**

| id | text |
|---|---|
| fly.0 *(v3)* | now from memory, no bells. the plan shows after each kite. |
| fly.p1 | the first one is for settling in. |

`fly.0b` is merged into `fly.0`; `fly.p2` is cut (D55, D69).

**Help and drift**

| id | trigger | text |
|---|---|---|
| help.back *(v3)* | the help guide starts (at most once per round), at the closing press + 1000 ms | the guide is back for two kites. |
| drift.fast | 2 fast breaths in a row, size 3 or 2.5 | slower is fine. smaller is fine too. |
| drift.fast2 *(v3)* | 2 fast breaths in a row, size 2 | slower is fine. stop any time. |
| drift.still *(v3)* | 2 short-still breaths in a row, size 3 or 2.5 (the smaller button glints) | short of air? a smaller square fits. |
| drift.still2 *(v3)* | 2 short-still breaths in a row, size 2 | short of air? stop and breathe normally. |
| drift.overKey *(v3)* | an in- or out-key held to target + 2 s | let go whenever you're ready. |
| drift.overHold *(v3)* | a pause reaches target + 2 s | breathe out whenever you're ready. |
| drift.overRest *(v3)* | a rest reaches target + 2 s (not on a round's final breath) | breathe in whenever you're ready. |
| drift.idle | 10 s with no key | breathe however you like. carry on when ready. |
| drift.slipIn *(v3)* | in-press under 300 ms | hold for the whole in-breath, then let go. |
| drift.slipOut *(v3)* | out-press under 300 ms | hold for the whole out-breath, then let go. |
| drift.small | 3rd off breath in a round, once per round, not at size 2 (the smaller button glints, α 0.6 → 1 → 0.6 over 1.2 s, once per round in all) | a smaller square is still a square. |

`help.off` stays cut (D38). `drift.over` is replaced by the three `drift.over*` lines (D50).

**Mastery and end**

| id | text |
|---|---|
| master.1 | that's the square sail. the stamp's there for you. |
| btn.stamp | stamp the page |
| master.2 | it's yours now. it flies on the hill line. |
| end.m1 *(v3)* | your last {n} kites were square on every side. |
| end.m2 | you flew it from memory: {k} of {s} kites matched the plan. |
| end.n1 | {k} of your last {s} kites matched the plan on every side. |
| end.n2 *(v3)* | your typical kite: in {inh} · pause {hold} · out {exh} · rest {rest} s. |
| end.n3 | plans keep. the wall isn't going anywhere. |
| end.later | the shed's open whenever. loose kites need no plan. |
| btn.moreEcho *(v3)* | one more round · with bells *(“· with rings” when bells are off)* |
| btn.moreFly *(v3)* | one more round · from memory |
| btn.loose | loose kites |
| btn.end | finish for today |

`btn.more` and `btn.later` are cut (D65).

Star captions on the page *(v3)*: ★ flown with the guide · ★★ flown with turn cues · ★★★ flown from memory. Stars are drawn as paths, never font glyphs: pencilled as an outline, stamped as filled.

**Always-visible controls**

| id | text |
|---|---|
| pad.in / pad.out | breathe in / breathe out, each with a 24 px ↑ or ↓ glyph; in landscape, small print "↑ or I" / "↓ or O" under the pads |
| btn.stop | stop (Esc) |
| btn.dizzy *(v3)* | dizzy or short of air. aria-label: "I feel dizzy or short of air; stop the plans". |
| btn.notmine *(v3)* | not my breath. aria-label: "that kite didn't match my breath; leave it out". Always in place; α 1 when available, α 0.35 and `aria-disabled` when not. |
| btn.smaller | smaller kite · {next} s. It shows 2.5, then 2, and is hidden at 2. |
| tog.bells *(v3)* | bells on / bells off. title: "the breeze stays on". One toggle, one label, everywhere (`tog.sound` is merged into it). |
| tog.motion | less motion |

**Stop screen** *(v3)*: `stop.1` "stopped. breathe however it comes." · `stop.2` "nothing here needs a bigger breath." · then `intro.safe1`, `intro.safe2`, `intro.safe3` · buttons, in focus order: `btn.dizzy`, `btn.resume` "carry on", `btn.end` "finish for today". `btn.end` here goes to END(open) with no "one more round".

**Dizzy screen** *(v3)*: `dizzy.1` "rest here until it passes." · `intro.safe1` · `intro.safe2` · `dizzy.2b` "if you felt short of air, your own pace is enough." · `dizzy.4` "if it hasn't passed in 10 minutes, ask someone for help." · `dizzy.3` "that's enough plans for today. the kites will keep." · button `btn.done` "done for today" → DONE.

**Plan page (the square sail)** *(v3)*
- **the square sail**
- in {n} · pause {n} · out {n} · rest {n}
- four equal sides: a pause after the in-breath, a rest after the out. {4n} seconds a breath, {60/4n} breaths a minute. *(3 → 12 s, 5 a minute; 2.5 → 10 s, 6 a minute; 2 → 8 s, 7.5 a minute)*
- also called box breathing.
- the pause and the rest are soft, not a clamped hold.
- sizes: 3 s, 2.5 s or 2 s a side. every size is the square.
- link: what we know

### 10.5 Guide schedule (Learn and Echo; also the help guide)

- **Anchor.** `c0` is the `t0` of the confirmed in-press that starts the round, or of the confirmed in-press after a pause, stop or size change. For the help guide, `c0` is the `t0` of the press that closed the triggering breath.
- **Turns within a cycle:** `c0`, `c0+inh`, `c0+inh+hold`, `c0+inh+hold+exh`. The next cycle starts at `c0 + cycle` (4n s). The schedule is fixed at the anchor and **never moves** for the rest of the round (D43).
- **The guide leads and never waits, never speeds up, never slows down, never follows (D21, D43).** A steady lag costs nothing, because scoring uses durations. An early or late press moves nothing; it simply shows as an early or late spar.
- **Bells.** The anchor in-turn is silent; every other turn rings on schedule; no in-turn rings after the last cycle's rest-turn. The guide has 6 cycles; after them the bead parks at the hub.
- **Overrun.** The guide has already moved on. Thresholds only trigger the `drift.over*` lines.
- **Echo:** bell + ring + ghost brighten at every turn after the anchor; the bead runs at α 0.4 in cycle 1 only.
- **Help guide:** full Learn guide (ghost in Fly too, bead fading in to α 0.6 over 600 ms, bells if on, even in Fly) for exactly the two helped breaths, then the bead fades over 1200 ms and, in Fly, the ghost fades with it.
- **Fly:** no guide, except the help guide.
- **Pause, stop, size change:** the guide stops; bells are cancelled (80 ms ramp); the guide re-anchors at the next confirmed in-press.

### 10.6 Scoring

```js
function evaluateBreath(T, b, { restOneSided = false } = {}) {
  const phases = {}
  for (const k of PH) {
    let err = q(b[k] - T[k])
    if (k === 'rest' && restOneSided) err = Math.min(err, 0)      // final breath only (D45)
    const tol = tolFor(T[k])
    phases[k] = { err, fit: Math.abs(err) <= tol, far: Math.abs(err) > 2 * tol }
  }
  const sum = o => PH.reduce((s, k) => s + o[k], 0)
  const cycle = sum(b), cycleT = sum(T)
  const mv = b.inh + b.exh, mvT = T.inh + T.exh
  const st = b.hold + b.rest, stT = T.hold + T.rest
  const fast = mv < 0.7 * mvT && cycle < 0.7 * cycleT              // in and out rushed (D47)
  const shortStill = stT > 0 && st < 0.5 * stT                     // pause and rest dropped
  return { fit: !fast && PH.every(k => phases[k].fit),
           wellOff: fast || PH.some(k => phases[k].far), fast, shortStill, cycle, phases }
}

newRound(tier, size) = { tier, size, cycles: CYCLES, res: [], help: 0, helpUsed: false,
                         smallShown: false, smallLineShown: false, settleNext: true, startMs }

// called when the next in-press is confirmed, or at the final breath's timeout
onBreathClosed(R, b, ctx):      // ctx: { closeT0 (null on timeout), afterPause, isFinal }
  r = evaluateBreath(SIZES[R.size], b, { restOneSided: ctx.isFinal })
  if (R.settleNext || ctx.afterPause) { st = 'settle'; R.settleNext = false }
  else if (R.help > 0)                { st = 'helped'; R.help-- }          // no extension (D48)
  else                                  st = r.fit ? 'fit' : 'off'
  R.res.push({ st, r, b })
  const last2 = R.res.slice(-2), scored = x => x.st === 'fit' || x.st === 'off'
  if (R.tier !== 'learn' && !R.helpUsed && !ctx.isFinal && last2.length === 2 &&
      last2.every(x => scored(x) && x.r.wellOff)) {
    R.helpUsed = true; R.help = 2
    startHelpGuide(ctx.closeT0)                       // c0 = the press that just closed this breath
    say('help.back', ctx.closeT0 + CAPTION_DELAY_MS)
    glintSmaller(R)
  }
  if (last2.length === 2 && last2.every(x => x.r.fast))
    say(R.size === 2 ? 'drift.fast2' : 'drift.fast')
  else if (last2.length === 2 && last2.every(x => x.r.shortStill)) {
    say(R.size === 2 ? 'drift.still2' : 'drift.still'); glintSmaller(R)
  }
  if (!R.smallLineShown && R.size !== 2 && R.res.filter(x => x.st === 'off').length >= 3) {
    R.smallLineShown = true; say('drift.small'); glintSmaller(R)
  }
  if (R.res.length >= R.cycles) endRound(R)

glintSmaller(R): if (R.smallShown || R.size === 2) return; R.smallShown = true; glint btn.smaller

// every breath-clock tick while a round runs
tick(R):
  if (open key phase elapsed >= T[phase] + OVERRUN_S) say('drift.overKey')            // once per phase
  if (open key phase elapsed >= KEY_MAX_S)            { closeOpenUnscored(); enter PAUSED }
  if (open pause elapsed >= T.hold + OVERRUN_S)       say('drift.overHold')
  if (open rest elapsed >= T.rest + OVERRUN_S && !finalBreathOpen) say('drift.overRest')
  if (finalBreathOpen && rest elapsed >= T.rest + TIMEOUT_EXTRA_S) close final breath by timeout
  if (no key for IDLE_PAUSE_MS)                       { closeOpenUnscored(); say('drift.idle'); enter PAUSED }
  if (roundMs(R) >= ROUND_CAP_MS || patternedMs + roundMs(R) >= LOAD_CAP_MS)
                                                      { closeOpenUnscored(); endRound(R) }

onNotMine(R): last = R.res.at(-1)
  if (notMineWindowOpen && last && (last.st === 'fit' || last.st === 'off')) {
    last.st = 'dropped'                                  // keeps its slot as not-fit; extends nothing
    if (R.ended) endRound(R)                             // final breath: re-judge before END renders
  }

onSmaller(R): closeOpenUnscored()
              R' = newRound(R.tier, nextSize); R'.startMs = R.startMs    // the cap keeps counting
              ghost redraws at the new size (600 ms dash reveal); guide re-anchors at the next confirmed in-press

endRound(R):
  R.ended = true
  win = R.res.filter(x => x.st === 'fit' || x.st === 'off' || x.st === 'dropped').slice(-5)
  R.mastered = win.length >= 4 && win.filter(x => x.st === 'fit').length >= 4
  patternedMs is updated once, the first time endRound runs for R
  if (R.mastered && STAR[R.tier] > saved.stars)
    save({ stars: STAR[R.tier], size: R.size, stamped: R.tier === 'fly' })
```

- `closeOpenUnscored()` closes the open breath; it still launches and flies, is kept in `R.void` for the debug panel, and is not a cycle.
- **Resume:** the next confirmed in-press resumes the round, and that breath is the settle-in (`afterPause`).
- **`roundMs(R)`** = `breathNow − R.startMs`, where `startMs` is the anchor press `t0`. The breath clock does not run during PAUSED or STOPPED. **`patternedMs`** is the sum of `roundMs` over finished rounds; the demo and loose kites do not count.
- **localStorage**, key `kitewright.v1`: `{ square: { stars, size, stamped }, settings: { bells, lessMotion } }`. `size` and `stamped` are written only when the star count rises. No breath data is stored. Every read and write is wrapped in try/catch, and the game runs without storage.

### 10.7 Self-tests

`__kw.selftest()` runs all of these and reports pass or fail for each. Times in ms; size 3 (tolerance 0.6 s) unless stated.

1. **A clean breath.** `in 0–3100, pause 3100–6000, out 6000–9200, pause 9200–12100, in 12100–12500` → 3.1 / 2.9 / 3.2 / 2.9, `fit`.
2. **A merged key-up.** `in 0–1500, pause 1500–1700, in 1700–3000, pause 3000–6500, out 6500–9400, pause 9400–12100, in 12100–12500` → 3.0 / 3.5 / 2.9 / 2.7, `fit`.
3. **A slip during the pause.** `in 0–3000, pause 3000–4400, out 4400–4600, pause 4600–6000, out 6000–9000, pause 9000–12000, in 12000–12400` → 3.0 / 3.0 / 3.0 / 3.0, `fit`.
4. **Rushed breaths bring help.** At Echo: a settle-in breath, then twice `in 0–1500, out 1500–3500, in 3500…` (1.5 / 0 / 2.0 / 0: `fast`, `shortStill`, `wellOff`, `off`). → `help = 2`, `help.back` said once, help guide `c0` = `t0` of the press that closed the second rushed breath, the next two breaths `helped`, `drift.fast` said, the smaller button glints once. The round still ends at 6 cycles, not mastered.
5. **"not my breath" never helps.** Fly statuses `settle, fit, dropped, fit, off, fit` → not mastered (3 of 5). `settle, fit, fit, dropped, fit, fit` → mastered, ★★★. No round length changes.
6. **The final rest is one-sided.** Last breath with rest 4.0 s closed by a press → `fit`; rest 5.0 s closed by timeout → `fit`; rest 2.0 s closed by a press → `off`.
7. **The demo kite** parses to n / n / n / n at each size, and the per-spar seconds in `state()` at launch equal `parseBreaths` within 1 ms.
8. **Chapter 1 check.** `in 0–4100, pause 4100–4350, out 4350–8200, pause 8200–8500, in 8500–8900` against 4/0/4/0 → 4.1 / 0.25 / 3.85 / 0.3, `fit`.
9. **A slip cannot close a breath.** `in 0–3100, pause 3100–6000, out 6000–9200, pause 9200–12100, in 12100–12250, pause 12250–13000, in 13000–13400` → one breath, rest 3.8, `off`; the cycle count rises exactly once, at 13300.
10. **The schedule never moves.** An in-press 1.4 s before the cycle-3 in-turn leaves that bell and every later bell on schedule. Six cycles with every in-press 1.0 s early → guide cycles stay 12.0 s; every rest scores −1.0 → `off`.
11. **Presses ring nothing.** No bell source starts within 50 ms of an anchor press; the first bell of a round is its pause-turn; no in-turn bell is scheduled after the last cycle.
12. **Held-key cap.** An in-key held for 20 s → `drift.overKey` at 5.0 s, PAUSED at 12.0 s, open breath unscored and not a cycle.
13. **Round and load caps.** A round reaching 180 s mid-exhale ends at 180.0 s. With `patternedMs` = 700 s, a round ends when it reaches 20 s.
14. **Tolerance.** `tolFor(2) = tolFor(2.5) = tolFor(3) = 0.6`, `tolFor(4) = 0.8`, `tolFor(0) = 0.5`.
15. **Rollover.** ↑ down at 0, ↓ down at 3000, ↓ up at 6000, ↑ still down → no in-segment after 6000; the open phase is a pause. ↑ down at 0, ↓ down at 3000, ↓ up at 3200 → falls back to in (a slip).
16. **Skipped pauses get "smaller", not "slower".** Two breaths of 4 / 0 / 4 / 0 at size 3 → not `fast`, `shortStill` → `drift.still`, smaller glint once; `drift.fast` not said.
17. **Last-breath "not my breath".** A tap 0.5 s after the final close marks it `dropped` and re-runs `endRound` before END renders. A tap at 1.1 s does nothing.
18. **Saved size.** A Fly stamp at 3 s, then a Learn ★ at 2 s → saved `size` stays 3.
19. **Rounding.** `q(9.2 − 6.0 − 3.0)` = 0.2. Scored Fly breaths all 3.3 / 3.0 / 3.0 / 3.0 → `end.n2` shows "in 3.3 · pause 3 · out 3 · rest 3 s" (one decimal where needed).
20. **Stop silences bells.** Stop pressed 50 ms before a turn → no bell source starts after the stop.
21. **The ghost is static.** At f = 1, the ghost top tip y equals hub y − n·S.
22. **Echo with bells off is visible.** One Echo turn rendered with bells off: the ring's peak contrast against the pixel behind it is ≥ 3:1.
23. **"One more round" gating.** `patternedMs` 540 s → shown; 560 s → hidden; after the stop screen's "finish for today" → hidden.
24. **Help at most once.** A second pair of well-off breaths later in the same round sets no help and says nothing.

**Debug API:** `window.__kw = { step(ms), press(kind), release(kind), state(), seed(n), setTier(t), setSize(n), selftest() }`. `state()` returns the beat, round, per-spar seconds of the live and last kite, the guide schedule, the scheduled bell log, the mentor pose and head angle, and caption slots. One breath clock drives everything, so `step()` screenshots are deterministic.

**Debug panel:** `?debug=1` shows per-phase errors and status for each breath, including void breaths, and lets the tolerance be tuned live. It is on-screen only.

### 10.8 Layout of always-visible UI

- **Landscape:**
  - Stop: top right, a 44 px tall pill.
  - "dizzy or short of air": a 44 px pill beside Stop.
  - Both pills: ink text on `rgba(255,255,255,.85)`, radius 24, reachable by Tab (Stop first, then dizzy).
  - Bells and less-motion toggles: top left.
  - Pads: the bottom band, two 240×88 pads centred with a 16 px gutter, each with its ↑ or ↓ glyph and key hint. Pressed state = filled background **plus** a 3 px inset ink border. Keyboard works at the same time.
  - "not my breath": fixed, centred above the pads.
  - "smaller kite": right, above the pads.
  - Logbook spot (Fly tiles): on the bench, left of the build frame.
- **Portrait:** the designer's positions, with pads 171×112 at y 716.
- Every control is at least 44 px tall.

### 10.9 Ending numbers

The numbers describe the round just played. Ending numbers use `fit` and `off` breaths only; `dropped`, `helped`, `settle` and void breaths are left out.

- **END(stamp):**
  - `run` = the number of consecutive `fit` breaths at the end of the round's mastery window (a `dropped` breath ends the run).
  - If `run ≥ 3`, show `end.m1` with `n = run`.
  - Otherwise show `end.m2`, with `k` = fit count and `s` = fit + off count in the last-5 window.
- **END(open):**
  - `end.n1` with `k` and `s` over the last 5 fit-or-off breaths. Skipped when `k = 0`.
  - `end.n2`, the median of each phase over the round's fit-or-off breaths, quantised to ms and rounded to the nearest 0.1 s.
  - `end.n3`.
  - With no fit-or-off breaths (for example after an early stop), only `end.n3`.

### 10.10 "What we know" card

Optional. Reached from the intro card and the plan page, never from mentor dialogue (D51).

> **What we know**
>
> This game times your key presses. It can't measure your breathing itself.
>
> Two small trials, of 66 and 47 people, found that people felt less anxious in a stressful moment after a short session of box breathing than after breathing normally or doing nothing. The first trial found the same for long out-breaths. A study of 84 students found square breathing did not change mood, and a 2026 review of 8 box-breathing trials called the evidence limited.
>
> If you feel dizzy, light-headed or tingly, stop and breathe normally. These are common signs of breathing more air than your body needs. If you feel short of air or uneasy, stop and breathe normally.
>
> Sources: McAllister et al. 2026, doi:10.1016/j.cpnec.2026.100360 · Riedl et al. 2026, doi:10.1080/10615806.2026.2659809 · Marchant et al. 2025, doi:10.1007/s10484-025-09688-z · Dujawara et al. 2026, doi:10.1007/s10484-026-09812-7

---

## 11. Research basis

*Condensed from Researcher A's evidence report (all sources reached 2026-11-01 through PubMed, Europe PMC full text or the publisher's page) and Researcher B's prior-art report. Researcher A read full text for Balban 2023, Fincham 2023 (meta-analysis) and Fincham 2024; for Cappo & Holmes 1984, Pradhan 2013, Sharma 2014 and every 2026 paper (including McAllister, Riedl and Dujawara, which the card cites) only the abstract was seen.*

### 11.1 Norm's question: box breathing, longer inhales or exhales, low energy and stress

**Box breathing for stress: weak to moderate, short-term only.**
- Two small randomised trials found less state anxiety in a stressful moment after one short session of box breathing, against normal breathing (McAllister et al. 2026, n = 66, before a virtual social stress test; it also reduced the stress-driven rise in heart rate and salivary alpha-amylase, with no change in HRV, cortisol or cognitive performance) and against a passive control (Riedl et al. 2026, n = 47 students, one minute in real-life stressful moments, pre-registered pilot; reaction times were *slower* afterwards).
- In the best-known trial, box breathing lowered state anxiety per session about as much as mindfulness, the only comparison group (Balban et al. 2023: box −3.75, mindfulness −3.95 STAI points; n = 21 in the box arm; registered only afterwards and called exploratory by its authors). HRV and resting heart rate did not change.
- A within-subject study of 84 students found square breathing did not meaningfully change mood (Marchant et al. 2025).
- A 2026 systematic review found 8 randomised trials of box breathing and called the evidence "limited", with "non-uniform" short-term benefits and inconsistent physiology (Dujawara et al. 2026). In N-of-1 trials with 76 resident physicians, box breathing met the responder criterion for 7 people (Vetter et al. 2026).

**Longer exhales for stress: weak; the ratio itself is not established.**
- Prolonged exhalation matched box breathing against normal breathing in McAllister 2026. A within-subject study (n = 30) found a long out-breath raised self-reported relaxation and stress reduction, and raised high-frequency HRV only at 6 a minute (Van Diest et al. 2014). An older trial found fast-in/slow-out breathing reduced arousal under threat of shock, though not during practice (Cappo & Holmes 1984).
- Whether a longer out-breath does more than an equal one is not established: 1:2 against 1:1 at 6 a minute had no effect on any HRV measure in a study and a replication, and the earlier literature splits 3 null, 1 for equal, 4 for longer exhales, 1 for longer inhales (Meehan & Shaffer 2024).
- Cyclic sighing (double in-breath, long out-breath) gave the largest mood gain against mindfulness in Balban 2023, and beat a passive control on state anxiety in Riedl 2026. Neither shows it beats box breathing.

**Longer inhales for low energy: no evidence found.**
- No study found shows that an inhale-emphasised ratio raises energy. In Van Diest 2014, "positive energy" was actually higher with the *longer exhale* and the slower rate. Perl et al. 2019 shows people time task onsets to nasal in-breaths; it is not a training technique.
- For energy in general, no technique has better than weak evidence. Fast breathing reliably raises physiological arousal (Kox et al. 2014: sharp rise in adrenaline, with respiratory alkalosis), but felt energy and alert performance have not held up under control conditions: kapalabhati and bhastrika results are weak and mixed (Sharma 2014; Pradhan 2013; Budhi & Singh 2024; Sadhana 2026), and a blinded trial of cyclic hyperventilation against a 15-a-minute placebo found no difference in stress or mood (Fincham et al. 2024).

**Slow breathing and breathing practice in general.**
- Slow breathing near 6 a minute **strongly** raises vagally mediated HRV during and right after a session (Laborde et al. 2022, 223 studies). That is a heart-rhythm measure, not a feeling.
- Breathing practice in general has **moderate** evidence for a small-to-medium drop in self-reported stress (Fincham et al. 2023 meta-analysis, 12 RCTs, n = 785: stress g = −0.35). HRV biofeedback shows larger effects against weaker controls (Goessl 2017, g = 0.83; Lehrer 2020, smaller against active controls).
- But the most rigorous test, a blinded placebo-controlled trial (n = 400, 4 weeks), found coherent breathing at about 5.5 a minute did no better than a matched 12-a-minute placebo on stress, anxiety, depression or wellbeing (Fincham, Strauss & Cavanagh 2023). So it is **weak** that the slow rate, rather than practising at all, does the work.

**Safety.** Over-breathing causes light-headedness, dizziness, tingling and occasionally tetany; about 9% of each arm in the 2024 fast-breathing trial reported unpleasant short-term effects, and even the 15-a-minute placebo caused dizziness for some (Fincham 2024). Mild over-breathing appeared at 6 a minute (Marchant 2025). Hyperventilation before breath-holding has caused drownings (CDC, MMWR 2015). Voluntary hyperventilation provokes anxiety in panic-prone people (Zvolensky & Eifert 2001). People can worry about getting enough air at 6 a minute (Kohlenberg 2019, n = 20, abstract only), and some become more anxious when trying to relax (Kim & Newman 2020).

**What this means for Kitewright.** The game teaches patterns as shapes and timing, which needs no evidence. It never claims energy effects (so the inhale-heavy chapter is "the tall dart", shape only). The only effect claim in the prototype is the box card, stated with its sample sizes, its null result and the review's "limited". Holds stay at 3–4 s (Balban's shortest box tier, with permission to shorten), nothing is fast, and air hunger gets its own exit.

### 11.2 Grades at a glance

| Technique | Stress, anxiety, mood | Energy, alertness |
|---|---|---|
| Breathing practice in general | Moderate (small to medium; mechanism unclear) | None |
| Slow / 6 a minute / HRV biofeedback | Strong for HRV; moderate for self-report; not shown to beat a placebo | Weak |
| Box breathing | Weak to moderate, short-term | None (one pilot: slower reaction times) |
| Longer exhale / cyclic sighing | Weak; ratio-specific effect not established | None |
| 4-7-8 | Weak to none | None |
| Fast / hyperventilation with retention | None beyond placebo | Arousal hormones: moderate; felt energy: none |
| Kapalabhati / bhastrika | Weak | Weak and mixed |
| Longer inhale | None | None |

### 11.3 Prior art that shaped the design (Researcher B)

- A pacer inside a game splits attention; guidance that fades leaves more skill behind (80% vs 30% still breathing to target once the guide was removed): Gummidela, da Cunha Silva & Gutierrez-Osuna 2021, https://doi.org/10.3389/fdgth.2021.760268 → Learn, Echo, Fly; delayed tiles in Fly.
- Players may overuse breath input, breathe too fast or hold too long; use cooldowns and adapt to the player: Sra, Xu & Maes 2018 (BreathVR), https://doi.org/10.1145/3173574.3173914 → caps, rest between rounds, a guide that never follows a rushing player.
- Non-interrupting, imitative feedback and a short tutorial: Patibanda et al. 2017 (Life Tree), https://doi.org/10.1145/3116595.3116621.
- Mechanically induced slow breathing is not always calm, and over-exertion may oppose it: Wongsuphasasawat, Gamburg & Moraveji, https://kanitw.github.io/assets/breathwear/poster_final.pdf → "small breaths are fine", sizes.
- Start from the user's own rate: RESPeRATE (Elliott & Izzo 2006), https://pmc.ncbi.nlm.nih.gov/articles/PMC1781326/ → baseline preselects a size.
- Metrics to avoid: Breathwrk's streaks and "lung score" (https://apps.apple.com/us/app/id1481804500) and Prana Breath's slower-is-harder ladder (https://olekdia.com/index.php/Relax) → "another size", no rates on tiles.
- Name check: no game named "Kitewright" found; Breathing Labs' "Kite (Breathing Games)" (https://apps.appfollow.io/ios/kite-breathing-games/974188510?country=us) is a microphone exhale-length game with a different mechanic. A standard web search, not a trademark search.
- The lab's own lessons: Breath Guardian was excluded because "breaches are a score" (website.md §21a); Kite's slip coaching and 300 ms parser rules; Kite 2.0's spar geometry, bells and breeze.

### 11.4 References

- Almahayni & Hammond 2024, PLoS One. doi:10.1371/journal.pone.0286933
- Avcık, Koç & Aktop 2026, Appl Psychophysiol Biofeedback. doi:10.1007/s10484-026-09811-8
- Balban et al. 2023, Cell Rep Med 4:100895. doi:10.1016/j.xcrm.2022.100895 (PMC9873947)
- Boyd et al. (CDC) 2015, MMWR 64(19):518-21. https://pmc.ncbi.nlm.nih.gov/articles/PMC4584570/
- Budhi & Singh 2024, Cureus. doi:10.7759/cureus.61027
- Cappo & Holmes 1984, J Psychosom Res 28:265-73. doi:10.1016/0022-3999(84)90048-5
- Dujawara, Ali & Kumari 2026, Appl Psychophysiol Biofeedback. doi:10.1007/s10484-026-09812-7
- Fincham et al. 2023, Sci Rep 13:432. doi:10.1038/s41598-022-27247-y
- Fincham, Strauss & Cavanagh 2023, Sci Rep 13:22141. doi:10.1038/s41598-023-49279-8
- Fincham et al. 2023, Neurosci Biobehav Rev 155:105453. doi:10.1016/j.neubiorev.2023.105453
- Fincham et al. 2024, Sci Rep 14:16893. doi:10.1038/s41598-024-64254-7
- Goessl, Curtiss & Hofmann 2017, Psychol Med 47:2578-86. doi:10.1017/S0033291717001003
- Kim & Newman 2020. https://pmc.ncbi.nlm.nih.gov/articles/PMC7288612/
- Kohlenberg 2019 (abstract only). https://www.x-mol.com/paper/1213053402078187520
- Kox et al. 2014, PNAS 111:7379-84. doi:10.1073/pnas.1322174111
- Laborde et al. 2022, Neurosci Biobehav Rev 138:104711. doi:10.1016/j.neubiorev.2022.104711
- Lehrer et al. 2020, Appl Psychophysiol Biofeedback 45:109-29. doi:10.1007/s10484-020-09466-z
- Marchant et al. 2025, Appl Psychophysiol Biofeedback 50:261-76. doi:10.1007/s10484-025-09688-z
- McAllister et al. 2026, Compr Psychoneuroendocrinol 27:100360. doi:10.1016/j.cpnec.2026.100360
- Meehan & Shaffer 2024, Appl Psychophysiol Biofeedback 49:407-17. doi:10.1007/s10484-024-09637-2
- Perl et al. 2019, Nat Hum Behav 3:501-12. doi:10.1038/s41562-019-0556-z
- Pradhan 2013, Int J Yoga 6:128-30. doi:10.4103/0973-6131.113415
- Riedl et al. 2026, Anxiety Stress Coping 39:608-22. doi:10.1080/10615806.2026.2659809
- Sadhana et al. 2026, Int J Yoga 19:102-5. doi:10.4103/ijoy.ijoy_34_25
- Sharma et al. 2014, J Clin Diagn Res 8:10-3. doi:10.7860/JCDR/2014/7256.3668
- Van Diest et al. 2014, Appl Psychophysiol Biofeedback 39:171-80. doi:10.1007/s10484-014-9253-x
- Vetter, Kurth & Konigorski 2026, NPJ Digit Med 9:135. doi:10.1038/s41746-025-02317-3
- Zaccaro et al. 2018, Front Hum Neurosci 12:353. doi:10.3389/fnhum.2018.00353
- Zvolensky & Eifert 2001, Clin Psychol Rev 21:375-400. doi:10.1016/s0272-7358(99)00053-7
- Game and HCI sources: Gummidela et al. 2021; Sra et al. 2018; Patibanda et al. 2017; Wongsuphasasawat et al.; Elliott & Izzo 2006 (URLs in §11.3).

## 12. Open questions for Norm

Neither blocks the build.

1. **Where does Kitewright live after the prototype?** radlab.zone prototypes only, or a sibling of Kite 2.0 in the senseforaging.com course, next to free-breathing Kite under the course's non-striving register. This decides which repo the full game goes into.
2. **Is a key-press mastery game acceptable on its own terms**, or should a later version check the press reports against a real breath signal (Breath Belt / H10, or the phone-on-belly idea from Kite 2.0)? The prototype claims only timing and says so on the card.

Before any course or public release (not the prototypes index): a trademark search (CIPO, USPTO) and an app-store name search for "Kitewright" (D58).

## 13. Decisions log

D1–D14 (round 1) and D15–D42 (round 2) still hold, except where a decision below amends them. The round-1 decisions referenced in this document are D3 (inline parser, verbatim), D6 (4 s hold cap, no fast or retention rounds), D7 (baseline never rescales; amended by D52), D11 (effect claims only on an optional card), D13 (house-pattern single HTML file, localStorage at most) and D14 (`--mute-audio` in every test browser).

Round-2 decisions amended in this round: D15 (by D46), D18 (by D55), D21 (made literal by D43), D23 and D7 (by D52), D27 (by D53), D28 (by D58), D37 (by D70), D42 (by D65).

- **D43. Pull-forward is deleted. The guide schedule is fixed at its anchor and never moves; bells ring only on that schedule; the anchor in-turn is silent; no in-turn rings after the last cycle.** Pull-forward let a rushing player drag the guide faster (B1, S3) and rang a bell at a press (D32). Scoring uses durations, so it bought nothing. D21's "never speeds up" is now literally true.
- **D44. A breath closes when the next in-press is confirmed at 300 ms, and launch happens then.** Scoring at the raw press let a slip close a breath the parser would later merge (S1). The renderer appends the open segment raw. The pre-launch lift is cut (N6).
- **D45. The final breath's rest is one-sided whatever closed it.** Under v2, waiting for the timeout turned an off kite into a fit one (S2).
- **D46. Tolerance is `max(0.6 s, 20%)` for nonzero targets, 0.5 s for zero targets.** At a 0.5 s floor the smaller sizes were about half as masterable, which punished the safety exit (S6). Chapter 1 and every self-test value are unchanged.
- **D47. "Fast" requires rushed in- and out-breaths; dropped pauses are "short still" and get "smaller", never "slower".** (B2)
- **D48. Nothing extends a round.** Helped and dropped breaths extend nothing; a dropped breath keeps its slot as not-fit; help fires at most once per round, anchored at the press that closed the triggering breath, with its caption and the smaller glint; a helped round ends "not yet" by construction. (B3, B4, S8, W2) `extend`, `MAX_EXT` and `R.ext` are deleted.
- **D49. Air hunger is a named safety case.** `intro.safe3` on the intro card, stop screen and card; the button becomes "dizzy or short of air"; the dizzy screen adds `dizzy.2b` and the 10-minute step `dizzy.4`. (A1, A4, B5)
- **D50. `drift.over` splits by what the player can do: `drift.overKey` (a key is held: "let go"), `drift.overHold` ("breathe out"), `drift.overRest` ("breathe in").** "Let go" now always means a key. (A2, W1)
- **D51. The card states the evidence with numbers, includes the Marchant null result, and cites Marchant.** (A3)
- **D52. The size is chosen on the plan page before Learn; the baseline preselects 2.5 s when its mean cycle is under 5 s.** It is a preselect, never a rescale, and nothing is stored. Amends D7 and D23. (B5) Researcher B's added intro line is placed under the size chooser as `size.air`, where it can be acted on.
- **D53. Small-breath cues come before the first scored breath and again in Fly; pose D swells the apron, not the shoulders; the §6 rationale is corrected; later chapter cards follow Researcher A's wording, and D27 now allows the sigh card's Riedl sentence.** (A5–A9)
- **D54. The prototype never invites eyes-closed play.** `echo.p2` is rewritten. An eyes-closed mode waits for an audible safety channel of fixed spoken lines. (B6)
- **D55. Fly shows one 44 px overlay tile per breath at press + 900 ms; the full strip appears only at END; the ghost no longer rides the kite; `fly.p2` is cut; "not my breath" stays in place and changes only opacity.** Amends D18. (B7, N6, C7)
- **D56. Nothing player-facing gives a rate or precision to beat.** The baseline tile is "your own kite" with no rate; `end.m1` drops "within {e} s"; `ceil10` is deleted. The plan page keeps "5 breaths a minute" because it describes the plan. (B8)
- **D57. Larger sizes are "another size", available after any ★, earning nothing.** (B9)
- **D58. "Kitewright" may appear on the prototypes index; "Hollis" stays internal; trademark and store searches come before any public release.** Amends D28. (B10)
- **D59. Held keys are capped (overKey at target + 2 s, pause at 12 s) and the round and load caps are checked every tick; "one more round" requires a full 180 s to fit.** (S4, S5)
- **D60. Rollover falls back to a held key only after a slip.** (S7)
- **D61. Every signal graphic meets 3:1 and every text 4.5:1 on its background; signals are ink, shape and position; captions are DOM with live regions; the canvas has a text alternative; pads carry glyphs and a border on press; the stop screen focuses the dizzy button first; stars are paths.** (C1–C3, C5, C6, C10)
- **D62. The ghost's geometry never moves; the bead is the head of the current ghost spar; the Echo ring sits at the next spar's end-tick.** (N1, N5)
- **D63. Two clocks: an unclamped breath clock for everything timed, clamped dt for decoration; bells scheduled at most 150 ms ahead and cancelled with an 80 ms ramp on any overlay; visual cues offset by output latency; all DOM tweens on the game clocks, no CSS transitions.** (N2, N3, N9)
- **D64. Species are told apart by pattern, never hue; hill-line kites are fitted to their slots, in two staggered rows on portrait.** (C4, C9)
- **D65. Copy pass: one name per phase (pause, rest); `echo.0` repeats the press rule instead of promising a wait; keys appear in the intro; exits say what they do (`btn.later` cut, no "one more round" after "finish for today", two explicit "one more round" buttons replacing the toggle-dependent one); one bells toggle; "these" restored in claim 5; small fixes.** Amends D42's single "one more round". (W4–W10)
- **D66. Finished kites are baked to sprites at launch and the background has its own canvas.** (N8)
- **D67. Pose D is three layers; gaze is a 6° head turn; pose crossfades draw the incoming pose over an opaque outgoing one; blocked changes defer up to 4 s; the stamp bell is 0.04 with an easeInOutQuad lower.** (C8, N10)
- **D68. The in-breath that closes a round flies as a loose kite, and END starts at its release or 6 s.** (N7)
- **D69. In-play captions start at press + 1000 ms; the Learn demo starts at 6 s so `learn.demo` has the slot; `fly.0` and `fly.0b` merge; a waiting flavour line drops after 6 s.** (W3, N6)
- **D70. Copy sign-off.** Researcher A's D37 sign-off covers every line kept from v2. The *(v3)* lines are A's own wording (safety and card), the writer's wording, or director copy that makes no effect claim and uses no banned word. A re-reads them before the prototypes index entry is published; this does not block the build. (A10)

**Build checklist** for the engineer:
1. Inline the parser verbatim (D3).
2. Build §10 as written.
3. Run `__kw.selftest()` in headless Chrome **with `--mute-audio`**; all 24 must pass.
4. Add the `public/prototypes/index.html` entry and the website.md §29b entry (name cleared, D58).
5. Commit to `dev` with explicit paths only.
6. Researcher A re-reads the *(v3)* lines before the index entry goes live (D70).

## 14. Critique log

Codes: A = Researcher A, B = Researcher B, S = breath dynamics specialist, W = writer, C = character designer, N = animator.

| Item | Critique | Outcome |
|---|---|---|
| A1 | No guidance for feeling short of air or uneasy | **Applied** (D49): `intro.safe3`, button "dizzy or short of air", `dizzy.2b`. |
| A2 | `drift.over` says "let go" when nothing is held | **Applied** (D50), with a third line, `drift.overKey`, for an over-held key, where "let go" is literal. |
| A3 | Card selective and vaguer than evidence | **Applied** word for word (D51), plus `intro.safe3` on the card. Abstract-only note kept in §11. |
| A4 | Dizzy screen has no step if symptoms don't pass | **Applied**: `dizzy.4`, 10 minutes, noted as a practical threshold. |
| A5 | "small breaths" arrives too late | **Applied**: new `learn.go`, `learn.p2` at cycle 2 and `learn.p1` at cycle 4, `learn.p2` again at Fly cycle 2. |
| A6 | Pose D models a shoulder breath | **Applied**: apron swell on the waist, shoulders still (merged with C8's layer split). |
| A7 | Full-game cards tie general findings to patterns | **Applied** in §4: general "about breathing practice" card, reworded claim 2, long-tail card with Meehan & Shaffer. |
| A8 | D27 understates sighing evidence | **Applied**: D27 corrected by D53; sigh card wording in §4. |
| A9 | §6 rationale links the wrong line to the risk | **Applied** in §6. |
| A10 | D37 sign-off returned | **Recorded** (D70). New v3 lines get a re-read before publication, not a build gate. |
| B1 | Pull-forward lets the guide chase a rushing player | **Applied** (D43): pull-forward deleted; self-test 10. |
| B2 | "Fast" catches a player who drops the pauses | **Applied** (D47): `fast` / `shortStill` split, `drift.still`; plus `drift.still2` at size 2. |
| B3 | Help makes the round unmasterable yet longer | **Applied** (D48): no extension, smaller glint, documented in §5. |
| B4 | "not my breath" works as a do-over | **Applied** (D48): dropped keeps its slot; extensions deleted; self-test 5 as proposed. |
| B5 | No air-hunger cover; everyone starts at 5 a minute | **Applied** (D52, D49): size chooser with baseline preselect. The added intro line is placed as `size.air` under the chooser. **Rejected:** the change to `learn.p2` ("smaller kites too"), because a smaller kite is shorter phases, not a smaller breath, and the line would blur depth with duration; A's "it's the timing" keeps depth out of the score. |
| B6 | "eyes can close" cuts off safety cues | **Applied** (D54). The suggested replacement ("…the kite waits") is **not used**, because W4 shows "waits" contradicts D21; `echo.p2` is "the bells keep the plan's time." |
| B7 | Too much on screen in Fly | **Applied** (D55): `fly.p2` cut, strip revealed at END, notmine fixed in place. **Changed:** the 600 ms ghost ride is cut rather than kept (N6); the per-breath result moves to a single tile. |
| B8 | Baseline rate and "within e s" invite striving | **Applied** (D56). |
| B9 | Larger sizes gated as "next" | **Applied** (D57) in §4. |
| B10 | Name check | **Applied** (D58). |
| S1 | Breath scored before the press is confirmed | **Applied** (D44): confirmation close, raw open segment in the renderer, self-test 9. |
| S2 | Longer final rest scored more kindly | **Applied** (D45): one-sided whatever closed it, no trailing in-turn bell, self-test 6. |
| S3 | Bells on presses; pull-forward speeds the guide | **Applied** for the silent anchor (D43). The narrowed pull-forward window is **superseded**: pull-forward is deleted outright (B1), which removes the speed-up entirely. Self-test 10 includes S3's 1.0 s-early case. |
| S4 | Held keys uncapped; caps only checked at a close | **Applied** (D59), self-tests 12 and 13. |
| S5 | Load cap can be overrun from END | **Applied** (D59), `patternedMs` defined, self-test 23. |
| S6 | 0.5 s floor makes small sizes harder | **Applied** (D46), self-test 14. |
| S7 | Rollover invents a breath | **Applied** (D60), self-test 15. |
| S8 | Help timing, repeat help, repeat `drift.small` | **Applied** (D48): help anchor at the closing press, `helpUsed`, `smallShown` / `smallLineShown`, self-test 24. |
| S9 | Last-breath notmine after `endRound`; size overwrite | **Applied**: window to END + 1.0 s with re-judge; save only on a rise; self-tests 17 and 18. |
| S10 | Self-test gaps; float rounding | **Applied**: test 4 rewritten, `q()` quantisation, tests added. `ceil10` is deleted with `end.m1`'s error figure (D56), so the "0.3" test becomes the median test 19. |
| W1 | "let go" in still phases | **Applied** (D50), merged with A2; mid-phase exception written into §9. |
| W2 | `help.back` timing and off-by-one | **Applied** (D48): anchor at the closing press, caption at press + 1000, new text, once per round. |
| W3 | Caption collisions | **Applied** (D69): demo starts at 6 s, `fly.0` merged, flavour queue rule. |
| W4 | `echo.0` "the kite waits" contradicts D21 | **Applied**; §9 example changed. |
| W5 | Three words for each still part | **Applied** with director wording for the lines that must name both still parts ("the pause and the rest"), since "two pauses" would itself mix names. |
| W6 | Keys missing; `intro.2` over length | **Applied**: `intro.2` / `intro.2b`, pad hints. |
| W7 | Lines that assume size 3 | **Applied**: `drift.small` suppressed at size 2, `btn.back` reworded, wall miniature redraws. `fly.p2`'s fix is moot (cut by B7). Lines with sizes use `{n}`. |
| W8 | End buttons don't say what they do | **Applied** (D65): `btn.later` cut; no more-rounds after "finish for today"; one bells toggle with the breeze noted. **Changed:** instead of one label that follows the bells toggle, two explicit buttons, "· with bells" and "· from memory", so the stamp's route is visible without touching a setting. |
| W9 | Claim 5 reworded; `stop.1` grammar | **Applied**. |
| W10 | Small line fixes | **Applied** all six. |
| C1 | Ghost near-invisible | **Applied** (D61) with the stated values. |
| C2 | Bells-off Echo cue invisible | **Applied**: ink ring at the next spar's end-tick, brighten to 1.0 at 3 px, self-test 22. |
| C3 | Fit stitches white on pale sky | **Applied**: ink stitches. |
| C4 | Portrait hill line overlaps | **Applied** (D64): per-slot fit, two rows. |
| C5 | Kite outlines and live tip vanish | **Applied**: ink outlines, ink tip ring. |
| C6 | Caption size, contrast, DOM text layer | **Applied**: DOM captions, live and status regions, canvas aria-label (using the phase names from W5). |
| C7 | 28 px tile pairs carry no information | **Applied**: one 44 px overlay tile per breath. |
| C8 | Pose D unbuildable; face lost on phone | **Applied**: 3 layers, px minimums, gaze by head turn. The torso's vertical scale and head lift are replaced by A6's horizontal apron swell with a still head. |
| C9 | Species reads as "a pink kite" | **Applied** (D64): seams, stronger tint, ink bows, species rule in §4. |
| C10 | Pads and safety controls need non-colour cues | **Applied**: glyphs, inset border, pills, Tab order, stop screen focuses dizzy first, stars as paths. |
| N1 | Swell moves the target | **Applied** (D62): fill-only swell, self-test 21. |
| N2 | Two clocks disagree | **Applied** (D63); self-test compares seconds. |
| N3 | Queued bells ring after stop; latency | **Applied** (D63), self-test 20. |
| N4 | Pull-forward contradicts D31/D32 | **Moot**: pull-forward deleted (D43). |
| N5 | Bead path and ring position undefined | **Applied** (D62). |
| N6 | Too much at the in-press | **Applied**, with one change: launch starts at confirmation (press + 300 ms), not the raw press, to agree with D44. |
| N7 | Closing breath unspecified | **Applied** (D68). |
| N8 | Path-op budget exceeded | **Applied** (D66). |
| N9 | DOM tweens bypass the sim clock | **Applied** (D63), with a separate overlay lane so stop and dizzy screens still animate while the game clock is paused. |
| N10 | Crossfade flicker, deferral, stamp level | **Applied** (D67). |
