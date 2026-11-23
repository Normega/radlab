Breath Attention and Emotional Recovery is one in-person visit of about an hour in DH4059. The participant does everything on the lab computer. You make their link, fit the sensors, start the recording, and stay nearby in case they need you. This guide covers the platform side. The **Distress Protocol** (printed copy in the room, from the REB package) covers what to do if a participant is upset. Read it and practise it with Maya before your first session.

The RA PIN is not written here (this repository is public). Maya or Norm will give it to you.

## Before the participant arrives

- Check sign-ups on SONA in the 24 hours before each slot.
- Turn on the Biopac and the lab computer. Open Chrome.
- Headphones on the computer, **system volume at the study setting**, the same for everyone. Don't change it during a session.
- Have the printed resource sheet, the Distress Protocol and the condition FAQs in the room.

## Make the participant's link

1. radlab.zone → Admin → Studies → **Breath Attention and Emotional Recovery** → *Participant links*.
2. Type their SONA ID under **SONA participant** and press **Create link**.
   - For a pilot or practice run with a lab member, tick **Pilot or test participant** first. Its data are marked as test data and it does not count towards the 300.
3. The panel shows a **study code** (`MB-…`). Write it on the log sheet. **The SONA ID is not shown again**, and nothing else connects the two after a week.
4. Copy the link and open it in Chrome on the lab computer. Each participant gets a fresh link at their session. Never reuse one.

If **Create link** says the session is closed, the study is inactive or full. Don't work around it: message Norm.

## What the participant does before the sensors

They read the consent form on screen and agree, then answer two short questionnaires and some background questions. Some participants are routed to a version with neutral films only, based on their answers. Nobody, including you, sees which version or which breathing instruction they got. **Don't ask, and don't guess from what they say.**

When they reach **"Please let the research assistant know you have finished."**, the screen holds until you unlock it.

## Fit the sensors

Fit the sensors as Maya trained you, then check the traces in AcqKnowledge before going further.

## Start the recording, then unlock

1. In AcqKnowledge, **File → Save As** first, and name the file with the **study code** (`MB-…`). Never use the SONA ID or a name.
2. Start recording.
3. On the lab computer, press **Ctrl + Alt + R** and enter the RA PIN. (Ctrl + Shift + R is Chrome's hard reload. Don't press it.)
4. Choose the **marker device** for this computer. The computer remembers it next time.
5. **Connect**, then **Send test pulse (200)**. Check it appears on the trigger channel in AcqKnowledge. The panel says which value to look for.
   - On a Biopac seat each marker is sent as a 4-bit event type, so the test pulse shows as the top step (15) of that seat's lines. The exact codes are kept in the platform's log.
   - If no pulse appears, check the device and resend. Don't start without one. Message Norm if you can't get it.
6. Tick **AcqKnowledge is recording and the test pulse arrived**, then press **Start (sends marker 1)**. The screen goes full screen and the participant carries on alone.

## During the session

The participant runs the task alone: a baseline, the breathing training, then film clips with short rating screens. Stay within reach. The task runs about 25 minutes.

**Ctrl + Alt + R** and the PIN open the RA panel at any time:

- **Pause** freezes the films, audio and timers (marker 250). **Resume** carries on (251).
- **Skip to final questions** ends the film task early and goes to the last questionnaire, for the Distress Protocol's "skip the rest of the clips" (252).
- **Stop session** ends the task (255). The data so far are kept.

After the first film block, look over and check the participant is comfortable continuing. Don't interrupt the recovery minutes to do it.

If the participant gets the check question about their breathing instruction wrong, the instruction plays again by itself. You don't need to do anything.

**If the browser closes or the computer restarts**, reopen the same link. The task finds the earlier run and the RA panel offers **Restart from the beginning** or **Skip this task**. Both are logged.

## At the end

The last screen thanks them and shows the **study code** in large type. They press **Finish**, which leaves full screen.

1. Stop the AcqKnowledge recording and save it. Check the file name is the study code.
2. Remove the sensors. Offer the private room for the ECG stickers.
3. Debrief on paper and give them the resource sheet. Always ask **"How are you feeling right now?"** before they leave.
4. Grant the credit in SONA by hand. The in-person link does not grant it.

## Withdrawal

Participants can withdraw their data within one week by emailing the study, quoting their study code.

1. Forward the email to Norm. He removes their data from the platform.
2. You delete the AcqKnowledge file with that study code, and any copy of it.
3. Note the withdrawal on the log sheet, by study code only.

After a week the SONA link is deleted and the data can't be traced to anyone, so a later request can't be acted on.

## If something goes wrong

| What you see | What to do |
|---|---|
| "This link is not valid" or "has expired" | Make a new link for the same SONA ID. |
| The screen is stuck on "Loading…" for more than a minute | Check the internet connection, then reload the page (F5). It resumes where it was. |
| A film or recording doesn't start and a **Play** button appears | Press it. Chrome sometimes blocks sound until someone clicks. |
| A film freezes for more than a few seconds | RA panel → **Pause**, then **Resume**. If it still doesn't play, **Skip to final questions**. Note the study code and the time on the log sheet. |
| A participant is upset | Follow the Distress Protocol. Pause first. |
