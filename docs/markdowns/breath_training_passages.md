# Windward phases 4–5: spoken passages (draft 1, 2026-11-10)

*A proposal for the passage set described in W16 and W17 of `breath_training_5phase_plan.md`. It covers timing, how big the set has to be, how passages are assigned to people, and nine sample triplets. Nothing here is decided yet; the decisions it asks for are listed at the end.*

## 1. Timing

**One kite in phases 3–5 takes about 18 s:**

| Part | Time | Notes |
|---|---|---|
| begin | about 1.5 s | paced by the player after the reveal |
| the breath (rest, in, pause, out) | 11–12 s | long-tail (in 4, pause 0.5, out 6, rest 0.5) and drifter (5, 0.5, 5, 0.5) are 11 s; square sail (3 each) is 12 s |
| confidence rating | about 3 s | |
| reveal | about 2 s | |

**One round is six kites plus the recap,** about 2 minutes. Phase 5 adds the comprehension questions, about 25 s for three questions.

**Passage length: about 9 s, a little shorter than the breath.** Each passage is two sentences, 22–26 words or 30–34 syllables. A calm synthetic voice speaks about 3.6 syllables a second (to be measured on the chosen voice), so that is roughly 8.5–9.5 s.

**Onset: locked to begin, with a small random delay (proposed).** A passage starts 0–1.5 s after the begin press, so it plays over the rest, the in-breath, the pause and most of the out-breath. It is over before the rating, so no rating is made while someone is talking.
- The cost is that a passage always starts at the same point in the kite. The phase table's measure "by where in the breath a passage started" then varies only with the plan: on the square sail a passage starts during the 3 s rest, and on long-tail during the in-breath.
- Fully random onsets would give that measure, but a 9 s passage started late would run into the rating.

**Three of the six kites in a round carry a passage (proposed):** one pleasant, one neutral, one unpleasant. The other three are silent, and no two voiced kites are next to each other, so there is always at least one silent kite (about 18 s) between passages.
- The silent kites give a no-voice baseline inside the same phase. The only other baseline is phase 3, which comes earlier and so is mixed up with practice.
- It halves the number of passages needed (section 2).
- In phase 5 it means three questions per round, one per passage.

## 2. How big the set has to be

Each participant hears each passage frame at most once (section 3), so the set needs one frame for every voiced kite a person meets across their six sessions.

**Assumed session length: 6 rounds,** about 12 minutes of play in phase 4 and 14–15 in phase 5. That is 36 kites per session, 18 of them voiced (6 per valence).

| Voiced kites per round | Rounds per session | Passages per session | Frames for 6 sessions | Passages to record (frames × 3) | To draft (+30%, section 4) |
|---|---|---|---|---|---|
| **3 (proposed)** | 4 | 12 | 72 | 216 | 94 frames, 282 passages |
| **3 (proposed)** | **6** | **18** | **108** | **324** | **140 frames, 420 passages** |
| 3 | 8 | 24 | 144 | 432 | 188 frames, 564 passages |
| 6 | 6 | 36 | 216 | 648 | 281 frames, 843 passages |

**With the proposed design (3 voiced kites, 6 rounds), each person gives per phase:** 54 voiced kites (18 per valence) and 54 silent kites over three sessions. Each session beyond six costs 18 more frames (54 more passages).

## 3. Assigning passages: random frames, counterbalanced valence

- **A participant never hears two versions of the same frame.** They would recognise it. In phase 5 the second hearing would also carry the answer over from the first.
- **The frames are split into three equal strata, A, B and C,** balanced on scene type and length.
- **Each participant gets a list, 0, 1 or 2, assigned in rotation at enrolment.** Stratum *s* plays in valence (*s* + list) mod 3. For list 0: A pleasant, B neutral, C unpleasant. For list 1: A neutral, B unpleasant, C pleasant. And so on. Across every three participants, each frame is heard once in each valence, so frame content cannot masquerade as a valence effect.
- **Each round draws one unused frame at random from each stratum.** So every round has exactly one pleasant, one neutral and one unpleasant passage, in a shuffled order and at random non-adjacent positions among the six kites. Valence is therefore balanced within every round and every session, and so across sessions.
- **The draw is without replacement across all six sessions.** Which frames land in phase 4 and which in phase 5 is therefore random for each person. Comprehension questions are written for every frame for this reason.
- **Logged per voiced kite:** frame id, version, list, draw seed, passage onset relative to begin, and the audio file's hash.

## 4. Building and norming the set

**Writing rules (the samples below follow them):**
- First person, past tense, an everyday scene, mild to moderate in feeling.
- Two sentences and two swap slots, with the same number of words in each version of a slot. The valence arrives in the first sentence or early in the second, by about 6 s.
- **Nothing about breathing, air, smoke, water over the head, running, panic, illness, injury or death.** Anything that touches the breath could act on it directly, and the safety copy promises a calm task.
- No names, no brand names, Canadian spelling.
- The comprehension question asks about the shared frame (where, when, what object), never about the swapped words. All three versions therefore have the same right answer, and question difficulty is matched across valence by construction.

**Screening on paper (done for the samples, section 5):** only the swap words differ within a triplet, so only they need matching. They are checked for syllables (CMU dictionary), frequency (SUBTLEX-US, Zipf), concreteness (Brysbaert et al., 2014) and word valence and arousal (Warriner et al., 2013). Word norms only screen; the passage ratings decide.

**Norming the text (about 30 raters per passage):**
- A rater sees only one version of each frame, so the three versions never sit side by side and inflate each other's differences. That gives three rating lists.
- For the proposed design, 140 drafted frames make lists that are too long for one rater, so each list is split in half: six lists of about 70 passages, about 12 minutes each. That is 6 × 30 = **180 raters**.
- **A triplet is kept only if all three versions land.** Pleasant and unpleasant fall clearly on their side of the neutral version, neutral sits near the middle of the scale, and pleasant and unpleasant are close in arousal. If 9 in 10 passages pass on their own, only about 3 in 4 triplets pass whole. That is the reason for drafting 30% more frames, and failed versions can be rewritten and normed again.

**Then the audio:**
- render the surviving passages once, with one voice and one calm delivery (W17)
- match duration, rate and loudness
- have a smaller group rate a sample of the audio, to check the voice adds no valence of its own

## 5. Sample set: nine triplets

The swapped words are shown as **pleasant / neutral / unpleasant**.

**T1 · letter.** A letter from the city came this morning, and I opened it at the table. My application had been **approved / received / refused**, and I read it twice, **smiling / slowly / frowning**.
*Q: Where did the speaker open the letter?* at the table · on the bus · at work

**T2 · bread.** I took the bread out of the oven after forty minutes. The crust was **golden and crisp / brown and firm / burnt and dry**, and I **proudly / carefully / angrily** set it on the rack.
*Q: How long was the bread in the oven?* forty minutes · twenty minutes · an hour

**T3 · dog.** On Sunday my neighbour's dog ran across the park toward me and **jumped up happily / sat down nearby / growled and snapped**. His owner **laughed / turned / shouted** and called him back.
*Q: What day was it?* Sunday · Saturday · Friday

**T4 · marks.** Our history marks went up on the board after lunch. My name was near the **top / middle / bottom** of the list, and I went back to my seat **pleased / again / upset**.
*Q: Which subject were the marks for?* history · math · French

**T5 · sky.** When I stepped outside, the sky over the river was **clear / cloudy / gloomy**, and the wind felt **warm / mild / bitter** on my face. I walked home along the water.
*Q: What was the speaker walking beside?* the water · a highway · a fence

**T6 · sister.** My sister phoned while I was cooking dinner. The bakery on our street had **accepted / contacted / rejected** her after the interview, and she sounded **thrilled / busy / crushed**.
*Q: What was the speaker doing when the call came?* cooking dinner · driving home · reading

**T7 · tomatoes.** This morning I checked the tomato plants I had watered all summer. The fruit was **ripe and red / green and small / split and rotten**, and I **picked / counted / tossed** a dozen.
*Q: What plants did the speaker check?* tomatoes · peppers · beans

**T8 · parcel.** A parcel was waiting on the doorstep when I got home. The jacket inside was **perfect / folded / ripped**, and I **tried it on / put it away / sent it back** that evening.
*Q: What was in the parcel?* a jacket · some books · a lamp

**T9 · bus.** The bus came as I reached the stop, and the driver gave me a **friendly wave / quick nod / cold glare**. I sat by the window and **smiled / read / sulked** the whole way.
*Q: Where did the speaker sit?* by the window · at the back · beside the driver

### Screening numbers

Words and syllables are for the whole passage; the duration estimate assumes 3.6 syllables a second. Frequency, concreteness, valence and arousal are means over the swap words (function words left out). Valence and arousal use Warriner's 1–9 scales.

| | Words | Syllables (P / N / U) | Est. s | Swap valence (P / N / U) | Swap arousal (P / N / U) |
|---|---|---|---|---|---|
| T1 | 26 | 36 / 36 / 36 | 10.0 | 7.5 / 5.6 / 3.4 | 4.4 / 3.6 / 4.0 |
| T2 | 25 | 31 / 31 / 31 | 8.6 | 6.7 / 5.7 / 3.7 | 4.6 / 3.5 / 5.0 |
| T3 | 22 | 29 / 28 / 28 | 7.9 | 7.5 / 5.5 / 4.6 | 5.9 / 3.5 / 4.6 |
| T4 | 27 | 31 / 33 / 33 | 9.0 | 6.9 / 5.2 / 3.0 | 4.3 / 2.9 / 3.8 |
| T5 | 25 | 30 / 31 / 32 | 8.6 | 6.8 / 5.4 / 3.4 | 3.0 / 2.9 / 4.0 |
| T6 | 23 | 35 / 36 / 35 | 9.8 | 6.9 / 5.8 / 2.6 | 5.0 / 3.9 / 4.9 |
| T7 | 23 | 29 / 30 / 30 | 8.2 | 5.7 / 6.0 / 4.0 | 4.5 / 3.3 / 4.9 |
| T8 | 23 | 30 / 31 / 29 | 8.3 | 6.4 / 5.1 / 3.3 | 4.4 / 3.4 / 5.3 |
| T9 | 26 | 29 / 28 / 28 | 7.9 | 7.4 / 6.0 / 3.8 | 4.4 / 3.9 / 3.6 |
| **Set** | **24.4** | **31.1 / 31.6 / 31.3** | **8.7** | **6.9 / 5.6 / 3.5** | **4.5 / 3.4 / 4.4** |

**What the screen shows:**
- **Length.** Within a triplet, versions are at most 2 syllables apart. Across the set, the length range (28–36 syllables, about 8–10 s) is wider than the target band: T1 and T6 should lose a few syllables, and T3 and T9 could gain a couple.
- **Valence.** The three versions separate cleanly on average (6.9 / 5.6 / 3.5).
- **Arousal.** Pleasant and unpleasant are matched (4.5 and 4.4). Neutral is calmer (3.4), as expected, and is handled as a covariate (W16).
- **Frequency.** The unpleasant swap words are less frequent (Zipf 4.0, against 4.5 for pleasant and 4.6 for neutral), a common pattern because negative words are rarer. In the full set, either choose more frequent unpleasant words or less frequent pleasant and neutral ones.
- **Word norms miss context.** Two places show it:
  - T7: on word norms "ripe and red" is no more pleasant than "green and small", but in a passage about tomatoes ripe fruit is the good outcome.
  - T3: "growled and snapped" is only mildly negative on word norms.

  This is why the passage ratings decide.
- **T4 (marks) is the most personally loaded for students.** It is still mild, but it is the one to watch in norming.

## 6. Decisions this asks for

1. **Three voiced kites in six**, one of each valence, never adjacent, or a passage on every kite.
2. **Session length:** 6 rounds (about 12–15 min) or another number. It sets the size of the set (section 2).
3. **Onset:** locked to begin plus 0–1.5 s, or random across the kite (which needs shorter passages).
4. **Passage length:** about 9 s, two sentences, 30–34 syllables.
5. **Comprehension:** one three-option question per frame, on shared content, asked after each phase 5 round (bears on P5-3).
6. **Sessions beyond six:** keep a reserve of frames (18 per extra session), or cap the study at six.
7. **The voice:** which service, for a test render of these nine triplets (27 files). It needs an account. No audio would be played aloud here; the files would be measured for duration, rate and loudness, and you would listen.
