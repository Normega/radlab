# Lecture Lounge: Phase 1 Implementation Brief

For Claude Code, working in Normega/radlab (main branch). Canonical spec: website.md section 29. Read that section in full before starting. This brief covers Phase 1 only.

## Step 0: Mandatory status audit (before any code)

Report findings before implementing:

1. Confirm website.md section 29 exists and matches this brief. If missing or conflicting, stop and ask.
2. Check for any existing tables or migrations named classes, class_admins, class_members, lectures, checkins, checkin_responses, class_questions. Report collisions.
3. Confirm current auth flow, profiles table shape (points column present?), and how Still Water awards points. Reuse that pattern.
4. Locate WheelSVG (Still Water circumplex) and BaseAvatar. Confirm props needed to render a static avatar from stored avatar config.
5. Confirm Resend email pipeline: how existing magic-link or branded emails are sent (Edge Function name, template location).
6. Confirm Supabase Realtime is enabled on the project and note any existing channel naming conventions.
7. Report the current React Router route registration pattern and admin gating pattern.
8. Check whether a QR code library is already in package.json; if not, propose one (small, maintained) before installing.

## Phase 1 scope

In scope:
- Schema + RLS for all eight tables (create class_questions and question_votes now even though lifecycle UI is Phase 2)
- Join flow + utoronto email verification
- Web console: class/lecture/check-in planning (out-of-class surface)
- Mobile remote: instructor's in-class surface (check-in queue, open/close, live counter, connection indicator, wake lock, auto-close countdown)
- Projector screen view: zero-interaction ambient display with QR code
- Student check-in flow: mood (single tap, self-in-aggregate result), pacing, prompt response, question submission
- Broadcast state machine driving all three non-console surfaces
- Results view (mood plot with own dot, pacing distribution)
- 5 platform points per completed check-in

Design principle: in-class experience is phone-first for instructor and students. The instructor never juggles browser tabs mid-lecture; they open the screen view once on the lectern and drive everything from their phone.

Out of scope (do not build):
- Quiz activity type
- Question publish/upvote/answered UI
- Claude summarization Edge Function
- Avatar wall presence (screen view shows a calm placeholder while idle in Phase 1)
- Preview-as-student, quick pulse
- Participation matrix, CSV export, dashboard card
- Live emotes

## Work packages

### WP1: Schema and RLS

- One migration file creating: classes, class_admins, class_members, lectures, checkins, checkin_responses, class_questions, question_votes. Column definitions exactly as in website.md section 29.
- task_type style note: status columns are plain text, not Postgres enums (platform convention).
- RLS:
  - classes: readable by members and admins; writable by class_admins (creation by lab admins per existing admin gating pattern)
  - class_admins: readable by the admins themselves; managed by lab admins
  - class_members: students insert own row, read own row; class admins read all rows for their classes
  - lectures, checkins: class admins full CRUD for their classes; members read only checkins with status open or closed for display purposes
  - checkin_responses: student insert/update own row only while parent checkin status = open; unique (checkin_id, profile_id); class admins read all for their classes; students never read other rows
  - class_questions: students insert own while checkin open; students read own rows plus published rows; class admins read/update all for their classes
  - question_votes: students insert/delete own votes on published questions; counts readable by members
- Acceptance: RLS verified with two test users (member, non-member) and one class admin. Document the verification queries run.

### WP2: Join flow and email verification

- Route /class/:slug. Logged-out users hit existing login flow then return.
- Non-members see join screen (class name + join button; join_code entry if arriving without slug link is out of scope for Phase 1, slug link is the path).
- On join: insert class_members row, then prompt for utoronto email.
- Email validation: accept only utoronto.ca or mail.utoronto.ca domains.
- Verification: send magic link via existing Resend pipeline to the utoronto address; clicking sets utoronto_verified_at. Token expiry 24h. Follow the existing branded template pattern.
- Unverified members can still respond to check-ins. Show a small persistent "verify your utoronto email" banner until verified.
- Acceptance: full join, verify, rejoin cycle works; wrong-domain email rejected with clear message.

### WP3a: Web planning console

- Route /class/:slug/console, gated by class_admins for that class (404 or redirect otherwise). Desktop-oriented.
- Planning view: tree of lectures (create/edit: number, title, date) and check-ins per lecture (create/edit: position, config, optional auto_close_seconds).
- Check-in config editor: toggle and order activities (mood, pacing, prompt with text field, question_box). Quiz toggle visible but disabled, labeled Phase 2.
- No live controls needed here in Phase 1; the remote is the live surface.
- Acceptance: instructor can plan a lecture with 3 check-ins including one with auto-close set.

### WP3b: Mobile live remote

- Route /class/:slug/remote, same gating. Phone-first, one-thumb, big touch targets.
- Shows today's lecture (nearest lecture_date) with its check-ins as an ordered queue; current position highlighted.
- Per check-in: Open, Close, Show Results buttons; status badge; live response counter (Postgres Changes subscription on checkin_responses).
- Auto-close: when config has auto_close_seconds, opening starts a visible countdown; instructor can Close early or Extend (+60s). Closing is enforced server-side by timestamp comparison on submit, not client timers alone.
- Connection indicator: live / reconnecting, driven by Realtime channel status.
- Screen wake lock (navigator.wakeLock) while the remote is foregrounded; reacquire on visibilitychange.
- Only one check-in may be staged/open per class at a time; enforce in UI and with a guard on state transitions.
- Acceptance: full check-in run driven entirely from a phone-sized viewport, including auto-close firing and an early close.

### WP3c: Projector screen view

- Route /class/:slug/screen, same gating. Opened once before class, zero interaction after load.
- Auto-follows broadcast state: idle (class name, calm idle animation, QR code linking to /class/:slug), open (activity name, live response count, QR), results (same ResultsView aggregates as students, larger type).
- QR generated client-side (small dependency acceptable, e.g. a QR component; flag choice in the audit report).
- Wake lock while active. Layout readable from the back of a lecture hall: large type, high contrast within the design system.
- Acceptance: screen transitions through idle, open, results with no user input after initial load.

### WP4: Broadcast state and student view

- Realtime channel per class, name lounge:{class_id}.
- Remote broadcasts: staged, open, closed, results_ready, each with checkin_id payload. Screen and student views are consumers only.
- Student view (ClassRoom.jsx) is a state machine: idle (waiting screen with class name), open (CheckinRunner), closed (thanks/waiting), results (ResultsView).
- On mount or reconnect, fetch current state from DB (checkins where status in staged/open, most recent) so refresh restores state without waiting for a broadcast.
- Draft responses persist in component state through activity steps; a submit writes the full checkin_responses row (upsert on unique key so re-submit while open updates).
- Acceptance: three browser sessions (remote + screen + student) demonstrate the full loop; student refresh mid-poll restores correctly; screen recovers state after a reload.

### WP5: Check-in flow and results

- CheckinRunner renders the config activity sequence, one step per screen, phone-first portrait layout, one-thumb reach.
- MoodTap: compact circumplex wheel wrapping WheelSVG, single tap records {x, y, label}. Neutral center is a valid tap. No opt-out control.
- Pacing: 5-point tap scale, too slow to too fast.
- Prompt: text area, instructor prompt text above.
- Question box: text area, "ask the instructor a question" framing; inserts class_questions row (submit only, no lifecycle UI).
- On final submit: write response row, award 5 points via the existing points pattern found in the audit, show confirmation.
- ResultsView: circumplex scatter of all class mood taps with the student's own dot highlighted (accent pink, others gray); pacing distribution bar. Console can trigger results_ready to push students here.
- Acceptance: submitted mood appears in aggregate with own dot highlighted; points balance increments once per check-in (no double award on re-submit).

## Design system

- Background #FCF0F5, white cards, accent #f068a4, gray #abadb0
- DM Serif Display headings, Space Mono for counts/data readouts, DM Sans body
- Font floor 0.75rem
- Tone: quietly curious. Waiting screens should feel calm, not dead (subtle idle animation acceptable)
- Use actual RADlab_Logo.svg assets, never redraw

## Conventions

- created_at TIMESTAMPTZ DEFAULT NOW() on all tables
- Version-bump any touched shared files to bust mobile cache
- No service keys or secrets in client code
- Present changed files individually, not a repacked tarball

## Deliverables

1. Migration SQL file(s)
2. src/classroom/ components per the file structure in section 29 (Phase 1 subset: ClassRoom, ClassConsole, ClassRemote, ClassScreen, CheckinRunner, MoodTap, ResultsView, ConsoleLecturePlanner)
3. Route registrations
4. Short RLS verification log
5. One-paragraph summary of deviations from this brief, if any
