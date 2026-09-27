# Toggler — design spec (working name)

> Started 2026-09-27 with Norm. Status: **grey-box mechanics prototype built** at
> `public/prototypes/toggler.html` (live at `/prototypes/toggler.html` once on a deployed branch;
> `?dev` or `t` for the tuning panel). Awaiting Norm's first playtest on a phone. Update this file as
> decisions land.

### Prototype notes (2026-09-27)

- **Implemented as specced**, plus the one addition the numbers forced: Kite only finalizes a breath
  when the next inhale begins, so a breath that already matches also closes once its bottom pause
  reaches `autoCloseFrac` (0.8) × the target's. The fourth breath then absorbs without a fifth inhale.
- **Measured separation** (`__toggler.crossMatch()`, ±20% jitter per phase, tempo ×0.75–1.35):
  own-shape breaths match 82% (water) to 92% (air); off-target breaths ≤0.9% (water read as air
  is the worst). No single breath can count for two elements (pairs 0.50 apart, tolerance 0.22).
- **Hidden route**: the updraft is *inside* the air pit, entered by jumping while floating. It could
  not sit before the pit, because air is only absorbed at the pit and movement is forward-only.
- **Internal review fixes**: the render loop multiplying after the tab was backgrounded; jumping at
  a pit edge without air dropping into the pit; the updraft losing a player who jumped while
  walking; a thumb held through the toggle being dropped (it now carries over, so an A held while
  toggling starts an inhale, and an A held while toggling back walks on); the toggle now shakes
  when refused (mid-air, mid-pipe, inside a wall); spawn at x=100, clear of the left thumb.
- **Not in the prototype**: sound, data logging, the real avatar (colours are stand-ins), Blender art.

A Sense Foraging platformer about **toggling between doing and receiving**. Side-view, flip-screen
palace corridors in the tradition of the original *Prince of Persia* (evoked, never copied — no
PoP sprites, tiles, names). Elemental barriers can only be passed by stopping, switching to
receptive mode, and breathing the element's shape for four breaths.

## Decisions (2026-09-27)

| Topic | Decision |
|---|---|
| Art | Pre-rendered 3D sprites: Blender models/rigs rendered from an orthographic side camera to sprite sheets; tiles, pillars, torches likewise. Element VFX and kites stay procedural (they pulse with breath). Canvas 2D in the browser — no three.js. |
| Camera | Flip-screen rooms. One obstacle per room, so receptive mode has a stable frame. |
| Absorption | Any **4 matching breaths** absorb the element; an off breath simply doesn't count (no reset, no decay). |
| Purpose | Practice game, logs lightly: `game_sessions` row + a few summary numbers. No new tables in v1. |
| Water | Flowing breath, no pauses (5-0-5-0). |
| Pacer | The obstacle's rhythm is clear at first and **fades as matched breaths accumulate** — the player ends up carrying it. |
| Character | One shared acrobat body for everyone, wearing the player's platform avatar (see Character). |
| Movement | Forward only in v1 (see Movement). |
| Element use | **Carried until replaced**, not spent on passing. Consecutive rooms need different elements so toggling stays necessary. |
| Opening | **Short playable scene** at the desk in the waking room: trying to "do" goes nowhere, the player drifts off. |
| Setting | **Home desk / bedroom** — the dream corridor is built from its objects. |
| Hidden paths | An absorbed element opens routes up, down, or through, rejoining the corridor (see Hidden paths). |
| Failure | None. No death, no damage. Impassable = the character teeters at the edge and won't go on. |

## Story frame (Norm, 2026-09-27)

Not ancient Arabia. The player is sitting in their room or office, and every day is the same.
Languishing at the desk, wishing they could get unstuck, they drift off to sleep, and the
platformer is the dream: **the path for life to be different.**

Agreed: home desk / bedroom; a short playable opening at the desk. Rest is a working proposal:
- **The dream is built from the room.** The corridor is the bedroom made strange: drawers become
  ledges, bookshelves become pillars, the desk lamp's glow becomes torchlight, the bedroom
  hallway becomes the dream corridor. PoP's *staging* (side-view, flip-screen, acrobat,
  teetering) stays; its setting does not.
- **Each element has a source in the waking room**: earth = the potted plant / stone paperweight,
  fire = the desk lamp or a candle, air = the window or fan, water = the glass of water. Seen dull and inert in the opening scene.
- **Waking** — the ending returns to the same room, and it is *slightly different*: the plant has
  a new leaf, the window is open, light has changed. Not fixed, not transformed; different. The
  non-striving register: the day is the same shape, the person meets it differently.
- "Languishing" is Keyes' term (mental health continuum), which gives the frame a research
  anchor.

## Hidden paths

Receptive mode reveals hidden paths in the sense that **an absorbed element opens routes that were
never passable before** — not just the barrier in front of you. Movement stays forward-only; hidden
routes go *up, down, or through* and rejoin the corridor: air floats you up to a ledge above, water
takes you down a drain, earth lets you walk into a wall that turns out to hold a room.

Proposal: what is found on a hidden route comes back with you to the waking room (the thing in
the room that has changed). That is the Alongside "cloak" pattern (§21d): what receptivity found
becomes visible afterwards, never announced.

## Controls

Three inputs; two change meaning with the mode, so the hands never move — only the mode does.

| | Button A | Button B | Toggle |
|---|---|---|---|
| Doing | hold = walk forward | jump / interact | → receptive |
| Receptive | hold = breathe in | hold = breathe out | → doing |

Holding neither in receptive mode = pause (top pause after an inhale, bottom pause after an exhale).
Touch: three on-screen buttons. Keyboard mapping TBD (Kite uses ↑/I in, ↓/O out).

## Breath shapes and matching

Receptive input is parsed by Kite's `src/games/Kite/breathShapes.js` unchanged (tested; already
handles slips and accidental key-ups). Shapes use Kite's vertex-distance geometry: inhale up, top
pause right, exhale down, bottom pause left.

| Element | in–top–out–bottom (s) | Proportions | Passage |
|---|---|---|---|
| Earth | 4-4-4-4 | .25 .25 .25 .25 | walk through a rock wall; falling glass shards glance off |
| Fire | 6-2-3-1 | .50 .17 .25 .08 | walk through flame; cobwebs burn away on approach |
| Air | 3-1-7-1 | .25 .08 .58 .08 | float over a pit / spikes |
| Water | 5-0-5-0 | .50 0 .50 0 | flow through a pipe / narrow passage; evaporate and rain down |

**Matching is on proportions, not seconds** — players keep their own tempo. A breath matches when
its normalized 4-vector is within an L1 tolerance of the target, and its total length is at least
~6 s so it can't be tapped out. The closest target pairs (earth–fire, fire–water, air–water) sit at
L1 = 0.50, so **any tolerance ≤ 0.25 guarantees one breath can never count for two elements.** The
prototype must verify this with simulated noisy breathers (e.g. a box breather never absorbs fire)
before any tuning is trusted.

## Receptive mode

- Toggle anywhere. The character stops, the world dims, and the room's element reveals itself:
  its own features (strata, flame tongues, dust motes, droplets) gather into a faint kite that
  breathes at the element's rhythm.
- The player's live kite draws on top. Each completed breath is scored; as matches accumulate the
  two kites merge, the element's pacer fades, and the character takes on the element's tint.
- At 4 matches the element is absorbed and carried. One element at a time; absorbing another
  replaces it. The toggle back to doing mode is required — it is the skill being practised.

## Doing mode

- Walk into an unabsorbed barrier or up to an unabsorbed pit: the character **teeters at the edge**
  and the barrier gives one faint pulse of its rhythm (a hint, not a penalty).
- With the matching element absorbed, passage is automatic in doing mode; the element stays with
  you until another is absorbed.

## Character

One Blender-rigged acrobat body for everyone; the player's avatar supplies the head and colour.
The avatar (`BaseAvatar`, website.md §13) is a front-facing SVG head, and a side-view walker shows
a profile, so:

- **Doing mode (profile):** a simplified side-view head built from the avatar's parameters — skin
  colour, hair colour/type, ear type — composited at a per-frame head anchor exported from Blender
  (position + rotation per sprite frame). Hands via a skin-mask layer tinted to `skinColor`.
- **Receptive mode (front-facing sit):** the character turns to face the viewer, and the **real
  `BaseAvatar`** is composited on — the full face appears exactly when the player stops to look
  inward.
- Guest / no avatar row: a default avatar.
- Body proportions need a moderately large head so the round avatar doesn't look pasted on — to
  settle with the first Blender blockout.

## Movement

Forward only in v1. Nothing in the first level needs backtracking, the teeter covers "stuck", and
walking into a barrier is how the player meets it. Revisit if later levels want to fetch an
element from behind (the cheap addition is tap-A-to-turn / hold-A-to-walk).

## Mobile (landscape-first)

Proposal, 2026-09-27 — not yet agreed.

- **Landscape phones are the primary touch target.** A 640×360 room scales to ~693×390 on a
  modern phone (844×390 CSS px), leaving ~75 px gutters each side, which is where the thumbs go.
  Character ~87 CSS px tall, tiles ~35 px: readable.
- **Layout:** A under the left thumb, B under the right. In receptive mode that is left thumb =
  breathe in, right thumb = breathe out: bilateral, and holding for 7 s is comfortable. The toggle
  is a third, smaller button in a spot that's hard to hit by accident (above B, or top-centre). Its
  icon/label and A/B's icons change with mode.
- **Bleed, not black bars:** gameplay stays in the 640×360 box, but room backgrounds are rendered
  wider (~780×360) so wide phones show more wall, not letterboxing.
- **Thumb-safe zones:** on 16:9 phones (e.g. iPhone SE, 667×375) there are no gutters, so the
  buttons overlay the room's lower corners. Room design rule: nothing that matters in the bottom
  ~90 px at either edge. The kites draw centre-screen, clear of thumbs.
- **Portrait:** a "turn your phone" prompt, with a Game Boy-style fallback (room on top, ~390×219;
  big buttons below) for people who won't rotate.
- **Touch plumbing** (the known iOS traps): `touch-action: none`, `user-select: none`,
  `-webkit-touch-callout: none`, `preventDefault` on touchstart so a long press never pops the
  magnifier or callout; Pointer Events with pointer capture so two thumbs and sliding off a
  button behave; release everything on `visibilitychange`/blur (Kite already does blur).
- **Platform limits:** iPhone Safari has no Fullscreen API for non-video elements and no
  orientation lock, so hence the rotate prompt; Android can do both (fullscreen on Begin, then
  `screen.orientation.lock('landscape')`). Respect `env(safe-area-inset-*)` for the notch.
  Haptics (`navigator.vibrate`) are Android-only, so treat them as a bonus.
- **Performance:** canvas 2D, DPR clamped (house convention, e.g. Delve's 1.5); sprite sheets at
  2×; room backgrounds lazy-loaded per room, not upfront.

## Build order

1. **Mechanics prototype** — `public/prototypes/toggler.html` (sketchbook pattern, §29b): grey
   boxes, procedural element kites, tuning panel (shape ratios, tolerance, minimum breath length,
   pacer fade), `step()`-based debug API for headless numeric playtests.
2. **Test corridor**: toggle intro room → earth → fire → air → water → a final room needing two
   elements in sequence.
3. **Art, in parallel** once the tile grid and character height are fixed.
4. **Promote** to `src/games/Toggler/` (lazy route, `GameIntro`, `/dev/toggler-preview`), to `dev`.

## Open questions

- Tile grid / room size / character height (proposed: 640×360 logical room, 32 px tiles, ~80 px
  character, sprites authored at 2×). Portrait phones letterbox the room with buttons below.
- Keyboard mapping.
- Sound: an ambient sound bed per element; Kite's breath-noise audio in receptive mode.
- Story details: exactly how the opening scene plays, and which waking-room changes map to which
  hidden-route finds.
- Belt mode later via `useBreathSignal` (Polar H10) — buttons alone can't distinguish breathing
  from button rhythm.
- Which summary numbers to log (breaths-to-absorb per element, toggles, time in each mode).
- Mocap source for fluid animation (Mixamo needs Norm's Adobe login).
