# Lecture Lounge: popcorn bowl while waiting (plan)

Status: **live 2026-10-21** (built and reviewed on `dev` via PR #11, then promoted). Backend live on `main`: `get_checkin_progress(uuid)`, `20261021_checkin_progress.sql`.

> **Changed while building: the count is polled, not presence.** Realtime counts every message *delivered* (Pro: 500/s, 2,500/s with no spend cap; over the limit, connections are dropped). A per-answer presence re-track fans out to every phone, so ~10 answers/s in a 250-seat room is ~2,500 messages/s, enough to knock the room offline mid-quiz. Instead each answered phone polls `get_checkin_progress` (a bare count; members, class admins and super admins only), from a random offset, every 4 s while it changes and easing to 15 s, skipped while hidden: about 50 cheap requests/s at most for 250 phones, and no new Realtime traffic. The room is still the existing presence list. The section "Where the numbers come from" below is the original design, kept for the record.

## What it is

After a student submits a check-in that is still open, the waiting card ("You're all set. Waiting for your instructor to close this check-in…", `ClassRoom.jsx` `renderCheckinArea`) shows a bowl filling with popcorn instead of the avatar wall:

- unpopped kernels = students in the room who haven't answered
- popped corn in the bowl = students who have
- line beneath: "142 of 198 in the room have answered · 72%"
- each new answer pops one kernel (a short hop-and-burst into the bowl)

Optional second surface: the projector's open-check-in view in `ClassScreen.jsx`, same component at a larger size.

## Where the numbers come from

Students can read only their own `checkin_responses` rows (RLS "own read"), so a phone can't count other answers from the table. Use **Realtime Presence**, which already carries every member with the lounge open (`useClassPresence`, channel `class:<classId>`, keyed by user_id):

- After `CheckinRunner` completes, the student re-tracks their presence payload with `answered_checkin: <checkinId>`.
- On reload, the existing `alreadyResponded` lookup (`ClassRoom.jsx` ~l.375) sets the same flag, so a refresh doesn't un-pop anyone.
- Every client computes `answered = present.filter(p => p.answered_checkin === liveCheckin.id).length` and `total = present.length`, from one list, so the numerator can't exceed the denominator.

No migration, RLS change or Edge Function, and nothing depends on the projector being open. Front-end only, so `dev` first.

Rejected alternatives:
- **A count RPC polled by phones**: about 200 phones every few seconds is constant DB load, and the denominator still has to come from presence.
- **The projector broadcasting the count**: it works only if `ClassScreen` is open, and the deck usually is what's on screen.

## Changes

1. **`useClassPresence.js`**: return `{ avatars, updateSelf }`. `updateSelf(patch)` calls `channel.track({ ...selfPayload, ...patch })` on the existing channel; keep the identity-only effect deps so the channel isn't torn down. Update both callers (`ClassRoom`, `ClassScreen`).
2. **`ClassRoom.jsx`**: when `alreadyResponded` turns true for the live check-in, call `updateSelf({ answered_checkin: liveCheckin.id })`. A new check-in id naturally resets everyone to "not answered".
3. **New `PopcornBowl.jsx`** (lounge folder): props `answered`, `total`, `size`.
   - SVG bowl, with popped pieces stacking to a fill height proportional to `answered / total`. Use at most about 40 kernels and pieces, scaled to the ratio rather than one per student, so it reads at phone width with 200+ students.
   - Pop animation on each increase; a CSS transform/opacity keyframe, no library.
   - `prefers-reduced-motion: reduce` turns it into a static fill and the number.
   - Colours are tokens (`var(--pk)`, `var(--bgc)`…), so the `/brand` drift ratchet doesn't move. Run `npm run audit:design:check`.
4. **Waiting card**: show `PopcornBowl` when `status === 'open' && alreadyResponded`. Keep the avatar wall for the idle, staged and closed states.

## Caveats to state honestly on screen and to Norm

- "In the room" means **the lounge is open on their phone right now**. A locked or backgrounded phone may drop out of presence, so the % can read high. Label it "in the room", not "in the class".
- Staff who have the student URL open are members and count in the total; this is negligible.

## Test before any lecture

- **Load.** Script about 200 simulated presence clients (anon-key Realtime, as the original presence verification did) joining, then re-tracking `answered_checkin` within 60 s.
  - Confirm syncs arrive, and look for any Realtime rate-limit or presence-quota errors.
  - The lobby already survives about 200 joins; the re-track burst is the new part.
- **Arrival animation.** Check that a re-track doesn't re-fire `AvatarWall`'s arrival animation (it should key on user_id, but verify).
- **Reload.** A student who reloads mid check-in reappears as answered.
- **Next check-in.** Opening the next check-in resets the bowl to all kernels.
- **Live run.** Run it on the dev site with a dummy class (not PSY240) and 2 or 3 real phones before promoting.

## Done when

On `dev`, tested as above, website.md's Lecture Lounge section updated, then promoted to `main` on Norm's approval on a non-lecture day.
