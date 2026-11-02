# UTMAP 2027 — instrument revisions queued from the 2026 wave

The 2026 wave (study `f5a2db89-9697-489f-9a16-dea9c64053e0`) is running, so nothing here changes it:
editing items mid-collection splits one administration into two, and the wording is what the
committee approved. Apply these when building the 2027 instruments and its ethics Attachment 2.

Source: feedback from a tabling RA (2026-11-02), checked against the 2026 data (124 answers to
Block 6 and 478 frequency-slider answers in Block 7 at the time) and the 2026 protocol.

## Make

1. **Block 6, `HelpSought`: "Friends or family only" → "Friends or family".** The item is
   select-all, and 21 of the 40 who picked this option also picked a professional source, so half
   ignored "only"; literal readers who used both would have left it unticked. Keep the option id
   (`HelpSought_informal`). In analysis of either wave, derive "friends or family only" from the
   pattern (this option and nothing else); that reading means the same under both labels.

2. **Block 6, `Impairment`: give "these problems" a referent.** It is the PHQ-9 functioning item,
   which normally follows the symptom list. Here it sits alone, four blocks after the PHQ-4, so
   "these problems" points at nothing. Suggested: "Over the last two weeks, how difficult have
   feeling anxious, worried, down or uninterested made it for you to do your work, take care of
   things at home, or get along with other people?"

3. **Block 7, frequency sliders (`PeerSlider_1..4`): flag the change of scale.** The page before
   asks "how many out of 100"; this one asks "how often". Add to the info text: "This scale is
   different: how often, not how many."

4. **Block 7 and the PHQ-4 peer estimate: add a time frame to both or neither.** Neither
   `utmap-phq4-peer` nor the frequency sliders name one. Block 7 compares those two formats, so a
   time frame added to one only would confound format with time frame. If added, use the PHQ's
   "over the last two weeks" on both.

## Consider

5. **Hide the slider's numeric readout** ("Value 73" appears once moved) for Block 7. Chasing a
   number that "feels right" depends on seeing one; the anchors carry the meaning. Check that
   `SliderScale`'s `showValue` can be set per item before relying on it.

## Declined

- **Coarsening the sliders to 0/25/50/75/100.** Block 7 exists to ask the peer questions on a
  response format with no midpoint (protocol: peer estimates converged near the middle of the
  scale, and the explanations differ on whether the scale causes it). Five stops restore a
  midpoint and make it nearly the 4-point scale it is compared against. The bias concern does not
  apply to the order either: the self-report PHQ-4 is step 6, before Block 7. Data showed no
  struggle: median 2 change events per frequency slider, 11% of answers on multiples of 25
  (about 5% by chance).
