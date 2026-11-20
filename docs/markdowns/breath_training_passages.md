# Windward phases 4–5: spoken passages (draft 2, 2026-11-17)

*The passage set for W16 and W17 of `breath_training_5phase_plan.md`. Norm settled the design on 2026-11-17 (W18 there). This file covers the timing, how big the set has to be, how passages are assigned to people, and 36 sample sets with test audio.*

## 1. Timing

**One kite in phases 3–5 takes about 18 s:**

| Part | Time | Notes |
|---|---|---|
| begin | about 1.5 s | paced by the player after the reveal |
| the breath (rest, in, pause, out) | 11–12 s | long-tail (in 4, pause 0.5, out 6, rest 0.5) and drifter (5, 0.5, 5, 0.5) are 11 s; square sail (3 each) is 12 s |
| confidence rating | about 3 s | |
| reveal | about 2 s | |

**Every kite carries one passage (W18).** A round of six kites therefore has six passages, two of each valence, in a shuffled order.
- **Phase 4:** a round takes about 2 minutes, and a session of 6 rounds about 12.
- **Phase 5:** after each round comes one question per passage, six questions at about 8 s each. A round then takes about 3 minutes, and a session about 17.
- **Silence:** between passages there are only the rating, the reveal and begin, about 6–7 s.
- **The cost:** there are no silent kites within phases 4–5, so phase 3 is the only no-voice comparison.

**Onset:** a passage starts 0–1.5 s after begin. It plays over the rest, the in-breath, the pause and most of the out-breath, and it is over before the rating, so nobody rates while someone is talking. Because the rest differs by plan, the passage starts in the rest on the square sail (3 s rest) and early in the in-breath on long-tail and drifter (0.5 s rest).

**Length: about 9 s for the pilot,** which is two sentences of 22–27 words.
- **Measured on the test render (section 5):** the two voices (W19), Kokoro's af_bella at speed 0.83 and am_michael at 0.88, both read at 3.7 syllables a second. The 36 sample sets run 7.3–9.7 s, 8.4 s on average in both voices.
- **The three valences come out the same length:** pleasant, neutral and unpleasant average 8.4, 8.3 and 8.4 s in Bella and 8.5, 8.4 and 8.4 s in Michael.

## 2. How big the set has to be

**A participant never hears the same frame twice** (section 3), so the set needs one frame for every kite a person meets. At 6 rounds of 6 kites, that is **36 frames per session**.

| | Sessions | Frames (each heard once) | Passages (frames × 3) |
|---|---|---|---|
| Core: 3 sessions in phase 4, 3 in phase 5 | 6 | 216 | 648 |
| **Reserve for 4 more sessions** (proposed) | +4 | +144 | +432 |
| **Normed set** | **10** | **360** | **1,080** |
| **To draft** (+30%, because some sets fail norming) | | **about 470** | **about 1,410** |

- **Novelty:** with 360 frames, nobody hears a repeat in their first ten sessions. Each further session needs 36 more frames.
- **Beyond the set:** if someone goes further still, the frames they heard longest ago come back, and the log marks them as repeats.
- **Data per person and phase:** three sessions give 108 voiced kites, 36 per valence.

## 3. Assigning passages: random frames, counterbalanced valence

- **A participant never hears two versions of the same frame.** They would recognise it. In phase 5 the second hearing would also carry the answer over from the first.
- **The frames are split into three equal strata, A, B and C,** balanced on scene type and length.
- **Each participant gets a list, 0, 1 or 2, assigned in rotation at enrolment.** Stratum *s* plays in valence (*s* + list) mod 3. For list 0: A pleasant, B neutral, C unpleasant. For list 1: A neutral, B unpleasant, C pleasant. And so on. Across every three participants, each frame is heard once in each valence, so frame content cannot pass for a valence effect.
- **Each round draws two unused frames at random from each stratum.** So every round has exactly two pleasant, two neutral and two unpleasant passages, in a shuffled order. Valence is therefore balanced within every round and every session, and so across sessions.
- **The draw is without replacement across all sessions.** Which frames land in phase 4 and which in phase 5 is random for each person, which is why every frame gets a comprehension question.
- **Logged per kite:** frame id, version, list, draw seed, passage onset relative to begin, and the audio file's hash.

## 4. Building and norming the set

**Writing rules (the samples follow them):**
- First person, past tense, an everyday scene, mild to moderate in feeling.
- Two sentences and one or two swap slots, with the same number of words in each version of a slot. The valence arrives in the first sentence or early in the second, by about 6 s.
- **Nothing about breathing, air, smoke, sighing, yawning, water over the head, running, panic, illness, injury or death.** Anything that touches the breath could act on it directly, and the safety copy promises a calm task.
- No names, no brand names, Canadian spelling. No swap word used in more than one frame where it can be helped.
- **The comprehension question asks about the shared frame** (where, when, what object, who), never about the swapped words. All three versions therefore have the same right answer, and question difficulty is matched across valence by construction. The three options are of similar length.

**Screening on paper:** only the swap words differ within a set, so only they need matching. They are checked for:
- syllables (CMU dictionary)
- frequency (SUBTLEX-US, Zipf)
- concreteness (Brysbaert et al., 2014)
- word valence and arousal (Warriner et al., 2013)

The script also flags slot word counts that differ, valence out of order, swap words repeated across frames, and length outside the band. Word norms only screen; the passage ratings decide.

**Norming the text (about 30 raters per passage):**
- **One version per rater.** A rater sees only one version of each frame, so the three versions never sit side by side and inflate each other's differences.
- **Lists:** about 1,410 drafted passages in lists of about 80 passages (about 15 minutes each) makes about 18 lists. At 30 raters per list that is **about 530 raters**, or roughly 130 rater-hours.
- **A set is kept only if all three versions land.** Pleasant and unpleasant fall clearly on their side of the neutral version, neutral sits near the middle of the scale, and pleasant and unpleasant are close in arousal.
- **Why draft 30% extra:** if 9 in 10 passages pass on their own, only about 3 in 4 sets pass whole. Failed versions can also be rewritten and normed again.

**Then the audio:**
- **Render once.** The surviving passages are rendered once, in each of the two voices, with one delivery per voice (W17, W19). Kokoro runs locally and gives the same file for the same text, so a render can be reproduced.
- **Match duration within each set.** A time-stretch of up to ±5% is not audible, and it brings the three versions of a frame to the same length. Loudness is normalised to −18 LUFS, as the lab's other voice clips are.
- **Check the voice.** A smaller group rates a sample of the audio, to check the voice adds no valence of its own.

**Is it hard to generate?**
- **Drafting is the cheap part.** The 27 sets of batch 2 took one pass, with the screen run automatically.
- **Getting variety across 470 frames takes the work.** Drafts drift toward the same openings ("When I got home…") and the same swap words. That needs a planned list of scenes and openers, and the repeat check.
- **Neutral versions are the hardest to write.** They have to stay plausible without tipping pleasant or unpleasant.
- **The real costs are the norming study (section above) and listening checks on the audio.**

## 5. Sample set: 36 frames, one session's worth

Batch 1 (T1–T9, 2026-11-10) and batch 2 (T10–T36, 2026-11-17). Test audio for all 108 passages in both voices (W19): Kokoro-82M, af_bella at 0.83 and am_michael at 0.88, −18 LUFS. The audio is on the unlisted listening page, radlab.zone/prototypes/windward-passages/.

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

**T10 · cafe.** At the cafe near my office, I ordered the usual and sat by the door. The coffee tasted **rich / plain / sour**, and the barista was **cheerful / new / rude** today.
*Q: Where was the cafe?* near the office · near the station · near the park

**T11 · library.** The book I had reserved was waiting at the library desk. Its cover was **spotless / blue / stained**, and the librarian **chuckled / paused / grumbled** as she handed it over.
*Q: Where was the book waiting?* at the library desk · in the mailbox · at the bookstore

**T12 · haircut.** I got my hair cut on Thursday at the place around the corner. It came out **great / shorter / uneven**, and I **grinned / glanced / scowled** at the mirror on the way out.
*Q: On which day was the haircut?* Thursday · Monday · Saturday

**T13 · train.** My train home was due at six, so I got to the platform early. It left **right on time / at six fifteen / an hour late**, and I **relaxed / waited / fumed** in my seat.
*Q: Where did the speaker wait for the train?* on the platform · in the station cafe · outside the station

**T14 · cat.** When I came in from work, my cat was sitting on the kitchen counter. She **purred / blinked / hissed** at me and **rolled over / walked away / swatted me** on the counter.
*Q: Where was the cat sitting?* on the kitchen counter · on the windowsill · on the bed

**T15 · apartment.** On Saturday I went to see an apartment two blocks from campus. The rooms were **bright and spacious / square and white / dark and cramped**, and the landlord was **kind / brief / harsh**.
*Q: How far was the apartment from campus?* two blocks · four blocks · six blocks

**T16 · concert.** My friend texted at noon about the concert at the old theatre. She had **upgraded / printed / cancelled** our tickets for the balcony, and I **cheered / answered / groaned** right away.
*Q: Where was the concert?* at the old theatre · in the park · at the arena

**T17 · bike.** I left my bike outside the post office for twenty minutes. When I came back, a stranger had **fixed the chain / moved it aside / kicked it over**. I rode home.
*Q: Where did the speaker leave the bike?* outside the post office · outside the library · outside the bank

**T18 · photo.** My aunt mailed me a photo from our summer at the lake. In it I looked **happy and carefree / young and serious / tired and sad**, and I **framed it / filed it / hid it** that night.
*Q: Who sent the photo?* my aunt · my cousin · my uncle

**T19 · roommate.** When I got up on Monday, my roommate was already in the kitchen. She had **cooked us pancakes / left for work / broken my bowl**, and the sink was **gleaming / empty / filthy**.
*Q: Where was the roommate?* in the kitchen · in the hallway · on the balcony

**T20 · gift.** I spent the weekend painting a small picture for my friend’s birthday. When she opened it, she **lit up / looked closely / went quiet** and **hung it / set it / left it** by the door.
*Q: What was the gift?* a painting · a scarf · a book

**T21 · peaches.** At the market I bought a basket of peaches from the last stall. They were **sweet and juicy / large and round / soft and bruised**, and I **ate three / ate one / threw two** on the way home.
*Q: What fruit did the speaker buy?* peaches · plums · apples

**T22 · recital.** At my cousin’s recital, she played the piece she had practised for months. Her playing was **flawless / careful / shaky**, and the audience **stood up / sat still / walked out**.
*Q: Who played at the recital?* my cousin · my sister · my friend

**T23 · gloves.** I left my gloves on the bus last night. This morning the clerk at the lost and found **handed them back / checked a list / shrugged at me**, and I **felt so grateful / signed a form / left with nothing**.
*Q: Where were the gloves left?* on the bus · at the gym · in a cafe

**T24 · driving.** My first driving lesson was on a quiet road behind the mall. The instructor said I was **a natural / doing okay / a danger**, and I **beamed / nodded / flushed** as I parked.
*Q: Where was the driving lesson?* behind the mall · near the school · on the highway

**T25 · phone.** I dropped my phone on the sidewalk outside the bank. When I picked it up, the screen was **perfectly fine / facing down / badly cracked**, and I **was so relieved / put it away / felt like crying**.
*Q: Where did the speaker drop the phone?* outside the bank · at the bus stop · inside a store

**T26 · presentation.** Our team gave its presentation to the manager on Wednesday afternoon. She called our work **excellent / complete / careless**, and the meeting ended **with applause / at four / in silence**.
*Q: When was the presentation?* Wednesday afternoon · Tuesday morning · Friday evening

**T27 · film.** Last night a few friends came over to watch a film in my living room. The film was **hilarious / subtitled / terrible**, and everyone **asked for another / went home after / left halfway through**.
*Q: Where did they watch the film?* in the living room · at the cinema · in the backyard

**T28 · plant.** I bought a small plant for my desk at work about a month ago. This week it **started to bloom / stayed the same / wilted and drooped**, and my coworker **praised it / watered it / mocked it**.
*Q: Where was the plant?* on my desk at work · on my kitchen table · by my front door

**T29 · museum.** On a rainy afternoon I visited the small museum near the station. The new exhibit was **stunning / modern / shabby**, and the guard **greeted me warmly / scanned my ticket / told me off**.
*Q: Where was the museum?* near the station · beside the park · across from the mall

**T30 · checkout.** At the grocery store the line was long, so I waited with my basket. A stranger **waved me ahead / was behind me / cut in front**, and I **thanked her kindly / paid by card / muttered at her**.
*Q: What was the speaker carrying?* a basket · a backpack · a box

**T31 · note.** This afternoon I found a note from my neighbour taped to my door. It said **she loved the flowers / she had a parcel / I was too loud**, and I **kept it close / put it down / tore it up**.
*Q: Where was the note?* taped to the door · under the mat · in the mailbox

**T32 · highway.** We drove north for the long weekend, and I drove first. The highway was **open and scenic / flat and straight / jammed for hours**, and my brother **sang along / played music / kept complaining**.
*Q: Who else was in the car?* my brother · my sister · my friend

**T33 · cake.** I picked up the cake I had ordered for my dad’s birthday. The icing was **beautiful / yellow / smeared**, and the baker had **put on sprinkles / written his name / misspelled his name**.
*Q: Whose birthday was the cake for?* my dad’s · my mom’s · my friend’s

**T34 · scarf.** I finished knitting my scarf and wore it to class on Tuesday. My friends said it looked **amazing / handmade / ugly**, and one of them **wanted one too / touched the wool / made a face**.
*Q: What did the speaker knit?* a scarf · a hat · a sweater

**T35 · hotel.** After the flight we checked into a small hotel near the harbour. Our room had **a lovely view / two single beds / a dripping tap**, and we went out for dinner.
*Q: Where was the hotel?* near the harbour · near the airport · near the station

**T36 · paint.** This weekend I painted my bedroom a pale shade of green. When it dried, the walls looked **fresh and calm / about the same / patchy and streaked**, and I was **delighted / done / annoyed**.
*Q: What colour was the paint?* green · blue · yellow

### Screening numbers (batch 1)

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

### Test audio (all 36 sets)

Speech duration in seconds, onset to offset: Bella is af_bella at 0.83, Michael is am_michael at 0.88.

| Set | Bella P | Bella N | Bella U | Michael P | Michael N | Michael U |
|---|---|---|---|---|---|---|
| T1 | 9.5 | 9.4 | 9.5 | 9.6 | 9.4 | 9.6 |
| T2 | 7.8 | 7.8 | 7.9 | 7.9 | 7.9 | 7.9 |
| T3 | 8.1 | 8.5 | 8.8 | 8.1 | 8.3 | 8.4 |
| T4 | 7.9 | 7.7 | 8.1 | 8.4 | 8.0 | 8.3 |
| T5 | 9.1 | 9.1 | 9.2 | 9.0 | 9.1 | 9.0 |
| T6 | 8.8 | 9.0 | 8.7 | 8.6 | 8.9 | 8.7 |
| T7 | 8.0 | 8.3 | 8.2 | 7.9 | 8.2 | 8.1 |
| T8 | 8.1 | 8.1 | 8.1 | 8.2 | 8.2 | 8.1 |
| T9 | 8.6 | 8.0 | 8.3 | 8.5 | 8.0 | 8.2 |
| T10 | 9.6 | 9.7 | 9.6 | 9.4 | 9.5 | 9.5 |
| T11 | 8.8 | 8.6 | 8.9 | 9.2 | 8.9 | 9.0 |
| T12 | 7.9 | 7.9 | 8.2 | 8.3 | 8.3 | 8.6 |
| T13 | 8.3 | 8.1 | 7.9 | 8.0 | 8.0 | 7.6 |
| T14 | 7.3 | 7.5 | 7.6 | 7.6 | 7.7 | 7.5 |
| T15 | 8.6 | 8.2 | 8.2 | 8.5 | 8.2 | 8.3 |
| T16 | 9.1 | 9.0 | 9.1 | 8.9 | 8.8 | 9.0 |
| T17 | 8.7 | 8.7 | 8.4 | 8.6 | 8.7 | 8.5 |
| T18 | 7.4 | 7.4 | 7.3 | 7.6 | 7.7 | 7.4 |
| T19 | 7.8 | 7.4 | 7.6 | 7.6 | 7.5 | 7.6 |
| T20 | 8.2 | 8.5 | 8.4 | 8.1 | 8.4 | 8.4 |
| T21 | 8.2 | 8.2 | 7.9 | 8.1 | 8.3 | 8.2 |
| T22 | 8.1 | 8.3 | 8.3 | 8.1 | 8.2 | 8.3 |
| T23 | 8.8 | 8.3 | 8.3 | 8.9 | 8.4 | 8.4 |
| T24 | 9.0 | 9.2 | 9.0 | 9.2 | 9.4 | 9.1 |
| T25 | 8.7 | 8.1 | 8.7 | 8.7 | 8.0 | 8.6 |
| T26 | 9.2 | 8.6 | 9.1 | 9.3 | 8.9 | 9.3 |
| T27 | 8.6 | 8.6 | 8.7 | 8.8 | 8.8 | 8.8 |
| T28 | 8.1 | 7.9 | 7.9 | 7.9 | 8.0 | 7.9 |
| T29 | 9.1 | 9.1 | 8.4 | 9.3 | 9.1 | 8.6 |
| T30 | 9.0 | 8.7 | 8.3 | 8.9 | 8.8 | 8.2 |
| T31 | 8.2 | 7.7 | 7.4 | 8.4 | 7.7 | 7.5 |
| T32 | 8.1 | 8.0 | 8.5 | 8.0 | 7.8 | 8.4 |
| T33 | 7.8 | 7.5 | 7.8 | 8.0 | 7.7 | 8.0 |
| T34 | 8.7 | 8.4 | 8.1 | 8.7 | 8.4 | 8.3 |
| T35 | 7.7 | 7.8 | 7.8 | 7.7 | 8.0 | 7.7 |
| T36 | 9.2 | 8.7 | 9.2 | 9.2 | 8.6 | 9.2 |

- **Overall:** 8.4 s on average in both voices (Bella 7.3–9.7 s, Michael 7.4–9.6 s), 3.7 syllables a second.
- **Between voices** the same passage differs by 0.03 s on average (at most 0.51 s), so the two speeds match the voices for length.
- **Within a set** the versions differ by 0.35 s on average in Bella and 0.33 s in Michael. Ten sets in Bella and eight in Michael differ by more than 0.5 s (the most is T31: 0.80 s and 0.96 s). The ±5% time-stretch closes these gaps.
- **The first test render,** af_heart at 0.80 (2026-11-17), averaged 8.7 s; it is retired.
- **Word screen across all 36 sets:** swap-word valence 6.9 / 5.7 / 4.0, and arousal for pleasant and unpleasant 4.4 and 4.3 (neutral 3.5). The unpleasant words are again less frequent (Zipf 4.1, against 4.4 and 4.6).
- **Word norms that disagree with context** (T7, T20, T32, T35, T36) are all cases where the words are mild or missing from the norms but the scene is clearly good or bad. The ratings will settle them.
- **The voice the PSY240 trial chose,** af_nicole at 0.80 (Handbook course voice, 2026-10-05), reads these passages at 2.2 syllables a second, 13.9 s on average, too long for an 11 s breath. **Norm ruled it out on 2026-11-18 as too breathy.**
- **Voice survey (2026-11-19).** All 19 North American Kokoro voices read T1 and T22 (neutral) at 0.80. Breathiness was measured as the harmonics-to-noise ratio (HNR, autocorrelation, voiced frames; lower is breathier). af_nicole scores lowest of the female voices (10.1 dB); af_heart 13.6, af_bella 15.6. Male voices are compared only with each other, because pitch shifts the measure: am_puck 12.7, am_fenrir 11.0, am_michael 10.5.
- **Chosen (Norm, 2026-11-20, W19):** af_bella and am_michael, out of the four candidates on the listening page (af_heart, af_bella, am_puck, am_michael). Each speed was set to match af_heart's length on T1 and T22.

## 6. Decided and open

**Decided (W18, 2026-11-17):**
- one passage per kite
- 6 rounds per session
- the passage starts just after begin
- 9 s passages for the pilot
- one comprehension question per passage, asked after each phase 5 round
- a reserve big enough that sessions stay novel

**Decided (W19, 2026-11-20):** two voices, af_bella (speed 0.83) and am_michael (speed 0.88).

**Open:**
1. **How the two voices are assigned.** Recommended: one voice per participant, assigned in rotation and crossed with the valence list (six cells). Each person then hears one consistent voice, as W17 intended, and voice is balanced across participants. The alternative, both voices within a session, needs voice balanced against valence inside every round.
2. **The reserve.** Four extra sessions (360 normed frames) as proposed, or another number.
3. **Neutral versions in the samples that read as slightly off.** For example, T13 "at six fifteen" is mildly late, and T28 "stayed the same" mildly disappointing. Mark any while listening.
4. **The order inside a round.** Fully random, or no two of the same valence back to back.
