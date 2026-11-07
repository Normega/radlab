# Five-phase breath training: structure (draft 1)

*Working title **Windward**. Started 2026-11-06 from Norm's conversations with a student collaborator. This is the skeleton; details get filled in phase by phase. Mock-ups: `docs/mockups/breath-training-5phase/` (open `index.html`; rebuild with `node docs/mockups/breath-training-5phase/build.mjs`).*

## The idea in one line

The same skill, making a kite with your breath, is carried through five phases. Each phase **keeps everything from the one before and adds exactly one thing**, so a change in performance from one phase to the next can be traced to that one thing.

| # | Name (working) | What is new | The player | What we record |
|---|---|---|---|---|
| 1 | **Open field** | nothing to match | breathes freely and watches each breath become a kite; is invited to try different breaths | natural breath shapes; how much the shapes vary (exploration) |
| 2 | **Follow the plan** | a plan (ghost kite) and a pacer (bead) | builds the plan's kite while seeing their own kite grow over it | fit to the plan, with full visual feedback (learning curve) |
| 3 | **Into the clouds** | their own kite is hidden | follows the pacer without seeing their kite; after each kite, rates how close it was (1–6) | fit; confidence; how well confidence tracks fit (metacognitive sensitivity) |
| 4 | **Crosswind** | sounds play: neutral, pleasant, unpleasant | keeps doing phase 3; is told the sounds need nothing from them | fit and confidence, by sound valence and by where in the breath a sound landed |
| 5 | **Messages on the wind** | the sounds carry content they must take in | keeps doing phase 4's task and listens; answers comprehension questions after the round | fit, confidence and comprehension (dual-task cost on both sides) |

The ladder only works if phases 3–5 hold everything else fixed: same plan, same pacer, kite hidden, confidence after every kite. Norm adopted this as W1.

## What carries over from existing work

- **Phase 1 is Kite 2.0** (`F:\gits\Handbook\src\games\Kite2`, senseforaging): two controls (hold one for the in-breath, one for the out-breath), one breath = four spars, `kiteGeom.js` (`spars`, `personality`, `KITE_COLORS`). Kite 2.0 caps a session at 8 breaths; phase 1 here probably wants longer and an explicit "try something different" invitation.
- **Phases 2–5 reuse Kitewright** (`public/prototypes/kitewright.html`, design of record `docs/markdowns/kitewright_design.md`, locked v3):
  - the ghost and bead (§8)
  - the parser and confirmation rules (§3, D44)
  - tolerance and fit (§5)
  - the safety layer (§6: hold caps, stop, "dizzy or short of air", round and load caps)
  - "press when your breath turns, not when the kite does"

  Phase 2 is essentially Kitewright's **Learn** tier. Phase 3 is new: Kitewright's Fly tier hides the plan, whereas phase 3 hides the player's kite and keeps the pacer.
- **Kitewright decisions that would conflict with this design** and need a deliberate call:
  - D13 says nothing is sent and there is no breath log. This game is a research instrument, so it must log.
  - Kitewright shows no score anywhere. The phase 3 reveal (mock-up 3c) shows fit indirectly.

## Measures (first pass)

- **Fit per kite.** Signed and absolute error per phase (in, pause, out, rest) against the plan, from the same parser. Kitewright's `fit` / `fast` / `short still` statuses come for free.
- **Confidence (phases 3–5).** 1–6 after each kite, no midpoint. Analysed as metacognitive sensitivity: how well confidence separates good kites from poor ones (type-2 AUROC, or meta-d′ if we binarise fit). That needs enough kites per person: roughly 30+ rated kites per phase for a stable per-person estimate, which is 5+ rounds of 6.
- **Sound effects (phase 4).** Fit and confidence for kites overlapping a sound, by valence, against kites with no sound. A sound's onset relative to breath phase is logged, so timing effects can be tested.
- **Dual-task cost (phase 5).** Fit and confidence relative to phase 4, and comprehension relative to a listen-only baseline (if we include one, question P5-2).

## Look and feel

- Mock-ups are SVG for now: layered hills with haze, film grain, fabric texture on the sails, wooden spars, frosted UI cards. Each phase moves the time of day on (morning, noon, overcast, golden, dusk), so the journey reads as a single day on the hill.
- Kitewright's rules stand: no colour carries meaning, and every signal is shown by ink, shape or position.
- Whether any of this goes to Blender (pre-rendered hills, sky plates, kite sprites) is decided after the mock-ups settle. The runtime is canvas, so Blender would supply baked images, not live 3D.

## Decisions

- **W1 (Norm, 2026-11-06). Clean ladder.** Phases 3, 4 and 5 all hide the player's kite and ask for a 1–6 confidence rating after every kite. The only thing that changes from 3 to 4 is the sounds, and from 4 to 5 the listening task. (Answers S1.)
- **W2 (Norm, 2026-11-06). Prototype now, study later.** Build it as a standalone prototype to tune the feel, then port it into a platform study once the design settles. The prototype should still log the way the study will (per-kite records with phase, round and plan), so the analysis can be developed on prototype data. Nothing is sent from the prototype. (Answers S3.)
- **W3 (Norm, 2026-11-06). Mastery gate.** A player moves up a phase on reaching a mastery criterion. The criterion, and whether there is a minimum and maximum number of rounds, are still open (S2a). Phase 1 has no fit to gate on, so it needs its own end rule (P1-1).
- **W4 (Norm, 2026-11-06). Keys now, belt later.** Build on the two press controls. Keep the log format ready for a breath-signal channel (Breath Belt) to be added later without changing the per-kite record. (Answers S4.)
- **W5 (Norm, 2026-11-06). Hidden while building, shown after the rating.** In phases 3–5 the player's kite is hidden while they build it. Once they have rated it, it comes out of the clouds and is drawn over the plan, with stitches on the sides that fit (mock-up 3c). Every rating is therefore followed by feedback on that kite, so phase 3 measures calibration *with* trial-by-trial feedback, and confidence accuracy may improve within the phase. That is a training effect worth tracking, not noise.
- **W6 (Norm, 2026-11-06). The gate is the same as phase 2.** Moving up from phases 3–5 uses the same fit criterion as phase 2, scored on the hidden kites. (Partly answers S2a: the criterion itself, and any minimum or maximum number of rounds, are still open.)
- **W7 (Norm, 2026-11-06). Round recap.** At the end of each round, the round's six kites are shown over the plan with the player's rating under each (mock-up 3d). With W5 this is a recap, not the first sight of the kites.
- **W8 (Norm, 2026-11-06). A small set of plans**, drawn per round so the pacer has to be followed rather than memorised. Candidates: square sail 3/3/3/3, long-tail 4/0.5/6/0.5, drifter 5/0.5/5/0.5 (pauses per W10). (Answers S5.)
- **W9 (Norm, 2026-11-06). Phase 5 audio is a spoken story**, with questions on what happened (mock-up 5b). (Answers P5-1.)
- **W10 (Norm, 2026-11-07). No true zeros: every plan has a pause after the in-breath and a rest after the out-breath.** Natural breathing has at least 200–300 ms between in and out. Narrow kites are fine; the game has to allow them.
  - **The shortest planned pause is 0.5 s.** It is longer than Norm's 200–300 ms, for three reasons:
    1. It matches the shortest width the kite can draw (Kite 2.0's side floor, 0.55 s).
    2. It is above what the key interface resolves: the parser treats holds and gaps under 300 ms as slips.
    3. It gives the bead a visible stop at the side tip.
  - **Switching straight from in to out still fits.** Tolerance on a 0.5 s target is ±0.6 s (Kitewright's `tolFor`), so an immediate switch counts as a fit.
  - **The rates change slightly.** Long-tail goes from 10 s to 11 s per cycle and drifter likewise, both about 5.5 breaths a minute instead of 6. The game makes no claim tied to 6 a minute, so this is fine. Anything that later cites one (e.g. Kitewright's drifter card) would need the cycle kept at 10 s instead (e.g. 4.5/0.5/4.5/0.5).
- **W11 (Norm, 2026-11-07). Pauses get their own axis, drawn 1.5× wider per second than the in- and out-breaths (option C of mock-up 6), in all five phases.** It applies to the player's kite, the plan's ghost, the bead on a pause spar, the stitches and the live kite as it grows. In the code this is `SIDE_K = 1.5` in `build.mjs`. The square sail 3/3/3/3 is now a wide diamond rather than a square, and narrow plans keep enough width to read as kites. Fit is still scored in seconds, so the scale changes only the drawing. (Answers G1. The findings that led to it are kept below.)
- **W12 (Norm, 2026-11-07). In phases 3–5 the pacer waits while the player rates and looks at the revealed kite. The player restarts it with a "next kite" press made as they finish breathing out (mock-up 3c).** This needs the kite to begin with its rest:
  - **A kite now runs rest → in → pause → out.** With the Kite 2.0 order (in → pause → out → rest), the rest only ends at the next in-press. So a kite could not be rated until the player had already begun the next in-breath. Moving the rest to the front means the kite is finished when the out key is released, and the rating falls in the natural gap.
  - **The "next kite" press is the start of the rest.** It goes where an out-breath ends, so the rest is timed from a real breath turn. The bead then runs the rest spar, and the in-breath follows.
  - **The shape is unchanged.** The rest is still the left spar; only the order the spars are drawn in, and where one kite ends, change.
  - **The safety copy matters here.** The break is untimed, and the card says to breathe normally, so nobody holds their breath while choosing. The 4 s hold cap applies to holds inside a kite, not to this break.
  - W14 extends this to every phase, and names the press **begin**.
- **W13 (Norm, 2026-11-07). The gate is 4 of the last 5 kites fit, with no minimum or maximum number of rounds.** This is the same rule in every phase from 2 up, scored on hidden kites in 3–5. A consequence: someone who masters a phase quickly can leave it with as few as 5 rated kites, too few for a per-phase metacognition estimate (about 30 needed). Confidence would then have to be pooled across phases 3–5 per person, or modelled hierarchically across people. This is a study-design note, not a reason to change the gate. (Answers S2a.)
- **W14 (Norm, 2026-11-07). One start rule for every kite in every phase: the player finishes breathing out and presses begin.** Trials must all start the same way. The start point being tested for now is the end of the out-breath, and it is one rule in one place so it can be swapped if testing argues for another.
  - **A kite is begin → rest → in → pause → out**, in phases 1 to 5 alike. Begin starts the rest. The in key starts the in-breath, and releasing it starts the pause. The out key starts the out-breath, and releasing it ends the kite.
  - **Phases 1 and 2 get a begin press too**, even though nothing is rated there. Straight after a kite they have just finished breathing out, so they can press begin at once or take a few easy breaths first. Phase 1 therefore differs from Kite 2.0, which ends each kite with its rest.
  - **Phase 1 is timed by the player's urges; phases 2–5 by the bead.** The instructions say so explicitly.
  - **The instructions spell it out (mock-up 0b, "How to make a kite"):**
    1. *Finish breathing out, then press begin.* Every kite starts here, in the still moment after a breath out.
    2. *Rest.* Stay still until you feel the urge to breathe in.
    3. *Hold ↑ breathe in as you start breathing in.* Let go when you reach the top of the breath.
    4. *Pause.* Stay at the top until you want to breathe out.
    5. *Hold ↓ breathe out while you breathe out.* Let go when the breath is all the way out. That is one kite.

    *From phase 2 on, the bead shows how long each part lasts: follow it instead of the urge.*
  - **Logging:** each kite records the begin time, and the rest is measured from it. Proposed, not decided: a gentle reminder if begin has not been pressed after a while.
  - (Answers P2-3.)
- **W15 (Norm, 2026-11-07; piloting). One breathe button, and nothing shorter than 0.5 s registers.** This is being explored, not settled. It revises W4's two controls: the parser and log keep room for a two-key mode.
  - **The button:** after begin, hold it while breathing in, let go at the top (the pause), hold it again while breathing out, and let go when the breath is out. That release ends the kite. Breathe is space and begin is Enter. The button's small line says what holding it means right now ("hold it as you start breathing in", "breathing out · let go when it is all out"). With one button, that line is how a player knows which breath the next press counts as. It shows state, not fit, so it stays on in phases 3–5. (Mock-ups 0b, 1–5.)
  - **The slip rule:** all four parts (rest, in, pause, out) must last at least 0.5 s. A button change that is undone within 0.5 s is a slip and is ignored: a tap during the rest or pause doesn't start a breath, and a flicker during a breath doesn't end it. Kitewright's parser used 300 ms for both of these (`MIN_HOLD_MS`, `MERGE_GAP_MS`). Here both become 500.
  - **Every raw press and release is still logged**, with the slip label attached by the parser, so the rule can be re-run later at another threshold. Nothing is dropped (CLAUDE.md data rule 5).
  - **The rest after begin** is timed from the begin press, which is a different key. A breathe press less than 0.5 s after begin is therefore not a finger slip but a rushed rest: it registers, and the short rest is scored as it is.
  - **The 0.5 s pause in the plans now sits exactly on the slip threshold (open, P2-4).** Long-tail and drifter plan a 0.5 s pause. A player aiming for it lets go for about 0.5 s, so roughly half their pauses would come out under the threshold. Each of those would be read as a slip: the in-breath would run on into the out-breath, and the kite would come out wrong. The plans need their shortest pause clearly above 0.5 s.

## Open questions

- **G1 (answered by W11). How narrow kites are drawn.** W10 settles the plans. What remains is how to draw narrow kites. The comparison sheet (mock-up 6) shows four ways, all with the tips in the same place so the timing is unchanged.

  **Findings:**
  - **Narrow is the normal case, not the exception.** Natural pauses are short next to the in- and out-breaths, so most free kites in phase 1 are narrow too.
  - **Below 0.55 s, width carries no information.** Kite 2.0 draws any pause under 0.55 s at the same minimum width, so 0.1 s and 0.5 s look the same. On narrow plans the in- and out-breath lengths do the work.
  - **B, a billowed sail, is worse.** Narrow kites pinch at the waist and read as seed pods.
  - **A wider pause axis reads best.** It is honest: an axis with its own seconds-per-pixel, like a chart. At 2× (D) the square sail becomes very wide. **Recommendation: 1.5× (C), applied in all five phases**, so the geometry stays the same throughout this game. It then differs from senseforaging's Kite 2.0, which is acceptable for a separate game.
  - **Narrow kites can carry identity in their trim.** A longer tail comes from the long out-breath (Kite 2.0 already does this), and side streamers could hang from the pause tips. These make them read as dart kites, a real kite type, rather than broken diamonds.

### Structure (decide first)

- **S2a (answered by W13).** The mastery criterion for each move up. Kitewright's is 4 of the last 5 kites fit. Phases 3–5 have no visible kite: is the criterion still fit (measured but not shown), or does the gate apply only from 2 to 3? Is there a minimum and maximum number of rounds per phase?


### Phase 1

- **P1-1.** How long, and what ends it: a number of breaths, a time, or "you've tried N different kinds"?
- **P1-2.** Are prompts suggested ("try a long out-breath")? Is there a shape catalogue to discover, or is it purely free?

### Phase 2

- **P2-1.** Keep Kitewright's stitches (a mark on each side that fit), or a quieter feedback?
- **P2-2.** Does the pacer stay identical through phases 3–5 (bead plus bells), or do the bells drop out once sounds arrive in phase 4?
- **P2-4.** With the 0.5 s slip rule (W15), what is the shortest planned pause? Proposal: 1 s, twice the threshold. Long-tail becomes 4/1/6/1 and drifter 5/1/5/1, both 12 s a cycle (5 breaths a minute). The alternative is 4/1/5/1 and 4/1/4/1 at 10–11 s.
- **P2-3 (answered by W14).** W12 makes a kite in phases 3–5 run rest → in → pause → out. Do phases 1 and 2 use the same boundary? Phase 2 has no break between kites, so the order only changes which spars are scored together as one kite. Using the same boundary keeps phase 2 → 3 a clean step. Phase 1 is Kite 2.0, which ends a kite with its rest.

### Phase 3

- **P3-1.** Confidence question wording: "how close was that kite to the plan?" (overall), or per side?
- **P3-4 (answered by W12).** Does the pacer pause while the player rates and looks at the revealed kite? If it keeps running, the rating interrupts the rhythm. If it pauses, every kite has a break after it, and the safety copy has to keep people breathing normally (not holding) while they choose.
- **P3-3.** Do the press pads still light up when pressed? Pressing is felt anyway, but a visible pad is still visual feedback.

### Phase 4

- **P4-1.** Sound source: a validated affective set (IADS-2/IADS-E; licensing to check), or curated clips (BBC sound effects are licensed under RemArc, so commercial use needs per-clip clearance)?
- **P4-2.** How many sounds per round, how long, how loud, and the valence mix (equal thirds)? Are onsets locked to breath phases or random?
- **P4-3.** Does anything on screen show a sound is playing?

### Phase 5

- **P5-2.** Is there a listen-only baseline for comprehension?
- **P5-3.** When are questions asked (after each round, or at the end), how many, and is confidence asked for them too?
- **P5-4.** Does the spoken content carry valence (continuing phase 4), or is it neutral?

### Later

- Name (search before any public use, as with Kitewright D58), safety copy review, mobile layout, accessibility of audio phases for people who are hard of hearing.
