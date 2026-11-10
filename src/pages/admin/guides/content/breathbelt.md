The BreathBelt study compares the Polar H10 chest strap with the Biopac stretch belt, recorded at the same time. The two recordings can only be lined up through the trigger codes the website sends to the Biopac. A session without those codes cannot be analysed, however well everything else went. Most of this guide is about getting them right.

The log sheet, building access and computer logins are in the RA checklist doc, not here.

## Before the participant arrives

- Arrive 10 minutes early. The physio setup is the slow part.
- Check sign-ups on SONA within the 24 hours before each slot.
- Turn on the MP160 (button on the back) and the computer you will use.
- Check the Polar H10 is charged. A flat H10 pairs and then drops mid-block.
- On each computer you will use, start the parallel helper (`parallel_server.py`, with `inpoutx64.dll` beside it). Open `http://localhost:8765/status` and check it shows `ok: true` **and** `dll: true`.
- Open the study from **radlab.zone**. Don't use `localhost:5173`; that was an old setup. If Chrome asks whether radlab.zone may access devices on your local network, click **Allow**: that is the page reaching the helper.

## Pick the computer and the rig

Each seat has its own computer. The rig you choose on the website must match the computer you are sitting at.

| You are at | Choose under *Trigger device* | Its codes land on |
|---|---|---|
| Right computer | **Biopac — Right rig** | Digital (STP Input 0–3) |
| Left computer | **Biopac — Left rig** | Digital (STP Input 4–7) |

- **AD_BBT is greyed out. Never use it.** Twelve sessions in October ran with it selected while recording on the Biopac, and none of them has trigger codes.
- **One participant: use the right seat.** Name the file `L0000.R` followed by their SONA id.
- **Two participants:** left seat first in the file name, `L<left id>.R<right id>`. Capital L and R, one dot between the two seats.
- In AcqKnowledge the right seat is **Breath 1 / Heart 1** and the left seat is **Breath 2 / Heart 2**. The order catches people out.

## Consent and enrolment

- Take consent first. Enrolling stamps the consent date at that moment.
- Admin → Studies → BreathbeltOfficial → Enrol, with the SONA id as the external ID.
- **If enrolment says the SONA id is already in use, stop and message Norm.** Never change the id (for example by adding a ".") to get past it.
- Note the seat (Left or Right) on the log sheet.

## Fit the sensors, in this order

The order is part of the preregistered method. Don't vary it.

1. Polar H10 first, directly on the skin, snug.
2. ECG electrode stickers, placed by the participant: white to the right above the heart, black to the left above the heart, red lower left below the heart. Offer the other room if they would rather place them in private.
3. Biopac respiration belt, over clothing, snug around the floating ribs. On a deep breath they should feel some resistance.
4. Transmitter belt. It can be loose; it only keeps the wires from tugging.

Check the wires (heart-rate leads to the ECG inlet, respiration belt to the RSP inlet), then turn the transmitter on. Both RSP modules and the MP160 should show green.

## Start the Biopac recording before you touch the browser

- Open the acquisition template, then **File → Save As before recording**. Saving after the fact is how sessions get lost.
- Save to the shared BreathBelt recordings folder on Drive. Never leave a recording only on the lab computer: the August to early-October files sat on one computer's local disk for two months before anyone found them.
- Press Start. A 30-second hang ending in "communications error" is common; press Start again.
- Ask for a few deep breaths, then a few rapid ones. Right-click → autoscale. A flat or noise-only respiration trace means the belt is too loose: refit now, not later.

## Check the trigger staircase

When **Check parallel server** succeeds, the website fires a test cascade of codes 1 to 13 by itself: one code every 0.3 s, about 4 seconds in all. **Send test cascade again** repeats it. Watch the **Experiment Triggers** channel, below the eight Digital lines. You should see 13 thin spikes, each taller than the one before: a staircase.

::figure staircase-right::

The right rig's steps are tiny next to the channel's scale. Right-click → autoscale, or you will see only a flicker on a flat line.

::figure staircase-left::

::figure staircase-both::

**Count all 13.** Don't start the session if:

- there are fewer than 13 spikes, or none: check the helper's status page, then resend;
- the staircase has the other seat's shape (big steps on the right computer, small on the left), or moves the other seat's Digital lines: the wrong rig is selected. Fix it, then resend.

This is your only proof, before the session, that the recording will line up. If you can't get a clean staircase, message Norm rather than running without one.

## During the session

The staircase does not come back. In AcqKnowledge you should see:

- a single mark at the start and end of each block;
- in Blocks 3 and 4, a pair of spikes for every trial;
- nothing during the two free-breathing blocks, except at their start and end.

::figure paced-trials::

If the trial pairs stop appearing partway through, write down the time on the log sheet and tell Norm the same day.

Inside the BreathBelt step your job is to watch the traces and stay quiet. Don't reassure the participant that "there was definitely a change" in Block 4: some trials have none. Don't close the tab until **Session complete** appears, because the trial records are saved at the very end.

## After the session

- Press Stop, then File → Save, and wait for the save to finish before closing AcqKnowledge.
- Remove the sensors, turn the transmitter off, and put the H10 and transmitter on charge.
- Wipe the H10 strap: it is worn against skin, so it is cleaned after every participant.
- Admin → Export: look the participant up and check today's session appears under Belt Physio with a signal preview.
- Check the recording is in the Drive folder, correctly named, and hundreds of MB. A file of about 166 KB was saved before recording started and holds nothing.
- Fill in the log sheet: SONA id, seat, session number, rig, file name and anything unusual.

## Troubleshooting

**The trigger box reads offline.** The helper isn't running, or `inpoutx64.dll` isn't beside it (the status page shows `dll: false`). If Chrome asked about local network access and you clicked Block, allow it in the site settings for radlab.zone.

**Only some of the 13 marks land.** Resend. If it is still partial, check the parallel cable and the rig choice.

**"Belt disconnected" mid-session.** Battery or strap contact. Refit, re-pair and retry on the connection-check screen, and note it on the log sheet.

**Calibration fails or scores poorly.** Refit the H10 tighter and directly on skin, check they are sitting upright and still, then redo it. It takes 20 seconds.

**Flat respiration trace.** The belt is too loose. Refit before the session: this problem is invisible on the website and only shows up in the analysis.

**The participant wants to stop.** They can, at any point, without a reason. Stop and save the recording, remove the sensors, and complete the debrief and compensation steps anyway.
