# Experience Factory: design draft v0.1

Status: draft for Norm's review. No code yet. 2026-09-15.

## Concept

A sorting game that trains participants to identify objects of awareness as **thoughts**, **feelings**, or **sensations**. The screen is a steampunk factory floor representing the global workspace of conscious awareness. Items arrive on a conveyor belt and the player sorts each one with three brass buttons. A labeled crate drops over the item at the sorting gate, and the crate rides one of three belt spurs into a glowing orb (one per category). Wrong sorts (screen rounds only) miss the spur and the crate tumbles to the floor.

After practice with on-screen items, rounds alternate with **observe rounds**: the belt runs empty, a question orb glides to the gate as a prompt, and the player sorts whatever is most prominent in their own experience right now. The same crate-drop feedback plays, so self-report feels identical to sorting, but nothing can ever fall on the floor.

Pedagogical core: decentering / noting practice. Level 1 lets stimulus modality do the work (sentences are thoughts, faces are feelings, colors and tones are sensations). Higher levels present everything as text, removing the modality shortcut, so the player must classify by content, which is the transferable skill.

## Aesthetic

Steampunk: brass, rivets, pressure gauges, warm Edison glow. Key elements:

- **Conveyor belt** with a sorting gate center-stage, three spurs fanning to the right.
- **Three sort buttons**: large brass push-buttons labeled Thought / Feeling / Sensation (also keyboard 1/2/3 or T/F/S on desktop).
- **Three orbs** at spur ends, glowing brighter and larger as they fill. Thought = cool white/blue filament, Feeling = warm rose, Sensation = green/amber. (Colors open to change.)
- **The difficulty lever**: a big brass lever with a pressure gauge, visible on the intro and summary screens. Higher settings unlock after completing the level below. Pulling it raises belt speed, switches the item mix to harder tiers, and accelerates observe-round prompts.
- **Question orbs**: opalescent spheres with a stamped "?" that arrive during observe rounds as the prompt to sort one's current experience.

## Session structure (target ~5 minutes at level 1)

1. **Intro** (GameIntro component): the factory metaphor, the three categories, one worked example triplet (see Matched triplets below).
2. **Practice**: 6 items, belt paused at the gate until the player answers, explicit teaching feedback.
3. **Sort round A**: ~16 screen items, belt moving slowly.
4. **Observe round A**: ~6 question-orb prompts, one every ~10 s.
5. **Sort round B**: ~16 screen items.
6. **Observe round B**: ~6 prompts.
7. **Summary**: the three orbs shown side by side, sized by counts, split by screen vs observe rounds; accuracy for screen rounds; lever unlock notice if earned.

## Difficulty lever (levels unlock sequentially)

| Level | Working name | Screen item mix | Belt | Observe prompts |
|---|---|---|---|---|
| 1 | Apprentice | Modality-cued: thoughts as text, feelings as faces, sensations as colors/tones | Slow, pauses briefly at gate | every ~10 s |
| 2 | Journeyman | All categories as text, unambiguous items | Medium, no pause | every ~8 s |
| 3 | Machinist | Text items plus trap items | Fast; unsorted items drift past (logged as missed) | every ~6 s |

The accelerating observe prompts embody the assumption that something is always happening in awareness: the question is never "is anything there", only "what is it".

## Feedback rules

- **Screen rounds**: correct = crate rides the spur into the orb with a satisfying clunk and glow pulse. Incorrect = crate misses and tumbles to the floor; the item's canonical category flashes briefly. Trap items additionally show a one-line teaching note (see item bank).
- **Observe rounds**: strictly non-evaluative. Every press produces a labeled crate that always reaches its orb. No accuracy, no floor, no scoring. Observe responses are still logged (category choice + response time), since the thought/feeling/sensation proportions are themselves interesting data.

## Item bank draft

Every item has: id, text or asset reference, modality (text / face / color / tone), canonical category, tier (1, 2, or 3-trap), valence tag (pos / neg / neutral). Screen rounds sample without replacement, balanced across categories and valence.

### Thoughts (text, tiers 1-2)

Self-judgment, negative:
1. I always mess things up.
2. I'm not good enough at this.
3. Nobody really wants me around.
4. I should have known better.
5. I'm falling behind everyone else.
6. I'm such an idiot.

Self-judgment, positive:
7. I handled that really well.
8. I'm getting better every day.
9. People enjoy my company.
10. That was a smart decision.

Judgments of others:
11. He never listens to anyone.
12. She's always so kind to people.
13. They have no idea what they're doing.
14. My neighbour is a genuinely good person.

Predictions and worries:
15. This is going to go badly.
16. What if I embarrass myself?
17. They're probably talking about me.
18. Tomorrow will be a better day.
19. I'll never get all this done.

Memories:
20. I can't believe I said that yesterday.
21. That summer at the lake was perfect.
22. I used to be so much fitter.

Planning:
23. I need to buy groceries after this.
24. I should call my mother tonight.
25. If I leave now I can still make the bus.

Comparisons and neutral:
26. She's so much smarter than me.
27. My life is better than it used to be.
28. It might rain later.

### Feelings

Tier 1 (faces): all 24 combinations from the existing affect system, `EXPRESSION_TABLE` 8 emotions (Alert, Excited, Good, Calm, Still, Sad, Bad, Tense) x 3 intensity zones (mild, moderate, strong), rendered with `AURenderer`. Unlabeled faces; the face itself is the stimulus.

Tier 2 (text):
1. joy
2. quiet contentment
3. a surge of excitement
4. calm
5. sadness
6. loneliness
7. irritation
8. a flash of anger
9. nervousness
10. dread
11. boredom
12. relief
13. gratitude
14. pride
15. embarrassment
16. hopefulness

### Sensations

Tier 1 (non-verbal):
- Colors (full-screen swatch on the belt item): warm amber glow, deep red, cool blue, soft green.
- Tones (Web Audio synth, no assets needed): low hum, bright chime, rising sweep, falling two-note figure. Tone items show a small speaker glyph on the crate; if the session is muted, tone items are swapped for colors.

Tier 2 (text):
1. warmth in the chest
2. tingling in the fingers
3. a tight jaw
4. heaviness in the eyelids
5. butterflies in the stomach
6. cool air on the skin
7. a racing heartbeat
8. dry mouth
9. tension across the shoulders
10. a growling stomach
11. ringing in the ears
12. goosebumps on the arms
13. aching feet
14. pressure behind the eyes
15. an itch on the forearm
16. a lump in the throat

### Trap items (tier 3 only, each with a teaching note shown on a miss)

| Item | Canonical | Teaching note |
|---|---|---|
| I feel like a failure. | thought | "Feel like" followed by a verdict is a judgment wearing a feeling costume. |
| I feel that nobody listens to me. | thought | "I feel that..." introduces a belief, not an emotion. |
| I feel anxious. | feeling | A named emotion is a feeling, even in a sentence. |
| My heart is pounding. | sensation | A body event, described without interpretation. |
| Everything is hopeless. | thought | A claim about the world. Compare: "hopelessness" is the feeling. |
| hopelessness | feeling | The emotion itself, no claim attached. |
| I can't take this anymore. | thought | A prediction about your limits. |
| a knot in the stomach | sensation | The body's signal, before any story about it. |
| I'm so stupid. | thought | A self-judgment, however loud it feels. |
| shame | feeling | The emotion, named directly. |
| burning cheeks | sensation | What shame feels like in the body. |
| I feel ignored. | thought | "Ignored" describes what others did, which is an interpretation. |

### Matched triplets (used in intro and teaching feedback)

The same moment of experience at three levels:

- Embarrassment: "Everyone saw me trip." (thought) / embarrassment (feeling) / burning cheeks (sensation)
- Fear: "Something bad is about to happen." (thought) / fear (feeling) / a pounding heart (sensation)
- Anger: "He had no right to say that." (thought) / anger (feeling) / heat rising in the face (sensation)

## Data logging sketch (built to the five rules from day one)

- `game_sessions` row with `game_name = 'experience_factory'`, standard start/end pattern.
- New table `experience_factory_trials`: `id, session_id, user_id, schedule_id (nullable, ON DELETE SET NULL), level, round_index, round_type ('sort' | 'observe'), trial_index, item_id (null for observe), item_modality, canonical_category (null for observe), chosen_category (null if missed), correct (null for observe), rt_ms, belt_speed, created_at`.
- Append-only: the two standard triggers, an entry in `responsesAppendOnly.test.mjs` `RESPONSE_TABLES`, explicit RLS policies per CLAUDE.md, migration in `supabase/migrations/`.
- Terminal submit guarded with `useSubmitLock` plus the database guard.
- Launch: standalone `/games/experience-factory` route (lazy-loaded) and a `src/data/games.js` entry. Study-flow wiring (`GameStepWrapper`) deferred, but the component accepts the study prop contract from day one so wiring later is one map entry.

## Open questions for Norm

1. Item bank content: anything to veto, soften, or add? The negative self-judgments are deliberately mild-to-moderate; happy to adjust the ceiling.
2. Should trap teaching notes also appear on *correct* trap sorts (reinforcement), or only on misses?
3. Faces unlabeled (my default) or labeled with the emotion word?
4. Points: award profile points like Drift does, or none like Tune?
5. Orb colors per category: preferences?
