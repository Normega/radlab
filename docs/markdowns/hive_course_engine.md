# Hive as the course's Quest engine

Status: ideas, plus Norm's first decisions (2026-11-25). Prototype: `public/prototypes/hive.html` (radlab.zone/prototypes/hive.html; `?skin=paths` for Paths, `?demo` for a sample month). Design record: website.md §29b, Hive.

## The idea

Hive (2026-10-18) practises the round trip beside ordinary doing:
- tap **Out** when you notice you've been doing for a while;
- take one sense and one prompt;
- tap **Home** and bring back a word or nothing.

Each trip becomes a cell in a comb. Norm (2026-11-23): Hive could become the foundation for many of the course's daily Quests, with variety beyond the bee.

Claude and a Fable agent brainstormed independently on 2026-11-23. The agent was briefed with the files and none of Claude's ideas. Both reached the same structure:

- **One engine, one record, several skins.** A trip is {sense, prompt, start, end, word, tell, declined, checks}. A skin is only a way of drawing that record, so nothing is lost when it changes.
- **A skin a week, not a day.** A daily skin never accumulates into anything and costs 28 art sets. A weekly one changes at the week's start (days 1, 8, 15, 22).
- **The controls never move:** Out, Home, Noticed, staying in, Your day. Out and Home keep their names in every skin, and the two modes stay "sensing" and "doing".
- **No outlines, borders or empty slots in any skin.** No quilt grid, no window to complete, no fog over unvisited places. Every artefact grows from nothing, as the comb does. Each week's piece stops growing when the week ends; day 28 shows all four.

## Decisions (Norm, 2026-11-25)

1. **The four weeks: Harbour → Quilt → Hive → Paths.**
   - **Week 1, Harbour.** Different boats fill a harbour. Norm preferred this to the Shore idea (pebbles on a windowsill).
   - **Week 2, Quilt.** Norm's weaver.
   - **Week 3, Hive.**
   - **Week 4, Paths.** Desire paths and avoidance paths.
2. **Taste and smell stay in the draw.** When one comes up, Hive asks "Anything to taste nearby?" or "Anything to smell nearby?" and draws again on a no. Fable had proposed leaving them out of free trips; Norm: "keep them, they are important".
3. **Log trip time.** "Went out earlier" logs a trip taken without the phone, with a rough length and when. It is recorded as estimated and drawn as estimated.
4. **Prototype desire and avoidance paths.** Built 2026-11-25; see below.

Still open:
- how each week's layer changes the mechanics (Fable's staged arrival, below);
- the skins' art (Gerold);
- the course version's data (below).

## What is built (2026-11-25, `hive.html`)

- **The nearby check.** It is asked before the prompt shows, and the screen does not rest while it asks. A no draws another sense, never the same one again that trip. It is saved as `checks: [{sense, nearby}]` and `declined: [{sense, why: 'nothing nearby'}]`.
- **Turned-from senses.** "A different sense" saves `declined: [{sense, why: 'different'}]`, so a trip keeps what it turned from on the way.
- **Went out earlier.** A link under the buttons opens it:
  - pick a sense;
  - pick a length: a few breaths (15 s), about a minute, a few minutes (3 min), longer (7 min);
  - pick when: just now, within the hour, earlier today.
  - Home's word screen follows.
  - The trip is saved with `told: true, est, when` and drawn dashed in both skins. Its detail says "logged afterwards".
- **Paths** (`?skin=paths`, or the "As paths" switch in the bar; prototype only). The same record, drawn as a park seen from above.
  - The house is doing, and each sense has a place (a glyph in its hue).
  - Each trip of the last seven days wears a faint path from the house to its place. Paths walked often wear in: **desire paths**.
  - A sense turned from on the way bends that trip's path: it heads toward that place and turns off. These are **avoidance paths**.
  - Longer trips loop wider at the place.
  - A place appears once visited or turned from. A place only turned from is a dashed outline.
  - Stays are scuffs in front of a bench by the house.
  - Tapping a place shows the words brought back from it, how often you were out there this week, and how often you turned from it.
  - Out walks a little way toward the offered place. Home draws the walk as it happens, then walks back.
- **The record** adds: trips logged afterwards, senses turned from, and taste or smell asked about with nothing nearby.
- **The sample month** turns from touch more often than not, often asks again until sight or hearing comes up, sometimes has nothing to taste or smell nearby, and logs about one trip in eight afterwards. Its paths therefore show both kinds.

Not built: Harbour, Quilt, the pull tap (week 3), any staging by week, and anything server-side.

## The week-by-week plan, against the Quests

Which layer each skin carries, merged from both brainstorms. The "week" layers are the course's own (`Handbook/src/pages/plan/planData.js`, WEEKS and CALENDAR; every calendar row is still "to be confirmed").

| Week | Skin | One trip draws | The week's layer in the mechanics |
|---|---|---|---|
| 1 Arrive (1–7) | Harbour | a boat comes in; hull colour = sense, size = length | Out and Home only; a word is offered, never asked |
| 2 Noting (8–14) | Quilt | a patch; colour = sense, size = length, the word embroidered | the word comes first: Home opens on the day's tour qualities (`TOUR`), then "your own word" |
| 3 The pull (15–21) | Hive | a cell, as now | one tap after the word: like, dislike or neither (drawing it is open: Fable proposed it as the quilt's pattern) |
| 4 Come back (22–28) | Paths | a path worn from the house | full Hive: free noticing, tells (from 22), Your day and tight marks (from 24), staying in (from 26) |

**Fable's main point (adopted).** Hive's native shape, where the learner notices mid-doing and goes out, is the week-4 skill. Weeks 1–3 Quests give the situation and usually the sense ("at the sink tonight: touch"). So the engine needs a **set trip**: the Quest card carries an Out button with its sense already chosen. Hive's features also arrive week by week as the course's layers do, without being presented as unlocks.

**Yesterday's Quest.** If a trip for it was logged, the next session shows it rather than asking: "Yesterday, 6:40 pm. Touch. 'warm'." One tap moves on, and it is kept to one quiet line. If nothing was logged, it asks as now (did you, when, one word).

**The Quests that change shape:**
- **Day 1** (one activity in each mode): no trip. The session introduces home and out.
- **Day 14** ("log each time it comes back"): the chosen quality is pinned, and each return is a one-tap trip carrying that word. On the quilt, a thread colour runs through every patch with that quality.
- **Days 15–20:** catches that arrive unbidden, mostly logged afterwards.
- **Day 21** ("note judging"): a tell.
- **Day 22** (kept doing after it stopped paying): a noticing that can end as a trip or a stay; the Quest text should say either counts.
- **Day 25** (wait one breath): needs "one breath" as a length.
- **Day 26** (sense, or finish the task): Out versus Noticed, staying in. The best fit in the calendar.
- **Day 27** (find one thing never noticed): an unworn path.
- **Day 28:** a choice, not a trip. It shows the four pieces side by side, the learner's words and tells, and the Your day pattern.

## Other settings from the brainstorms (not chosen)

Each shares the shape of a home base, a short trip out, something brought back and an artefact that accumulates.

- Printer's page (Fable's week 2: the artefact is the learner's own words)
- Shore or beachcomber's sill
- Dyer's line
- Mapmaker
- Bowerbird
- Specimen drawer or herbarium
- Kitchen herb garden
- Observatory or star chart
- Mosaic or leaded glass (the pull as glaze)
- Lighthouse log
- Postcards on the fridge
- Music box (the month plays back; ask before any sound)
- Beads on a string
- Swallow's nest
- Cairn
- Tide pool

To avoid:
- a garden that needs tending (a streak in disguise; wilting punishes);
- a well or jars with a fill level (a target);
- constellations or maps with blank quarters (they invite "complete the figure").

## Risks to keep in view

- **Gamification creep.** A growing artefact is a progress display. Keep no empty slots, no learner-facing totals in headlines, no collectible skins, and no comparison between weeks. Cap the visual range of trip length (Hive caps it at three minutes), or size nudges toward longer trips.
- **Sensing drawn as production.** A quilt and a comb are things made. The copy keeps the artefact a trace of trips, not a goal; the loom and the hive are the doing.
- **Metaphor fatigue.** Delve, Tune, Kite and Nectar are already worlds, so four skins is the ceiling. Keep skins thin: the same buttons, hues and Home screen, with only the drawn unit and one animation changing.
- **Accessibility.**
  - Sense must not be colour alone: each skin needs a glyph or pattern per sense, and Paths has one.
  - The pull is pattern plus label, never red and green.
  - Your day's timeline is the list form of every skin, and the screen-reader route.
  - Offering a different sense is always free of cost (anosmia, hearing loss).
- **Data.** The prototype is localStorage only. A course version needs append-only senseforaging Supabase tables, with explicit grants and RLS. Each trip records its day, whether it was the Quest or a free trip, live or logged afterwards, and its declines and checks.
- **Reaching the engine between sessions** without a new class of email or reminder.
