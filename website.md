# RADlab Platform — Design & Architecture Decisions

> **Regulatory and Affective Dynamics Lab**  
> University of Toronto · PI: Professor Norman Farb, PhD  
> Last updated: 2026-07-14 (**Ripple WP6 complete** — email reminders: new `ripple_reminder` Edge Function (hourly window-based send via Resend, `morning` 8 AM / `midday` 12 PM / `evening` 7 PM Toronto; cadence-aware dedup via `last_reminder_sent_on`), `handle_ripple_unsubscribe` Edge Function, `ripple_unsubscribe_tokens` table, `_shared/rippleUnsubscribeToken.ts` helper; profile UI: email reminder toggle + time-of-day picker (shown when check-in enabled and cadence ≠ 'never'); `Unsubscribe.jsx` now tries `handle_ripple_unsubscribe` first (returns `{status:'token_not_found'}` on a miss — 200 not 404 so the page can fall through cleanly) before falling back to `handle_unsubscribe` for study tokens; migrations `20260714_ripple_wp4_intentions.sql` and `20260714_ripple_reminders.sql` written, **both not yet applied**; pg_cron wiring needs one manual SQL step in the Supabase editor (see migration comments). Build clean. Prior update: **Ripple WP4 complete** — micro-intentions + intention follow-up + game suggestions added to `CheckinFlow`; `prompt_cadence` setting added to `/profile` Ripple section + cadence-aware `RippleSection` on Dashboard; migration `20260714_ripple_wp4_intentions.sql` written, **not yet applied**. Prior update: **`/ripple/settings` merged into `/profile`** — `RippleSettings.jsx` deleted; Ripple name edit, streak stats, and check-in toggle absorbed into `/profile` as a new `// Ripple` section above Points & Progress; Dashboard "settings →" and "Manage →" links now point to `/profile`; "Edit Ripple" button on profile avatar card renamed "Edit avatar" to reduce confusion. Prior update: **Ripple WP4 complete — `/ripple/settings` + disable path**) — new `RippleSettings.jsx` at `/ripple/settings` (lazy, inside existing `ErrorBoundary label="Ripple"`): shows `RippleAvatar` (neutral pose) + editable Ripple name (inline text input, Enter/Escape, saves to `ripples.name`) + streak/best/check-in-count stats + `check_in_enabled` toggle (ON/OFF pill, saves to `ripples.check_in_enabled`); paused state copy: "your data is safe and your streak is saved." Dashboard `// Ripple` section now routes through `RippleSection` which fetches `check_in_enabled` once and either renders `RippleGreeting + RippleCard` (enabled) or a quiet "Check-ins are paused · Manage →" line (disabled); "settings →" link appears inline beside the `// Ripple` section label. Migration `20260714_ripple_settings.sql` (adds `check_in_enabled boolean NOT NULL DEFAULT true` to `ripples`) applied 2026-07-14. Build clean. Prior update: **Ripple WP5 mood trends on Dashboard** — `RippleCard` now adapts to check-in history: 0 check-ins → onboarding prompt; 1 → single dot + composite label (unchanged); 2+ → circumplex scatter (all dots, most recent highlighted) + VALENCE/AROUSAL sparklines (reusing existing `SwMoodGrid`/`SwLinePlot` primitives) + stat row showing check-in count, most-often label (mode), and today's label. Fetch expanded to last 30 check-ins ascending. Build clean. Prior update: **Ripple WP4 login greeting** — `RippleGreeting` component on Dashboard fades in above `RippleCard` with a context-driven headline + subtitle. Template matrix in `src/ripple/greetings.js`: primary branch on `daysSinceLast` (null/0/1/2–6/7+), secondary on last composite quadrant (energized/settled/low/on_edge/neutral), milestone branch (7/14/30-day streaks) with arousal-trend-modulated tone (high→energetic, low→understated), derived from mean `composite_y` of last 7 check-ins. All lines non-punitive: gaps welcomed not shamed, states treated with equal warmth. Picks are day-stable (seed = floor(Date.now()/86400000)) so the line is consistent across page loads within a day. Build clean. Prior update: **Ripple WP3 complete + WP4 rotating item engine** — `CheckinFlow` now routes through an optional `items` phase (0–2 VAS questions drawn between the two circumplex steps and the reveal). New `src/ripple/itemEngine.js`: versioned item bank (`BANK_VERSION = 1`), two pools — stress (cadence 2, 3 items) + life satisfaction (cadence 3, 3 items) — sampled without replacement per pool; `drawItems(itemState)` increments `checkinsSinceLast` per pool, draws when cadence met, reshuffles exhausted pool (increments `cycle`), respects a 2-item friction budget per check-in; `formatItemResponses()` stamps `bank_version`, `pool_id`, and `item_id` on every response for longitudinal safety. `CheckinFlow.jsx` gains `ItemStep` (7-point interactive dot scale, left/right label anchors, "See result →" on final item); `ripples.item_state` now fetched on mount alongside `name`; after phase 2 confirm items are drawn and flow routes to `'items'` or straight to `'reveal'` depending on count; responses saved to `ripple_checkins.items` jsonb + `ripples.item_state` updated in the same save effect; `RevealStep` stats card shows drawn items (pool label + n/7) between circumplex rows and streak/points. No new migration — `ripple_checkins.items` and `ripples.item_state` jsonb columns already existed from WP1. Build clean. Prior update: **U of T Student Equity Census + admin "Advanced (coded)" instruments tab** — the Questionnaire Library (`/admin/questionnaires`) now has Standard (JSON) / Advanced (coded) tabs; the Advanced tab lists every bespoke React instrument from the new registry `src/components/study/advancedInstruments.js` (policy: all coded instruments must register there so they stay reviewable — nothing lives only in the codebase), with live no-write previews at `/admin/questionnaires/advanced/:key` for demographics, compensation, and the new instrument. New `EquityCensusStep.jsx`: faithful 2025-2026 U of T Student Equity Census (8 sections, every question offers exclusive "Prefer not to answer", hierarchical race/ethnocultural subcategories, conditional disability/Indigenous follow-ups), stored as jsonb in `equity_census_responses`; migration `20260713_equity_census.sql` (table + RLS mirroring `demographics` + `form/equity_census` activities row) applied via MCP and verified live 2026-07-13 at merge. See §23. Prior update: **ColorMax results cleanup + admin Quick demo mode** — ColorMax results screen decluttered per Sandy's feedback: thin/thick/eraser time row removed from the display (still recorded in `aptitude_sessions.results.toolTime` for analysis), "Overall Score" heading added above the stat tiles, and a "Coverage / Precision" column label now sits over the per-image values so the paired percentages are self-explanatory. New **admin quick-demo mode**: `/admin/games` cards for the three session-timer games (AptitudeSuite 8:00, WordMax 5:00, ColorMax 5:00) gain a "Quick demo →" link beside Review that opens `/games/<slug>?demo=1`, cutting the session timer to 20 s so reviewers reach the results screen fast — new `src/lib/demoMode.js` helper; `useGameTimer`/`useSessionTimer` hooks now accept a `durationMs` override; ColorMax computes `totalSecs` in-component. Demo is never honored in study mode (`studyMode`/`studyId`/`isSimMode` gates), and demo sessions save to the DB exactly like Review plays. Build + lint clean; verified via static markup harness (no admin credentials in this environment for a live click-through). Prior update: Mirror field-tuning from first real belt recordings: fixed calibration confidence stalling at ~33% (rhythm gate was double-counting breaths via naive peak-picking → now detrended zero-crossings, validated 27→12 bpm; tracking now lag-aligned + up-weighted; gates softened), added an always-visible head outline so materialization reads as "empty circle → face inside it", auto-run the breath-follow avatar (`AvatarBreathPacer` never started its RAF without `resumeAnimation` — froze both the lab preview and `/demo/mirror` PLAY), and a calibration-trace export for offline confidence tuning. 27 headless checks; browser sim smoke green. See Mirror §. Prior same-day update: **Ripple WP3 reveal enhanced + Dashboard RippleCard + landing redirect** — `RevealStep` now shows StillWater-style side-by-side layout: `WheelSVG` with `revealData` highlighting composite sector+zone, animated `RippleAvatar` (136px), stats card with energy/tension step breakdown + streak + +5 points; Ripple name shown in heading fetched on mount from `ripples.name`; `saveCheckin` now returns `{ newStreak, newBest, pointsTotal }`. Dashboard gains `RippleCard` above the games grid (name, streak badge, `SwMoodGrid` mini-map of last check-in composite, "Check in now →" link). Logged-in users hitting `/` are now redirected to `roleToPath(role)` via `PublicOnlyRoute` instead of seeing the landing page. Build clean. Prior update: **Ripple WP3 check-in core complete** — `CheckinFlow.jsx` two-diagonal circumplex (WheelSVG + `computeRating`, FACS reveal via `calcExpr` driving `RippleAvatar`); saves to `ripple_checkins` with write-time streak logic + `profiles.points` (+5); wired into `WelcomeFlow` as the final onboarding step (context='onboarding') and as standalone `/checkin` ProtectedRoute (context='manual'); `CheckinFlow` emits as its own chunk. No new migration — schema from WP1. Build clean. Prior update: **Ripple WP2 code complete** — `RippleAvatar` unified component (FACS expression engine + species/hair system at neutral v=0, a=0 is visually identical to BaseAvatar); `WelcomeFlow` CUSTOMIZE + NAME steps replace the WP1 bridge placeholder (skin/eye swatches → Ripple name → `onboarding_complete=true`); `RippleName` migration beat at `/ripple/name` for existing users whose `ripples.name IS NULL`; BaseAvatar swapped for RippleAvatar in Nav, ProfilePage, AvatarEditor preview, AvatarWall; `needsRippleName` guard added to `ProtectedRoute`; `checkRippleName()` called from `fetchRole` after role resolves; build clean — `RippleAvatar` and `RippleName` emit as separate chunks. Not yet click-tested live. Prior update: **Avatar → Ripple UI rename** — all user-visible "avatar" copy replaced with "Ripple" across 9 files; §13 "Edit Ripple" button label updated to match. Prior update: **Signup already-registered fix + super-admin /admin/users** — Signup.jsx now detects Supabase’s anti-enumeration fake-success for existing emails (empty `identities`) and says so instead of showing a false "check your email"; new super-admin-only user management page (list, lab↔public role toggle, type-to-confirm transactional delete) backed by `20260712_admin_user_management.sql` (NOT yet applied), built to unblock Ripple test-account cleanup. Prior update: **Ripple WP1 code complete** — `/welcome` onboarding flow (consent + minimal ToS + demographics) for new public-tier users plus the `20260712_ripple_wp1.sql` migration (`ripples`/`ripple_checkins`/`consents`), which is written but NOT yet applied to the live project; spec gained the eight design guardrails + growth-partner relationship model after a comparative review (Finch, AI-companion literature). Prior update: **Ripple (Wellness Buddy v2) design brief authored** — the platform's merged avatar/companion, named Ripple, becomes the default onboarding + login concierge for the public tier; full spec in `docs/markdowns/ripple_spec.md`, roadmap P1 restructured into WP1–WP6. Prior update: **Avatar wall confirmed working live with two real accounts** — Norm signed in with a second account and both could see both avatars update in real time. His initial "I don't see the wall" report was the `results_ready`-forever bug below, not the wall; once past that, the actual remaining issue was UX clarity — a single avatar with no label doesn't read as "a live wall of who's here." Added a small count label (`AvatarWall.jsx`, "N people here" above the grid) so even one avatar is unambiguous. Prior same-day update: **Bug found live testing the avatar wall: no way back to the lobby**, closed same-day with a small backend addition. Norm reported not seeing the wall on class `n3` after a refresh; root cause was one level up from the wall itself — `ClassRoom`/`ClassScreen` restore their state on load by picking the most-recently-touched non-planned checkin with no time cutoff at all, so a checkin left in `results_ready` (nothing else ever resets it) restores as "the live one" forever, and the true idle/lobby view — where the wall renders — becomes unreachable after the first check-in of a term. Confirmed live: class `n3` had **three** stale `results_ready` checkins from Norm's own earlier test session blocking it. Fixed with `checkins.dismissed_at` (migration `20260713_checkin_dismiss.sql`, no RLS change needed — the existing whole-row admins policy already covers it) plus a new `dismissed` broadcast event (not a checkin status — `ClassRoom`/`ClassScreen` treat it as "go straight to no live checkin" rather than a status object) and a "Back to lobby" button on the remote for `results_ready` checkins; both restore queries now filter `.is('dismissed_at', null)`. Dismissed the three real stale checkins on `n3` directly as part of the fix. Prior update: 2026-07-12 (**Phase 2: avatar wall presence shipped** — fourth of five Phase 2 items, chosen after the quiz activity type; only Claude summarization is left. New `useClassPresence` hook wires up Supabase Realtime **Presence**, which had zero prior art anywhere in this codebase (every other Lecture Lounge live-update path uses broadcast or postgres_changes) — verified the mechanism itself directly against this project with two independent anon-key clients (a writer `track()`s, a reader's `sync`/`join` events land with the right shape, `presenceState()` groups correctly by an explicit key) before wiring it into any component, same bar as broadcast got in Phase 1. Each present class member tracks their own avatar config (`skin_color`/`eye_color`/`species`/`hair_style`/`hair_color`/`aura`, pulled from the existing `avatars` table via the already-shared `useAvatarConfig` hook) onto a `class:{id}` channel — no new RLS needed anywhere, since presence relays opaque payloads client-to-client over the realtime pub/sub layer rather than reading other users' rows from the database at all. New `AvatarWall.jsx` renders the resulting list as a `BaseAvatar` grid (wrapping `SyncAura` when a member's aura cosmetic is enabled) with a pop-in arrival animation, shown in the existing idle/lobby branch of both `ClassRoom` (student, tracks + renders) and `ClassScreen` (projector, read-only — reads presence without tracking itself, since it isn't a "member"). One real gap caught before shipping, not by code review: gating presence tracking on a student having an `avatars` row would have made the wall nearly empty in practice — a live count showed only ~12% of `profiles` (14/116) have ever customized one, since most students land on Lecture Lounge as brand-new radlab signups who've never touched the avatar editor. Fixed by falling back to `BaseAvatar`'s own built-in defaults (`{}` spread) rather than requiring a row to exist, so every member shows up in the wall regardless. **Not yet click-tested through an actual browser** — same standing limitation as the rest of Lecture Lounge (no test login credentials in this environment); verification here was the two-client presence smoke test plus a clean lint+build. Prior update: 2026-07-12 (**Phase 2: quiz activity type shipped** — third of five Phase 2 items, chosen after question publish/upvote. Norm chose a staged, Peer-Instruction-style reveal over an immediate one (distribution shown first, instructor taps to reveal the correct answer as a separate step) — this drove the whole design, since it means the correct answer can never reach a student's client before that tap. It can't live in `checkins.config` (students already read that column directly today for every other activity type) or in any row a student can `SELECT` at all, so correct answers get their own table, `checkin_quiz_keys` (migration `20260713_lecture_lounge_quiz.sql`), with **no student-facing RLS policy whatsoever** — the only path to them is a new SECURITY DEFINER RPC, `get_checkin_quiz_results`, which always returns the questions/options and server-aggregated per-option vote counts (safe), but only includes the `answer_key` once `checkins.quiz_revealed_at IS NOT NULL` or the caller is an admin. Counts are aggregated server-side in SQL rather than shipping raw per-student answers the way the existing mood/pacing RPC does — quiz correctness felt more sensitive than a mood tap. `checkins` was added to `supabase_realtime` so `ResultsView`'s new `QuizResults` sub-component can pick up the reveal live via `postgres_changes` (no new broadcast event needed, no prop plumbing since it only needs the already-available `checkinId`) — same live-update technique proven for the question feed the day before. Console gets a `QuizItemsEditor` (2-6 options per question, radio for the correct one, ids random not position-derived so removing then re-adding a question can't collide); on save, `{id, text, options}` goes to `checkins.config.quiz_items` (public) while `{id: correctIndex}` goes to `checkin_quiz_keys` (admin-only) in a second write. Students answer all questions on one screen (`QuizTap` in `CheckinRunner.jsx`), submitted as `checkin_responses.quiz_answers` alongside mood/pacing/prompt in the existing single upsert. Instructor gets a "Reveal quiz answers" button on the remote once a quiz check-in reaches `results_ready`. **Verified live end-to-end** on class `n2` with real accounts (a real non-lab `class_admins` instructor, a real student profile added to `class_members` for the test, both removed after): instructor created a checkin + quiz key, student submitted an answer, RPC returned counts with `answer_key: null` pre-reveal (and confirmed a direct `SELECT * FROM checkin_quiz_keys` as the student returns zero rows — RLS, not just the RPC, blocks it), instructor closed → showed results → revealed, RPC then returned the real answer key to the student. All test rows cascade-deleted, confirmed via count queries; real class data untouched throughout. **Not yet click-tested through an actual browser** — same standing limitation as the rest of Lecture Lounge (no test login credentials in this environment). Prior update: 2026-07-12 (**Phase 2: question publish/upvote/answered lifecycle shipped** — second of five Phase 2 items, chosen after participation matrix. Backend was mostly already in place from WP1 (`class_questions`/`question_votes` schema + most RLS, `QuestionBoxTap` already inserted submitted questions); two gaps found building the instructor side and closed in `20260712_question_lifecycle.sql`: (1) `question_votes: members read` only checked `class_members`, missing the `lab role/super_admin` clause every other Lecture Lounge table already has (same lab-admin-parity bug class as 2026-07-11's, just missed on this table since Phase 1 built no UI needing it yet) — without it the instructor's live feed couldn't read vote counts to sort by upvotes; (2) `class_questions` was never added to the `supabase_realtime` publication (only `checkin_responses` was, in WP1), needed for the remote's live question feed. `ClassRemote.jsx` now embeds `checkins(*, class_questions(*))` in its lecture query and subscribes to `postgres_changes` INSERT on `class_questions` scoped to the open check-in for live incoming questions; each check-in card gets a Questions section (only shown when the check-in's activity list includes `question_box`) with Publish/Mark answered buttons, published questions sorted by vote count. `ResultsView.jsx` gains a `QuestionsList` sub-component shown to students (own device, interactive vote toggle) and on the projector screen (`session` prop omitted there, so it renders read-only vote counts automatically) — shows the student's own submitted question's moderation status (under review/published/answered) plus the published list sorted by votes. Verified via SQL: confirmed all four `class_questions`/`question_votes` policies present with the intended `USING`/`WITH CHECK` expressions (including the pre-existing lab-parity on `class_questions: admins update`), and both tables present in `supabase_realtime`. **Not yet verified**: real authenticated click-through of publish/vote/answer (same limitation as the rest of this feature area — no test login credentials in this environment; every check here was SQL-impersonation/policy inspection plus a clean lint+build). Prior update: 2026-07-12 (Lecture Lounge post-Phase-1 fixes + **Phase 2 started**. Live testing (two real accounts, one deliberately unable to verify since only one real utoronto address exists) caught two real bugs: `MoodTap.jsx` passed `activeIds={null}` to `WheelSVG` intending "no restriction," but that's actually the component's non-interactive *display* mode — its click handler is hard-gated on `activeIds !== null`, so the whole mood wheel was permanently unclickable; fixed by passing every emotion id explicitly. Separately, `ResultsView`'s circumplex scatter positioned dots by literal valence/arousal, but `WheelSVG` draws each emotion's wedge at a fixed *angular* slot that doesn't correspond to that emotion's actual valence/arousal (confirmed numerically — Alert's wedge points straight up, its valence/arousal would plot up-and-left) — dots landed in the wrong wedge relative to the background grid. `get_checkin_mood_results` now also returns `emotion_id`/`zone`; dots position via the wedge's own angle+zone geometry instead, with a small random jitter added since there are only 25 possible mood positions and identical taps were silently stacking into what read as an averaged dot. Confirmed live: unverified accounts fully participate and earn points — `utoronto_verified_at` was never meant to gate participation, only to link an account to a confirmed utoronto address for later attendance/grade export. Also a **performance pass**: traced (not just masked with a loading screen) why Lecture Lounge pages felt slow — `ClassAdminRoute` resolved the class for its own admin check then discarded it, so console/remote/screen each re-fetched the identical row; the guard itself ran class-lookup and profile-role-check sequentially though they don't depend on each other; `/remote` and the console fetched lectures then checkins as a dependent second round trip; `ClassRoom` gated its check-in-restore query on membership resolving first even though RLS already enforces that server-side. Fixed via `Outlet` context (resolved class shared instead of re-fetched), parallelizing independent fetches, and combining lectures+checkins into one embedded query — roughly halves the sequential round trips on every one of the four pages. New: a reusable `QrDownloadButton.jsx` exports any class's join QR as a PNG (white background, for embedding in slides — SVG-to-canvas conversion tested directly in a real browser) on `/lecture-lounge/admin`; noted an **instructor onboarding email package** (all four links + QR + training link, not started) on the roadmap for later. **Phase 2 begun**: participation matrix + CSV export shipped first (of five Phase 2 items) — console gains a Planning/Participation tab, matrix of members x lectures (cell = check-ins responded that day), CSV keyed to `utoronto_email` with unverified rows flagged, backed by a new `get_class_participation` RPC (same narrow-SECURITY-DEFINER pattern as `list_class_admins` — `profiles` has no policy letting a non-lab class admin read another student's `utoronto_email`). Remaining Phase 2: Claude summarization, question publish/upvote lifecycle, avatar wall presence, quiz activity type. Prior update: 2026-07-11 (**Lecture Lounge Phase 1 complete** — WP3b (mobile remote at `/class/:slug/remote`), WP3c (projector screen at `/class/:slug/screen`), WP4 (broadcast state machine), and WP5 (check-in flow + results) now shipped on top of WP1–WP3a. `ClassRoom.jsx`/`ClassScreen.jsx` are real state machines (idle/open/closed/results_ready) driven by broadcasts on a per-class `lounge:{class_id}` Realtime channel — the remote is the sender, screen and student are consumers only, both restore state from the DB on mount so a refresh never needs to wait for a broadcast. `CheckinRunner.jsx` dispatches the configured activity sequence (mood via a new `MoodTap.jsx` wrapping Still Water's `WheelSVG`, pacing, prompt, question box) with a single upsert on the final step; `ResultsView.jsx` renders the anonymized aggregate (own dot highlighted) via WP1's `get_checkin_mood_results` RPC, reused as-is (scaled 1.6x) on the projector screen. Two DB hardenings added for WP3b's explicit brief language ("guard on state transitions", "not client timers alone"): `enforce_single_live_checkin` BEFORE UPDATE trigger on `checkins` (DB-level, survives two remote tabs racing), and `checkin_responses` write policies independently check the auto-close deadline (`opened_at + auto_close_seconds`) so a late submission is rejected even if the client-side countdown never got to flip `status` itself — both reproduced live via SQL impersonation (conflicting transition raises `P0001`; late submission rejected with status still `'open'`). QR via `react-qr-code` (SVG, no canvas dep) — the only new runtime dependency added across all of Phase 1. The Realtime broadcast mechanism itself had never been used anywhere in this codebase before now — tested end-to-end with two independent anon-key clients (send on one, receive on the other) before wiring it into any component. **Not yet verified**: the full three-surface loop (remote + screen + student) has never run through actual authenticated browser sessions — every verification this session was either SQL-impersonation at the data layer or an unauthenticated-route Playwright smoke test, since no test credentials are available in this environment; that live click-through is the natural next step. Prior same-day update: Lecture Lounge Phase 1 WP1–WP3a implemented and verified live (see §29 for corrected schema/status — the section below still reads as the pre-implementation design doc in places): 8-table schema + RLS (`supabase/migrations/20260710_lecture_lounge_schema.sql` + three same-day follow-ups), join + utoronto verification flow, per-class planning console at `/class/:slug/console`, and a lab-wide admin screen to create classes and assign instructors. **Verification redesigned mid-build from per-class-membership to per-account** (`profiles.utoronto_verified_at`, not `class_members` — the schema table in §29 below is now stale on this point): proving utoronto ownership once now covers every class joined afterward with that account, closed via a BEFORE UPDATE trigger (RLS's broad `profiles: own update safe` policy can't take a column-level restriction without breaking avatar/points updates). Class management lives at a standalone `/lecture-lounge/admin`, deliberately not `/admin/classes` — own route, own layout (`Nav` + plain wrapper, not `AdminLayout`), own guard (`LectureLoungeAdminRoute`, independent of `AdminRoute`), own error boundary, own bundle chunk group — a firm partition from research admin per Norm's explicit ask, now the reference pattern for any future feature area needing the same isolation (see CLAUDE.md's new "Route code-splitting convention" section). Five real bugs found and fixed during live testing, none caught by code review alone: (1) a pre-existing, unrelated site-wide crash — `MirrorCalibration.jsx`/`mirrorCalibration.js` case-collision import resolved to the wrong file, `npm run build` had been failing since the Mirror commits landed and Vercel had been silently serving a stale deploy for some time; (2) `lectures`/`checkins`/`class_questions` RLS policies only checked `class_admins` membership, missing the `OR lab role/super_admin` clause `classes` itself had, so a lab account passed the UI gate but every write silently failed — `ConsoleLecturePlanner` also never checked `{error}` on any mutation, compounding the silent failure; (3) `AdminRoute` (pre-existing) and `ClassAdminRoute` (new) both treated `session === undefined` (still loading) the same as logged-out, causing a `/login` flash that tripped the existing lab-role redirect back to `/admin` — any cold `/admin/*` load was affected, not just Lecture Lounge; (4) the original WP2 RLS policy let a client set its own `email_verify_token` via direct UPDATE and self-verify without ever receiving mail — closed same-day, before any real use; (5) the join button threw a raw duplicate-key error on a stale already-joined page instead of recovering. Separately, a **site-wide performance audit** (prompted by the slowdown these additions made newly visible) found zero code-splitting existed anywhere in the app — one ~782 KB gzipped entry bundle shipped to every visitor on every route. All non-Landing routes converted to `React.lazy()`; entry bundle now ~70 KB gzip + a shared ~122 KB vendor chunk, 121 chunks total, verified live via bundle-hash polling and a 9-route Playwright smoke test. Also uncovered but **left unresolved**: a ~260 KB gzip minification regression in the pre-1.0 Rolldown bundler (`vite@8.0.3`, `rolldown@1.0.0-rc.12`) — every top-level function/component name across the whole app stops being mangled once the module graph crosses some threshold, reproduced against the exact pre-Lecture-Lounge commit in an isolated worktree, confirmed NOT fixed by `build.minify: 'esbuild'` or upgrading to Vite 8.1.4; matches open upstream issue `vitejs/vite#22007`. Fixing it for real means a deliberate decision to downgrade to stable Vite 5/6 + Rollup — not attempted. Prior update: 2026-07-10 (New §29 Lecture Lounge — classroom engagement system designed and documented: three-surface model (student phone / instructor phone remote / projector screen) off one broadcast channel, 8-table schema, avatar-only identity, polling-window knowledge checks, instructor-gated question publishing with upvotes, Claude summarization Edge Function (first platform Anthropic API use). Part IV renumbered: Key Learnings §29→§30, Roadmap §30→§31; P4 roadmap resolved to full rebuild. Not yet implemented; Phase 1 brief in docs/markdowns/. Prior same-day update: Mirror — breath-driven avatar + adaptive materializing calibration on the shared breath layer, live at `/demo/mirror` (+ `/dev/breath-lab` preview with a Mirror/Standard mode selector). New `mirrorCalibration.js` (pure, 25 headless checks): live amplitude auto-ranger (fixes frozen-calibration clip on a breath-driven pulse), composite calibration-**confidence** engine (tracking·clarity·axis-lock·strength, gated by rhythm+motion, weakest-factor-routes-coaching), running-PCA projector, and an adaptive stop-policy session. `MirrorCalibration.jsx` materializes the avatar (ghost→solid as confidence climbs) and coaches live on stall. `useBreathSignal` gains opt-in `mirrorMode` (auto-ranged `value`) + `beginMirrorCollection`/`acceptMirrorNow` (confidence-driven stop, not the fixed 4-breath timer); `AvatarBreathPacer` gains `getLevel` (avatar tracks live breath). **Ember/BreathBelt untouched** (default off). Verified: build clean + Playwright sim smoke (materialize 0→100 %, converge, pulse preview, no errors). See breath-signal-layer §. Prior update: 2026-07-09 (New §26a — canonical documentation of Liliana Study 3: the 27-day design (counterbalanced Phase 1, three-arm midpoint with anti-preference No-Choice, quality metric v1/v2) and the WP-L1…WP-L5 infrastructure (capture linkage, scoring backend, MidpointStep, dry-run findings, migration list). Prior same-day update: WP-L5 of the Liliana feedback plan, dry run: all 36 missing daily templates generated (48/48), dry-run study authored programmatically (graph validated with the real `experimentGraph.js`, 51 sessions compiled, 27-consecutive-day calendar pending Liliana's confirmation), 3 participants enrolled via real `auto-enroll` (3 distinct counterbalance orders, walk stopped at fork), one full training session and **all three midpoint arms click-tested in a real browser through real participant links** — feedback cards matched designed data, anti-preference reveal correct. **Five launch-blocking bugs found and fixed**, none reachable from admin demos: token RPC couldn't serve training nodes; `scheduleId` never passed by SessionEntry (WP-L1 linkage silently null); global-anon-client use across the whole training stack (saves + authenticated-only video/audio buckets); `liliana_participants` never created / `current_day` never advanced (new `ensure_liliana_participant` RPC); a lazy supabase-js builder meant `shown_at` never stamped. Phase 2 cron advance verification + export coverage pending. See spec doc WP-L5 status. Prior same-day update: WP-L4 of the Liliana feedback plan: `MidpointStep.jsx` — new `midpoint` step category (StepDispatcher case, SessionBuilder picker, `activities` row `midpoint/liliana_midpoint`), three-arm midpoint experience: feedback→choice / control→choice / control→preference→**anti-preference assignment**. Group mechanics finalized by Norm same day, replacing the balanced-owl-draw design for the No-Choice arm: participant states a preference, then is assigned to one of the two **non-preferred** practices 50/50 (never the preferred), owl frames it as growth outside the comfort zone. Backend reworked to match (migration `20260709_liliana_midpoint_choice_rework.sql`, applied + verified live: `stated_preference` recorded for all three groups, `record_practice_decision(p_practice, p_source, p_node_id default null)` auto-detects the fork node from `design_graph` and does the seeded 50/50 server-side, `participant_assignments.kind` gains `'anti_preference'`). `liliana_midpoint` step appended to the "Liliana Study 3 - Midpoint" template (after the assessment questionnaires). All participant-facing copy is placeholder pending Liliana. Not yet click-tested with a real participant link — that's the WP-L5 dry run. Prior same-day update: WP-L3 of the Liliana feedback plan: scoring backend implemented, applied, and verified live against synthetic data — `liliana_session_metrics` view (six ratings pivoted + delta_stress/appraisal, linked to condition by (profile, module) via the schedule's template training node), `liliana_midpoint_feedback` snapshot table (RLS: participant SELECT own, writes RPC-only), `get_liliana_midpoint_summary()` (metric v1 = within-person z-blend of stress relief + appraisal, v2 = Δstress stored alongside; idempotent snapshot; deterministic tie-breaks), `record_practice_decision()` (choice writes a `kind='choice'` `participant_assignments` row the existing materializer routes; owl stamps the drawn value), and `draw_assignment` patched so choice rows don't consume permuted-block cycle positions (verified: draw_index 0 after a coexisting choice row). Two schema fixes caught live: kind CHECK + schedule-FK ON DELETE. Migration `20260709_liliana_feedback_backend.sql`. See §26 Daily check-in capture / spec doc. Prior same-day update: WP-L2 of the Liliana feedback plan: all 11 existing Liliana daily-training session templates converted from six single-scale VAS check-in steps to the two canonical packages (`Check-in (pre) → training → Check-in (post)`) — the single-scale shape would have defeated WP-L1's pre/post stress disambiguation; `/admin/training` wrapper demo now renders the live packages through the real `VasRenderer` (placeholder valence/energy/stress sliders deleted) — see §26 Daily check-in capture. Prior update: 2026-07-08 (WP-L1 of the Liliana feedback plan (`docs/markdowns/liliana_feedback_spec.md`): `vas_responses` gained `schedule_id` + `package_slug` (migration `20260708_vas_schedule_linkage.sql`, applied), `liliana_day_data` gained a `module_id` condition stamp, and `scheduleId` is now threaded StepDispatcher → VasStepWrapper → VasRenderer, so daily pre/post check-in ratings are attributable to a specific study day and the twice-per-session stress item is disambiguated by package. Canonical check-in contents = VAS packages `liliana_pre_intervention_ratings` / `liliana_post_intervention_ratings` (confirmed in live DB); the `wrapperElements.js` check-in items are placeholders superseded by those packages. See §26 Daily check-in capture. Prior same-day update: Training §26: the four standard session wrapper elements — Welcome, Check-in (pre), Check-in (post), Farewell — are now first-class, visually inspectable definitions. New `src/components/study/wrapperElements.js` (editable content + placeholder check-in rating items pending Liliana's final wording) + `WrapperElementPage.jsx` renderer (reuses InterventionPage's exported styles, progress bar shows each element's true slot); TrainingLibrary gained a "Standard Session Elements" section at `/admin/training` with ▶ Demo modals; existing module Demo refactored onto a shared children-based DemoModal and verified intact. Verified live in browser: all four demos render, slider gating works, owls load, farewell Finish button green. Not yet wired into the participant session flow — preview/spec only. Prior same-day update: Experiment Builder Phase 2 Pass 2: `RandomizeNode.jsx`/`CounterbalanceNode.jsx` builder UI, new `experimentGraph.js` mutators (`addArm`/`removeArm`/`addArmEntry`/`addBlockToCounterbalance`/`removeBlockFromCounterbalance`), balance audit view at `/admin/studies/:id/balance` — implemented and verified live via a temporary local `playwright` install (not added to package.json). Live browser testing caught and fixed a real bug code review missed: `insertAfter`/`addNode`/`tailNode`/`chainOrder` assumed every node has at most one outgoing edge, so toolbar-inserting near a populated Randomize node either destroyed its arm edges or wired a bogus continuation edge — `validate()` caught the resulting corruption but the insertion logic itself was wrong; fixed and covered by a new regression test (46 total standalone assertions passing). Balance audit view verified against 6 real draws: marginal counts balanced, stratified cross-tab correctly split by group. Not yet pushed. See §28. Prior same-day update: Phase 2 Pass 1 — `draw_assignment` extended in place for design_graph randomize/counterbalance nodes (not the stale brief's separate `balancedDraw.ts` module — reused the already-shipped shared primitive instead), `experimentGraph.js` rewritten for fork traversal/validation, `materializeSchedule.ts` + `check_schedule` advance pass resolve forks as participants reach them — fully verified live against a hand-authored scratch study, two backend bugs found and fixed (a `draw_assignment` value-shape mismatch, a `check_schedule` early-return skipping the advance pass); pushed same day (commit `8e98833`). Prior same-day update: WP7 contact settings modal built (`ContactSettingsModal.jsx`, reuses StudyFormPage's variable-pill/iframe-preview pattern, writes `reminder_interval_hours` not `_days`) — pushed same day (commit `9a79359`), closing Phase 1. Prior same-day update: the pg_cron `check_schedule` credential mismatch (anon key vs. this project's `sb_secret_...` key) is fixed and verified live — 6 real reminder emails sent, `message_log` confirms it. Prior same-day update: WP6 — `check_schedule`/`send_message` rewritten against the live schema and deployed, lab-tz-aware due-check via `America/Toronto`; `handle_unsubscribe` fixed to target `study_enrollments` instead of the nonexistent `participant_consent`; link issuance extracted to shared `issueLink.ts` — see §28 Status. Prior same-day update: WP5 materializer implemented and deployed — `supabase/functions/_shared/materializeSchedule.ts` walks `design_graph`, bulk-creates `participant_schedule` rows at enrollment (linear + block, no forks yet), issues the first link, revokes prior active links; wired into `auto-enroll/index.ts` for `online_longitudinal` studies, legacy single-row path untouched for other delivery modes. Prior update: 2026-07-07 (Password reset flow: `/forgot-password` + `/reset-password` pages added — see §8 Auth Flow. Prior same-day update: 2026-07-06 (ISARP keynote: `/keynote` 23-slide click-through deck with Minimal/Reading toggle + speaker notes, BCAT figures wired + neuro-figure drop-in slots, links out to the two live demos — see §20 Keynote deck. Prior same-day: keynote opener `/demo/pacer-opener` and BreathBelt conference demo `/demo/breath-belt`. Prior update: 2026-07-05 (display elements §24a: block-based `displays` table, condition-gated blocks, `{{variable}}` interpolation from session step outputs, admin editor + Elements nav regroup. Same day: assignment randomizer implemented and pilot-verified: shared `draw_assignment` primitive, `assignment_slots` + StudyFormPage condition card, `useAssignment` hooks, SessionEntry draw gating, `seededRandom.js` utility — see §28 Shared assignment primitive. Prior update: 2026-07-02 (restructured into Parts I–IV: renumbered sections, restored lost §11/§16 headers, rewrote roadmap as §30, added §22 game stubs, §24 VAS stub; §28 Experiment Builder merged verbatim from commit 7a030c3 (renumbered from 26). Prior update: 2026-05-29 (BreathBelt §20: Biopac parallel-port triggers implemented — Biopac_Left/Biopac_Right now relay through a local parallel_server.py helper; trigger-device selector moved onto the connect screen; connectBiopac() + sendTestCascade() added; a 1–13 test cascade auto-fires on connect with an RA verify step. Earlier 2026-05-26 update: MLR calibration pipeline replacing percentile approach; fitBestModel — 6 model variants, best by Pearson R; useBeltConnection exposes mlrWeightsRef, filterState3Ref, syncQuality, calibReviewData, beginCalibCollection, redoCalibration, getPacerRadiusFnRef; BeltSyncRing retained for other games; SynchronyBar shown during trials; useStreamingBackup adds parallel File System Access API CSV backup; belt_mlr_migration.sql adds calib_model_label, calib_fit_r, calib_lag_ms to belt_sessions.)))))))

---


---

# Part I — Platform Core

## 1. Platform Overview

**Goal**: A web platform that delivers psychophysics games and questionnaires to three distinct user populations, persists data to Supabase, and provides engaging performance feedback to drive sustained participation.

**Core value proposition to users**: The games are genuinely fun and funny. Performance feedback — personal progress, comparisons against peers, leaderboards — gives users a reason to return beyond compensation.

**Design principle**: Narrative disguise is essential. Each game wraps a rigorous perceptual test in an engaging fiction. Copy and UI should have personality — this is NOT a clinical portal. Fun > formal. Engaging > authoritative.

**Platform theme**: The overarching aesthetic is **awareness and attunement** — quiet, curious attention to subtle signals within and around the self. Games are framed around noticing, sensing, and detecting. The tone is contemplative but warm, never clinical. Nature imagery (ponds, breath, rhythm) serves the attunement theme rather than defining it.

---

## 2. User Tiers

Three distinct roles with different access, workflows, and UX:

### Tier 1 — Lab Members (Internal)
- Researchers, developers, RAs at RADlab
- Full admin access: create/edit studies, assign participants, view all data
- Can flag sessions as "test" to exclude from real data
- Invite-only signup via admin-generated link

### Tier 2 — Research Participants
- Recruited participants in formal studies
- Assigned a specific **study protocol** (ordered set of games + questionnaires)
- Compensation tracked in platform or externally
- Controlled experience: see only what's assigned, in assigned order
- Consent flow and demographics questionnaire at onboarding
- No leaderboard access (privacy)

### Tier 3 — Public / Crowd
- Anyone who signs up via open signup
- Full access to all public games
- Leaderboards, personal performance history, population comparisons
- Contributes to crowdsourced normative data
- Demographics questionnaire at signup

---

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite | |
| Styling | Tailwind CSS v3 + CSS custom properties | Brand tokens in `index.css` |
| Routing | React Router v6 | |
| Data fetching | TanStack Query | |
| Charts | Recharts | Dashboard, future |
| Backend/DB | Supabase | PostgreSQL + Auth + auto REST |
| Auth | Supabase Auth | Email/password; `display_name` in `user_metadata` |
| Hosting | Vercel | SPA rewrites via `vercel.json` |
| Fonts | Fontsource packages | DM Serif Display, Space Mono, DM Sans |

---

## 4. Project Structure

```
radlab/
  public/
    RADlab_Logo.svg           ← original (white+pink outline on transparent) — use on hub page; white dissolves into #FCF0F5
    RADlab_Logo_light.svg     ← dark #1c1c1e outline variant — use everywhere else in UI
    images/
      people/                 ← lab member photos (migrate from radlab.zone/images/people/)
      veggies/                ← Farm Joy 24 veggie sprite PNGs
  src/
    components/
      Nav.jsx                 ← games nav (auth-aware); NOT used on hub or lab pages
      Avatar/
        BaseAvatar.jsx        ← pure SVG avatar component (skinColor, eyeColor, size props)
        AvatarEditor.jsx      ← avatar editor UI with Supabase save/load
    data/                     ← static data files (no CMS)
      people.js               ← PI, grad students, alumni records — exports: pi, gradStudents, alumni
      research.js             ← lab description + researchAreas array — exports: labDescription, researchAreas
      publications.json       ← annotated bibliography (reverse chrono; annotation field nullable; 69 entries)
    games/
      PondWatch.jsx             ← go/no-go RT game
      EbbAndFlow/               ← interoceptive breath detection game
        EbbAndFlow.jsx
        useQuestStaircases.js
        useBreathCycle.js
        useButtonSync.js
        components/
          AvatarBreathPacer.jsx
          PsiAmpButton.jsx
          ResponseScreen.jsx
          WarmupScreen.jsx
          SessionStart.jsx
          SessionSummary.jsx
          SessionFeedback.jsx
          ModeSelector.jsx
          ContinuePrompt.jsx
        constants.js
      FirstContact/             ← onboarding sync game + standalone Deeper Contact
        FirstContact.jsx
        useBreathSync.js
        constants.js
        components/
          ContactAvatar.jsx
          SyncMeter.jsx
          BreathPrompt.jsx
          ContactComplete.jsx
      BreathBelt/               ← respiratory detection thresholds (§20)
        BreathBelt.jsx
        constants.js
        breathUtils.js
        belt_schema.sql
        belt_mlr_migration.sql
        belt_sync_metrics_migration.sql
        hooks/
          useBeltConnection.js
          useBeltSession.js
          useBeltQuestStaircases.js
          useTrialRunner.js
          useStreamingBackup.js
        components/
          BrowserWarning.jsx
          CalibrationScreen.jsx
          CalibReviewPanel.jsx
          SignalGraph.jsx
          SynchronyBar.jsx
          TrialSyncOverlay.jsx
          BaselineScreen.jsx
          FixedTrialsScreen.jsx
          StaircaseScreen.jsx
          BeltSyncRing.jsx
          SessionComplete.jsx
      FarmJoy/                  ← values clarification game (§19)
        FarmJoy.jsx
        constants.js
        data/
          values.js
          veggies.js
        hooks/
          useFarmJoySession.js
        components/
          FarmField.jsx         ← Round 1 background
          Greenhouse.jsx        ← Round 2 background
          FarmRow.jsx           ← Round 3 + Harvest background
          Veggie.jsx
          PullAnimation.jsx
          ValueCard.jsx
          SortBins.jsx
          FeedbackPrompt.jsx
          Intro.jsx
          HarvestSummary.jsx
    layouts/
      LabLayout.jsx           ← wraps all /lab/* routes; renders lab nav (About/People/Research/Publications/Contact)
    lib/
      supabase.js             ← supabase client singleton
    pages/
      Hub.jsx                 ← root splash page (/); logo + 3 cards (Come See, UTMaps, Our Lab); no nav links
      Landing.jsx             ← games landing page (moved from / to /games)
      Login.jsx               ← auth: sign in
      Signup.jsx              ← auth: create account
      ForgotPassword.jsx      ← auth: request password reset email (§8)
      ResetPassword.jsx       ← auth: set new password from recovery link (§8)
      Dashboard.jsx           ← protected: post-login home
      ProfilePage.jsx         ← user profile: avatar, points, unlock progress
      Games.jsx               ← public games listing (/games/list) — Pond Watch + Ebb & Flow cards
      lab/
        AboutPage.jsx         ← stub (content TBD)
        PeoplePage.jsx        ← reads people.js; PI featured card, grads grid, collapsible alumni section
        ResearchPage.jsx      ← reads research.js; lab description intro + research area cards
        PublicationsPage.jsx  ← reads publications.json; reverse chrono grouped by year; bold lab member names
        ContactPage.jsx       ← address + joining info (RA / grad / postdoc)
    App.jsx                   ← router + auth state
    main.jsx                  ← entry point
    index.css                 ← Tailwind + brand CSS tokens + font guardrails
  .env.example                ← copy to .env.local, fill in Supabase keys
  vercel.json                 ← SPA rewrite rules
  tailwind.config.js
```

---

## 5. Supabase Project

- **Account name**: RADlab (linked to GitHub, PI: Norman Farb)
- **Auth**: Supabase Auth (email/password)
- **`display_name`** stored in `user_metadata` at signup
- **Client library**: `supabase-js` via `src/lib/supabase.js`
- **Keys**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env.local` (local) and Vercel env vars (production)
- **Email confirmation**: disable for development in Supabase dashboard → Authentication → Email

---

## 6. Database Schema

### `profiles`
Extended user record (one per auth user). Created by trigger on `auth.users` insert.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, FK → `auth.users` |
| `role` | text | `"lab"`, `"participant"`, `"public"` |
| `display_name` | text | Shown on leaderboards |
| `study_id` | uuid | FK → `studies` (null for public users) |
| `created_at` | timestamptz | |
| `onboarding_complete` | bool | Has completed consent + demographics |
| `points` | integer | Accumulated points from games + onboarding; default 0 |
| `ebb_flow_game_mode` | text | `'beginner'` \| `'listener'` \| `'empath'`; default `'beginner'` |
| `ebb_flow_total_trials` | integer | Cumulative trial count across all sessions; default 0 |
| `ebb_flow_total_score` | integer | Cumulative score; default 0 |
| `ebb_flow_quest_state` | jsonb | Serialized 4-staircase QUEST+ posterior (~50–200 KB); null until first session |
| `ebb_flow_listener_unlocked_at` | timestamptz | Timestamp when Listener mode unlocked (≥50 trials) |
| `ebb_flow_empath_unlocked_at` | timestamptz | Timestamp when Empath mode unlocked (≥100 trials) |
| `ebb_flow_last_session_at` | timestamptz | Timestamp of most recent Ebb & Flow session |
| `first_contact_complete` | boolean | Has completed First Contact onboarding; default false |
| `first_contact_complete_at` | timestamptz | Timestamp of First Contact completion |
| `deeper_contact_best_sync` | numeric(4,3) | Best ever rolling sync mean from Deeper Contact sessions |
| `deeper_contact_last_sync` | numeric(4,3) | Most recent session sync mean — seeds aura intensity in Ebb & Flow |
| `deeper_contact_sessions` | integer | Total Deeper Contact sessions played; default 0 |

### `studies`
A curated protocol for participant recruitment.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | e.g. `"Emotion Regulation Study 1"` |
| `created_by` | uuid | FK → `profiles` (lab member) |
| `protocol` | jsonb | Ordered array of game/questionnaire slugs |
| `active` | bool | |

### `game_sessions`
One row per play session.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles` |
| `game_name` | text | e.g. `"pond_watch"` |
| `study_id` | uuid | FK → `studies` (null for public) |
| `is_test` | bool | Lab-member test sessions excluded from analysis |
| `started_at` | timestamptz | |
| `ended_at` | timestamptz | |

### `trials`
One row per trial within a session.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → `game_sessions` |
| `game_name` | text | e.g. `'pond_watch'`, `'ebb_flow'` — indexed for fast filtering |
| `trial_number` | int | 1-indexed within session |
| `cumulative_trial_number` | int | Auto-set by Postgres trigger — counts up across all sessions and games per user |
| `stimulus_type` | text | e.g. `"duck"`, `"heron"` (Pond Watch); trial type for Ebb & Flow stored in `metrics` |
| `is_target` | bool | Go trial or not |
| `responded` | bool | Did participant respond |
| `reaction_time_ms` | int | null on no-response trials |
| `created_at` | timestamptz | DEFAULT NOW() — used for ordering within session |
| `metrics` | jsonb | Flexible per-game metrics (see §15 for Ebb & Flow fields) |

`cumulative_trial_number` is maintained by a `BEFORE INSERT` trigger (`trials_cumulative_trial_number`) that queries `MAX(cumulative_trial_number)` across all trials for the same user and increments by 1. Application code should never set this column — let the trigger handle it.

### `performance`
Session-level computed metrics. Flexible across games.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → `game_sessions` |
| `hit_rate` | float | |
| `false_alarm_rate` | float | |
| `d_prime` | float | SDT sensitivity |
| `criterion` | float | SDT response bias |
| `median_rt_ms` | float | Hits only |
| `rt_sd_ms` | float | RT variability |
| `accuracy` | float | |
| `threshold` | float | For adaptive staircase games |
| `slope` | float | Psychometric function slope |

### `questionnaire_responses`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles` |
| `questionnaire_slug` | text | e.g. `"demographics"`, `"panas"`, `"ders"` |
| `session_id` | uuid | FK → `game_sessions` (null if standalone) |
| `responses` | jsonb | `{question_id: response_value}` |
| `completed_at` | timestamptz | |

### `avatars`
One row per user. Created at onboarding with default skin + eye color. Unlockable slots are null until the user earns points and applies a feature.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `auth.users`, UNIQUE |
| `skin_color` | text | Hex; default `#FDBCB4` |
| `eye_color` | text | Hex; default `#4A90D9` |
| `ear_type` | text | null = locked/not applied |
| `nose_type` | text | null = locked/not applied |
| `mouth_type` | text | null = locked/not applied |
| `hair_type` | text | null = locked/not applied |
| `hair_color` | text | null = locked/not applied |
| `tail_type` | text | null = locked/not applied |
| `accessory` | text | null = locked/not applied |
| `aura_type` | text | null = locked/not applied |
| `scar_type` | text | null = locked/not applied |
| `updated_at` | timestamptz | |

RLS: users can read and write only their own row.

### `ripples`, `ripple_checkins`, `consents` (Ripple WP1 — migration written, **not yet applied**)

Written 2026-07-12 (`20260712_ripple_wp1.sql`, see manifest) for the Ripple onboarding
ecosystem — full column detail in `docs/markdowns/ripple_spec.md` §7. Summary: `ripples`
(1/user; companion name, `enabled`, `prompt_cadence`, `mood_mirror_header`, write-time streak
fields, `item_state` jsonb — own-rows RLS), `ripple_checkins` (1/user/local-day; Still Water
circumplex columns + rotating `items` jsonb + `intention`/`prev_intention_outcome` — own-rows
RLS + lab read), `consents` (append-only versioned consent/ToS records — own insert/read + lab
read, deliberately no UPDATE/DELETE policies). Public-tier demographics reuse the existing
`demographics` table (nullable study columns) — no new table.

### `avatar_unlocks`
Tracks which individual items each user has earned. Separate from `avatars` (which tracks what's currently equipped).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `auth.users` |
| `feature` | text | e.g. `'ear_type'`, `'nose_type'`, `'hair_type'` |
| `item_id` | text | e.g. `'cat'`, `'fox'`, `'bun'` |
| `unlocked_at` | timestamptz | |
| — | — | UNIQUE on `(user_id, feature, item_id)` |

RLS: users can read only their own rows.

---

## 7. Site Routes

| Route | Component | Access |
|---|---|---|
| `/` | `Hub` | Public — splash with 3 cards; no nav links |
| `/games` | `Landing` | Public — games landing page (was `/`) |
| `/games/list` | `Games` | Public — game listing page |
| `/login` | `Login` | Public only (redirects to `/dashboard` if logged in) |
| `/signup` | `Signup` | Public only |
| `/forgot-password` | `ForgotPassword` | Public only — request reset email (§8) |
| `/reset-password` | `ResetPassword` | No guard — reached via recovery email link (§8) |
| `/dashboard` | `Dashboard` | Protected (redirects to `/login` if not logged in) |
| `/profile` | `ProfilePage` | Protected — avatar, points, unlock progress |
| `/profile/avatar` | `AvatarEditor` | Protected — avatar editor; redirected here on first login |
| `/admin/users` | `UserAdminPage` | Super admin only — list/role-toggle/delete users (§8) |
| `/welcome` | `WelcomeFlow` (`src/ripple/`) | Auth only — Ripple WP1+WP2 public-tier onboarding: intro → consent + ToS → demographics → **customize appearance (skin/eye swatches)** → **name your Ripple**. New public users (`onboarding_complete=false`, no avatar) redirected here; sets `onboarding_complete=true`, creates `avatars` row + `ripples.name`. Own `ErrorBoundary label="Ripple"`. |
| `/ripple/name` | `RippleName` (`src/ripple/`) | Auth only — **WP2 migration beat**: existing public users whose `ripples.name IS NULL` land here once on next login. Shows existing avatar colours, prompts for a name, upserts `ripples.name`, then `→ /dashboard`. |
| `/games/first-contact` | `FirstContact` | Protected — mandatory onboarding sync game; also accessible as Deeper Contact standalone |
| `/games/pond-watch` | `PondWatch` | Protected |
| `/games/ebb-flow` | `EbbAndFlow` | Protected — redirects to `/games/first-contact` if `first_contact_complete === false` |
| `/games/farm-joy` | `FarmJoy` | Protected |
| `/games/breath-belt` | `BreathBelt` | Protected — lab-only guard internal to component |
| `/lab` | redirect → `/lab/people` | Public |
| `/lab/about` | `AboutPage` | Public — stub |
| `/lab/people` | `PeoplePage` | Public — reads from `src/data/people.js` |
| `/lab/research` | `ResearchPage` | Public — stub |
| `/lab/publications` | `PublicationsPage` | Public — reads from `src/data/publications.js` |
| `/lab/contact` | `ContactPage` | Public |
| `/study` | — | Participant tier (future) |
| `/admin` | — | Lab tier (future) |

**Nav behaviour — contextual by route prefix:**

- **Hub (`/`)**: logo only (links home); no nav links. Logo uses original `RADlab_Logo.svg` — white fill dissolves into `#FCF0F5` background, leaving pink + gray shapes.
- **Games (`/games/*`, `/login`, `/signup`, `/dashboard`, `/profile*`)**: `Nav.jsx` as-is — logo + Games + Dashboard + avatar circle. Logo uses `RADlab_Logo_light.svg`.
- **Lab (`/lab/*`)**: `LabLayout.jsx` renders its own nav — logo + About · People · Research · Publications · Contact. Logo uses `RADlab_Logo_light.svg`. Logo always links back to `/` (hub).

**Onboarding guard**: Any attempt to access `/games/ebb-flow` while `first_contact_complete === false` redirects to `/games/first-contact` with message: *"Complete First Contact before beginning Ebb & Flow."*

---

## 8. Auth Flow

1. **Signup** (`/signup`) → `supabase.auth.signUp()` with `display_name` in `user_metadata`
2. Confirmation email sent (disable for dev in Supabase dashboard)
3. **Login** (`/login`) → `supabase.auth.signInWithPassword()`
4. Auth state listener in `App.jsx` catches session changes and re-renders
5. Role-based redirect (currently all users → `/dashboard`; future: check `profiles.role`)
6. **Sign out** → `supabase.auth.signOut()` → redirect to `/`

**Already-registered signup detection (2026-07-12)**: with email confirmation on, Supabase's `signUp()` deliberately returns a success-shaped response (and sends **no** email) for an already-registered confirmed address — anti-enumeration. `Signup.jsx` now checks the tell (`data.user.identities` is an empty array) and shows "This email is already registered — sign in or reset your password" with links, instead of the false "check your email" screen. Deliberate tradeoff: an attacker can probe whether an email has an account; Norm accepted this for honest UX (discovered when a test signup for an existing account produced a confirmation screen and no email).

**Super-admin user management (2026-07-12)**: `/admin/users` (sidebar link visible to super admins only; page + RPCs enforce server-side) lists all accounts (email from `auth.users` via SECURITY DEFINER, role/flags from `profiles`, confirmed/created/last-sign-in), toggles roles **lab↔public only** (never participants — their role anchors study linkage — never super admins, never self, no elevation path), and deletes accounts behind a type-the-email modal ("no undo"). Deletion is one transaction (`admin_delete_user`): explicit deletes for `word_max_sessions`/`avatars`/`avatar_unlocks` (FKs to `auth.users` without verified cascades), then `profiles` (dependents cascade), then `auth.users`. Migration `20260712_admin_user_management.sql` (also exempts super admins in the `prevent_self_privilege_escalation` trigger, matching the 20260611 RLS policy). Built for test-account cleanup during Ripple development.

### Password reset (2026-07-07)

For Tier 1 (lab) and Tier 3 (public) users, who authenticate with real email/password. Does **not** apply to Tier 2 participant accounts — those use synthetic `p-{id}@radlab.internal` addresses with a hidden random password (§28 Silent participant account creation) and are RA-driven, not self-service.

1. `Login.jsx` — "Forgot password?" link next to the password field → `/forgot-password`
2. `ForgotPassword.jsx` (`src/pages/ForgotPassword.jsx`) — email form → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<origin>/reset-password' })`. Always shows the same "check your email" success message regardless of whether the address matches an account, to avoid account enumeration.
3. Supabase emails a recovery link (template + redirect URL allowlist configured in the Supabase dashboard → Auth → URL Configuration)
4. `ResetPassword.jsx` (`src/pages/ResetPassword.jsx`) — reached via the email link. Supabase's client parses the recovery token from the URL hash on load and fires a `PASSWORD_RECOVERY` auth event once the temporary recovery session is established; the page waits for that (`ready` state) before showing the new-password form. Falls back to an "invalid or expired" state after a 2.5s timeout if no session appears.
5. On submit: `supabase.auth.updateUser({ password })`, then `supabase.auth.signOut()` so the user logs back in fresh with the new password
6. Routes: `/forgot-password` is wrapped in `PublicOnlyRoute` (redirects away if already logged in, like `/login`/`/signup`); `/reset-password` has **no** session/role guard, since Supabase establishes a session as part of following the recovery link and `PublicOnlyRoute` would bounce the user away before they could set a new password

---

## 9. Design System

**Brand**: RADlab — Regulatory and Affective Dynamics Lab, University of Toronto

**Aesthetic**: Light mode. Warm pinkish off-white background. White cards. Pink accent. Inviting, not clinical. Playful copy, serious science underneath.

**Logo files** (never redraw — always use one of these two):
- `RADlab_Logo.svg` — original, white outline on `path1`. Dark backgrounds only.
- `RADlab_Logo_light.svg` — `path1` fill changed to `#1c1c1e` via `sed`. Light backgrounds. Use this everywhere in the UI.
- In React: `<img src="/RADlab_Logo_light.svg" height="34" alt="RADlab logo" />`

**Colour tokens** (defined as CSS custom properties in `index.css`):

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#FCF0F5` | Page background |
| `--bgc` | `#ffffff` | Card background |
| `--bgp` | `#FBEAF3` | Pink-tinted section background |
| `--pk` | `#f068a4` | Primary accent — CTAs, highlights (from logo `path3`) |
| `--pkd` | `#c04a82` | Darker pink — hover states, text on pink bg |
| `--pkb` | `rgba(240,104,164,0.18)` | Subtle pink border |
| `--pkbs` | `rgba(240,104,164,0.35)` | Strong pink border |
| `--gy` | `#abadb0` | Gray — secondary elements (from logo `path5`) |
| `--tx` | `#1c1c1e` | Primary text |
| `--tx2` | `#6b6c70` | Secondary text |
| `--tx3` | `#a8a9ad` | Tertiary / labels |
| `--bd` | `rgba(180,100,140,0.13)` | Default border |
| `--bds` | `rgba(180,100,140,0.25)` | Strong border |

**Fonts**:
- `"DM Serif Display"` — headings, hero title, game titles
- `"Space Mono"` — data readouts, labels, monospace UI
- `"DM Sans"` — body, UI, buttons

**Tone**: Warm, a little funny, encouraging. Feedback feels like a supportive coach. Leaderboard copy is playful. Errors are charming.

**Font size guardrails** (defined as CSS custom properties in `index.css` — never go below `--fs-min`):

| Token | rem | px | Usage |
|---|---|---|---|
| `--fs-min` | `0.75rem` | 12px | Absolute floor — WCAG minimum |
| `--fs-mono-sm` | `0.75rem` | 12px | Space Mono chips, tags, small labels |
| `--fs-mono-md` | `0.8125rem` | 13px | Space Mono nav links, CTAs, eyebrows |
| `--fs-body-sm` | `0.875rem` | 14px | Secondary DM Sans body text |
| `--fs-body` | `1rem` | 16px | Default body; iOS auto-zoom floor |
| `--fs-body-lg` | `1.125rem` | 18px | Comfortable long-form reading |

Space Mono reads small at any given size — prefer `--fs-mono-sm` or above for all labels.

---

## 10. Responsive Design

**Core principle**: Minimise friction unless design requires user investment. Never add UI complexity (hamburgers, modals, extra taps) without a clear reason.

**Breakpoints** (standard Tailwind):
- `sm` 640px — large phone
- `md` 768px — tablet portrait
- `lg` 1024px — tablet landscape / small desktop
- `xl` 1280px — desktop

**Approach**: Tailwind responsive classes for layout (grids, padding, show/hide). `useBreakpoint()` hook only for structural component-level decisions.

**Nav on mobile**:
- Logged-out: logo + "Join free" button only (About and Log in dropped)
- Logged-in: logo + "Dashboard" link only
- No hamburger — not enough nav items to justify the friction

**Game cards on mobile**: illustration stacks above info (Option 1). Uses CSS `order` classes — `order-first` on mobile pulls illustration to top, `md:order-last` returns it to right column on desktop. Border flips from `border-b` (stacked) to `md:border-l` (side-by-side). When there are 4+ games, reconsider switching to compact thumbnail row layout.

**Layout collapse rules**:
- Hero: `lg:grid-cols-[1fr_min(340px,35%)]` → single column below `lg`
- Game card: `md:grid-cols-[1fr_200px]` → single column, illustration on top
- Steps: `md:grid-cols-3` → single column on mobile
- Tiers: `sm:grid-cols-2 lg:grid-cols-3` → 1 → 2 → 3 columns
- Dashboard game grid: `md:grid-cols-2` → single column on mobile
- Section padding: `24px` horizontal on all screen sizes (was 40px desktop only)

**Recommended: Claude Code for implementation, Claude.ai for design**

- Use **Claude.ai** (this chat) for architecture decisions, design mockups, and planning
- Use **Claude Code** for all file editing, running builds, and git operations — it works directly on the local filesystem with no download/upload friction

**Claude Code setup:**
```powershell
npm install -g @anthropic/claude-code
cd radlab
claude
```
Requires an Anthropic API key from `console.anthropic.com`.

**Git workflow (PowerShell — no `&&`):**
```powershell
git add .
git commit -m "your message"
git push
```
Vercel auto-deploys on every push to `main`.

**When sharing context with a new conversation**, paste in `website.md` — it contains everything needed to get up to speed. Individual changed files can be presented directly from Claude.ai rather than repacking the full tarball.

---

## 11. Deployment

**Hosting**: Vercel  
**Repo**: GitHub (push from local, Vercel auto-deploys on push to `main`)  
**SPA routing**: `vercel.json` rewrites all paths to `index.html`

**Environment variables** (set in both `.env.local` and Vercel dashboard):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Deploy steps** (one-time):
1. Push repo to GitHub
2. Vercel → New Project → Import GitHub repo
3. Add env vars in Vercel dashboard
4. Deploy — subsequent pushes to `main` auto-deploy

**Windows note**: Use PowerShell commands one at a time (no `&&` chaining).

---


---

## 12. Hub & Lab Pages

> Header restored 2026-07-02; this block previously sat inside §18 without a section header.


### Decision

The platform root (`radlab.vercel.app`) is a **hub splash page** with three equal cards linking to:
1. **Come, See** — the games platform (`/games`)
2. **UTMaps** — knowledge translation project (external link or `/utmaps` TBD)
3. **Our Lab** — academic lab pages (`/lab/people`)

Lab pages and games pages share the same Vite/React codebase and Vercel deployment but use separate layouts and nav.

### Hub page (`src/pages/Hub.jsx`)

- Route: `/`
- No nav links — logo only in header (links back to `/`)
- Logo: inline the RADlab_Logo.svg paths directly as `<svg>` at two sizes (nav 42×36, hero 66×56). The white fill dissolves into `#FCF0F5`, showing only pink and gray shapes. Do NOT use `RADlab_Logo_light.svg` here.
- Three equal white cards, all light by default, flip to dark (`#1c1c1e`) on hover
- Visual reference: `radlab_hub_mockup.html` (generated in claude.ai session 2026-05-04)
- Sign-out from games must redirect to `/` (hub), not `/games`

### Lab layout (`src/layouts/LabLayout.jsx`)

Wraps all `/lab/*` routes. Renders:
- Sticky nav: logo (links to `/`) + links: About · People · Research · Publications · Contact
- Logo: `<img src="/RADlab_Logo_light.svg" height="34" alt="RADlab logo" />`
- Main content area (no Supabase auth — all public)
- Footer consistent with hub

### Lab data files

| File | Location | Purpose |
|---|---|---|
| `people.js` | `src/data/people.js` | PI, grad students, alumni — edit here to update people page |
| `publications.js` | `src/data/publications.js` | Annotated bibliography; reverse chrono; `annotation` field nullable |

### Lab pages

| Page | File | Status |
|---|---|---|
| About | `src/pages/lab/AboutPage.jsx` | Stub — content TBD |
| People | `src/pages/lab/PeoplePage.jsx` | Built — reads `people.js`; PI featured, grads grid, alumni collapsible |
| Research | `src/pages/lab/ResearchPage.jsx` | Stub — content TBD |
| Publications | `src/pages/lab/PublicationsPage.jsx` | Template built — reads `publications.js`; bold lab authors via `labMemberNames` |
| Contact | `src/pages/lab/ContactPage.jsx` | Built — address + RA/grad/postdoc joining sections |

### CSS additions for lab pages

Add to `index.css` — copy from comment blocks at bottom of `PeoplePage.jsx` and `ContactPage.jsx`:
- `.lab-page`, `.lab-section`, `.lab-section__heading` — shared layout
- `.person-card`, `.person-grid`, `.alumni-toggle` — people page
- `.contact-address`, `.contact-block`, `.contact-cta` — contact page
- All font sizes reference guardrail tokens (`--fs-mono-sm`, `--fs-body-sm`, etc.) — never hardcode below 12px

### Photo migration

Photos currently at `radlab.zone/images/people/`. Steps:
1. Download each from `https://www.radlab.zone/images/people/<filename>`
2. Place in `public/images/people/<filename>`
3. Update `photo` paths in `src/data/people.js` to `/images/people/<filename>`

Filenames: `norm2.jpg` `thomas.jpg` `john.jpg` `sandy.jpg` `liliana.jpg` `zoey.jpg` `geissy.png` `phil.jpg` `leanh.jpg` `jordan.png` `kyle.jpg` `katie.jpg` `yiyi.jpg` `jaafar.jpg`

---


---

## 13. Avatar System

> Header restored 2026-07-02; content was present but the `## 11` header line had been lost.

### Philosophy
Every user gets a cartoony humanoid avatar that evolves as they accumulate points. The base avatar (skin + eye color only) is chosen at onboarding. Feature categories unlock at point thresholds, giving users a persistent reason to return and play more games. The avatar appears in the site header and on leaderboards.

### Onboarding guard
After signup, `App.jsx` checks whether an `avatars` row exists for the user. If not, the user is redirected to `/profile/avatar` before accessing any other screen. This ensures every user has a base avatar before they see the dashboard.

### Navigation flow
```
Header avatar circle (36px, always visible when logged in)
  → click → /profile
              ├── large avatar preview (160px)
              ├── display name + role badge
              ├── points total + progress bar to next unlock
              ├── unlock tracker (upcoming features, greyed out)
              ├── activity summary (completed sessions count)
              └── "Edit Ripple" button → /profile/avatar
                    → AvatarEditor
                          └── Save → back to /profile
```

### Header avatar
- Renders `<BaseAvatar size={36} />` clipped to a circle in `Nav.jsx`
- Fetched via React Query key `['avatar', userId]`
- Falls back to a plain pink circle with the user's initial if no avatar row exists yet

### BaseAvatar component
**File**: `src/components/Avatar/BaseAvatar.jsx`  
**Props**: `skinColor` (hex), `eyeColor` (hex), `size` (px, default 200)  
**Renders**: Pure SVG, no UI chrome. Safe to use at any size — 36px in header, 160px on profile, 40px on leaderboards.

**SVG construction:**
- `viewBox="0 0 200 185"`
- Head: `<ellipse cx="100" cy="105" rx="64" ry="68" />`
- Left sclera: `<circle cx="76" cy="100" r="17" />`; right: `<circle cx="124" cy="100" r="17" />`
- Left eyelid (upper, skin-colored crescent): `M 60 91 Q 76 94 92 91 A 17 17 0 0 0 60 91 Z`
- Right eyelid: `M 108 91 Q 124 94 140 91 A 17 17 0 0 0 108 91 Z`
- The eyelid's bottom edge (Bézier) droops into the eye; its top edge follows the sclera arc — produces a calm, half-lidded expression
- Mouth: `M 82 145 Q 100 149 118 145` — wide, nearly flat, corners tilt slightly up
- Eyebrows derived from `darken(skinColor, 18)`; blush from `mix(skinColor, "#FF8FAB", 0.45)`
- No ears, nose, neck, or body in the base — those are unlock categories

### Color palettes
**Skin (16 swatches):**
Human: `#FFEEE8 #FDBCB4 #F5CBA7 #E8B08A #C68642 #8D5524 #4A2912`  
Fantasy: `#D4B8E0 #A8D8EA #B5EAD7 #FFD6A5 #C9B1D0 #8ECAE6 #95D5B2 #E8C1C1 #BDE0FE`

**Eyes (16 swatches):** Warm Brown `#6B4F3A`, Dark Brown `#3D2B1F`, Hazel `#8B7355`, Sky Blue `#4A90D9`, Deep Blue `#1C5FA0`, Forest `#4A8B5A`, Dark Green `#2D6A4F`, Purple `#7B4FCF`, Amber `#FFBF00`, Red `#CC2200`, Teal `#00897B`, Pink `#F06292`, Steel `#546E7A`, Violet `#8B008B`, Ember `#FF8C00`, Moss `#2E7D32`

### Unlock progression
| Points | Unlocks |
|---|---|
| 0 | Base avatar (skin + eye color) |
| 50 | Ears (human, cat, fox, rabbit, bear, dog, deer, wolf) |
| 100 | Nose styles |
| 150 | Hair type + hair color picker |
| 200 | Mouth styles |
| 300 | Auras / glows |
| 500 | Scars, marks, tattoos |

Species are expressed by mixing ear type + nose type + tail type freely — no species presets.

### AvatarEditor component
**File**: `src/components/Avatar/AvatarEditor.jsx`  
- On mount: `SELECT * FROM avatars WHERE user_id = auth.uid()` — pre-populates pickers if row exists
- On save: upsert into `avatars`; navigate to `/profile` on success
- Currently shows only skin + eye pickers (base avatar); unlock-gated feature pickers added later

### ProfilePage
**File**: `src/pages/ProfilePage.jsx`  
- Large avatar preview with "Edit Ripple" → `/profile/avatar`
- Display name + role badge from `profiles`
- Points total + progress bar to next unlock milestone
- Unlock tracker list (upcoming categories, greyed out with point threshold shown)
- Activity summary: count of completed `game_sessions`

---


---

# Part II — Games

## 14. Pond Watch

**File**: `src/games/PondWatch.jsx`  
**Paradigm**: Go/No-Go reaction time  
**Narrative**: Wildlife monitor watching a pond. Duck → spacebar/tap. Heron/frog/fish/ripple → withhold.

**Trial structure**:
- 60 trials, ~5 min
- Target rate: 50%
- ITI: 1000–3000 ms random
- Stimulus duration: 800 ms
- Response window: 1000 ms from onset
- Per-trial feedback: hit / miss / false alarm / correct rejection

**State machine**: `instructions → countdown → [iti → stimulus → feedback] × 60 → results`

**Key decisions**:
- All timing via `useRef` — avoids stale closure bugs
- RT via `performance.now()` — sub-millisecond precision
- d′ log-linear correction — prevents ±Infinity at 0%/100%
- `onSessionComplete(data)` prop — Supabase push goes here (stubbed)

**Metrics**: `hit_rate`, `false_alarm_rate`, `d_prime`, `criterion`, `median_rt_ms`, `rt_sd_ms`, `accuracy`

**Status**: Built, not yet wired to Supabase or exposed as a live route.

---

## 15. Ebb & Flow

**Files**: `src/games/EbbAndFlow/` (see §4 for full structure)  
**Paradigm**: Interoceptive breath change detection — 4-breath adaptive staircase  
**Route**: `/games/ebb-flow`  
**Dependency**: `npm install jsquestplus` (MIT, Kuroki & Pronk 2022)

**Narrative / framing**: The participant's own avatar serves as the breath pacer. The participant breathes along with their avatar using the PSI-AMP attunement button (hold = inhale, release = exhale). On each trial the avatar's pace may subtly shift. The participant's job is to notice — to detect impermanence in the breath rhythm. The game is named after the cyclical, bidirectional nature of breath and change: things ebb and flow.

The term **PSI-AMP** (psionic amplifier) appears on the instruction screen as a narrative device — a tool for attuning your breath to your avatar's signal. The button face itself simply reads "inhale" when held.

**Scientific basis**: Orthogonal manipulation of change *magnitude* (how much the breathing pace shifts) and *salience* (how abruptly vs. gradually the shift is delivered). Enables independent measurement of interoceptive sensitivity, conscious detection, metacognitive accuracy, and subjective arousal. Based on Study 1 data (N=103, 3,192 trials) — see `fourbreathtask.md` for full empirical priors.

**Trial structure**:
- Warm-up: replaced by First Contact onboarding (see §16). Ebb & Flow uses a shortened 4-breath warm-up for returning players who have completed First Contact
- After warm-up: `GET_READY` screen — avatar frozen at neutral, text prompt, spacebar or "Begin" button to start
- Each trial: avatar resets to neutral synchronously then holds 1000ms before breath 1 begins
- 4 breaths per trial; breath 1 always baseline reference
- High salience: full change loads abruptly at breath 2→3
- Low salience: change amortised gradually across breaths 2, 3, 4
- Catch trials (25%): TotalChange = 1.0, no change
- After 4 breaths: combined response screen (3AFC + confidence slider + arousal slider)
- Session minimum: 10 trials; "keep going?" prompt every 10 thereafter
- Session ends automatically when all 4 QUEST+ posteriors converge (SD < 0.04)

**State machine**:
```
SESSION_START → WARMUP → GET_READY → [TRIAL_ITI → BREATH_SEQUENCE → RESPONSE] × n
                                                                         ↓ every 10 trials
                                                                   CONTINUE_PROMPT
                                                                         ↓ all converged
                                                                  STABILITY_COMPLETE
                                                                         ↓
                                                                  SESSION_COMPLETE
```

- `WARMUP`: PSI-AMP sync ring visible; auto-advances at rolling sync mean ≥ 0.80
- `GET_READY`: static screen; avatar frozen at neutral (rAF loop paused); spacebar or "Begin" advances
- `TRIAL_ITI`: 800ms pause; avatar breathing continues at baseline
- `BREATH_SEQUENCE`: on entry — rAF loop cancelled, `resetAvatarToNeutral()` called synchronously via direct `setAttribute`, 1000ms hold, then rAF restarts and breath cycle begins. This reset applies at warmup start too — standard start-of-trial behaviour.
- `RESPONSE`: PSI-AMP button inert; 3AFC + two placement sliders

**Four QUEST+ staircases** (one per condition):

| Key | Direction | Salience |
|-----|-----------|----------|
| `faster_high` | Acceleration | High (abrupt) |
| `faster_low` | Acceleration | Low (gradual) |
| `slower_high` | Deceleration | High (abrupt) |
| `slower_low` | Deceleration | Low (gradual) |

Trial type selected by highest posterior SD (most uncertain staircase gets next trial). QUEST+ configured for 3AFC with Weibull psychometric function. Priors: μ=0.20, σ=0.15, slope=5.70, lapse=0.02, guess=0.33. Full posterior serialized to `profiles.ebb_flow_quest_state` (JSONB) between sessions.

**Response screen** (all three required before Next unlocks):
- 3AFC: `[ Faster ] [ No change ] [ Slower ]`
- Confidence: placement slider (1–7); starts as dashed ghost thumb + horizontal dashed line; real thumb appears at exact tap position
- Arousal: same placement slider mechanic (1–7, calm/still → alert/activated)

**Avatar as breath pacer** (`AvatarBreathPacer.jsx`):
- Pulls `profiles.avatars` for logged-in users; default mid-range avatar for guests
- Avatar expands/contracts driven by `requestAnimationFrame` + `useRef` timing (no CSS keyframes — Safari compatibility)
- Four animated cues: scale (mode-dependent amplitude), eyelids, blush, brow lift
- All SVG attributes via `setAttribute` — never CSS animation on SVG elements

**Game modes** (scale amplitude of breathing animation):

| Mode | Amplitude | Unlock threshold |
|------|-----------|-----------------|
| Beginner | 25% | Default (0 trials) |
| Listener | 12% | 50 trials |
| Empath | 2% | 100 trials |

Mode buttons shown on session start screen — locked modes greyed out with lock icon and trial threshold shown. Unlock celebrated on session summary. User may stay on current mode; downgrading is valid.

**Scoring**:

| Event | Points |
|-------|--------|
| Correct detection, high salience | +10 |
| Correct detection, low salience | +20 |
| Correct catch rejection | +8 |
| False alarm on catch | −5 |
| Confidence calibrated (high+correct or low+wrong) | +5 bonus |

**Metrics stored** (in `trials.metrics` JSONB):
`trial_type`, `total_change`, `magnitude`, `log10_magnitude`, `salience`, `direction`, `response`, `correct`, `confidence`, `arousal`, `reaction_time_ms`, `breath_sync` (array of 4, with `press_phase`, `release_phase`, `sync_score` per breath), `trial_sync_mean`, `quest_posterior_mean`, `quest_posterior_sd`, `game_mode`, `scale_amplitude`

**`onSessionComplete` payload** includes: `trials[]`, `session_score`, `total_score`, `total_trials`, `quest_state` (4 serialized staircases), `game_mode`, `new_mode_unlocked`, `all_converged`, `session_sync_mean`

**Key implementation notes**:
- All breath timing via `useRef` — never `useState` (stale closure prevention, same pattern as Pond Watch)
- `pointerdown`/`pointerup` + `setPointerCapture` for PSI-AMP button (mouse + touch unified)
- QUEST+ stimulus in log10(magnitude) space; convert back to linear for breath duration computation
- **jsQuestPlus psychometric function**: use `getStimParams()` as a plain scalar (not array). Call `update(log10Mag, responseIndex)` with a plain scalar too — NOT `update([log10Mag], responseIndex)`. Wrapping in array causes NaN posterior.
- **Weibull P(correct) formula** (no `/20` divisor — slope is already in correct units for this parameterisation):
  ```js
  function pCorrect(stim, threshold, slope, guess, lapse) {
    const tmp = slope * (stim - threshold);
    return (1 - lapse) * (guess + (1 - guess) * (1 - Math.exp(-Math.pow(10, tmp)))) + lapse * guess;
  }
  ```
  Do NOT use `jsQuestPlus.weibull()` directly — that function returns P(incorrect), not P(correct).
- `psych_samples` must match function signature order: `[thresholdSamples, slopeSamples, guessSamples, lapseSamples]`
- Staircase restoration: pass `saved.normalized_posteriors` as `priors` to new jsQuestPlus constructor
- Avatar aura intensity in Ebb & Flow seeded from `profiles.deeper_contact_last_sync` — fixed ambient effect, does not update mid-session. Max opacity capped at 0.35.

**Session feedback** (`SessionFeedback.jsx`): shown after every 10 trials, replacing the old `ContinuePrompt`. Shows:
- Excitement sensitivity arc (amber, faster staircases combined) — certainty % = `(1 − SD/0.15) × 100`
- Calm sensitivity arc (blue, slower staircases combined) — same formula
- Connection to avatar: sync mean %, trend (strengthening/steady/fading), dual-line chart (faded trial-by-trial + solid trend)
- Change awareness: calibration of confidence vs accuracy — "You knew when you knew." / developing / still learning
- Focus card (conditional, only when `|excSD - calmSD| > 0.04`): real-world noticing suggestion
- Next session hook: points at less certain signal by name
- Buttons: "Take a break" / "Practice more"

**Full build spec**: `ebb-and-flow-spec.md` (generated 2026-04-25) — pass this to Claude Code as primary build instructions.

**UI entry points**:
- `Nav.jsx` — "Games" link (visible logged-in and logged-out) routes to `/games`
- `Landing.jsx` — Ebb & Flow preview card: *"Breathe with your avatar. Notice when something changes. A quiet game of awareness — each session takes about 5 minutes."*
- `Games.jsx` (`/games`) — listing page with one card per game; Ebb & Flow tagline: *"Breathe with your avatar and detect subtle shifts in rhythm."*; Pond Watch tagline: *"Watch the pond. Press when you spot a duck."*

**Status**: Built. QUEST+ staircases confirmed updating and persisting correctly across sessions. SessionFeedback implemented.

---

## 16. First Contact / Deeper Contact

**Files**: `src/games/FirstContact/`  
**Route**: `/games/first-contact`  
**Full build spec**: `first-contact-spec.md`

**Purpose**: Solves the cold-start usability problem of the Ebb & Flow warmup by giving participants a dedicated, narrative-rich environment to learn the PSI-AMP breath sync mechanic before they enter the detection task.

**Narrative**: You are making psychic contact with your avatar for the first time, summoning it into existence through breath synchronisation. As connection deepens, the avatar's features (eyes, brows, blush, mouth) fade in from ghost impressions to full visibility. On completion: *"Initial contact established. Your avatar is with you."*

**Two modes — same component, same route:**

| Mode | Trigger | Avatar state | Aura |
|------|---------|--------------|------|
| First Contact | `first_contact_complete === false` | Ghost features reveal with sync | None until ~80% |
| Deeper Contact | `first_contact_complete === true` | Full opacity always | Pulsing rings at sync intensity |

**Core mechanic**: Identical to Ebb & Flow PSI-AMP warmup. A circle/avatar pulses at 4 s/cycle. Hold button during expansion (inhale), release during contraction (exhale). `BreathPrompt` shows staggered "press → inhale" / "release → exhale" text. For returning players, prompts fade after 3 cycles.

**Rolling sync buffer** (`useBreathSync.js`): last 4 cycles only. Older cycles are evicted as new ones arrive. This prevents early fumbling from permanently blocking the 80% threshold — participants always have a fresh path to completion.

**Completion threshold**: rolling mean ≥ 0.80 after ≥ 4 cycles minimum.

**Avatar reveal** (`ContactAvatar.jsx`): 
- Ghost feature opacity: `0.08 + (syncLevel / 0.80) * (1 - 0.08)` — reaches 1.0 exactly at 80% sync
- Head ellipse always at full opacity
- All four breath animation cues active (scale 15%, eyelids, blush, brows) — fixed amplitude regardless of game mode

**Aura effect**: Three concentric rings behind avatar head, expanding outward like ripples on each breath cycle, staggered by 1/3 cycle. Ring opacity scales with `syncLevel`. In First Contact: `max opacity = 0.60`. In Ebb & Flow: `max opacity = 0.35` (ambient, less distracting). Colour: rgba(253, 188, 180, 0.5).

**`SyncMeter.jsx`**: Arc below avatar showing rolling sync mean. Amber < 50%, yellow-green 50–79%, green ≥ 80%. Pulses on each new cycle score. Flashes green on first completion.

**`BreathPrompt.jsx`** timing:

| Phase | Text | Style |
|-------|------|-------|
| 0.00–0.05 | "press" | Bold, amber |
| 0.05–0.50 | "inhale" | Regular, amber |
| 0.50–0.55 | "release" | Bold, blue |
| 0.55–1.00 | "exhale" | Regular, blue |

**State machine**: `INTRO → SYNCING → COMPLETE`

**Supabase writes on completion**:
```
first_contact_complete = true          (first time only)
first_contact_complete_at = now()      (first time only)
deeper_contact_best_sync = max(current, previous)
deeper_contact_last_sync = current rolling mean
deeper_contact_sessions += 1
```

**Games page cards**:
- If `first_contact_complete === false`: show "First Contact" card prominently at top, lock icon on Ebb & Flow card. Tagline: *"Begin here. Meet your avatar for the first time."*
- If `first_contact_complete === true`: show "Deeper Contact" card normally. Tagline: *"Return to strengthen your connection."*

**Onboarding guard**: `/games/ebb-flow` redirects to `/games/first-contact` if `first_contact_complete === false`.

**Aura in Ebb & Flow**: `AvatarBreathPacer.jsx` reads `deeper_contact_last_sync` from profile. If 0, aura invisible. Aura is a fixed ambient effect seeded at session load — does not update during the detection task.

**Status**: Specced. Not yet built. Build spec: `first-contact-spec.md`.

## 17. Still Water — Mood Check-in Game

### Overview

Still Water is a two-question mood check-in that reconstructs a position in the affective circumplex (valence × arousal) from two diagonal ratings. It is both a scientific instrument and a game — participants receive visual feedback in the form of an expressive avatar face that animates to reflect their composite state.

**Scientific paradigm**: Two bipolar ratings along the circumplex diagonals, decomposed into valence and arousal coordinates.
- Phase 1: Sad ↔ Excited (positive activation diagonal: x=t, y=t)
- Phase 2: Calm ↔ Tense (negative activation diagonal: x=−t, y=t)
- Composite: average of the two (x, y) pairs → nearest named sector + zone
- Ambivalence: Euclidean distance between the two rating vectors (large = emotionally mixed)

**Route**: `/games/still-water`
**Access**: Protected (logged-in users only)
**Game name slug**: `still_water`

### File structure

```
src/games/StillWater/
  StillWater.jsx          ← main game component (intro → phase1 → phase2 → reveal)
  expressionEngine.js     ← calcExpr() — FACS-based AU engine; exported for FaceRead reuse
  ExpressiveAvatar.jsx    ← SVG avatar with expression props; imports calcExpr
  WheelSVG.jsx            ← shared radial wheel; imported by StillWater and FaceRead
  constants.js            ← EMOTIONS array, INTENSITY_LABELS, coordinate helpers
```

### Shared components (used by FaceRead too)

| Export | File | Description |
|---|---|---|
| `calcExpr(valence, arousal, intensityT, pupilTier)` | `expressionEngine.js` | FACS AU engine — AU1/2/4/5/20/25/27/43/12/15 |
| `ExpressiveAvatar` | `ExpressiveAvatar.jsx` | SVG face; props: skinColor, eyeColor, size, valence, arousal, intensityT, pupilTier, glowColor |
| `WheelSVG` | `WheelSVG.jsx` | Radial wheel; props: activeIds, selection, hovered, onHover, onZoneClick, onNeutral, revealData |
| `EMOTIONS` | `constants.js` | 8-sector array with valence, arousal, pupilTier, colors, angles |
| `computeRating(phase, emotionId, zone)` | `constants.js` | Returns `{rating, x, y}` for a given diagonal phase + zone |
| `getCompositeLabel(cx, cy)` | `constants.js` | Maps (x, y) coords to nearest sector name |

### FACS expression engine — AU summary

| AU | Muscle | Signal | Formula |
|---|---|---|---|
| AU1 | Frontalis medialis | Inner brow up | `neg(v) × (1 − pos(a)×1.5) + surpriseBrow` |
| AU2 | Frontalis lateralis | Outer brow up | `pos(v) × (0.3 + pos(a)×0.7) + surpriseBrow×0.7` |
| AU4 | Corrugator supercilii | Brow knit/lower | `neg(v)×0.35 + neg(v)×pos(a)×0.75` |
| AU5 | Levator palpebrae | Lid raise / wide eyes | `pos(a)×0.85` |
| AU12 | Zygomaticus major | Smile (corners up) | `pos(v)` |
| AU15 | Depressor anguli | Frown (corners down) | `neg(v)×neg(a)×1.4` |
| AU20 | Risorius + platysma | Lip stretch (horizontal) | `neg(v)×pos(a)×1.4` |
| AU25 | Orbicularis oris | Lip part/gap | `neg(v)×pos(a)×1.1` |
| AU27 | Pterygoids | Jaw drop / O-mouth | `neg(v)×pos(a)×1.3` (threshold 0.28) |
| AU43 | Relaxed levator | Lid droop | `neg(a)×0.7` |

All AUs multiplied by `intensityT` before SVG transforms. Eyelid uses fixed-top anchor geometry (top anchored at y=83; only lash line moves downward). Brows track lash lift (lashLift coupling at ×0.8).

Pupil uses discrete 3×3 table (pupilTier × intensityZone), not continuous formula — pupillometry is primarily arousal-driven, not valence-driven.

### Supabase table — `stillwater_responses`

```sql
CREATE TABLE stillwater_responses (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      timestamptz DEFAULT now(),
  participant_id  text,         -- from URL ?pid= or sessionStorage UUID
  pos_rating      int,          -- 1–7 (1=strong sad, 4=neutral, 7=strong excited)
  pos_x           float,        -- valence contribution from diagonal 1
  pos_y           float,        -- arousal contribution from diagonal 1
  neg_rating      int,          -- 1–7 (1=strong calm, 4=neutral, 7=strong tense)
  neg_x           float,
  neg_y           float,
  composite_x     float,        -- (pos_x + neg_x) / 2
  composite_y     float,        -- (pos_y + neg_y) / 2
  composite_label text,         -- nearest named sector
  ambivalence_x   float,        -- |pos_x − neg_x|
  ambivalence_y   float,        -- |pos_y − neg_y|
  ambivalence_mag float         -- Euclidean distance between the two rating vectors
);
ALTER TABLE stillwater_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon insert" ON stillwater_responses FOR INSERT TO anon WITH CHECK (true);
```

RLS allows anonymous insert. When integrated into the platform, add `user_id` FK → `profiles` and tighten to authenticated insert only.

### Game flow

1. **Intro screen** — illustrated diagonal diagram + two-step explanation (gold = axis 1, purple = axis 2)
2. **Phase 1** — Sad↔Excited sectors active only; live face updates on selection
3. **Phase 2** — Calm↔Tense sectors active only; live face updates on selection
4. **Reveal** — 0.6s pause → 1s ease-out animation: face transitions from neutral to composite; wheel highlights composite sector/zone; Supabase insert fires

### Scoring / points

Still Water is a check-in, not a scored game. Award **5 points** per completed check-in to `profiles.points`. No leaderboard. Track completion count in `profiles` (add `still_water_sessions` int column).

---

## 18. Face Read — Circumplex Identification Game

### Overview

Face Read presents a generated avatar face with a known emotional expression. The participant taps the area of the circumplex wheel that they think matches the face. Score is derived from the Euclidean distance between the tapped position and the correct position in (valence, arousal) space. Narrative framing: "A creature from the deep has surfaced. Can you read how it feels?"

**Route**: `/games/face-read`
**Access**: Protected
**Game name slug**: `face_read`

### Scientific paradigm

Inverse of Still Water: participant observes a face → maps to circumplex, rather than self-reports state → sees face. Measures:
- Circumplex reading accuracy (valence/arousal perception)
- Systematic biases (e.g. over-attribution of arousal, valence positivity bias)
- Learning curve across trials and sessions

### File structure

```
src/games/FaceRead/
  FaceRead.jsx            ← main game (intro → trial loop → session summary)
  useFaceReadSession.js   ← session state, trial generation, scoring, Supabase writes
```

Imports `ExpressiveAvatar`, `WheelSVG`, `EMOTIONS`, `calcExpr` from `../StillWater/`.

### Trial structure

**Per trial:**
1. Face is displayed at centre — neutral expression for 0.5s (preview)
2. Face animates to target expression over 0.8s (same easing as Still Water reveal)
3. Full wheel presented — all 25 zones clickable (8×3 + neutral)
4. Participant taps a zone
5. Feedback: correct zone glows green; tapped zone glows if different; score animates in
6. 1s pause → next trial

**Target generation:**
- Select a random emotion from EMOTIONS array (weighted toward all 8 equally)
- Select a random zone (0/1/2) — each weighted equally
- `intensityT = [1/3, 2/3, 1.0][zone]`
- Store `targetValence`, `targetArousal`, `targetIntensityT`, `targetSectorId`, `targetZone`

**Scoring:**
```js
// Circumflex coordinates for each zone within a sector:
// coord = emotion.valence * intensityT, emotion.arousal * intensityT
// Neutral = (0, 0)
// Distance: Euclidean in normalized (-1,+1) valence/arousal space
const MAX_DIST = 2 * Math.SQRT2;  // ≈ 2.828 — max possible distance
const dist = Math.sqrt((clickedX - targetX)**2 + (clickedY - targetY)**2);
const score = Math.round(Math.max(0, 100 * (1 - dist / MAX_DIST)));
```

Perfect hit = 100. Adjacent zone = ~85. Adjacent sector = ~60. Opposite corner = 0.

**Session length**: 10 trials. Configurable in `constants.js`.

**Session score**: mean of 10 trial scores (0–100).

### Feedback display

After each tap, show both face and wheel simultaneously:
- Correct zone: bright green glow `#1EA878`
- Tapped zone (if wrong): pink glow `#f068a4`
- Score badge animates in with the trial score
- Text: "Spot on!" (≥90), "Close!" (≥70), "Nearly!" (≥50), "Keep reading..." (<50)

### Session summary

After 10 trials, show:
- Mean accuracy score (large, prominent)
- Personal best and session count
- Breakdown: valence accuracy vs arousal accuracy (were they better at one dimension?)
- Leaderboard position (if public user)
- Points earned: `session_score / 10` rounded (max 10 points per session)

### Supabase schema additions

```sql
-- Add to game_sessions: no changes needed (game_name = 'face_read')

-- face_read_trials — one row per trial
CREATE TABLE face_read_trials (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id          uuid        REFERENCES game_sessions(id),
  user_id             uuid        REFERENCES profiles(id),
  trial_number        int,
  target_sector_id    int,        -- 0–7, index into EMOTIONS array
  target_sector_name  text,       -- 'Excited', 'Sad', etc.
  target_zone         int,        -- 0=mild, 1=moderate, 2=strong
  target_intensity_t  float,
  target_valence      float,
  target_arousal      float,
  clicked_sector_id   int,        -- null if neutral clicked
  clicked_zone        int,        -- null if neutral clicked
  clicked_valence     float,
  clicked_arousal     float,
  distance            float,      -- Euclidean in normalized space
  trial_score         int,        -- 0–100
  response_time_ms    int,        -- ms from face reveal to tap
  created_at          timestamptz DEFAULT now()
);

-- face_read_performance — one row per session
CREATE TABLE face_read_performance (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id          uuid        REFERENCES game_sessions(id),
  user_id             uuid        REFERENCES profiles(id),
  mean_score          float,      -- 0–100
  valence_accuracy    float,      -- mean |clicked_valence - target_valence| (lower = better)
  arousal_accuracy    float,      -- mean |clicked_arousal - target_arousal|
  trials_completed    int,
  created_at          timestamptz DEFAULT now()
);
```

RLS: users can insert and read only their own rows.

Add to `profiles`:
```sql
ALTER TABLE profiles ADD COLUMN face_read_sessions    int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN face_read_best_score  float;
ALTER TABLE profiles ADD COLUMN face_read_total_score float DEFAULT 0;
```

### Game card copy

**Name**: Face Read  
**Tagline**: "A creature has surfaced. Can you read how it feels?"  
**Description**: Study a face and tap where it lands on the feeling map. Train your eye for emotion.  
**Illustration concept**: Avatar face emerging from water, wide-eyed, expression ambiguous  


---

## 19. Farm Joy: Values Clarification Game

### Overview

Farm Joy is a values clarification game in which the participant pulls plants from a soil grid, sorts the revealed value words into Plant or Compost bins, then narrows down across two further rounds to identify a small set of core values. The progression is sorting → greenhouse → planting → harvest. Each visit samples a fresh subset from a 38 value taxonomy, so repeated play allows a stable signal of personal values to emerge.

Narrative framing: the participant is deciding what kind of values they want to grow to bring joy to their life. They experiment with harvesting from many known sources of value to see what works best. Over time, with repeated visits, the values that matter most should emerge as a consistent signal.

**Route**: `/games/farm-joy`
**Access**: Protected
**Game name slug**: `farm_joy`

### Scientific paradigm

Values clarification through forced binary choice (Plant or Compost) followed by ipsative selection (pick 6, then pick 3). Lineage: ACT (Acceptance and Commitment Therapy) values clarification, motivational interviewing, and Schwartz's hierarchical ranking work. The 38 item taxonomy combines plain language items from VIA Character Strengths, Schwartz Refined Theory, and the Rokeach Values Survey, collapsed and standardized for accessibility.

Construct measured: subjective endorsement of named values, and stability of endorsement across repeated sessions. Per session output is the participant's selected hierarchy: 24 sampled → up to N planted → up to 6 in greenhouse → up to 3 final. Across sessions, the cumulative value history table tracks how often each value survives each round, building a probabilistic signal of stable personal values.

### Value taxonomy (38 items, 7 categories)

| Category | Count | Items |
|---|---|---|
| Cognitive/exploration | 3 | Curiosity, Creativity, Wisdom |
| Character/conduct | 7 | Integrity, Courage, Self-control, Responsibility, Humility, Perseverance, Authenticity |
| Relational | 8 | Kindness, Love, Family, Community, Friendship, Forgiveness, Gratitude, Loyalty |
| Moral/civic | 4 | Fairness, Peace, Tolerance, Service |
| Hedonic/openness | 7 | Freedom, Agency, Adventure, Fun, Humor, Beauty, Nature |
| Meaning/order | 5 | Hope, Spirituality, Tradition, Security, Presence |
| Wellbeing/self | 4 | Health, Achievement, Influence, Growth |

### Per-session sampling

Each session randomly samples 24 of the 38 values, stratified by category for breadth:

| Category | Pool | Sample |
|---|---|---|
| Cognitive/exploration | 3 | 3 |
| Character/conduct | 7 | 4 |
| Relational | 8 | 4 |
| Moral/civic | 4 | 3 |
| Hedonic/openness | 7 | 4 |
| Meaning/order | 5 | 3 |
| Wellbeing/self | 4 | 3 |
| **Total** | **38** | **24** |

Sampling is fresh each session (no memory of recent draws). The 24 sampled words are logged so retrospective analysis can adjust for exposure imbalance.

### Veggie sprites

24 PNG sprites in `public/images/veggies/`. Filenames: `beet.png`, `carrot.png`, `daikon.png`, `garlic.png`, `ginger.png`, `horseradish.png`, `kohlrabi.png`, `leek.png`, `onion.png`, `other1.png`, `other2.png`, `other3.png`, `other4.png`, `other5.png`, `other6.png`, `other7.png`, `parsnip.png`, `potato.png`, `potato_boots.png`, `radish.png`, `rutabaga.png`, `sweetpotato.png`, `taro.png`, `turmeric.png`.

Each session shuffles all 24 sprites and assigns one to each of the 24 sampled values — every veggie is unique per session (24 sprites for 24 values). Mapping is fixed within a session: the same value always uses the same veggie across rounds 1, 2, and 3.

### File structure

```
src/games/FarmJoy/
  FarmJoy.jsx                ← main FSM, owns session state
  constants.js               ← CFG, PHASE enum, sampling helpers
  data/
    values.js                ← 38 values across 7 categories
    veggies.js               ← 24 sprite names + value→veggie helper (1:1, no repeats)
  hooks/
    useFarmJoySession.js     ← Supabase writes, session lifecycle
  components/
    FarmField.jsx            ← Round 1 background (built; see §19 Status)
    Greenhouse.jsx           ← Round 2 background (built)
    FarmRow.jsx              ← Round 3 + Harvest background (built)
    Veggie.jsx               ← single sprite renderer
    PullAnimation.jsx        ← Mario-style yank animation overlay
    ValueCard.jsx            ← revealed value word, flips into veggie
    SortBins.jsx             ← Plant + Compost bins for round 1
    FeedbackPrompt.jsx       ← yes/no + 30 char text overlay
    Intro.jsx                ← landing screen with narrative
    HarvestSummary.jsx       ← final core values + closing copy
```

### Game flow (state machine)

```
INTRO
  ↓
ROUND_1_SORTING                          // 24 mounds in 4×6 grid
  ├── (zero plants) → ZERO_PLANT_FEEDBACK → SESSION_END
  └── (≥1 plant)    → ROUND_2_GREENHOUSE
ROUND_2_GREENHOUSE                       // up to 6 in 2×3 pots
  ↓ confirm
ROUND_3_PLANTING                         // up to 3 across 3 rows
  ↓ confirm
HARVEST                                  // chosen veggies multiply across rows
  ↓
SESSION_COMPLETE
```

Underfull feedback (Round 2 < 6, Round 3 < 3) renders as an overlay modal that pauses underlying state. Always optional, never blocks progression.

### Round 1: Sorting

- 24 mounds with green stalks in a 4×6 grid (FarmField component)
- Tap mound → pull animation → ValueCard reveal → tap Plant or Compost
- Each plant decision is a discrete trial with a recorded RT (mound tap to bin tap)
- After all 24 sorted: if zero plants, trigger zero-plant feedback overlay; else advance to Round 2

**Zero-plant feedback copy**:

> Sorry, we didn't plant any seeds you value this time. Each visit to the farm only shows you some of the options. Want to share what we missed that you'd have said 'yum' to?

Yes / No buttons. If Yes, single 30 char text input. Either path closes with: *"Thanks for visiting. Come back and play again soon."*

### Round 2: Greenhouse

- 6 terracotta pots in 2×3 grid (Greenhouse component)
- Planted values from Round 1 are visible at the bottom of the screen as veggies
- Tap a veggie to select; tap a pot to place. Tap a placed veggie to remove.
- Up to 6 can be in pots simultaneously
- If fewer than 6 plants exist from Round 1, pots autofill with all available
- Confirm advances to Round 3
- If pots underfull at confirm time, trigger underfull feedback overlay

**Underfull feedback copy**: *"What values would fill your bowl?"* (yes/no + 30 char text mechanics, same as zero-plant)

### Round 3: First Planting

- 3 row spots in 3 horizontal soil bands (FarmRow component, `cropsPerRow={[1,1,1]}`)
- Greenhouse veggies visible at top of screen
- Tap to select, tap a row to place
- Reset and re-pick allowed
- Up to 3 placements
- Confirm advances to Harvest
- If fewer than 3 placed at confirm time, trigger underfull feedback overlay

**Underfull feedback copy**: *"What values would fill your fork?"* (yes/no + 30 char text mechanics)

### Harvest

- FarmRow with `cropsPerRow={[6,6,6]}` (or `[6,6,0]` etc. if user only chose 1 or 2)
- Each chosen veggie animates outward from its planting position, multiplying across the row in stagger
- Final copy:

> Amazing, here's what you have selected as your core values. We hope you can find ways of realizing them today.

The chosen values are listed below the visual.

### Interactions

**Tap-to-confirm** throughout (no drag-and-drop). First tap selects (visual highlight), second tap places at destination. Reliable on mobile, accessible.

**Pull animation** (Round 1): Framer Motion or rAF, never CSS keyframes (Safari compatibility, consistent with platform pattern).

**Harvest multiplication**: Framer Motion stagger, originating veggie spawns duplicates outward across its row.

### Scoring / points

- 10 points for completing harvest
- 5 points for ending early at zero-plant feedback (showed up, deserves recognition)

### Supabase schema

#### `farm_joy_trials` (one row per value shown)

```sql
CREATE TABLE farm_joy_trials (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      uuid REFERENCES game_sessions(id),
  user_id         uuid REFERENCES profiles(id),
  trial_number    int,             -- 1 to 24
  value_word      text,
  category        text,
  veggie          text,            -- sprite assigned this session
  round1_choice   text,            -- 'plant' | 'compost'
  round1_rt_ms    int,             -- mound tap to bin tap
  in_greenhouse   boolean,         -- chose for Round 2?
  in_final        boolean,         -- chose for Round 3 final?
  created_at      timestamptz DEFAULT now()
);
```

#### `farm_joy_performance` (one row per session)

```sql
CREATE TABLE farm_joy_performance (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id          uuid REFERENCES game_sessions(id),
  user_id             uuid REFERENCES profiles(id),
  values_sampled      jsonb,         -- 24 word array
  values_planted      jsonb,         -- yum list
  values_greenhouse   jsonb,         -- up to 6
  values_final        jsonb,         -- up to 3
  ended_early         boolean,       -- zero plants
  round1_duration_ms  int,
  round2_duration_ms  int,           -- null if ended early
  round3_duration_ms  int,           -- null if ended early
  created_at          timestamptz DEFAULT now()
);
```

#### `farm_joy_feedback` (one row per feedback event)

```sql
CREATE TABLE farm_joy_feedback (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id         uuid REFERENCES game_sessions(id),
  user_id            uuid REFERENCES profiles(id),
  round_triggered    int,             -- 1, 2, or 3
  user_responded     boolean,         -- yes / no to the prompt
  suggested_value    text,            -- max 30 chars
  values_sampled     jsonb,           -- the 24 they saw, for taxonomy gap analysis
  created_at         timestamptz DEFAULT now()
);
```

#### `farm_joy_value_history` (cumulative, one row per user × value)

```sql
CREATE TABLE farm_joy_value_history (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES profiles(id),
  value_word       text,
  times_shown      int DEFAULT 0,
  times_planted    int DEFAULT 0,
  times_greenhouse int DEFAULT 0,
  times_final      int DEFAULT 0,
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (user_id, value_word)
);
```

Upserted at session end with simple counter increments. Max 38 rows per user. Probabilities computed client-side: `P(plant|shown)`, `P(greenhouse|planted)`, `P(final|greenhouse)`, overall `P(final|shown)`. Future use: stable values panel on profile, smart sampling biased toward under-tested values, longitudinal trends.

#### Profile additions

```sql
ALTER TABLE profiles
  ADD COLUMN farm_joy_sessions int DEFAULT 0,
  ADD COLUMN farm_joy_last_core_values jsonb;
```

RLS on all four tables: users can insert and read only their own rows.

### Background components (already built)

`FarmField.jsx`, `Greenhouse.jsx`, and `FarmRow.jsx` are pure presentation components built ahead of architecture. Each uses viewBox 680×1020 (mobile-first portrait), shares the same color palette, and renders a static SVG with depth-illusion ridge/furrow shading. All three accept tap callbacks; they emit `{row, col}` events. They take no game state, just visual config.

**FarmField props**: `pulledMounds` (Set of `"row-col"` strings), `onMoundClick(row, col)`, `seed` (optional, deterministic stalk distribution), `className`. Stalk variants randomized per mount via mulberry32 PRNG. 5 stalk variants distributed across 24 mounds.

**Greenhouse props**: `onPotClick(row, col)`, `className`. Fixed 2×3 layout. Pot fill state lives in parent.

**FarmRow props**: `cropsPerRow` (array of 3 numbers), `onMoundClick(row, col)`, `className`. Mound x positions auto-distribute based on count via `moundXPositions()` helper. Same component handles planting state (`[1,1,1]`) and harvest (`[6,6,6]`).

Source files generated in claude.ai design conversation 2026-05-08, ready to drop into `src/games/FarmJoy/components/`.

### Game card copy

**Name**: Farm Joy
**Tagline**: "Plant the values that grow joy."
**Description**: A short visit to your value garden. Sort, narrow down, and harvest the values that matter most. Each visit deepens your sense of what you want to cultivate.
**Illustration concept**: Soil grid with green stalks, one mound mid-pull revealing a value card

### Status

Specced. Three background components built (FarmField, Greenhouse, FarmRow) and saved as React components. Main game FSM, value taxonomy data files, Supabase schema, and remaining components pending Claude Code handoff.

---

## 20. Breath Belt: Respiratory Interoception Thresholds

### Purpose

Breath Belt is a lab-only psychophysics study measuring how well participants can detect changes in their own breathing pace. It uses a Polar H10 chest belt (via Web Bluetooth) to record respiratory acceleration data, and a COM port trigger box to send synchronisation signals to the physio equipment. The study runs in Chrome/Edge only (Web Bluetooth requirement).

**Conference demo (2026-07)**: `src/games/BreathBelt/BreathBeltDemo.jsx` at `/demo/breath-belt` — unauthenticated, writes nothing (no Supabase, no CSV, no-op triggers, no COM/Biopac step). Flow: pairing → real MLR calibration with review panel → 3 paced trials with post-trial SignalGraph + sync chips → 2 hardcoded change-detection trials (speed up 4s→3s, then slow down 4s→5s) with 3AFC + confidence + arousal ratings and a reveal graph → summary. `?sim=1` rehearses without a belt. Trial graphs (paced + detection): trials run under the `'phase2'`/`'phase3'` labels so `useBeltConnection` collects raw accel, and `useTrialRunner` returns `syncMetrics` de-trended the same way as the calibration graph (avoids the raw `breathValueRef` baseline drift that made the belt line ramp). `useGraphSampler` (live `breathValueRef` vs pacer) is the fallback so graphs still render in `?sim=1` with no belt. **Directional adherence** on detection trials ports the exact method from Study 5's `Intero2025_BehaviourLedBreathAnalysis.R` (`direction_correct = sign(observed_dur_change) == sign(delta)`): detect breath-onset troughs in the de-trended belt signal, per-breath durations = diff(trough times), `observed_dur_change = mean(dur3,dur4) - mean(dur1,dur2)` in seconds, compared in sign to the cued `delta` (positive = slower/longer). Runs on the same beltPts already built for the graph — what the audience sees is what gets scored. Displayed directly on the graph screen in both phase 2 and phase 3 as "Expected" / "Observed" chips (Slower/Same/Faster, classified from the signed duration change with a ±0.25s same-band — a demo judgment call, not from the paper) plus the four raw breath durations underneath.

**Filtering architecture (fixed 2026-07-07)**: Study 5's pipeline (`run_pipeline` in `breath_pipeline.R`) filters the entire continuous recording once via `filtfilt`, then extracts each trial's troughs from that already-filtered signal. The demo initially re-ran `filtfilt` on each short (~18s) per-trial window in isolation — `filtfilt` has no data outside a window to reference, so it distorts amplitude near the edges by an amount that depends on where the true breath boundaries land relative to the cut, varying trial to trial (symptom: worked on trial 1, then failed). `buildCleanGraph` now filters the whole accumulated session once (`belt.rawAccelRowsRef`, always populated) and slices each trial's window out of that result, matching the study's architecture and giving `filtfilt` full context on every trial. Reuses `useBeltConnection`, `useTrialRunner`, `CalibrationScreen`, `SignalGraph`, shared rating scales.

**Keynote opener (2026-07)**: `src/games/BreathBelt/PacerOpenerDemo.jsx` at `/demo/pacer-opener` — the whole-room *opening* exercise (distinct from the instrumented closing demo above). No device, no Bluetooth, no data. A full-screen breathing circle (driven by the same `useBreathCycle` timing engine as the strap demo, so the two visually rhyme) runs one fixed BCAT trial: 2 baseline breaths at **5s (12 bpm — confirmed with Norm for a cold room, vs the paper's 15 bpm)** then 2 accelerated breaths at 3.5s (~30% faster, change onset breath 3). Then presenter-advanced polling screens (Did the pace change? / How confident? / Arousal?) polled by show of hands — no audience input captured — and a reveal ("the pace accelerated from breath 3"). Presenter controls: Begin · Advance · Reset, on-screen buttons **and** keyboard (Space/Enter/→/PageDown advance, R resets) for presentation clickers. Runs fully client-side once loaded; pre-load the page before going offline.

**Keynote deck (2026-07)**: `src/pages/keynote/Keynote.jsx` (+ `graphics.jsx`) at `/keynote` — 24-slide click-through single-page deck replacing PowerPoint, doubling as a permanent read-later resource. (Slide 14 is a MAIA intro — "What do people know about their own interoception?" — before the confidence-vs-sensitivity scatterplots on 15; slide numbers below the belt clincher shifted +1 accordingly.) Click anywhere (or ←/→/Space) advances; no clicker dependency. **Minimal ↔ Reading density toggle** (top-right, persisted in localStorage) — Minimal for stage, Reading folds the spoken supporting text into each slide for standalone reading; built both ways so Norm can compare. Speaker-notes overlay (button or "N") holds figure sources + spoken-only content, off by default. The two live demos are **not embedded** — slides 4 (`/demo/pacer-opener`) and 22 (`/demo/breath-belt`) link out in a new tab; presenter returns and clicks on. Crests: `RADlab_Logo_light.svg` + `UofT_Logo.svg` (already in repo/in use — licensing settled). Figures: BCAT behavioral figures live in `public/keynote/` (`fig-detection-curve`, `fig-arousal-gating` wired to slides 11/12; `fig-staircase` on slide 9; regime/mediation/confidence figures also copied for later use); neuroimaging figures **now wired** (extracted from `resources/ISRP20206figs/neuroslides.pptx`): `fig-eneuro-3` (whole-brain deactivation + MAIA scatter) slide 16; `fig-eneuro-4` split into panels A/B (`fig-eneuro-4a` ACC×MAIA sparing on slide 17, `fig-eneuro-4b` DAN maps revealed on slide 18 — cropped via System.Drawing at 50.5% width); `fig-ejn-classifier` slide 20, `fig-brainsci-training` (converted from embedded TIFF) slide 20. Figures are click-to-enlarge (fullscreen lightbox) and results slides use a wide frame (min(1280px,95vw)) so landscape figures fill the screen. The Figure component still falls back to a captioned dashed placeholder if any file is missing. MAIA-J items table (pptx slide 1) intentionally not used — supplementary reference, not a result. Original SVG graphics built fresh in `graphics.jsx`: position icons (6), salience×magnitude schematic (8), annotated missed-trial belt trace showing where the correct-direction adherence score comes from (13), two illustrative MAIA scatterplots rendered from reported correlations r=.260 / r=.071 (15), neural pathway flow (19), pacer-attention illustration (22). Figures preloaded on mount so click-through never stalls on stage.

**Shared breath-signal layer (2026-07-08)**: `src/games/shared/breath/` extracts the Polar-H10 biofeedback plumbing out of BreathBelt so any future game is just a visual mapping on a common signal API. Three files:
- `useBreathSignal.js` — hook wrapping BLE connect + MLR calibration (state-machine and calibration callbacks are prop-compatible with `BreathBelt/components/CalibrationScreen`, reused verbatim) + live feature derivation. Exposes `signalRef.current = { t, value (0–1 breath amplitude), phase ('inhale'|'exhale'|'pause'), bpm, regularitySdMs, lastPeriodMs, hr, rsaMs, lagMs }` polled inside rAF/interval (never React state), plus `getRecentBreath(ms)/getRecentRR(ms)/getRecentHr(ms)` history slices (60 s kept) and `onBreathEvent(cb)` for inhale/exhale-onset transitions. Live MLR runs in 8-sample sub-chunks so games get ~25 Hz updates instead of ~5 Hz per BLE packet. Sim mode (`?sim=1`) drives a sine breath + RSA-coupled fake heartbeat, backfilling 40 ms steps to survive background-tab timer throttling; `setSimPeriodMs()` retunes it live.
- `breathFeatures.js` — pure (React-free, node-testable) extractors: `parseHrPacket` (GATT 0x2A37, now also decodes **RR intervals** at 1/1024 s — the raw material for RSA/HRV feedback that BreathBelt's original HR handler discarded), `createPhaseDetector` (range-normalized slope with hysteresis deadband → inhale/exhale/pause), `createRateTracker` (onset-to-onset median bpm + SD regularity), `rsaAmplitudeMs` (max−min RR over a window), `createHistory` (age-trimmed ring buffer).
- `BreathLab.jsx` at `/dev/breath-lab` — dev instrumentation page (unauthenticated, writes nothing; `?sim=1` for beltless). Live phase-colored breath oscilloscope + RR tachogram (canvas, drawn on setInterval not rAF so traces survive tab switches) with rate/regularity/HR/RSA chips and a breath-event ticker. Ground-truth surface for prototyping biofeedback game mappings. Verified end-to-end in `?sim=1`.
  - **Signal-quality monitor (explained-variance)**: the breath signal is a fixed 1-D projection (calibration weights) of the filtered x/y/z; `createQualityTracker` computes `EVR = uᵀΣu / trace(Σ)` over a rolling 15 s covariance — the fraction of tri-axial breathing variance still captured by that projection. Drops when posture/belt-fit change rotates the breath onto a different axis (the signal flatlines even though the chest still moves); `totalVar` (= trace Σ) separates that from a breath-hold (posture change keeps totalVar high while EVR falls; a hold drops both). Verified on synthetic data: on-axis EVR ≈ 0.999, off-axis ≈ 0.000, totalVar invariant to rotation. `processPacketMLR` now returns the last filtered axes to feed it; exposed as `signalRef.qualityEvr` / `qualityTotalVar`, with a debounced `signalDegraded` flag (EVR < 55% of a post-calibration baseline while totalVar stays > 50% → sustained 4 s). The lab shows an EVR chip and, when degraded, a warning banner prompting re-calibration. Same Σ is the input a future PCA background auto-recalibration would use (top eigenvector = current breath axis).
  - **Background auto-recalibration (PCA)**: `useBreathSignal({ autoRecal })` (default on). When `signalDegraded` latches, instead of only warning, the quality tracker's `proposeRecal()` power-iterates the top eigenvector of the same rolling covariance (the current dominant breath axis) and re-projects onto it — expressed as the same `{bias, weights}` linear model the live path already consumes (`value = (u·f − lo)/range`), with sign chosen for polarity continuity vs the old axis and scale/offset from robust (10th/90th) percentiles, so no pacer and no re-breathing needed and `processPacketMLR` is unchanged. Gated: 20 s cooldown, skip while total variance spikes (motion artifact), only accept a new axis capturing ≥70% variance that beats current EVR by ≥10 pts; on accept it swaps the model, re-anchors the baseline, and emits an `auto_recalibrated` event (lab shows a transient "re-anchored" toast + an Auto-recals count, and a toggle). Validated offline on the sit→stand→slouch recording: the breath axis rotates 32–40° with posture, `proposeRecal` restores EVR to 97–99% in every posture, and the closed-loop sim fired once at 86 s (standing), EVR 62%→97%, staying healthy after. When auto-recal can't find a clean axis (e.g. mid-artifact) the degraded banner still surfaces for manual re-calibration.
  - **Re-calibrate button** (recorder panel + degraded banner): re-runs calibration from the lab without leaving the page; on completion returns to the live view. `resetCalibration`/re-fit clears the quality baseline so it re-anchors to the new fit. Routes through the NONE "ready" screen (not straight to FIXATION) to avoid a StrictMode mount-time timer hang.
  - **Session recorder** (top panel, schema 2): Record → breathe → Stop → Download JSON. Captures 50 Hz `signalRef` snapshots — now including the **filtered axes** (`fx/fy/fz`) and **live signal-quality** (`evr`, `totalVar`, `degraded`), plus `regularityCv`, and the projection **weights** in `meta` — so EVR can be recomputed and its thresholds re-tuned offline. `src/games/shared/breath/analyzeRecording.mjs` reports per-10 s posture/quality (value SD, clamp-saturation % as a motion-artifact proxy, rate, and EVR/degraded episodes; degrades gracefully on schema-1 files). A posture-change test recording (2026-07-08: erect→stand→slouch) confirmed the failure modes to handle — ~85–96% clamp-saturation motion artifacts at the get-up/sit-down transitions, and a genuine slouch flatline (value SD 0.02–0.05 with the rate tracker then reading noise as 16–17 bpm). Full EVR-detector validation awaits a schema-2 posture recording. Captures 50 Hz `signalRef` snapshots (`{t, value, phase, bpm, lastPeriodMs, regularitySdMs, hr, rsaMs}`) + breath-onset events + calibration/provenance meta, as a self-contained replay artifact. Keep the tab focused while recording (background tabs throttle the sampling interval). The file (lands in Downloads) is the hand-off for offline game tuning — a lab member records a real belt session and gives the JSON to Claude, which reads it and replays it through the game mechanics deterministically (no belt, no tab-throttle). Replay harness: `src/games/Ember/replayRecording.mjs` — `node src/games/Ember/replayRecording.mjs <recording.json>` prints the rate distribution, warmth trajectory, time-in-resonance, and time-to-catch so `Ember/constants.js` can be tuned against real breathing.

**Mirror — breath-driven avatar + adaptive materializing calibration (2026-07-10)**: an interaction where the avatar pulses to the wearer's live breath, plus a calibration reframed as "the avatar learns to mirror you." Built on the shared layer. Lives at **`/demo/mirror`** (unauthenticated, writes nothing; `?sim=1` beltless) with the same WELCOME → CONNECT → CALIBRATE → PLAY shell as Ember; also previewable on `/dev/breath-lab` (calibration mode selector: **Mirror** vs **Standard**). Targets **natural-rate breathing (~12 bpm)**, not resonance, so the calibration pace (~5 s) and both filter passbands line up.
- **`Mirror.jsx`** (`src/games/Mirror/`): the demo surface. CALIBRATE renders `MirrorCalibration`; on COMPLETE it `resetFeatures()` (re-anchoring the pulse range to play-time breathing) → PLAY, where a large `AvatarBreathPacer` is driven by `getLevel` = the smoothed live auto-ranged value, with a soft glow that breathes with it. No score — a calm "it follows you" stage.
- **`mirrorCalibration.js`** (pure, React-free, node-tested — `mirrorCalibration.test.mjs`, 25 checks): four primitives.
  - `createAmplitudeRanger` — live auto-ranging of the breath value: keeps the calibrated *axis* but re-derives the 0..1 gain/offset from rolling robust percentiles (5th/95th over 30 s) of the raw projection. Fixes the frozen-calibration clamping that makes a breath-driven pulse flat-top on deep breaths / shrink on shallow ones (Pearson-R calibration is scale-invariant, so a great fit can still clip in play).
  - `createCalibrationMonitor` — composite calibration **confidence** as a weighted geometric mean (a soft AND: one bad factor tanks it) of four independent factors: **tracking** (|r| vs the paced avatar), **clarity** (EVR, variance on the top axis), **axis lock** (angular convergence of the breath axis between window halves), **strength** (breath excursion ÷ high-freq noise floor = SNR). Gated by **rhythm** (regular, in-band peaks) and **motion** (totalVar spike) checks. The same decomposition routes **coaching** by *fundamentality* — acquisition (strength→clarity) before artifacts (motion→rhythm) before behavior (lock→tracking) — so the earliest broken link (the root cause) names the prompt, not whichever number is numerically lowest. Coaching strings map each failure to plain guidance ("check the strap is snug…", "breathe a little deeper…", "let your shoulders relax…", etc.).
  - `createRunningProjector` — running-PCA provisional breath axis (top eigenvector of a rolling covariance) so the monitor has a scalar breath signal *before* any model is fitted; sign is arbitrary (tracking uses |r|; the final supervised fit fixes polarity).
  - `createCalibrationSession` — wraps projector + monitor + the **adaptive stop policy** (min 20 s / ≥4 breaths, accept at confidence ≥ 0.85 held 3 s, ceiling 60 s → `timeout` status). One object shared by the hook and the tests so behaviour is identical.
- **Materialization** (`MirrorCalibration.jsx`): the avatar breathes at the pace and **fades in from a blurred ghost to solid as confidence climbs** (opacity `0.10→1.0`, blur `7→0 px`, plus a confidence ring). Honest biofeedback about the *calibration itself* — people settle and breathe evenly to make themselves appear. On sustained-confident it finalizes the real `fitBestModel` fit (→ REVIEW); on stall it surfaces the weakest-factor coaching live (with "Use this" / "Start over") while collection continues. Coaching is suppressed until the session has enough samples to diagnose ("settling in…").
- **Hook wiring** (`useBreathSignal`): opt-in `mirrorMode` (runtime-toggleable via `setMirrorMode`) applies the auto-ranger to the live `value`; `beginMirrorCollection`/`acceptMirrorNow` run the adaptive path (BREATHE stops on confidence, not the fixed 4-breath timer — the timer effect is skipped when a session is active). The live confidence snapshot is on `signalRef.current.calib`. `runFit` extracted so both paths share the fit+review. **Off by default — Ember and the BreathBelt study are untouched** (frozen calibration gain, fixed 4-breath calibration). Sim (`?sim=1`) synthesizes tri-axial accel from the pacer so the whole confidence path runs beltless.
- **`AvatarBreathPacer` `getLevel` prop**: when supplied, the avatar's scale/eyes/brows track a live breath level directly instead of the clock cosine — the mechanism by which the avatar "follows you." Backward-compatible (falls back to `getPhase`).
- **Verified**: 25 headless checks (confidence factors, coaching routing, ranger range-recovery, adaptive convergence-vs-timeout); production build clean; **Playwright sim smoke** on `/dev/breath-lab?sim=1` — materialization 0→100 %, converged to REVIEW, reached LAB pulse preview, zero runtime errors. On-belt tuning of the confidence thresholds is the next step (all gathered at the top of each factory).

- **Field-tuning pass on first real belt recordings (2026-07-13)**: three fixes from a live-belt test. (1) **Calibration confidence stalled at ~33%** — the rhythm gate false-failed because naive local-maximum peak-picking latched onto secondary intra-breath bumps and reported ~2× the true rate (27 bpm vs 12 on the recording), inflating period CV and slamming the gate's hard 0.45× penalty. Fixed: breaths are now counted as **detrended upward zero-crossings** (validated 27→12 bpm, CV 0.37→0.20); **tracking correlation is lag-aligned** (best |r| over a ≤0.8 s belt-vs-pacer lag) so a genuinely good phase match isn't penalized by physiological/filter delay; gates softened (0.45→0.70×) and tracking up-weighted (the meaningful signal). A good calibration now climbs to ~100% instead of capping near the gate penalty. (2) **Materialization was invisible at low confidence** — added an always-visible head outline (a thin ring, no fill) that breathes with the pacer and fades out as the face arrives; it now reads as "empty circle → face materializing inside a confidence ring." (3) **The breath-follow avatar sat frozen** — `AvatarBreathPacer` deliberately never auto-started its RAF (waiting for the calibration/trial loop's `resumeAnimation()`); it now **auto-runs when `getLevel` is supplied**, so both the `/dev/breath-lab` preview and the `/demo/mirror` PLAY avatar actually pulse. Also added an optional **calibration-trace export** (`createCalibrationSession.getTrace()` → `signalRef` `calibTraceRef`, "⤓ Calibration data" button in the lab) capturing raw axes + pacer + per-assess confidence factors, so the confidence engine can be tuned offline on real calibration data (the play-time recorder only captured post-calibration). All verified in a browser sim smoke; 27 headless checks (added a double-bump regression).

**Ember — breath biofeedback campfire (2026-07-08)**: `src/games/Ember/` at `/demo/ember` — the first game built on the shared breath-signal layer, and the reference every later breath game copies. A campfire you keep alive with your breath: slow, steady breathing feeds the flame; fast/ragged breathing guts it to embers and smoke. Unauthenticated, writes nothing (demo-only); `?sim=1` rehearses beltless with an in-play sim breath-rate slider. Screen flow mirrors BreathBeltDemo (WELCOME → CONNECT → CALIBRATE → PLAY → SUMMARY) and reuses `CalibrationScreen` verbatim.
- **Two-layer mapping** (the core design): instantaneous rate (`lastPeriodMs`, responsive — *not* the laggy median `bpm`) drives the strategic *warmth accumulator* `W∈[0,1]` (the score, tens of seconds), while `value`+`phase` drive tactical within-breath flicker so the flame always breathes with you while `W` slowly converges. `warmthDelta = rateGain(rate) · regularityFactor · RATE_PER_S · dt`, where `rateGain` is +1 at ≤6 bpm (resonance), 0 at 10, −1 at ≥14; regularity gates only gains, never the drain. Win beacon: sustain `W ≥ 0.85` for 10 s continuously → the fire "catches" (celebratory spark burst + "roaring"); no hard-fail, endless until the user hits Finish. Summary reports max warmth, longest steady stretch, time in the resonance zone, mean bpm.
- **Tuned against a real 4.5-min belt session (2026-07-08)**: fill `RATE_PER_S=1/18`; regularity gate switched from absolute SD to **coefficient of variation** (`regularityFactor = clamp(1 − cv/0.35, 0.60, 1)`) because absolute SD unfairly penalizes slow breathing (longer periods carry larger absolute jitter) — `createRateTracker` now exposes `regularityCv` (SD/mean-period) alongside `regularitySdMs`, and it's on `signalRef.regularityCv`. With these, the recorded session catches at 216 s (~60 s into a sustained slow stretch); it previously peaked at 74% and never caught. Verified via `replayRecording.mjs` (which backfills `regularityCv` from SD+bpm for recordings predating the field). Unit tests updated (9 pass); live `?sim=1` flow re-verified clean.
- **Files**: `emberMechanics.js` (pure transfer functions — warmth, flame geometry, color ramp, metrics; **node-testable**, imports use explicit `.js` for that reason) + `emberMechanics.test.mjs` (9 checks, run `node src/games/Ember/emberMechanics.test.mjs`); `constants.js` (all tuning knobs in one place); `Campfire.jsx` (the canvas — reads `signalRef` in a setInterval loop, owns `W`+particles+beacon+metrics, no React state per frame); `Ember.jsx` (screen-flow shell).
- **`resetFeatures()`** added to `useBreathSignal` and called on CALIBRATE→PLAY: clears the phase/rate/regularity trackers (not the fitted belt model) so the fire reflects play-time breathing rather than the 15 bpm calibration pace, which would otherwise pollute the regularity window for ~a minute.
- Verified in `?sim=1`: full flow, rich canvas render (whole 520² filled, ~1900 distinct colors), signal pipeline (rate tracked correctly 15→5.4 bpm as the sim slowed), metrics→summary populated, console clean. Note: `Campfire` draws on setInterval (not rAF) with a 0.1 s `dt` cap — the cap stops a backgrounded tab-away from dumping a huge warmth jump on return; in a foreground 30 fps tab warmth accrues correctly, and the rise-to-1.0/catch math is proven by the unit test (headless observation of long accumulation is unreliable because Chrome deep-throttles hidden-tab timers).

Access is gated internally by the component: only users with `profiles.role` of `'lab'` or `'admin'` can proceed past the browser check. All other users see an "Access restricted" screen.

Route: `/games/breath-belt`

### Phase flow

```
BROWSER_CHECK → BT_CONNECT → COM_CONNECT
→ SESSION_SETUP   (researcher enters session number)
→ CALIB_READY → CALIBRATING   (CalibrationScreen manages sub-states)
→ BASELINE_READY → BASELINE_RECORDING → BASELINE_COMPLETE   (120 s, COM triggers)
→ PHASE2_READY → PHASE2_RUNNING   (9 fixed trials)
→ PHASE2_REVIEW → PHASE3_INTRO → PHASE3_RUNNING   (dual-QUEST until converged)
→ POST_BASELINE_READY → POST_BASELINE_RECORDING → POST_BASELINE_COMPLETE   (120 s, COM triggers)
→ SESSION_COMPLETE
```

### Hardware

- **Polar H10**: Bluetooth LE chest belt. Streams raw accelerometer (ACC) and heart rate (HR) data. ACC signal is used as a proxy for respiratory effort. Connected via Web Bluetooth in `useBeltConnection.js`.
- **Trigger device**: sends 1-byte event codes to the physio recording system at trial start/end and at baseline start/end. Connected separately after BT. Two transports are supported (chosen per session — see *Trigger devices & transports* below): the **AD_BBT** rig uses a Web Serial COM box; the **Biopac** rigs use a parallel-port card driven through a local helper server.

### Trigger vocabulary (codes 1–13)

All codes fit in a single byte. Codes 1–9 are fired from `BreathBelt.jsx` at FSM transitions; codes 10–12 are fired from `useTrialRunner.js` within each trial; code 13 is session end.

| Code | Event | Fired from |
|------|-------|------------|
| 1 | Session start | `BreathBelt.jsx` — pre-baseline `onStart`, just before code 2 |
| 2 | Pre-baseline start | `BaselineScreen` — via `triggerStart='2'` prop on recording start |
| 3 | Pre-baseline end | `BaselineScreen` — via `triggerEnd='3'` prop on recording end |
| 4 | Phase 2 start | `BreathBelt.jsx` — `useEffect` watching `phase === PHASE2_RUNNING` |
| 5 | Phase 2 end | `BreathBelt.jsx` — `FixedTrialsScreen` `onComplete` handler |
| 6 | Phase 3 start | `BreathBelt.jsx` — `useEffect` watching `phase === PHASE3_RUNNING` |
| 7 | Phase 3 end | `BreathBelt.jsx` — `StaircaseScreen` `onComplete` handler |
| 8 | Post-baseline start | `BaselineScreen` — via `triggerStart='8'` prop on recording start |
| 9 | Post-baseline end | `BaselineScreen` — via `triggerEnd='9'` prop on recording end |
| 10 | Trial start | `useTrialRunner.js` — baseline breaths begin |
| 11 | Condition onset | `useTrialRunner.js` — breath 3 begins (baseline→condition boundary) |
| 12 | Trial end | `useTrialRunner.js` — after condition breaths complete |
| 13 | Session end | `BreathBelt.jsx` — after `endSession()` resolves in post-baseline `onComplete`, and on mid-session unmount |

Codes 10/11/12 are reused across Phase 2 and Phase 3. The preceding phase code (4 or 6) establishes context in the lab belt signal.

**Code 0 is the line-clear, not an event marker.** Every trigger pulses its value high for ~25 ms then writes 0 to clear the lines (on AD_BBT, `"00"` is the Black Box ToolKit clear command, so session end uses 13 to stay a distinct marker). The same 1→13 sequence is replayed as a connection test on connect (see below).

### Trigger devices & transports

Each testing rig uses different physio equipment, so the RA picks a **trigger device** on the connect screen (`COM_CONNECT`) — *before* connecting, since the device determines the transport. `TRIGGER_DEVICES` (in `constants.js`); default `AD_BBT`. The choice is persisted to `belt_sessions.trigger_device`.

| Device | Transport | Encoding |
|---|---|---|
| `AD_BBT` (default) | Web Serial COM box (Black Box ToolKit USB TTL Module) | 2-char uppercase hex per code, `"RR"` init on connect, `"00"` clear |
| `Biopac_Right` | Parallel-port card via local helper, port `0xD030` | code sent as-is (`shift: 1`) |
| `Biopac_Left` | Parallel-port card via local helper, port `0xDFF8` | code on the high nibble (`shift: 16`, i.e. `code × 16`) |

`sendTrigger(code)` branches on the selected device: AD_BBT writes hex over the serial writer; a Biopac device computes `code × shift` (clamped 0–255) and relays it to the parallel-port server. Both pulse the value high for 25 ms then write 0 to clear. A failed Biopac relay is logged (`console.error` with address + value) but never thrown — a missed trigger must not crash the session.

**Biopac parallel-port server** (`scripts/parallel_server.py`): the browser cannot drive a parallel port, so Biopac triggers go through a small local Flask helper (Windows-only; uses `inpoutx64.dll`/`inpout32.dll`). `constants.js` `BIOPAC_SERVER_URL = 'http://localhost:8765'`. Endpoints:
- `POST /send` — body `{ address, value }`; writes `value` to the parallel `address` via `Out32`. (Also accepts an optional `zero_delay` ms to self-clear; the browser instead sends an explicit `value: 0` after 25 ms.)
- `GET /status` — `{ ok: true, dll: <bool>, dll_name }`. `connectBiopac()` pings this and reports connected only when `ok && dll`; otherwise it surfaces a distinct message (DLL not loaded / not ready / offline) in the same `comState` status indicator used for the COM box.

**Connect flow** (`COM_CONNECT`): for AD_BBT the button reads *Connect to COM port* → `connectCOM()` (Web Serial port picker); for Biopac it reads *Check parallel server* → `connectBiopac()` (no port picker / writer / reader — just the status ping). On a successful connect the screen does **not** auto-advance: it auto-fires the 1–13 test cascade once (`sendTestCascade()`, ~250 ms between marks) so the RA can confirm all 13 marks land in the recording, then offers *Send test cascade again* and *Continue to session setup*. The cascade uses `sendTrigger`, so per-device encoding is automatic.

> **Mixed-content caveat:** the deployed app is https but the parallel server is `http://localhost:8765`. Opening BreathBelt from the production https URL makes the browser block the localhost call (server reads as "offline"). Run the Biopac rigs from the local dev server (`http://localhost:5173`) so the scheme matches. AD_BBT (Web Serial) is unaffected.

### Session setup (SESSION_SETUP)

After connecting (and the trigger-test cascade), the researcher enters a session number (1-indexed, incremented per lab visit by the same participant) before calibration begins. Stored in `belt_sessions.session_number`. The trigger device chosen on the connect screen is shown here read-only.

### Calibration

CalibrationScreen drives a 4-state flow (FIXATION → BREATHE → FITTING → REVIEW) using the MLR signal processing pipeline from `breathUtils.fitBestModel()`. The avatar IS the pacer — no `BeltSyncRing` is shown during calibration. `beginCalibCollection(calibStartMs, breathPeriodMs)` is invoked at the exact tick the avatar animation begins, so the pacer reference timestamps align with belt samples to within a frame.

The pipeline evaluates 6 model variants (MLR × {wide-band, tight-band} × {plain, LP-smoothed} + PCA × {wide, tight}) and selects the one with the highest Pearson R against the cosine pacer reference. Requires ≥100 samples and fitR ≥ 0.4 to proceed; transitions to FAILED otherwise.

`useBeltConnection` exposes:
- `mlrWeightsRef` — `{ bias, weights: [wx,wy,wz], modelLabel, lagMs, fitR }` after calibration (replaces `calibStateRef`)
- `filterState3Ref` — causal biquad state for live `processPacketMLR()` during trials
- `syncQuality` — rolling Pearson R (React state) between live belt predictions and current pacer, used by `SynchronyBar`
- `calibReviewData` — `{ pacerPts, beltPts, fitR, peakErrorMs, modelLabel, lagMs }` shown in `CalibReviewPanel`
- `beginCalibCollection(calibStartMs, breathPeriodMs)` — called by CalibrationScreen exactly when avatar animation begins (timestamp precision matters for model fitting)
- `redoCalibration()` — resets to FIXATION from REVIEW (renamed from `redoPhase2`)
- `getAndClearTrialSamples()` — returns the raw `{t,x,y,z}` collected during the most recent trial and clears the buffer. Called by `useTrialRunner` after code 12 to compute offline per-trial sync metrics.
- `getPacerRadiusFnRef` — fn ref set by trial screens before code 10; read by accel handler to log pacer radius per raw accel row

`BeltSyncRing` is retained for other games (Still Water etc.) where aesthetic warmth matters more than precise quantitative feedback. **No live synchrony feedback is rendered to the participant during paced breathing trials.** `SynchronyBar` (a rolling Pearson R bar) exists in the component tree but is no longer mounted by BreathBelt — research protocol calls for between-trial feedback only via `TrialSyncOverlay`. The underlying `syncQuality` / `rollingPearsonR` pipeline still runs internally (the `setPacerContext` swap at code 11 is still wired) so the bar can be re-enabled later without code changes.

### Per-trial sync feedback (TrialSyncOverlay)

After each trial, `useTrialRunner` runs an offline MLR pass over the trial's raw samples and returns `syncMetrics = { trialRBaseline, trialRCondition, peakErrorMs, pacerPts, beltPts }`. The parent screens render `TrialSyncOverlay` (fixed bottom-left, above the back button at `bottom: 80px`):

- **Phase 2** — `showGraph={true}`: SignalGraph (pacer blue + belt amber) + Base R + Cond R + Peak err. Full researcher QC.
- **Phase 3** — `showGraph={false}`: metrics only, no graph. The graph would reveal condition speed and break participant blinding. Additionally receives `convergence` prop → shows ↑ faster SD and ↓ slower SD rows, colour-coded by convergence threshold.

The overlay clears when the next trial starts (parent sets `syncData` to null).

**Props:** `visible` (default `true`) — pass `visible={false}` from either screen to hide the overlay for participant-facing sessions. Data collection and Supabase writes continue normally; only the render is suppressed.

### Avatar timing during trials

Between trials the avatar is frozen at neutral (`controlRef.current.resetToNeutral()` is called at trial end). Each new trial begins with a **500 ms fixation hold** (no animation, no signal collection) before `sendTrigger('10')` and the first paced breath, giving a clear stimulus boundary between trials.

### Streaming backup

`useStreamingBackup` provides parallel local CSV backup via the File System Access API (`showDirectoryPicker`). Non-Chrome or permission-denied sessions degrade gracefully (returns false). Files: `{participantId}_{ts}_{accel,hr,trials,quest}.csv`. `initBackup(participantId)` opens the directory picker during SESSION_SETUP; `flushAccel/flushHR` are called after each trial alongside Supabase writes via the `recordTrialWithBackup` wrapper in `BreathBelt.jsx`. The trials CSV header now includes `peak_error_ms`, `trial_r_baseline`, and `trial_r_condition`; `appendTrial/appendQuest` are available for per-row backup.

Calibration metrics (`calib_model_label`, `calib_fit_r`, `calib_lag_ms`) are part of the `mlrWeightsRef` JSON stored to `belt_sessions.calib_state`; the separate scalar columns added by `belt_mlr_migration.sql` are available as queryable shortcuts (currently populated from the JSON downstream).

### Baselines — pre and post (120 s each)

Both baselines use the same `BaselineScreen` component with a generic `phase` prop (`'READY'`|`'RECORDING'`|`'COMPLETE'`). Parent FSM maps its states to this generic prop via `baselinePhaseMap()`.

- **Pre-session baseline** (`BASELINE_*`): 120 s free breathing before Phase 2. Code 1 (session start) fires in `onStart` just before recording; codes 2/3 fire at recording start/end via `BaselineScreen`. `breathUtils.estimateBreathPeriodMs()` runs on the collected samples; result stored in `belt_sessions.baseline_period_ms`.
- **Post-session baseline** (`POST_BASELINE_*`): 120 s free breathing after Phase 3. Codes 8/9 fire at recording start/end via `BaselineScreen`; code 0 (session end) fires after `endSession()` resolves. Result stored in `belt_sessions.post_baseline_period_ms`. `endSession()` is called here — all trial and session data flushed to Supabase on post-baseline completion.

Both baselines are 120 s (was 60 s) for matched pre/post comparison in the correspondence study.

### Phase 2 — Fixed trials

9 trials at pre-specified breath period deviations (faster/slower/same relative to baseline). AvatarBreathPacer (from EbbAndFlow) paces the avatar. The participant follows. No response is collected — these are familiarisation trials. Trial data is recorded to Supabase.

After all 9 trials complete, `FixedTrialsScreen.onComplete(trialsData, trialGraphs)` is called — `trialGraphs` is an array of `{ trialNumber, condition, pacerPts, beltPts, peakErrorMs }` accumulated per trial. `BreathBelt.jsx` stores this in `trialGraphsRef.current` and transitions to `PHASE2_REVIEW`.

**Phase 2 review (`PHASE2_REVIEW`):** `Phase2ReviewScreen` shows a 3×3 grid of `SignalGraph` thumbnails — one per trial, labelled by trial number and condition (colour-coded: faster blue, slower purple, same grey). The researcher can assess signal quality across all 9 trials before continuing to the staircase. Replaces the old `PHASE2_COMPLETE` interstitial screen.

### Phase 3 — Dual-QUEST staircase

Interleaved faster/slower staircases using the QUEST+ algorithm.

**Block structure:** trials are generated in blocks of 5 — `[dominant×2, other×2, same×1]` shuffled. Dominant = the staircase with the higher posterior SD (highest uncertainty). SAME catch trials run at BASE speed; the staircase is not updated on SAME responses. `same_context` records which staircase was dominant when the block was built (for SDT false-alarm-by-direction analysis).

Each trial:
1. QUEST selects the next magnitude (log10 seconds deviation from baseline).
2. Avatar paces at that period. Participant follows.
3. 3AFC response: slower / same / faster.
4. Confidence rating (1–7, ConfidenceRating component).
5. Arousal rating (1–7, ArousalRating component).

Both staircases converge independently. Session ends when both converge. Quest state is stashed in `questStateRef` (a `useRef`) when Phase 3 completes, then written to Supabase inside the post-baseline `onComplete` handler. Convergence thresholds and SDs are displayed on the SessionComplete screen.

**Phase 3 screen:** staircase SD values are no longer shown in the centre of the screen. They appear instead in `TrialSyncOverlay` (bottom-left) via the `convergence` prop — colour-coded green/amber/red by threshold (SD < 0.10 / 0.20 / above).

### Belt period estimates — correspondence study

`breathUtils.js` exports `estimateBreathPeriodMs(signal, minPeriodMs=2000, maxPeriodMs=8000)`: accepts `{ t, value }[]`. Uses 5-point peak detection with a 0.40 normalised threshold and median inter-peak interval. Returns null if < 2 valid peaks detected, signal is flat (max−min < 1e-6), or no intervals fall within [minPeriodMs, maxPeriodMs].

`useTrialRunner` collects raw `breathValue` numbers during two windows per trial, then converts to `{ t: i*40, value }` (synthetic relative timestamps, not wall-clock) before calling `estimateBreathPeriodMs`. Both calls pass **`minPeriodMs=1500`** — not the free-breathing default of 2000 — because at the fast extreme of the QUEST staircase the condition breath period approaches 2000 ms, making the inter-peak interval barely pass the 2000 ms gate; 1500 ms avoids false nulls from timing jitter without accepting noise (genuine breath peaks are always ≥ 1500 ms apart at the staircase range used).

- **baseline window** (breaths 1–2 at BASE speed): `btBaselinePeriodMs`
- **condition window** (breaths 3–4 at condition speed): `btConditionPeriodMs`

`BaselineScreen` (pre/post 120 s windows) uses wall-clock `{ t: Date.now(), value }` samples and calls `estimateBreathPeriodMs` with the default `minPeriodMs=2000`. Session-level baseline fields are null if the MLR model is not yet calibrated when recording begins (flat `breathValueRef` → max−min < 1e-6).

Both trial fields are stored on `belt_trials` rows. Null is valid — do not drop the trial. `useTrialRunner` also sets `getPacerRadiusFnRef.current` at trial start (cleared to `() => NaN` at trial end), enabling per-sample pacer radius logging in the raw accel rows.

### Data

Supabase schema in `belt_schema.sql` (initial) + `belt_correspondence_migration.sql` (run second). Tables:

| Table | Contents |
|---|---|
| `belt_sessions` | One row per session: user_id, calib_state JSON, quest_state JSON, storage_path, **session_number**, **baseline_period_ms**, **post_baseline_period_ms**, ***calib_model_label***, ***calib_fit_r***, ***calib_lag_ms*** |
| `belt_trials` | One row per trial: phase, trial_number, condition, breath_period_ms, log10_mag, ††proportion_mag††, response, correct, *****same_context*****, confidence, arousal, belt_sync_mean, **bt_baseline_period_ms**, **bt_condition_period_ms**, ****trial_r_baseline****, ****trial_r_condition****, ****peak_error_ms**** |

**Bold** = added by `belt_correspondence_migration.sql`. ***Bold italic*** = added by `belt_mlr_migration.sql` (now populated by `useBeltSession.endSession` from `calibState` JSON). ****Bold underline**** = added by `belt_sync_metrics_migration.sql`. *****Bold italic underline***** = added by inline `ALTER TABLE` (same_context — for SAME catch trial SDT analysis). ††proportion_mag†† = added by `belt_proportion_migration.sql` — signed proportion change in breath period: `(breath_period_ms − 4000) / 4000`; negative = faster, positive = slower, zero = same; always non-null, computable from `breath_period_ms` alone.

Raw signals are uploaded to the `belt-sessions` Storage bucket as two CSVs per session:

| Storage key | Columns |
|---|---|
| `{user_id}/{session_id}_accel.csv` | `phase, trial, packet_timestamp, sample_index, x, y, z, pacer_radius` |
| `{user_id}/{session_id}_hr.csv`    | `phase, trial, timestamp, heart_rate` |

`belt_sessions.storage_path` holds the base prefix (`{user_id}/{session_id}`) — suffix with `_accel.csv` / `_hr.csv` to reach the blobs. The naming matches the local backup convention written by `useStreamingBackup` (`{participant_id}_{ts}_accel.csv` etc.).

**Storage RLS:** the `belt-sessions` bucket requires an RLS policy on `storage.objects` — without it, authenticated uploads are silently blocked. Policy applied June 2026:
```sql
CREATE POLICY "own belt session data" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'belt-sessions' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'belt-sessions' AND (storage.foldername(name))[1] = auth.uid()::text);
```
If the bucket is ever recreated or the project is migrated, this policy must be re-applied.

### Source layout

```
src/games/BreathBelt/
  BreathBelt.jsx             ← main FSM; backup.initBackup at SESSION_SETUP;
                               recordTrialWithBackup wraps session.recordTrial + flushAccel/HR;
                               accepts studyMode/userId/studyId/onSessionComplete for in-study use
  constants.js               ← BASE_BREATH_SPEED_S, BASELINE_DURATION_MS (120 s), POST_BASELINE_DURATION_MS (120 s), QUEST params,
                               TRIGGER_DEVICES (AD_BBT + Biopac_Left/Right with address/shift), DEFAULT_TRIGGER_DEVICE, BIOPAC_SERVER_URL
  breathUtils.js             ← full MLR pipeline: fitBestModel (6 variants), processPacketMLR, initFilterState3,
                               rollingPearsonR, estimateBreathPeriodMs, buildReviewEntry,
                               medianPeakTimingError, computeMLRPredictions, pearsonRArrays,
                               getPacerRadius, getPacerRadiusForTrial, meanOf
  belt_schema.sql                    ← initial Supabase migration
  belt_mlr_migration.sql             ← adds calib_model_label/calib_fit_r/calib_lag_ms to belt_sessions
  belt_sync_metrics_migration.sql    ← adds trial_r_baseline/trial_r_condition/peak_error_ms to belt_trials
  belt_proportion_migration.sql      ← adds proportion_mag to belt_trials
  hooks/
    useBeltConnection.js     ← Web Bluetooth + Web Serial + Biopac parallel-port server, MLR calibration pipeline;
                               sendTrigger branches per device (AD_BBT hex / Biopac code×shift); connectCOM + connectBiopac;
                               sendTestCascade (1–13 connect check) + testRunning; exposes mlrWeightsRef, filterState3Ref,
                               syncQuality, calibReviewData, beginCalibCollection, redoCalibration, getAndClearTrialSamples,
                               getPacerRadiusFnRef
    useBeltSession.js        ← Supabase session lifecycle; uploads accel + HR as two CSVs to belt-sessions Storage;
                               flattens calibState.modelLabel/fitR/lagMs into the scalar columns on belt_sessions
    useBeltQuestStaircases.js ← dual-QUEST state machine; block-based trial generation [dominant×2, other×2, same×1];
                               recordResponse returns {correct, responseIndex}; SAME trials skip staircase update
    useTrialRunner.js        ← per-trial avatar pacing: 500 ms fixation hold, resetToNeutral at trial end,
                               returns syncMetrics { trialRBaseline, trialRCondition, peakErrorMs, pacerPts, beltPts }
    useStreamingBackup.js    ← parallel local CSV backup via File System Access API (showDirectoryPicker);
                               trials CSV header includes peak_error_ms, trial_r_baseline, trial_r_condition
  components/
    BrowserWarning.jsx       ← Chrome/Edge prompt
    CalibrationScreen.jsx    ← MLR 4-state calibration: FIXATION → BREATHE → FITTING → REVIEW
    CalibReviewPanel.jsx     ← calibration quality metrics + SignalGraph overlay (fit%, lag, peak timing, model)
    SignalGraph.jsx          ← SVG line chart: pacer (blue) vs belt model (amber)
    SynchronyBar.jsx         ← rolling Pearson R bar; NOT currently mounted (kept for future use)
    TrialSyncOverlay.jsx     ← fixed bottom-left post-trial overlay; Phase 2 shows SignalGraph + Base R + Cond R + peak err;
                               Phase 3 shows metrics only (no graph — preserves condition blinding) + staircase SDs via convergence prop;
                               visible prop (default true) — pass false to hide overlay without affecting data collection
    BaselineScreen.jsx       ← reusable for pre and post baselines; props: phase ('READY'|'RECORDING'|'COMPLETE'), title, durationMs, phaseLabel, triggerStart, triggerEnd, onComplete(periodMs)
    FixedTrialsScreen.jsx    ← Phase 2: 9 fixed trials; renders TrialSyncOverlay (with graph) between trials only;
                               records bt_baseline_period_ms, bt_condition_period_ms, trial_r_baseline, trial_r_condition, peak_error_ms;
                               onComplete(trialsData, trialGraphs) — trialGraphs: [{trialNumber, condition, pacerPts, beltPts, peakErrorMs}]
    Phase2ReviewScreen.jsx   ← 3×3 grid of SignalGraph thumbnails shown after Phase 2; props: trialGraphs, onContinue
    StaircaseScreen.jsx      ← Phase 3: QUEST trials + 3AFC + ratings; block-based SAME catch trials (1 per 5-trial block);
                               renders TrialSyncOverlay (no graph) with convergence prop; records same_context for SAME trials
    BeltSyncRing.jsx         ← real-time belt signal ring — retained for other games (Still Water etc.); not used in BreathBelt trials
    SessionComplete.jsx      ← shows session number, pre/post resting period, QUEST thresholds
```

Outside the game tree: `scripts/parallel_server.py` — the localhost:8765 Flask helper that relays Biopac parallel-port writes (Windows-only; needs `inpoutx64.dll`/`inpout32.dll` alongside it). Run it on the Biopac rigs before a session.

### Convergence data flow

`quest.getConvergence()` is called in `StaircaseScreen` when both staircases converge and passed as the third argument to `onComplete(trials, questState, convergence)`. `BreathBelt.jsx` stores convergence in `convergenceRef.current` and quest state in `pendingQuestStateRef.current` (both `useRef`). `endSession()` is called inside the post-baseline `onComplete` callback, consuming `pendingQuestStateRef.current`.

### Schema migration

Run these migrations manually in the Supabase SQL editor in order:

1. `belt_schema.sql` — initial schema
2. `belt_correspondence_migration.sql` — adds `bt_baseline_period_ms`, `bt_condition_period_ms` to `belt_trials`; `session_number`, `baseline_period_ms`, `post_baseline_period_ms` to `belt_sessions`
3. `belt_mlr_migration.sql` — adds `calib_model_label`, `calib_fit_r`, `calib_lag_ms` to `belt_sessions`
4. `belt_sync_metrics_migration.sql` — adds `trial_r_baseline`, `trial_r_condition`, `peak_error_ms` to `belt_trials`
5. Inline — `ADD COLUMN IF NOT EXISTS same_context text` on `belt_trials` (run June 2026; adds SAME catch trial SDT context column)
6. Inline — `ALTER COLUMN breath_period_ms TYPE double precision` on `belt_trials` (run June 2026; QUEST-derived periods are floats, original integer type caused insert failures)
7. `belt_proportion_migration.sql` — adds `proportion_mag` to `belt_trials` (run June 2026; applied via Supabase MCP)

All migrations use `ADD COLUMN IF NOT EXISTS` — safe to run on existing data.

### Status

Integrated. All source files updated at `src/games/BreathBelt/`. Route registered at `/games/breath-belt`. Run migrations in order: `belt_schema.sql`, `belt_correspondence_migration.sql`, `belt_mlr_migration.sql`, `belt_sync_metrics_migration.sql` — all require manual execution in the Supabase SQL editor before running in the lab. Requires Chrome or Edge with Web Bluetooth enabled.

All three trigger devices are implemented: AD_BBT (Web Serial) is production-verified; Biopac_Left and Biopac_Right (parallel-port via `scripts/parallel_server.py`) have been verified on the parallel port. The Biopac rigs must run `parallel_server.py` (with its inpout DLL) and be opened from the local dev server (`http://localhost:5173`) to avoid the https mixed-content block.

---

## 21. WordMax

**Route**: `/games/word-max`
**Slug**: `word_max`
**Access**: Protected
**Duration**: 5 minutes shared across 5 sets
**Status**: Built

### Overview

Five sets of 10 letters. Submit one valid English word per set using only those letters (each only as many times as it appears). Points = word length. A shared 5-minute countdown runs across all 5 sets — spending too long hunting for a long word risks running out of time for later sets. Core perfectionism measure: dwell time per set vs. time remaining at submission.

**Key behavioural measures**: time spent per set, word length chosen vs. time remaining, whether the participant times out before completing all 5 sets.

### Dictionary

Fetched at game load from `https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt` (370k words). Stored in a module-level `Set` (ref, not state). Start button hidden until fetch resolves. 4–10 letter words only.

### Letter tile behaviour

10 tiles rendered in shuffled display order. Tiles fade to 18% opacity as letters are consumed by the typed input (greedy left-to-right match against display order). Tiles restore on delete. Shuffle re-randomises display order and re-applies fade state.

### Word input

All character keypresses intercepted in `onKeyDown` — uppercase enforced manually with `setSelectionRange` to preserve cursor position. Letters not remaining in the pool (computed from prefix before cursor) are blocked at keydown. Enter submits.

### Schema

Table: `word_max_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users |
| `created_at` | timestamptz | |
| `completed` | boolean | true if all 5 sets submitted |
| `timed_out` | boolean | true if timer expired before completion |
| `total_score` | int | sum of word lengths |
| `sets_completed` | int | number of sets with a submitted word |
| `duration_ms` | int | actual elapsed ms at session end |
| `set_results` | jsonb | array of 5 `{set_id, letters, word, score, dwell_ms}` objects; word/score null for timed-out sets |

Migration: `supabase/migrations/20260609_lexical_sessions.sql` (creates `word_max_sessions`)

### File structure

```
src/games/LexicalPerfectionism/
  LexicalPerfectionism.jsx    ← orchestration, timer, Supabase write
  constants.js                ← SESSION_DURATION_MS, NUM_SETS, MIN_WORD_LENGTH, DICTIONARY_URL, colour thresholds
  data/
    letterSets.js             ← 25 verified sets + sampleSets()
  hooks/
    useGameTimer.js           ← ref-based countdown; start/stop; onExpire callback
    useLetterSet.js           ← displayLetters, shuffle, getUsedIndices, remainingPool, isDrawable
  components/
    LetterTiles.jsx           ← 10 tiles with opacity fade on use
    WordInput.jsx             ← controlled uppercase input with keydown letter-blocking
    SetResults.jsx            ← completed set rows (letters / word / pts)
    SessionComplete.jsx       ← end screen: score summary + per-set breakdown
```

---


---

## 22. Additional Games (documentation pending)

Built and routed but not yet documented here. Each needs a full section on paradigm, flow, and schema.

**Admin quick demo (2026-07-13)**: the three session-timer games below (AptitudeSuite, WordMax, ColorMax) can be launched from `/admin/games` via a "Quick demo →" link (`/games/<slug>?demo=1`) that cuts the timer to 20 s (`src/lib/demoMode.js`). Ignored in study mode; demo sessions save normally.

- **ColorMax** (`src/games/ColorMax/`) — canvas-based paint-by-numbers game (companion to WordMax), 5 images / 5 minutes; scored on coverage and precision per image. Results screen (reworked 2026-07-13): "Overall Score" tiles (avg coverage, avg precision, images attempted) + per-image bars with a "Coverage / Precision" column; brush-time stats are recorded in `aptitude_sessions.results.toolTime` but not displayed. Full paradigm writeup pending.
- **Drift** (`src/games/Drift/`) — emotion-based game reusing Still Water EMOTIONS and the First Contact ContactAvatar; writeup pending.
- **Owl Barn** (`src/games/OwlBarn.jsx` + `useOwlAudio.js`) — audio-based game; writeup pending.
- **Aptitude Suite** (`src/games/AptitudeSuite/`) — multi-task cognitive battery with task-switching metrics; has its own `schema.sql`; writeup pending.


---

# Part III — Measurement & Study Infrastructure

## 23. Questionnaire System

### Overview

A global questionnaire library accessible at `/admin/questionnaires`, with two tabs (2026-07-13):

- **Standard (JSON)** — lab members upload JSON definitions, preview them interactively, and lock them to prevent accidental edits. The same `QuestionnaireRenderer` component is used for both admin preview and live study delivery.
- **Advanced (coded)** — bespoke React instruments (things the JSON schema can't express: conditional branching, multi-select with exclusive options, custom widgets). Sourced from the advanced-instruments registry (see below).

### Routes

All routes are inside the `AdminRoute` / `AdminLayout` guard — `profiles.role === 'lab'` required.

| Route | Component | Purpose |
|---|---|---|
| `/admin/questionnaires` | `QuestionnairesPage` | Library list — Standard (JSON) and Advanced (coded) tabs; `?tab=advanced` selects the latter |
| `/admin/questionnaires/new` | `QuestionnaireUpload` | Paste or file-upload a JSON definition |
| `/admin/questionnaires/advanced/:key` | `AdvancedInstrumentPreview` | Live preview of a coded instrument (previewMode — never writes to the database) |
| `/admin/questionnaires/:slug` | `QuestionnairePreview` | Full renderer preview + lock/edit controls |

### File structure

```
src/
  components/
    questionnaire/
      QuestionnaireRenderer.jsx   ← full player; used for preview and study delivery
      questionnaireUtils.js       ← buildSlides(), effectiveLabels(), validateDefinition()
      InstructionScreen.jsx       ← mandatory "Begin" screen before first item
      LikertItem.jsx              ← single Likert item + image label support
      ProgressLabel.jsx           ← sticky "Part N of M · Item X of Y" header
      ScaleChangeScreen.jsx       ← auto-inserted slide when scale changes between items
  pages/
    admin/
      QuestionnairesPage.jsx      ← library list
      QuestionnaireUpload.jsx     ← JSON upload + validation
      QuestionnairePreview.jsx    ← preview + lock/unlock + JSON editor overlay
questionnaires_schema.sql         ← Supabase migration (run manually in SQL editor)
```

### JSON schema

```json
{
  "slug": "panas",
  "name": "PANAS",
  "auto_advance": true,
  "instructions": "Rate each word to the extent you feel this way right now.",
  "scale_labels": [
    { "value": 1, "label": "Very slightly or not at all", "image": null },
    { "value": 5, "label": "Extremely", "image": null }
  ],
  "items": [
    {
      "id": "panas_1",
      "text": "Interested",
      "type": "likert",
      "scale_min": 1,
      "scale_max": 5,
      "subscale": "positive",
      "reverse_score": false,
      "required": true,
      "scale_labels_override": null
    }
  ],
  "scoring": {
    "subscales": {
      "positive": { "items": ["panas_1"], "method": "sum" }
    }
  }
}
```

**Key fields:**
- `slug` — unique identifier; used as the URL slug and the key in `questionnaire_responses`
- `name` — display name shown to participants
- `auto_advance` — `true` (default): advances immediately on selection; `false`: shows a Next button
- `instructions` — shown on the mandatory instruction screen before item 1
- `scale_labels` — questionnaire-level default scale labels; each entry: `{ value, label, image }`
- `items` — ordered array of Likert items
- `scale_labels_override` per item — overrides the questionnaire-level labels for that item only; enables mixed-scale questionnaires
- `scoring` — optional; subscale definitions with item lists and aggregation method

### Image labels

Set `"image"` on a scale label entry to a path relative to `/public/`, e.g. `"scale_images/vas_face_1.png"`. The `LikertItem` component renders the image at 36×36px beside the text label. If the file is not found, it falls back to a `?` placeholder — no hard failure.

### Auto-generated scale-change slides

`buildSlides()` in `questionnaireUtils.js` inserts a `ScaleChangeScreen` slide automatically whenever consecutive items have different effective labels (comparing by JSON string equality). This handles mixed-scale questionnaires (e.g., DERS items switching between 5-point frequency and 7-point agreement scales) without any explicit marking in the JSON.

### QuestionnaireRenderer

The player component. Builds a flat slide sequence (instruction → [scale_change →] item → …), manages fade transitions, back navigation (scale_change slides are skipped when going back), and response collection.

**Props:**
- `questionnaire` — full JSON definition
- `partNumber` / `totalParts` — for the sticky progress label (e.g. "Part 2 of 3")
- `onComplete(payload)` — called when all items answered; `payload` is `{ responses, subscaleScores, derivedScores }`, plus `totalScore` for checklist-type
- `onBack` — optional; called if participant presses Back on the instruction screen
- `previewMode` — shows "Preview complete — N items [answered|endorsed]." instead of calling `onComplete`

### Checklist-type questionnaires

A second `questionnaire_type` alongside the default `"likert"` — for instruments like life-event checklists where each item is independently endorsed (checked or not) at a fixed point value, rather than rated on a shared response scale. `questionnaire_type` defaults to `"likert"` when absent, so all existing instrument JSONs are unaffected.

Root fields when `questionnaire_type: "checklist"`:
- `scale_min` / `scale_max` / `scale_labels` must be `null` (not used)
- `scoring.method` must be `"weighted_checklist"`

Per-item fields (checklist type):
- `weight` — integer 0–300; point value if the item is endorsed
- `allow_multiple` — `true` shows a frequency stepper (number of occurrences) once checked; `false` is a simple checkbox

Rendered by `ChecklistScreen.jsx` as one scrollable screen of all items (not one slide per item like likert), always with a manual Next button — checklist questionnaires ignore `auto_advance`. Unchecked item score = 0; checked score = `weight × occurrence_count` (`occurrence_count` = 1 if `allow_multiple` is `false`). On completion, `QuestionnaireRenderer` normalizes any never-touched items to "unchecked" so every item has a response, then computes `totalScore` (sum of item scores) alongside the usual `subscaleScores`/`derivedScores` (which, for checklists, operate on the per-item weighted scores — no reverse-scoring).

Each response is stored as `{ response_value, item_weight, occurrence_count }` — `response_value` is the weighted score, with `item_weight` and `occurrence_count` kept alongside so the score's source is transparent without re-deriving it from the definition. `validateDefinition()` in `questionnaireUtils.js` enforces the checklist-specific rules (item `weight`/`allow_multiple` presence, null root scale fields, `weighted_checklist` scoring method) in addition to the shared checks.

### Advanced (coded) instruments — registry + review policy (2026-07-13)

**Policy: every bespoke (coded-in-React, non-JSON) instrument that collects participant data must be
registered in `src/components/study/advancedInstruments.js`.** The registry drives the Advanced tab of
the Questionnaire Library and the `/admin/questionnaires/advanced/:key` preview route, so no instrument
lives only in the codebase where it can be forgotten. Each entry records: `key` (the
`activities.subcategory` that `StepDispatcher.jsx` dispatches on for `category='form'`), name,
description, source file, storage table, and a lazy `load()` for previewable entries (keeps participant
step code out of the admin library chunk).

Registered instruments:

| Key | Component | Storage table | Previewable |
|---|---|---|---|
| `demographics` | `DemographicsStep.jsx` — age, gender (free text), racialized identity, MacArthur SES ladder | `demographics` | yes |
| `equity_census` | `EquityCensusStep.jsx` — full 2025-2026 U of T Student Equity Census (below) | `equity_census_responses` | yes |
| `compensation` | `CompensationStep.jsx` — pay (e-transfer email) vs SONA credit | `participant_compensation` | yes |
| `consent` / `debrief` | per-study HTML renderers | — | no (content lives on the study) |
| `midpoint` | `MidpointStep.jsx` (Liliana Study 3, §26a) | see §26a | no (needs live session context) |
| `belt_setup` | `PhysioSetupStep.jsx` | — | no (needs hardware) |

Preview safety: `DemographicsStep`, `CompensationStep`, and `EquityCensusStep` accept a
`previewMode` prop — submit calls `onComplete` without any database insert. `AdvancedInstrumentPreview`
passes a null-id stand-in enrollment and shows a "Preview complete — nothing was written" screen.

### U of T Student Equity Census (`equity_census`, 2026-07-13)

Faithful reproduction of the 2025-2026 U of T Student Equity Census (source PDF in the ComeSee shared
drive under Assessments). Eight sections: gender identity (multi-select with inline definitions +
trans-identity follow-up), sexual orientation, disability (yes/no gate → type multi-select), Indigenous
identity (gate → identity multi-select), racial/ethnocultural identity (racialized yes/no/not-sure +
hierarchical category→subcategory checkboxes stored as `parent:child` keys), religion, parental
education (single select), optional feedback. Every question offers "Prefer not to answer" (exclusive —
selecting it clears other selections); all questions required. Responses stored as one self-describing
jsonb blob per completion in `equity_census_responses` (`user_id`/`enrollment_id`/`schedule_id` +
`responses` + `completed_at`; RLS mirrors `demographics`: own-rows ALL, lab read, lab insert).
Migration `20260713_equity_census.sql` also seeds the `activities` row (`form`/`equity_census`) that
makes it appear in the Session Builder Forms picker. Deliberately separate from Standard Demographics —
maximally sensitive wording is overkill for many studies; pick per study in the Session Builder.

### locked flag

`locked: true` prevents the "Edit JSON" button from appearing in `QuestionnairePreview`. The lock toggle always works (a lab member can lock or unlock at any time). Locking does **not** block saves — it is a UI safety guard only, not a database constraint.

### Supabase table — `questionnaires`

Schema in `questionnaires_schema.sql` (project root — run manually in Supabase SQL editor).

RLS policies:
- Lab members (`profiles.role = 'lab'`): full read/write/delete
- All authenticated users: read-only (for study delivery)

### Status

Integrated. All source files placed. Routes registered inside the existing `AdminRoute`/`AdminLayout` guard. SQL schema at project root for manual migration.

---


---

## 24. VAS Scale System (documentation pending)

Visual analogue scale infrastructure is built and in use but undocumented here.

- Components: `src/components/vas/`
- Admin pages: `VasLibraryPage`, `VasUploadPage`, `VasPreviewPage`, `VasPackageBuilder`, `SliderCreatePage`
- Scales built: confidence, life-satisfaction, task-satisfaction; emoji anchor assets in Supabase storage
- Authoring workflow: `vas-scale` skill (claude.ai)

## 24a. Display Elements (2026-07-05)

Participant-facing content pages placeable as session steps: instructions, condition-specific text, performance feedback. Built for Sandy study 3 (predicted vs. observed percentile after Aptitude Suite); the long-term host for what instruction screens currently do in game code.

**Architecture — block-based from day one, text-only for now.** `displays` table (`slug`, `name`, `blocks` jsonb, RLS: authenticated read / lab write via `my_role()`). `blocks` is an ordered array of `{ type: 'text', text, showIf }`; video/audio/interactive block types are additive later (new `type` values), no schema change. Migration `20260705_displays.sql` (applied). Long-term, displays absorb the Training Module system — see §26 Convergence plan (Liliana stays on `intervention_modules`; Sense Foraging course authors as displays).

**Element integration** follows the VAS pattern: one `activities` row per display (`category = 'display'`, `subcategory = slug`), so displays appear in SessionBuilder's picker (new "Displays" group) and flow through `session_template_nodes` / `get_session_by_token` with zero server changes. StepDispatcher v4 dispatches `category === 'display'` to `DisplayStepWrapper`.

**Condition-dependent content**: per-block `showIf: { slot, in: [arms] }` filters against the participant's assignments from `draw_assignment` (§28 Shared assignment primitive). One display serves all conditions.

**Variable interpolation**: `{{path}}` placeholders resolve from the session context — `{{condition}}` (any slot key), `{{slider.<slug>.value}}`, `{{vas.<slug>.value}}`, `{{game.<slug>.<key>}}`. SessionEntry v6 accumulates step outputs from each step's `onComplete` payload (games/sliders/VAS already reported these; previously discarded). Unresolved variables render as "—". The context is in-memory only: a mid-session reload restarts the flow (accepted; restart-from-top is the current session model).

**Variable manifest**: `src/lib/elementOutputs.js` declares what each game reports (`aptitude_suite`: scores + percentiles + `avg_pct`; `word_max`, `color_max`; `still_water`/`breath_belt`: none). Sliders/VAS always produce `value`. The display editor's variable picker reads this manifest plus live slider/VAS slugs — keep the manifest updated when a game's `onSessionComplete` payload changes.

**Admin**: `/admin/displays` (list) + `/admin/displays/new|:id` (editor: name, auto-slug locked after create, text blocks with per-block showIf inputs, variable pill picker). AdminLayout nav regrouped: Sessions/Studies top-level, then an **Elements** section (Games, Screeners, Questionnaires, Rating Scales, Displays, Videos, Audio), then Training/Compensation/Export.

**Sandy study 3 wiring**: session = `slider_predicted_efficacy` → Aptitude Suite → display referencing `{{slider.predicted_efficacy.value}}` and `{{game.aptitude_suite.avg_pct}}`, with condition-gated blocks.

**Dependency checker (2026-07-05)**: `src/lib/displayDeps.js` (pure: `extractDeps`, `itemProduces`, `checkSequence`). Three layers, all warnings non-blocking (unmet variables render "—" at runtime, never crash):
- *SessionBuilder*: display nodes show amber warnings per unmet variable — `missing` (no producer in session), `after` (producer ordered later), `badkey` (game exists but output name wrong, checked against `GAME_OUTPUTS`); slot expectations shown as an info line. Removing a node that later displays depend on prompts a confirm listing exactly which variables break. Display blocks and package contents fetched lazily only when such nodes are present; checks are pure client-side list scans on every edit.
- *StudyFormPage v4*: warns when a display in the study's sessions (via `study_sessions` → `session_template_nodes`) expects a condition slot the study doesn't define — the randomizer half of the check.
- *Package fix*: VAS/slider steps inside `vas_pkg_*` packages previously reported only `{ package_slug, responses_count }` — item values never reached the session context. Packages now report `item_values: [{type, slug, value}]` and SessionEntry v7 files each under its own `slider.`/`vas.` key, so packaging is transparent to variable availability (and to the checker, which resolves package contents to typed slugs).

**Bugfix (2026-07-07)**: displays never appeared in SessionBuilder's picker. Root cause: `activities.category` has a CHECK constraint (`activities_category_check`) whose allowed list was never updated to include `'display'` when §24a shipped — DisplayEditorPage's `activities` insert (line ~101) silently failed the constraint and was swallowed by a `console.warn`, so no `activities` row ever existed for any display. Same class of bug as the RLS gotcha at the top of this file's companion CLAUDE.md, just a CHECK constraint instead of RLS. Fixed by `supabase/migrations/20260707_activities_category_add_display.sql`, which widens the constraint to include `'display'` and backfills `activities` rows for displays created before the fix (`aptitude_feedback`, `aptitude_feedback_redemption`). Verified live: both now show under SessionBuilder's Displays group and can be added to a session sequence.

## 25. Video Library (Admin)

**Routes**: `/admin/videos`, `/admin/videos/new`
**Access**: Lab/admin only
**Status**: Built (June 2026)

### Overview

Standalone video file registry for managing video assets used in study sessions. Separate from `study_videos` (which ties videos to specific study tasks). Videos are uploaded to the `videos` Supabase Storage bucket; the library table stores metadata and provides folder-based organisation in the admin UI.

### Supabase

**Storage bucket**: `videos` (already existed). Storage RLS: authenticated users can read (for signed URLs); lab/admin can upload and delete. See `supabase/migrations/20260526_videos_bucket_storage_policies.sql`.

**Table**: `video_library`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `title` | text | Display name |
| `description` | text | nullable |
| `folder` | text | Logical folder for UI grouping; default `'General'` |
| `storage_path` | text | UNIQUE — path within `videos` bucket, e.g. `general/abc123_intro.mp4` |
| `file_name` | text | Original filename |
| `duration_secs` | int | nullable — read from browser before upload |
| `file_size_bytes` | bigint | |
| `mime_type` | text | |
| `created_by` | uuid | FK → profiles |
| `created_at` | timestamptz | |

RLS: authenticated read; lab/admin insert/update/delete.

**Note**: `study_videos` (which ties videos to `study_tasks`) was also missing INSERT/UPDATE/DELETE RLS policies — these were added in the same migration (`20260609_video_library.sql`).

### VideoLibrary page

- Folder tabs (pill-style): "All" + one tab per unique folder with count badge
- In "All" view: videos grouped under folder headings
- Each row: video icon, title, folder · duration · size · date, storage path in `Space Mono`
- **▶ Preview** button — opens a dark modal overlay with `StudyVideoPlayer` in `preview` mode (no session data recorded)
- **Copy path** button — copies `storage_path` to clipboard (useful when configuring study tasks)
- Inline delete confirmation

### VideoUpload page

- Drag-and-drop zone or click-to-browse; auto-reads video duration and resolution from browser via `URL.createObjectURL`
- **Encoding pre-flight check** — validates against `encode_study_clip.ps1` spec before upload:
  - Container: must be `.mp4` (hard block)
  - Resolution: must be `1280 × 720` (hard block)
  - Approx. bitrate: warns if > 5 Mbps (suggests un-encoded raw footage)
  - "Upload anyway" override available for both hard and soft failures
- Title auto-populated from filename (snake_case → Title Case), editable
- Folder picker: dropdown of existing folders + "+ New folder…" option
- Storage path format: `{folder_slug}/{8-char-uid}_{sanitized_filename}.mp4`
- Progress bar via `onUploadProgress` callback on Supabase storage upload
- On success: inserts `video_library` row; navigates back to library

### StudyVideoPlayer — preview prop

`StudyVideoPlayer` gained a `preview?: boolean` prop (default `false`). When `true`:
- Skips `createVideoSession` — no `participant_video_sessions` row created
- Skips all `logVideoEvent` calls
- Skips `complete_video_session` RPC
- `participantId`, `videoId`, `onComplete` become optional

Used by the VideoLibrary preview modal and the Training module demo modal.

### File structure

```
src/pages/admin/
  VideoLibrary.jsx    ← list + folder tabs + preview modal + delete
  VideoUpload.jsx     ← drag-drop + pre-flight check + upload
src/components/video/
  StudyVideoPlayer.tsx  ← preview prop added
  StudyVideoPlayer.css
```

---

## 26. Training Module System

**Routes**: `/admin/training`, `/admin/training/new`
**Access**: Lab/admin (importer); participant (renderer via StudySessionRunner)
**Status**: Built (June 2026)

### Overview

Intervention training is a first-class step type in the study session flow, distinct from games, questionnaires, and videos. Lab staff import JSON-defined training modules; the session runner renders them as a guided step-by-step participant experience. Built for Liliana's 31-day longitudinal study (Study 3).

### JSON module schema

```json
{
  "module_id": "non-reactivity-phase1-day1",
  "condition": "non_reactivity | reappraisal | self_compassion",
  "phase": "phase1 | phase2",
  "lesson": 1,
  "title": "string",
  "subtitle": "string (optional)",
  "lead_in":  { "owl": "owl_nonreactivity", "text": "string" },
  "steps": [
    { "type": "video",           "video_id": "filename.mp4", "label": "string" },
    { "type": "text",            "content": [{ "tag": "p|h3", "text": "string" }] },
    { "type": "prompt_response", "prompt": "string", "example": "string|null",
      "example_label": "string|null", "size": "single_line|short|long" },
    { "type": "closing",         "content": [{ "tag": "p", "text": "string" }] }
  ],
  "lead_out": { "owl": "owl_love", "text": "string" }
}
```

Screen sequence delivered to participant: `lead_in → steps[] → lead_out`

### Owl assets

10 transparent PNGs stored at `public/assets/owls/{key}.png`. Valid keys:

| Key | Key | Key |
|---|---|---|
| `owl_waving` | `owl_excited` | `owl_nonreactivity` |
| `owl_reappraisal` | `owl_selfcompassion` | `owl_love` |
| `owl_happy` | `owl_crying` | `owl_still` |
| `owl_thinking` | | |

### Database

**`intervention_modules`** — library of imported JSON modules.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `module_id` | text | UNIQUE slug, e.g. `non-reactivity-phase1-day1` |
| `condition` | text | `non_reactivity`, `reappraisal`, `self_compassion` |
| `phase` | text | `phase1`, `phase2` |
| `lesson` | int | Day number within phase |
| `title` | text | |
| `subtitle` | text | nullable |
| `definition` | jsonb | Full parsed JSON module |
| `created_by` | uuid | FK → profiles |
| `created_at` | timestamptz | |

RLS: authenticated read; lab/admin write.

**`session_template_nodes`** gained a `module_id text` column (FK → `intervention_modules.module_id`) for training steps.

**`liliana_participants`** — study-specific participant table for Liliana's Study 3.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `profile_id` | uuid | FK → profiles |
| `study_id` | uuid | FK → studies |
| `condition` | text | Assigned condition arm |
| `randomization_arm` | text | nullable until assigned |
| `phase` | text | `phase1`, `phase2`; default `phase1` |
| `current_day` | int | Advances each completed session; default 1 |
| `midpoint_completed_at` | timestamptz | null = not done; gates Phase 2 access |
| `dropped_out` | bool | default false |
| `dropout_reason` | text | nullable |
| `enrolled_at` | timestamptz | |

RLS: lab/admin all; participant can SELECT own row.

**`liliana_day_data`** — one row per participant per day; created on first session attempt.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `participant_id` | uuid | FK → liliana_participants |
| `study_day` | int | 1–31 |
| `session_name` | text | e.g. `"Phase 1 · Day 3"` |
| `started_at` | timestamptz | Stamped on first open (re-entry preserves original) |
| `completed_at` | timestamptz | Stamped when "Complete Practice" clicked; null = abandoned |
| `data` | jsonb | Variable per-day content: pre/post check-ins, watch flags, etc. |
| — | — | UNIQUE on `(participant_id, study_day)` |

**`intervention_responses`** — per-prompt free-text answers, saved as participant advances.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `participant_id` | uuid | FK → liliana_participants |
| `day_data_id` | uuid | FK → liliana_day_data — links response to the session row |
| `schedule_id` | uuid | nullable — FK → participant_schedule |
| `module_id` | text | Which module was being delivered |
| `study_day` | int | |
| `response_index` | int | 0-based index of this `prompt_response` step within `steps[]` |
| `response_text` | text | |
| `created_at` | timestamptz | |

`day_data_id` allows joining responses to their session row directly. Day row is always created before any prompt step is reachable, so the FK is always satisfiable.

### Design system (InterventionPage)

Distinct visual theme from the main platform — matches the longitudinal study's own design spec:

| Token | Value |
|---|---|
| Background | `#f5f4f0` |
| Page surface | `#ffffff`, max-width 640px |
| Text primary | `#1a1a18` |
| Text secondary | `#5f5e5a`, `#888780` |
| Border | `#ebe8e3`, `#e0ddd8` |
| Surface | `#f0ede8`, `#faf9f7` |
| Done / accent | `#639922` |
| Active step | `#2c2c2a` |
| Complete button | `#3b6d11` |
| Font | system-ui stack |

### InterventionPage rendering rules

**Progress bar** (5 steps, always in this state on the training page):
Welcome ✓ → Check-in ✓ → **Practice** (active) → Check-in (upcoming) → Farewell (upcoming)

**Step pips**: one dot per screen (lead_in + steps[] + lead_out). Done = `#639922`, current = `#2c2c2a`, upcoming = `#ddd`.

**Next button gate per step type**:
| Type | Gate |
|---|---|
| `lead_in`, `lead_out`, `text`, `closing` | Always enabled |
| `video` | Disabled until 90% of video watched (`StudyVideoPlayer.onComplete`) |
| `prompt_response` | Disabled until ≥ 1 character entered |

In `demoMode` (admin preview), the video gate is lifted — Next is enabled immediately.

**Final step** ("Complete Practice"): green button (`#3b6d11`); stamps `completed_at` on `liliana_day_data` row, then calls `onComplete()`.

**Video steps**: use `StudyVideoPlayer` with `preview={true}` (no `participant_video_sessions` row) and `storagePath = liliana/{video_id}`.

**Storage path convention**: training videos must be uploaded to the `videos` bucket with a `liliana/` prefix, e.g. `videos/liliana/1d103c49_nonreactivity_phase1_day1_resampled.mp4`. The `liliana/` folder does not auto-create — the prefix is simply part of the object name.

### Session runner integration

`training` is a first-class category in `StepDispatcher`. Nodes with `module_id` set are normalized by `StudySessionRunner.normalizeNode()` to `{ category: 'training', subcategory: module_id }`. The step label is hidden for training steps (full-screen experience, same as games).

`TrainingStepWrapper` (mounted by `StepDispatcher`):
1. Fetches module definition from `intervention_modules`
2. Looks up `liliana_participants` row by `profile_id`
3. Creates (or fetches) the `liliana_day_data` row for this day — **first attempt stamps `started_at`; re-entry gets existing row, preserving original timestamp**
4. Passes `module`, `participantId`, `dayDataId`, `scheduleId`, `studyDay` to `InterventionPage`

Sim mode (`isSimMode=true`) skips all DB calls and renders a stub module.

### Admin pages

**TrainingLibrary** (`/admin/training`):
- **Standard Session Elements section** (top of page, added 2026-07-08): the four platform-managed screens that wrap every practice module — Welcome (1/5), Check-in pre (2/5), Check-in post (4/5), Farewell (5/5) — each with a ▶ Demo button rendering it full-screen in the InterventionPage visual system, with the 5-step progress bar showing that element's true position. Definitions live in `src/components/study/wrapperElements.js` (owl keys, copy, check-in rating items — **check-in items are placeholders pending Liliana's final wording**; edit that file to change them). Renderer: `src/components/study/WrapperElementPage.jsx`, which imports `interventionStyles` + `OwlScreen` (named exports added to `InterventionPage.jsx` — no behavior change to the frozen renderer). Check-in demos enforce the production gate (Next unlocks only after every slider is moved). **Not yet wired into the participant session flow** — this is the inspectable spec; delivery integration is a separate pass.
- Modules grouped by condition (Non-Reactivity / Reappraisal / Self-Compassion)
- Each row shows: phase/day badge, title, step type chips, `module_id`, import date
- Video steps show full bucket path (`videos/liliana/filename.mp4`) for upload reference
- **▶ Demo** button — opens full-screen modal rendering the complete module in `demoMode` (no DB writes, video Next gate lifted)
- Inline delete

**TrainingUpload** (`/admin/training/new`):
- JSON file picker or paste
- Schema validation: required fields, condition/phase/owl key enums, step structure
- **Video existence check** (async, runs after schema validates): pings `videos/liliana/` prefix in bucket for each `video` step; shows found/not-found per file with exact bucket path
- Import button gated until check completes; "Import anyway" override available for missing videos — file names remain visible so they can be matched later
- Module preview: condition, phase, lesson, owl keys, step breakdown with colour-coded type chips

### SessionBuilder integration

Training modules appear in the "Training Modules" section of the activity picker. Adding one sets `module_id` on the `session_template_nodes` row (with `activity_id` and `questionnaire_id` null). Training nodes are restored correctly on session edit.

### Migrations

```
supabase/migrations/20260609_training_infrastructure.sql  — 4 tables + module_id column
supabase/migrations/20260609_intervention_responses_day_fk.sql — day_data_id FK
supabase/migrations/20260708_vas_schedule_linkage.sql — vas_responses.schedule_id/package_slug + liliana_day_data.module_id (WP-L1)
```

### Daily check-in capture (WP-L1, 2026-07-08)

First work package of the session-quality scoring & midpoint feedback plan — full design in
`docs/markdowns/liliana_feedback_spec.md` (metric, snapshot table, three-arm midpoint manipulation,
WP-L1…WP-L6).

- **Canonical check-in contents** are the VAS packages `liliana_pre_intervention_ratings` (sleep, stress)
  and `liliana_post_intervention_ratings` (stress, helpful, enjoyment, effort), delivered as steps around
  the training step in every session template, **all 31 days, both phases**. Package contents/order in the
  DB are authoritative; scoring keys on scale slug, not position. The check-in items in
  `wrapperElements.js` (valence/energy/stress) are admin-demo placeholders superseded by these packages —
  WP-L2 aligns that demo.
- `vas_responses` now carries `schedule_id` (FK → `participant_schedule`) and `package_slug`, so
  `(user_id, schedule_id, package_slug, scale_id)` uniquely identifies every rating — the pre vs post
  stress response is disambiguated by package, not timestamp. Index on `(user_id, schedule_id)`.
  RLS unchanged (existing own-rows policy already covers the new columns).
- `scheduleId` threads `StepDispatcher → VasStepWrapper → VasRenderer` (new optional props, default null —
  standalone/preview VAS usage unaffected). Package flow also passes the package slug; single-scale steps
  leave it null.
- `liliana_day_data.module_id` stamps which intervention module (and thus condition) ran that day, written
  by `TrainingStepWrapper` on day-row insert and backfilled on re-entry if null. Belt-and-braces vs. the
  join through `study_sessions`/`session_template_nodes`, which remains available as a cross-check.
- Backend-only: nothing user-visible changes until WP-L2 wires the packages into session templates.

**WP-L2 (2026-07-09) — packages wired into templates; wrapper demo renders live packages.**
- All 11 existing Liliana daily-training templates (P1 D1 ×3 conditions, P1 D2–4 NR, P2 D1 ×3
  conditions, P2 D2–4 NR) converted by SQL transaction from six single-scale VAS steps to the
  canonical 3-step shape: `Check-in (pre)` (pre package) → training module → `Check-in (post)`
  (post package). The single-scale shape would have defeated the pre/post stress disambiguation —
  single VAS steps write `package_slug = null`. Remaining ~23 daily templates must be authored with
  the same shape (SessionBuilder activity picker → the two `vas_pkg_liliana_*` entries).
- `/admin/training` "Standard Session Elements" demo: check-in cards now fetch the live packages and
  render them through the participant-facing `VasRenderer` (previewMode, full-bleed) — no second copy
  of the items to drift. `wrapperElements.js` exports `PRE_/POST_CHECKIN_PACKAGE_SLUG`; the
  placeholder `CHECKIN_ITEMS` slider battery was deleted; `WrapperElementPage` keeps the
  InterventionPage chrome for owl screens only.

### File structure

```
public/assets/owls/
  owl_waving.png  owl_excited.png  owl_nonreactivity.png  owl_reappraisal.png
  owl_selfcompassion.png  owl_love.png  owl_happy.png  owl_crying.png
  owl_still.png  owl_thinking.png

src/components/study/
  InterventionPage.jsx     ← participant renderer; demoMode prop; exports interventionStyles + OwlScreen
  TrainingStepWrapper.jsx  ← fetches module + participant row + creates day row
  wrapperElements.js       ← standard session element definitions (welcome / check-ins / farewell)
  WrapperElementPage.jsx   ← renderer for wrapper elements (admin demo; not yet in participant flow)

src/pages/admin/
  TrainingLibrary.jsx  ← module list + demo modal
  TrainingUpload.jsx   ← JSON import + schema validation + video existence check
```

### Key learnings

- Study-specific participant tables (`liliana_participants`) are the right call for longitudinal studies with typed study-specific variables. DDL required at study launch — can't be provisioned via a client INSERT. Pattern to reuse: dedicated table per major longitudinal study, shared `participants` + JSONB metadata for simpler studies.
- `liliana_day_data.started_at` is stamped on first attempt; `completed_at` remains null for abandoned sessions. Use `completed_at IS NULL` to find drop-offs.
- `midpoint_completed_at` on `liliana_participants` is a hard gate for Phase 2 — explicit nullable timestamp is cleaner than inferring completion from day data presence.
- Training videos must be uploaded with the `liliana/` prefix in the object name — Supabase Storage has no real directories; the slash is just part of the path string.

### Convergence plan with Display Elements (decided 2026-07-05)

Training modules and display elements (§24a) are two parallel block-based content systems (`intervention_modules.definition.steps` vs `displays.blocks`). Decision: converge on displays — but **not for Liliana**.

- **Liliana stays frozen on `intervention_modules`** through her study. Her 34 modules are authored, working, and wired into study-specific data capture (`liliana_participants`, `liliana_day_data`). Rebuilding the delivery vehicle before the August pretest is timeline risk for zero participant benefit. Legacy by appointment, not neglect.
- **Display block types grow by real demand**, additive to the shipped schema: video and audio blocks next (assets + admin libraries already exist), then a `prompt_response`-style response block with a general `display_responses` table. Response capture is the hard design (her modules *collect* data into study-specific tables; displays currently only *show* it) — it gets its own pass, not a deadline-driven one.
- **Step-type census of her content** (what parity actually requires): `prompt_response` 92, `video` 37, `text` 18, `closing` 8, `multi_response` 7, `slider` 7, `audio` 5, `training_response` 6; long tail of bespoke interactives (`thought_rating`, `thought_choice`, `word_select`, `body_diagram`, `trigger_map`, `quality_explorer`, `timer`). Text + video + audio + response blocks ≈ 85% of usage; bespoke widgets get ported only if a future study needs them.
- **Sense Foraging course (P3) is the convergence point**: authored as displays from day one. New curricula never touch `intervention_modules`.
- **After Liliana's study completes**, retire `intervention_modules` / `TrainingStepWrapper` / `InterventionPage`; do not migrate live participants.
- When building the video/audio display blocks, spec their shape against her `video`/`audio` step shapes so a future `definition.steps` → `blocks` converter is mostly mechanical.

## 26a. Liliana Study 3 — Study Design & Feedback Infrastructure

> Added 2026-07-09. The canonical summary of the study design and the WP-L1…WP-L6 infrastructure.
> Working spec with full per-package detail: `docs/markdowns/liliana_feedback_spec.md`.

### Study design

A **31-day** online longitudinal RCT (calendar confirmed 2026-07-10 from Liliana's methods
document — the 3-day assessment windows are what stretch 27 session days to 31; timepoint
`day_offset`s in the dry-run graph still reflect the old 27-day assumption pending WP-L5b). Three
emotion-regulation practices: **non_reactivity**, **reappraisal**, **self_compassion**.

| Days | Content |
|---|---|
| 1 | Screener → consent → Baseline assessment |
| 2–13 | **Phase 1**: all three practices, 4 days each, block order **counterbalanced** (all 6 permutations, permuted-block draw at enrollment) |
| 14–16 | **Midpoint window** (state battery + preference ranking + the feedback/choice step) — hard deadline end of day 16; non-completers are withdrawn from Phase 2 (Phase 1 data retained); the fork's completion gating enforces this naturally |
| 17–28 | **Phase 2**: 12 days of ONE practice, determined at the midpoint (see below) |
| 29–31 | **Final window**: final assessment + debrief |

Timing (per methods doc): emails ~06:00 America/Toronto; daily links live 24 h (missed days skip
forward on the original calendar); midpoint/final links 72 h with daily reminders; same-day 18:00
reminder for dailies. Feedback metric **pre-specified as Δstress (metric v2)**; preference captured
as a full #1–#3 **ranking** (Appendix 16) by all groups. Deltas vs. the built system are queued as
WP-L5b — see the spec doc §4b reconciliation.

**Daily training session shape** (all 24 training days): `Check-in (pre)` → practice module →
`Check-in (post)`. Check-ins are the two canonical VAS packages (`emoji_6`, 1–6; contents managed
at `/admin/vas` — DB is the source of truth):
- `liliana_pre_intervention_ratings`: sleep quality, stress
- `liliana_post_intervention_ratings`: stress, helpfulness, enjoyment, effort

**Three-arm midpoint manipulation** (group drawn at the midpoint via the shared `draw_assignment`
primitive, slot `midpoint_group` — balance among participants who actually reach it):

| Group | Experience | Phase 2 practice |
|---|---|---|
| `feedback_choice` | Personalized Phase 1 results (ranked practices) → choice | Free choice |
| `control_choice` | Control display (no personal data) → choice | Free choice |
| `control_assigned` | Control display → **states a preference** | Assigned to one of the two **non-preferred** practices, 50/50 seeded, never the preferred one — the owl frames it as growth outside the comfort zone |

`stated_preference` is recorded for **all three groups** (a chooser's selection doubles as their
preference), enabling preference-vs-assignment and feedback-influence analyses. The feedback shown
is the experimental manipulation, so it is snapshotted immutably per participant
(`liliana_midpoint_feedback`: metric version, per-practice stats, ranking, `shown_at`, decision).

**Session-quality metric** (store ingredients, compute the score — swappable via `metric_version`
with no data migration):
- per session: `delta_stress` = pre − post stress (positive = relief); `appraisal` = mean(enjoyment, helpful)
- **v2 is primary** (decided 2026-07-10 per the methods document, which pre-specifies feedback as
  the mean pre-to-post stress improvement per arm): practices ranked by mean `delta_stress`
  (tie-breaks: delta → helpfulness → seeded hash; `low_n` flag below 2 usable sessions). The
  feedback UI foregrounds the stress delta; raw means (enjoyment/helpfulness /6) appear as
  secondary info; z-scores are never shown to participants.
- **v1 (exploratory)**: quality = (z(delta_stress) + z(appraisal)) / 2, z-scored within-person over
  completed Phase 1 sessions — still computed and stored in every snapshot alongside v2, enabling
  the how-often-would-they-disagree analyses.
- Effort and sleep are deliberately excluded from the score (effort is valence-ambiguous →
  engagement covariate; sleep is a pre-practice nuisance covariate)

### Infrastructure (WP-L1…WP-L5, all applied + verified live)

**Data capture (WP-L1/L2)** — `vas_responses` carries `schedule_id` + `package_slug`, so
`(user, schedule, package, scale)` uniquely identifies every rating and the twice-per-session
stress item is disambiguated by package, not timestamp. `liliana_day_data.module_id` stamps the
day's condition at delivery. All 48 daily templates exist in the canonical 3-step shape (36
generated by SQL from `intervention_modules`). The `/admin/training` check-in demos render the
live packages through the real `VasRenderer` — no second copy to drift.

**Scoring backend (WP-L3)** —
- `liliana_session_metrics` view: one row per training day, six ratings pivoted (latest response
  wins on re-entry), delta/appraisal derived; condition linked by (profile, module) via the
  schedule's template training node — immune to day-numbering drift between
  `participant_schedule.study_day` and `liliana_day_data.study_day`.
- `liliana_midpoint_feedback` table (RLS: lab all / participant SELECT own; writes RPC-only).
- `get_liliana_midpoint_summary(p_mark_shown)`: computes + snapshots idempotently, backfills the
  group after a later draw.
- `record_practice_decision(p_practice, p_source, p_node_id default null)`: auto-detects the fork
  node from `design_graph`; choice path writes a `kind='choice'` `participant_assignments` row the
  existing materializer routes unchanged; anti-preference path does the seeded 50/50 server-side.
  Decisions are final (repeat calls return the original).
- `draw_assignment` patched: permuted-block cycle counts only drawn rows (`draw_index IS NOT NULL`),
  so decision rows at a fork never corrupt balance.
- `ensure_liliana_participant(p_schedule_id)`: self-creates the `liliana_participants` row on first
  training contact and derives the day from the schedule row (nothing else ever created rows or
  advanced `current_day`).

**Midpoint step (WP-L4)** — `MidpointStep.jsx`, step category `midpoint` (activities row
`midpoint/liliana_midpoint`, StepDispatcher case, SessionBuilder picker). Renders in the
InterventionPage design system with the condition owls; feedback cards show stress ↓/↑, appraisal
/6, session counts, #1 highlighted; `shown_at` stamps when the cards first render. Re-entry safe
(decided participants see an "already set" screen). **All participant-facing copy is placeholder
pending Liliana's sign-off** (constants at the top of the component).

**Dry run (WP-L5, 2026-07-09)** — study `Liliana Study 3 — DRY RUN (WP-L5)`
(`dddddddd-0000-4000-8000-000000000001`), graph authored programmatically and validated with the
builder's own `experimentGraph.js` (51 sessions compiled). Three test participants enrolled through
the real `auto-enroll`; full pipeline exercised **in a real browser through real participant
links**: counterbalanced Phase 1 materialization → a complete training day (check-ins, video via
participant-client signed URL, prompts) → all three midpoint arms → decisions recorded → **the
production 15-minute cron advanced all three into their decided Phase 2 arm** (12 sessions at day
15+, final at day 27) with no manual intervention. Five launch-blocking integration bugs found and
fixed (none reachable from admin demos): token RPC couldn't serve training nodes; `scheduleId`
never passed by SessionEntry; global-anon-client use across the training stack (saves +
authenticated-only video/audio buckets); missing `liliana_participants` provisioning; a lazy
supabase-js builder never firing the `shown_at` stamp. Full detail in the spec doc.

**Remaining before pretest**: data-export coverage (`liliana_session_metrics` + snapshot in
DataExportPage), unsubscribe click-test, Liliana's copy + calendar sign-off, author the real study
(duplicate the proven dry-run graph), delete the dry-run study + `ext-sona-dryrun-*` accounts.

### Migrations (this workstream)

```
20260708_vas_schedule_linkage.sql          — vas_responses.schedule_id/package_slug + liliana_day_data.module_id
20260709_liliana_feedback_backend.sql      — metrics view, snapshot table, summary/decision RPCs, draw_assignment cycle patch
20260709_liliana_midpoint_choice_rework.sql — stated_preference, anti_preference mechanics, midpoint activity category
20260709_ensure_liliana_participant.sql    — self-healing participant provisioning
20260709_session_token_training_nodes.sql  — get_session_by_token serves training nodes
```

## 27. In-Person Study System

### Overview

Extends the study protocol system with an `in_person` delivery mode. A lab RA enrolls participants on-site using an external participant ID, runs a full session (consent → tasks → questionnaires → debrief) on a single screen, and can resume from the last completed step if the session crashes mid-run. The RA's lab account remains authenticated throughout; participants use a silently-created Supabase profile.

> Note: the `online_longitudinal` delivery mode has moved off this protocol model onto the node-graph Experiment Builder (§28). `in_person` and `online_single` stay here. Parts of this section's schema notes predate the live DB; §28 records the verified current schema.

---

### Routes

All inside the existing `AdminRoute` / `AdminLayout` guard (`profiles.role === 'lab'` required).

| Route | Component | Purpose |
|---|---|---|
| `/admin/studies` | `StudiesPage` | Study list with delivery mode badges |
| `/admin/studies/new` | `StudyFormPage` | Create study |
| `/admin/studies/:id/edit` | `StudyFormPage` | Edit study |
| `/admin/studies/:id` | `StudyDetailPage` | Study detail + enrollment panel |
| `/admin/studies/:id/session/:enrollmentId` | `StudySessionRunner` | Full-screen session runner |

---

### File structure

```
src/
  pages/
    admin/
      StudiesPage.jsx           ← study list; In-Person badge on relevant studies
      StudyDetailPage.jsx       ← study detail + enrollment panel
      StudyFormPage.jsx         ← create/edit form; fields conditional on delivery_mode
      StudySessionRunner.jsx    ← full-screen step runner; crash-recoverable
  components/
    study/
      ProtocolBuilder.jsx       ← drag-to-reorder typed step list
      EnrollmentPanel.jsx       ← enrolled participants list + inline enroll form
      StepDispatcher.jsx        ← routes protocol step to correct component
      ConsentStep.jsx           ← consent screen (text from studies.study_consent_text)
      DebriefStep.jsx           ← debrief screen + session complete handoff
      QuestionnaireStepWrapper.jsx  ← fetches questionnaire by slug; wraps QuestionnaireRenderer
      GameStepWrapper.jsx       ← loads game component by slug; passes studyMode props
  lib/
    createParticipantAccount.js ← silent Supabase account creation (secondary client)
inperson_study_migration.sql    ← run manually in Supabase SQL editor
```

---

### Schema

#### `studies` table additions

| Column | Type | Notes |
|---|---|---|
| `delivery_mode` | text | `'remote'` \| `'in_person'`; DEFAULT `'remote'` |
| `study_consent_text` | text | Nullable; consent body shown in ConsentStep |

`protocol` column format changed from bare slug strings to typed step objects:
```json
[
  { "type": "consent",        "slug": "consent" },
  { "type": "game",           "slug": "breath_belt" },
  { "type": "questionnaire",  "slug": "panas" },
  { "type": "debrief",        "slug": "debrief" }
]
```
Valid `type` values: `consent`, `game`, `questionnaire`, `debrief`. Consent and debrief slugs are fixed; game slugs are platform game keys; questionnaire slugs match `questionnaires.slug`.

#### `study_enrollments` table (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `study_id` | uuid | FK → `studies` |
| `participant_id` | text | RA-provided external ID |
| `user_id` | uuid | FK → `profiles` (silent account); set after account creation |
| `enrolled_by` | uuid | FK → `profiles` (lab member who enrolled) |
| `enrolled_at` | timestamptz | DEFAULT now() |
| `status` | text | `'enrolled'` \| `'in_progress'` \| `'completed'` \| `'withdrawn'` |
| `current_step` | int | Index into protocol array; DEFAULT 0 |
| `completed_steps` | jsonb | Array of `{step, slug, type, completed_at, ...summary}`; DEFAULT `[]` |
| `started_at` | timestamptz | Set on first step completion |
| `completed_at` | timestamptz | Set when `current_step >= protocol.length` |
| `notes` | text | Optional RA notes |

UNIQUE constraint: `(study_id, participant_id)` — prevents double-enrollment.

RLS: lab members full access; participants read own row via `user_id`.

---

### Silent participant account creation

`createParticipantAccount(participantId, studyId)` in `src/lib/createParticipantAccount.js`:

- Creates a **secondary** Supabase client (anon key) so the RA's primary session is not disturbed
- Calls `signUp()` with synthetic email `p-{participantId}@radlab.internal` and a random UUID password (never stored or shown)
- After signup, updates the auto-created `profiles` row to `role = 'participant'`, `study_id = studyId` via the primary (RA-authenticated) client
- Returns `{ userId, error }`

Production path: move to a Supabase Edge Function with service role key. For lab use, secondary anon client + RLS is sufficient.

Required RLS policy (in migration):
```sql
CREATE POLICY "lab_can_update_participant_profiles" ON profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'lab'))
  WITH CHECK (role = 'participant');
```

---

### Study creation form (`StudyFormPage`)

Fields always shown: study name, delivery mode (radio: Remote / In-Person), protocol builder, active toggle.

Fields hidden when `delivery_mode = 'in_person'`: reminder settings, enrollment email, messaging options.

Protocol validation: warns (does not block) if consent or debrief step is missing.

---

### Protocol builder (`ProtocolBuilder`)

Each step is `{ type, slug }`. UI per step: type selector (consent / game / questionnaire / debrief), slug selector (fixed for consent/debrief; game list for game; locked questionnaires dropdown for questionnaire), remove button, reorder controls.

Consent step is visually locked to position 0 if present; debrief to the last position.

---

### Enrollment flow (`StudyDetailPage`)

1. RA opens study detail page; sees enrolled participants table with status badges
2. "Enroll New Participant" opens inline form: enter external participant ID → "Enroll & Begin Session"
3. `createParticipantAccount()` called → `study_enrollments` row inserted → navigate to session runner
4. Duplicate participant ID shows inline error (UNIQUE constraint)

Enrollment table actions per row:
- **Resume** (status `in_progress`): navigate to session runner
- **Reset to beginning**: `current_step = 0`, `completed_steps = []`, `status = 'enrolled'` — does not delete game/questionnaire data rows
- **Reset to step N**: set `current_step = N` — choose from completed steps by name
- **Mark withdrawn**: set `status = 'withdrawn'`

All reset actions require a confirm dialog.

---

### Session runner (`StudySessionRunner`)

On mount: fetches enrollment row (including `studies.protocol` and `studies.name`). Reads `current_step` and resumes from there — crash recovery is automatic on any reload of the same URL.

State machine: `LOADING → RUNNING_STEP → SAVING → RUNNING_STEP → ... → COMPLETE`

`SAVING` state (between steps): writes `current_step + 1`, appends to `completed_steps`, updates `status`. Spinner shown to prevent accidental advance.

UI during steps: full-screen, no admin chrome. Thin progress bar at top with step label ("Step 2 of 4 — Questionnaire"). Only persistent UI element visible to participant.

Final screen (after last step): "Session Complete — Participant [ID] has finished all steps." with a "Return to Study" link for the RA.

---

### Step types

| Type | Component | Notes |
|---|---|---|
| `consent` | `ConsentStep` | Static text from `studies.study_consent_text` (placeholder if null) + checkbox + "I Agree" button |
| `questionnaire` | `QuestionnaireStepWrapper` | Fetches by slug; wraps `QuestionnaireRenderer`; writes to `questionnaire_responses` on complete |
| `game` | `GameStepWrapper` | Dispatches to game component by slug; passes `studyMode`, `userId`, `studyId`; receives `onSessionComplete` |
| `debrief` | `DebriefStep` | Static text (placeholder) + "Complete Session" button |

Currently supported game slugs in `GameStepWrapper`: `breath_belt`.

`BreathBelt.jsx` access guard updated to allow `studyMode === true` in addition to `role === 'lab'`.

---

### Migration

Run `inperson_study_migration.sql` in Supabase SQL editor. Includes:
- `ALTER TABLE studies ADD COLUMN delivery_mode`
- `ALTER TABLE studies ADD COLUMN study_consent_text`
- `UPDATE studies SET protocol = '[]'` (resets all existing test data)
- `CREATE TABLE study_enrollments` with RLS
- RLS policy for lab members to update participant profiles

---

### Status

Specced. Build brief: `INPERSON_STUDY_BRIEF.md`.

---


---

## 28. Experiment Builder (Longitudinal Study Redesign)

Replaces the longitudinal study planner with a node-graph design tool for `online_longitudinal` studies. Full detail in `experiment_builder_spec.md` and `phase1_implementation_brief.md`; this section records the durable decisions.

### Scope

- New builder owns `online_longitudinal` only. `in_person` and `online_single` stay on `StudyFormPage`. Balanced condition assignment for single-shot studies runs through the shared `draw_assignment` primitive (see Shared assignment primitive below); per-trial randomization (stimulus order, jitter, item sampling) stays in study code via `src/utils/seededRandom.js`, seed logged with results.
- `delivery_mode`: `online_longitudinal` is the only value routing to the builder. Legacy `remote` and `online_single` are treated as equivalent single-shot and stay on `StudyFormPage`; existing rows are not migrated. If a CHECK constraint limits the column, extend it to allow the new value. Mixed in-person plus online longitudinal sessions are deferred (a per-session delivery flag can be added later without reshaping the graph).
- Route: `ExperimentBuilder` at `/admin/studies/new` and `/admin/studies/:id/design` when `delivery_mode = 'online_longitudinal'`.

### Confirmed live schema (ground truth, 2026-06)

Two parallel runtime models existed on paper; a live column check settled which is real.

- `participant_schedule`: `id, participant_id, study_id, study_session_id, scheduled_date, send_time, status, link_id, attempts, completed_at, created_at`.
- `participant_links`: `id, schedule_id, participant_id, study_id, token, status, expires_at, created_at`.
- Runtime is study_sessions-centric: `participant_schedule.study_session_id -> study_sessions`. auto-enroll and SessionEntry run on this path.
- The deployed `check_schedule` and `send_message` reference a non-existent schema (`scheduled_for`, `protocol_id`, `day_contact_id`, `session_template_id`, `study_day`, `schedule_instance_id`). They are dead code for an unbuilt flow, rewritten rather than patched.
- `message_log` exists; `participant_consent` does not and is not revived. Email opt-out lives on `study_enrollments` (alongside `consent_date`). Unsubscribe tokens live separately in `participant_unsubscribe_tokens`.

### Canonical model going forward

- `studies` + `design_graph` jsonb is the source of truth. Retire `study_protocols` / `protocol_study_days` / `protocol_day_contacts` and `src/pages/admin/ProtocolBuilder.jsx`.
- Keep `study_sessions` (compiled session-slot catalog, one row per graph session node, new `node_key`), `participant_schedule`, `participant_links`, and `session_templates` / `session_template_nodes` / SessionBuilder (untouched).
- Email and reminder settings consolidate onto `studies`; the `study_protocols` duplicate is retired.
- Identifier convention: the profiles UUID is `participant_id` in the runtime/email tables (`participant_schedule`, `participant_links`, `message_log`, `participant_unsubscribe_tokens`, `participant_assignments`) and `profile_id` in `study_enrollments`. The RA-facing text id is `external_id`, only on `study_enrollments`. Never name a text external-id column `participant_id`.

### Graph model (`design_graph`)

Stored as `{ nodes, edges }`. Rendered with React Flow (`@xyflow/react`, MIT, client-side, no telemetry). Node types:

- `timepoint`: `day_offset` (int days from day 1, day 1 = 0), `time_of_day` (null inherits baseline). First is baseline.
- `session`: `session_template_id`, `link_expires_hours`, `label`. References a `session_templates` row; its internal steps are `session_template_nodes`, edited by SessionBuilder.
- `block`: named ordered group of session ids; copy/paste-able; within-block order fixed.
- `randomize` (P2): between-subjects fork; balanced without replacement.
- `counterbalance` (P2): within-subjects order permutation; full permutation set, order randomized; within-block order preserved.

Both fork operations compose in either order, at any timepoint.

### Resolution and materialization

- Rule: resolve each fork when the participant reaches it. Materialize greedily from t0, stop at the first randomize not yet reached.
- Randomize at t0 resolves at enrollment (full schedule materializes immediately). Randomize mid-study (e.g. Liliana midpoint) resolves at that point, so balance is among those who actually reach it.
- Enrollment is a bulk insert of all pre-fork `participant_schedule` rows. First session `unlocked` + link issued; later sessions `pending` with `scheduled_date`, the cron issues each link just in time. This replaces auto-enroll's single-row insert; the materializer is the enrollment flow the cron was waiting for.
- Completion hook (P2) advances across a fork by drawing the balanced slot and bulk-creating the next branch. `complete_session_by_token` only marks done, it does not advance.
- One live link per participant: issuing a new link revokes any prior active links for that participant.

### Balanced draws (P2)

- Fixed `design_seed` per study makes draws reproducible.
- `draw_index` = participants already past the node (live count), so no participant total is declared; the sequence wraps forever by modulo. More participants than orders starts a new cycle; fewer means each order is used at most once.
- Reshuffle each cycle from `seed + node_id + cycle_number` (permuted-block randomization; an RA cannot predict the next arm).
- `participant_assignments` records every draw (group label or block order) for end-of-study audit within each group.

### Shared assignment primitive (2026-07)

Single-shot studies and longitudinal randomize nodes share one draw implementation rather than duplicating balance logic.

- `draw_assignment(study_id, slot_key)`: Postgres function, SECURITY DEFINER, participant from `auth.uid()`. Owns permuted-block draws (seed + slot + cycle, per Balanced draws above), concurrency (advisory lock on study + slot), idempotency (one assignment per participant per slot, returned on re-entry), and the audit write to `participant_assignments` (`node_id` doubles as the slot key, `kind = 'randomize'`).
- Arms live server-side, never passed by the client: `studies.assignment_slots` jsonb (`{ "condition": ["A","B"] }`) for single-shot; `design_graph` randomize nodes for longitudinal (P2 extension point inside the function).
- `design_seed` null falls back to `study_id::text`, so single-shot studies need no setup.
- Callers: single-shot draws at SessionEntry via `useAssignment` hook when `assignment_slots` is non-empty, assignments passed into the step flow; longitudinal (P2) calls the same function from the materializer/completion-hook with arms from the graph.
- StudyFormPage gains a Condition assignment section for non-longitudinal modes: named slots, comma-entry arms (min 2). A slot locks (read-only) once its first assignment exists; lock triggers on first draw, not launch. Escape hatch is duplicating the study, which carries slots but no assignments. New slots can always be added.
- `assignment_balance` view (counts per study, slot, arm) serves pilot verification now and the P2 balance audit.
- Anonymous participants work: token exchange yields an authenticated session, so `auth.uid()` resolves.
- Pilot: Sandy study 3 (Sandy Luu). Full detail in `randomizer_spec.md` and `randomizer_implementation_brief.md`.

**Implemented and pilot-verified 2026-07-05 (WP1–WP5 complete).**
- Migrations (both applied): `20260705_assignment_randomizer.sql` (`assignment_slots`, one-per-slot unique index, `draw_assignment`, `assignment_balance` view with `security_invoker`); `20260705_session_token_assignment_slots.sql` (`get_session_by_token` returns `assignment_slots` in the study object).
- Implementation detail: the Fisher-Yates swap index derives from 24 hash bits (`bit(24)::int`), not 32 — a 32-bit cast can go negative in Postgres and corrupt the modulo. Negligible bias at realistic arm counts.
- Client: `src/hooks/useAssignment.js` (`useAssignment` single-slot, `useAssignments` multi-slot via `useQueries`; both accept a `client` option for SessionEntry's isolated participant client). SessionEntry v5: draws fire only at `state === 'running'` (after screener + consent, so no rows for participants who never pass those gates), block the step flow with loading/error cards, never proceed unassigned. StepDispatcher v3 threads `assignments` (`{ [slotKey]: arm }`) to GameStepWrapper; the display element will consume the same prop.
- StudyFormPage v3: Condition assignment card (non-longitudinal modes) — named slots, comma-separated arms (min 2), validated on save; slot renders read-only once any draw exists (lock queried from `participant_assignments` counts).
- `src/utils/seededRandom.js`: mulberry32 + FNV-1a `hashStringToInt` + `seededShuffle`/`seededPick` for per-trial randomization. FarmJoy's inline mulberry32 copies left for opportunistic consolidation.
- Pilot result: 3 draws on Sandy study 3 (`condition: [control, treatment]`, seed = study id fallback) matched the pre-computed permutations exactly — cycle 0 `treatment, control`, cycle 1 opens `control`; balance even per completed block; link reopen returned the same arm with no new row; slot locked on the form.
- Known behavior kept as-is: reopening a session link restarts the step flow from step 1 (`currentIndex` is client state only; each redone step re-writes its responses). Mid-session resume + persisted step outputs deferred to the display element build or later.

### Liliana flow

baseline -> counterbalanced Phase 1 (3 blocks, days 1-4 order preserved within each) -> midpoint assessment -> randomize into groups -> Phase 2 diverges by group.

### Email and contact settings

- Nested popout (`ContactSettingsModal`) inside the builder, not the first screen. Writes to `studies`: `reminders_enabled`, `reminder_interval_hours` (default 24), `reminder_max`, `allow_restart`, `max_attempts`, `email_subject`, `email_body`. Reuses the existing template-variable editor and iframe preview.
- Cron rewrite: `check_schedule` and `send_message` rebuilt against the live schema. Settings read from `studies` by `study_id`, link expiry from `study_sessions.link_expires_hours` via `study_session_id`, email opt-out from `study_enrollments.email_reminders`, logging to `message_log`. The 15-minute cron does the date+time due-check in code (lab tz America/Toronto); `scheduled_date` + `send_time` stay the source columns.

### Phasing

- P1: additive migration; builder shell (timepoint, session, block) with React Flow; compile graph -> `study_sessions`; linear materializer wired into auto-enroll; contact popout; cron rewrite. Checkpoint after authoring, before runtime.
- P2: randomize + counterbalance + forks + balanced draws + assignment writes + completion-hook advance.
- P3: sample-flow generator and test run.

### Phase 1 migration (additive, nothing dropped)

- `studies`: `design_graph jsonb`, `design_seed text`, `design_version int`, `max_attempts int`, `reminder_interval_hours int default 24`.
- `participant_schedule`: `study_day int`.
- `study_sessions`: `node_key text`.
- new `participant_assignments` (written from P2); `email_reminders` opt-out added to `study_enrollments`.
- `study_protocols` family orphaned in P1, dropped in a follow-up migration once the cron rewrite is verified.

### Key decisions and learnings

- integrate-don't-regenerate, reinforced: the deployed cron functions had drifted from the live DB, visible only via a live column check. Verify schema against the database, not reconstructed DDL or function code.
- Resolve-each-fork-when-reached dissolves the eager-vs-lazy dilemma: it satisfies both full-schedule-at-enrollment (randomize-first) and point-of-divergence balance (mid-study forks).
- A multi-day materializer had to be built regardless (auto-enroll only ever created the first row), so lazy forks cost almost nothing extra.
- Keep `scheduled_date` + `send_time`; do not add `scheduled_for` as a source column (a generated timestamptz is not immutable across time zones).

### Phase 1 implementation — WP1–WP4 complete (2026-06-24)

**WP1 — Migration** (`supabase/migrations/20260624_experiment_builder.sql`, applied)
- `studies`: added `design_graph jsonb`, `design_seed text`, `design_version int default 1`, `max_attempts int default 1`; `reminder_interval_hours` already existed — altered to `SET DEFAULT 24`
- `participant_schedule`: added `study_day int`
- `study_sessions`: added `node_key text`
- New table `participant_assignments (id, study_id, participant_id, node_id, group_label, block_order jsonb, draw_index int, created_at)` — written from P2 balanced-draw logic; RLS: lab ALL, participant SELECT own via `participant_id = auth.uid()`
- `study_enrollments`: added `email_reminders bool default true`, `email_unsubscribed_at timestamptz`

**WP2 — ProtocolBuilder retired**: `src/pages/admin/ProtocolBuilder.jsx` deleted. `study_protocols` was empty; no data migration needed. `study_protocols` / `protocol_study_days` / `protocol_day_contacts` left in DB — to be dropped in a follow-up migration once WP6 cron rewrite is verified.

**WP3 — StudyFormPage + routing**
- `App.jsx`: added `ExperimentBuilder` import and route `/admin/studies/:id/design`
- `StudyFormPage`: selects `design_graph` for lock check; `onSuccess` redirects longitudinal → `/:id/design`, others → `/:id`; delivery-mode radios lock when `existing.design_graph` is set; email/reminder block hidden for longitudinal; hint text added; `useEffect` redirects `/admin/studies/:id/edit` → `/:id/design` for existing longitudinal studies

**WP4 — ExperimentBuilder shell**

*`src/lib/experimentGraph.js`* — pure graph helpers (no React):
- `newId()`, `topLevelNodes()`, `entryNode()`, `chainOrder()`, `validate()`, `addNode()`, `updateNode()`, `removeNode()`, `addSessionToBlock()`, `removeSessionFromBlock()`, `duplicateBlock()`, `toSlots()`
- `toSlots()` walks the chain; timepoints set `currentOffset`/`currentTime`; session nodes produce one slot at `dayNumber = offset + 1`; block children produce consecutive slots at `dayNumber = offset + i + 1`
- `validate()` checks: single entry, starts with timepoint, baseline offset = 0, at least one session, all sessions have template, block children exist, single outgoing edge per non-block node

*`src/components/study/builder/nodes/`*:
- `TimepointNode.jsx` — pink border, shows day label + send time, locked badge
- `SessionNode.jsx` — gray border, shows template name (red if missing) + link expiry, locked badge
- `BlockNode.jsx` — pink-tinted, renders children as list with `Day +i` labels, "+ Add session" and "Duplicate block" buttons (callbacks via `data` props), locked badge

*`src/pages/admin/ExperimentBuilder.jsx`* — main builder page:
- Loads study + `design_graph` from DB; bootstraps baseline timepoint for new studies
- `hasEnrollments` flag blocks structural edits and recompile
- `graphToRfNodes()` / `graphToRfEdges()`: converts internal graph → RF nodes/edges; positions stored in `_positions` meta field on the graph, not in graph structure proper
- `onNodesChange` syncs position changes only; `nodesConnectable={false}` prevents drag-to-connect
- `compileStudySessions()`: calls `toSlots()` then delete-and-reinsert `study_sessions`
- `EditPanel`: different fields per node type (timepoint: dayOffset + time; session: template picker + expiry; block: child count info)
- Save: validates, writes `design_graph` + `_positions` + `design_version`, compiles, invalidates queries
- Header: inline study name edit, save button, locked/error/saved badges
- Toolbar: "+ Timepoint", "+ Session", "+ Block" (hidden when locked)

### Status

WP1–WP4 complete; build passes.

**WP5 — Materializer, implemented and deployed 2026-07-08 (`auto-enroll` v3).**
- `supabase/functions/_shared/materializeSchedule.ts`: walks `design_graph` from an optional `fromNodeId` (P1 always starts at entry), one planned row per session node (including block children); `scheduled_date = t0Date + resolved day_offset`, `study_day = resolved day_offset + 1`; timepoint `time_of_day` is explicit-or-baseline (`null` inherits `baselineSendTime` directly, not the nearest preceding timepoint's resolved time — a deliberate reading of "null = inherit baseline" from §28's node-type table, distinct from `experimentGraph.js`'s `toSlots()`, which is sticky/cumulative and only feeds the nominal design-time `study_sessions` catalog, not per-participant schedules).
- Maps each planned row to its `study_sessions` row via `node_key` for the `study_session_id` FK. Bulk-inserts `participant_schedule` (first row `status='unlocked'`, rest `'pending'`), then issues a link for the first row via exported `issueLink()` (applies the one-live-link revoke, backfills `link_id`). Idempotent: no-ops if `participant_schedule` rows already exist for `(participant_id, study_id)`.
- Wired into `auto-enroll/index.ts`: branches on `study.design_graph` — present means longitudinal (calls `materializeSchedule`, looks up the `status='unlocked'` row's link, returns its token; a same-participant retry that idempotently no-ops falls back to the existing-active-link check, else a 409 telling the participant a new link will arrive when next due); absent falls through unchanged to the legacy single-row/single-link path (`in_person` / `online_single`, renumbered but byte-identical logic). No regression risk for existing non-longitudinal studies.
- No local Deno/Supabase CLI in this environment to typecheck; deployed via `mcp__supabase__deploy_edge_function` instead, and smoke-tested post-deploy (unknown `study_id` → clean 404, confirming the `_shared` import resolved and the function boots). No new migration needed — WP1 already added every column WP5 touches. Logic cross-checked against a real authored study (`Review WC1-4`, id `2bd0fae0-...`): its two-timepoint graph (Baseline day_offset 0 → session → Day 8 day_offset 7 → session) reproduces the exact `scheduled_date`/`study_day` the WP4 compile already recorded in `study_sessions.day_number` (1 and 8) — not exercised live since that study has `allow_external_enrollment = false`.
- Out of scope for WP5, left as-is: `WP5a` internal `enroll_participant` EF (explicitly a fast-follow per the brief, not Phase 1).

**WP6 — Cron rewrite, implemented and deployed 2026-07-08 (`check_schedule` v7, `send_message` v7, `handle_unsubscribe` v4).**
- `check_schedule/index.ts`: rewritten against the live schema — selects `id, participant_id, study_id, scheduled_date, send_time, attempts` (no more `protocol_id`/`scheduled_for`); due-check is `scheduled_date <= today` then, for today's rows, `send_time <= now` compared as lexicographically-ordered `date + time` string keys computed via `Intl.DateTimeFormat` in `America/Toronto` (handles the UTC-server-vs-lab-tz boundary correctly — a naive UTC `now` would fire early/late near midnight). Suppression checks (max attempts, existing active link via `participant_links.schedule_id`, new-link-imminent within `reminder_interval_hours`) preserved as-is against `studies.max_attempts`/`reminder_interval_hours`. Calls `send_message` with `{ schedule_id }` (renamed from `schedule_instance_id`).
- `send_message/index.ts`: rewritten — fetches `study_session_id`/`study_day` from `participant_schedule` directly (no `day_contact_id`/`protocol_id` joins), link expiry from `study_sessions.link_expires_hours`, email copy from `studies.email_subject`/`email_body` (single per-study values now, not per-protocol). Email opt-out check moved to `study_enrollments.email_reminders` (missing enrollment row = opted in; not gated on `consent_date`, since the first link is emailed before the participant ever reaches `/s/{token}` to consent). Link resolve now checks `status`/`expires_at` before reusing `link_id`, so an expired/revoked link is never re-emailed.
- Link-issuing logic extracted from `materializeSchedule.ts` into its own `supabase/functions/_shared/issueLink.ts` (`materializeSchedule.ts` now imports it) so `auto-enroll` and `send_message` share one implementation, per the brief's "reuse auto-enroll's link insert" instruction. `issueLink()` only back-fills `link_id` — callers set `participant_schedule.status` themselves (`auto-enroll`'s first session stays `'unlocked'`; `send_message`'s due row moves to `'link_sent'`), since the two callers need different statuses.
- `handle_unsubscribe/index.ts`: fixed the bug found during WP5 — now reads/writes `study_enrollments.email_reminders` + `email_unsubscribed_at` (matched by `study_id` + `profile_id`) instead of the nonexistent `participant_consent` table. Returns 404 `enrollment_not_found` if no enrollment row exists (previously would have silently no-op'd against the missing table).
- All four functions (`auto-enroll`, `check_schedule`, `send_message`, `handle_unsubscribe`) smoke-tested post-deploy — clean structured error responses (404/401 as expected), no boot/import errors. `get_advisors` security scan run after deploy: no new findings, only pre-existing unrelated items.
- **Root cause of the `check_schedule` 401s found and diagnosed, not fixed (needs Norm)**: `select command from cron.job` shows the pg_cron job posts `Authorization: Bearer <anon key>`, but the function has always required `Bearer <service role key>` — a pure credential mismatch in the cron job itself, unrelated to the schema rewrite. Fix (run in the SQL editor, substituting the real service_role key from Dashboard → Settings → API):
  ```sql
  select cron.alter_job(
    job_id := 1,
    command := $$
    select net.http_post(
      url := 'https://qajrlfqoicfcfhthsfay.supabase.co/functions/v1/check_schedule',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || '<SERVICE_ROLE_KEY>'),
      body := '{}'::jsonb
    );
    $$
  );
  ```
  Not run automatically — the service role key isn't retrievable through any available tool (by design), so this is a manual, secret-touching step.
- **Fixed and verified live 2026-07-08**: Norm ran the `cron.alter_job` SQL above with his project's secret key. Confirmed via `cron.job` (command now carries the corrected key) and by invoking `check_schedule` directly with the exact header shape the cron sends (`Authorization` only, no separate `apikey`) — first call processed 6 real due rows, all logged `sent` in `message_log`; second call (immediately after) returned `processed: 0`, confirming the queue had genuinely drained rather than double-sending. This project uses Supabase's newer `sb_secret_...` key format rather than a legacy JWT `service_role` key — worth knowing if this trips up a future fix here.

**WP7 — Contact settings popout, implemented 2026-07-08.**
- `src/components/study/builder/ContactSettingsModal.jsx`: new modal, opened via a "Contact settings" button in `ExperimentBuilder`'s header (not the first screen). Self-contained — fetches and saves its own slice of `studies` (`reminders_enabled`, `reminder_interval_hours`, `reminder_max`, `allow_restart`, `max_attempts`, `email_subject`, `email_body`) independently of the graph save, via its own `useQuery`/`useMutation`, so it can be opened/saved without touching `design_graph`/`design_version`.
- Reuses `StudyFormPage`'s pattern verbatim: `{{first_name}}`/`{{study_day}}`/`{{link_url}}`/`{{expires_hours}}` variable pills that append into the body textarea, plus the sandboxed `<iframe srcDoc>` preview with the same placeholder substitutions. Overlay/modal chrome copied from the existing `Modal` component pattern in `VasLibraryPage.jsx` (fixed-position backdrop, centered card, click-outside-to-close) rather than introducing a new one.
- Deliberately writes `reminder_interval_hours` (not `reminder_interval_days`) — confirmed via schema dump that `studies` carries both columns as two genuinely separate settings: `reminder_interval_days` is `StudyFormPage`'s pre-existing field for non-longitudinal studies, `reminder_interval_hours` is the WP1-added column `check_schedule` (WP6) actually reads for longitudinal studies. Using the wrong one would have silently no-op'd the reminder cadence.
- Also surfaces `max_attempts`, which no UI wrote before this (non-longitudinal studies via `StudyFormPage` never set it, so it silently sat at the DB default of 1 for every study).
- `npm run build` passes clean (pre-existing `numeric_es6` eval warnings and bundle-size warning only, both unrelated). Pushed and deployed via Vercel same day (commit `9a79359`), closing out Phase 1 (WP1–WP7).

Pending:
- Follow-up: drop `study_protocols` / `protocol_study_days` / `protocol_day_contacts` now that WP6 is verified end-to-end

### Phase 2, Pass 1 — randomize/counterbalance runtime (DB + materializer + cron), no UI yet

Scoped in a dedicated planning session (plan file `polymorphic-forging-catmull.md`) and implemented + fully verified live 2026-07-08, split deliberately into two passes: this pass covers the DB/runtime pipeline only, proven against a hand-authored `design_graph` via SQL; the builder UI (`RandomizeNode`/`CounterbalanceNode`, `ExperimentBuilder.jsx` wiring, balance audit view) is a separate future session.

**Key reconciliation found during scoping**: `phase2_implementation_brief.md` describes building a new `balancedDraw.ts` module and `claim_draw_index` RPC — but that brief predates the "Shared assignment primitive" work (§28, 2026-07-05), which already shipped a general-purpose `draw_assignment(p_study_id, p_slot_key)` function with an explicit code comment marking it as the intended Phase 2 seam. Extended it in place instead of building a parallel implementation.

**`draw_assignment` extension** (`supabase/migrations/20260708_phase2_draw_assignment.sql`, applied and verified):
- Added `p_participant_id uuid default null`, guarded by `auth.role() = 'service_role'` (same idiom already used in `20260707_profiles_prevent_privilege_escalation.sql`) — lets the materializer draw on a participant's behalf since it runs under the service-role client with no `auth.uid()`. Single-shot client calls are unaffected (still use `auth.uid()`).
- `CREATE OR REPLACE` doesn't replace-in-place across a changed parameter list (Postgres treats it as a distinct overload, which would have made 2-arg PostgREST calls ambiguous) — the migration explicitly `DROP FUNCTION IF EXISTS draw_assignment(uuid, text)` first. Caught this before applying, not after.
- When `assignment_slots -> slot_key` is null, falls back to a `design_graph` node lookup by id: `randomize` nodes expand `arms[].group` repeated by `weight` into a flat array (existing shuffle-and-pick-one code unchanged below that point); `counterbalance` nodes generate the full permutation set of `block_ids` via a `WITH RECURSIVE` append-based generator and pick one permutation the same way. Hard error above 6 blocks (verified: raises correctly at 7).
- **Value shape, easy to get wrong**: a randomize draw's `value` is a bare string (e.g. `"groupB"`), not `{group: "groupB"}"` — confirmed by direct testing, and it corrected a wrong assumption already coded into `materializeSchedule.ts` before this was caught live.
- Verified live: 6 participants → 6 distinct permutations of a 3-block counterbalance (one full balanced cycle); 4 participants → 2/2 balanced randomize split; idempotent repeat draws (same value, no new row); 7-block ceiling raises the expected exception.

**`experimentGraph.js`** (`src/lib/experimentGraph.js`): `validate()` now accepts multiple outgoing edges from `randomize` nodes only (matching `arms[].entry`), with structural checks (arm shape, exclusive arm-entry incoming edges, `counterbalance.block_ids` all exist and are `block` type, >4 blocks warns / >6 errors). New `counterbalanceMemberBlockIds()` excludes counterbalance-owned blocks from `topLevelNodes()`, mirroring `blockChildIds()`. `chainOrder()` stays linear-only (still correct for the authoring-UI helpers, since each arm's internal chain is itself linear — Pass 2 concern). New `fullTraversal(graph)` walks every branch (fans out at randomize, walks `counterbalance.block_ids` in authored order as a nominal reference ordering only — documented as not representing any real participant's actual order) for `toSlots()`, which now calls it; also detects rejoin nodes reached at inconsistent day offsets from different branches and surfaces them as validation errors. Verified via a 21-assertion standalone script (`node` with a `file://` import, since the repo path required an explicit URL scheme) covering: exact linear-graph regression against the old single-path `toSlots()` output, a 2-arm randomize fork with rejoin, a 3-block counterbalance, and three deliberately-broken graphs (missing arm entry, 7-block ceiling, mismatched rejoin offsets) — all 21 passed.

**`materializeSchedule.ts`** (`supabase/functions/_shared/materializeSchedule.ts`): rewritten to always re-walk from the true graph entry on every call (fixing a latent Phase 1 gap where `fromNodeId` was accepted but `planRows()` never actually used it to resume offset context correctly) and rely on per-node idempotency instead — pre-fetches existing `participant_schedule` status by `node_key` and existing `participant_assignments` by `node_id`, skips re-inserting/re-drawing anything already there. `counterbalance` resolves eagerly (order doesn't gate on completion); `randomize` gates on every upstream session on the walked path having status `completed` — stops (`stoppedAt = node.id`) if not, drawing and continuing into the winning arm only once reached. Removed the old whole-participant `count > 0` early-exit shortcut, since that would have permanently blocked all fork resolution after first enrollment. `fromNodeId`/`seed` removed from `MaterializeArgs` (dead weight once re-walk-from-entry made them unused, rather than leaving them to silently rot).

**`check_schedule` advance pass** (added as step 4, `supabase/functions/check_schedule/index.ts`): finds `(participant_id, study_id)` pairs with zero `unlocked`/`pending`/`link_sent` rows and at least one `completed` row (done in JS over a single query rather than SQL `GROUP BY`/`HAVING`, since the supabase-js query builder doesn't expose those), derives `t0Date` from `min(scheduled_date)` over the participant's existing rows (no new column needed), and re-calls `materializeSchedule` — safe every 15-minute tick since it's idempotent. **Bug found and fixed during live verification**: the original `if (dueRows.length === 0) return ...` early-return for the reminder-send logic accidentally skipped the advance pass entirely whenever nothing needed a reminder sent — restructured into a conditional block so the advance pass always runs. Caught because the very first live test returned `{processed:0,...}` with no `advanced` key at all.

**End-to-end verification** (hand-authored scratch study, cleaned up after): `auto-enroll` → materializes baseline + counterbalance eagerly, correctly stops at the randomize (upstream not completed) — 3 sessions inserted matching the drawn block order exactly, first `unlocked` + linked. `check_schedule` advance pass correctly no-ops while gated; after marking all 3 sessions `completed` via SQL, one call resolves the randomize (drew `groupA`), materializes only that arm's session at the correct day (`offset 10 + 1 = 11`, `t0Date` correctly derived from the earliest existing row), issues its link — confirmed via both `participant_schedule` and `participant_assignments`. A second immediate call is a true no-op (`advanced: 0`, row count unchanged at 4) — idempotency holds on both sides of fork resolution.

Pass 1 fully pushed 2026-07-08 (commit `8e98833`).

### Phase 2, Pass 2 — builder UI + balance audit view

Implemented and verified live 2026-07-08, same day as Pass 1. Live browser testing (via a temporary `playwright` install, `npm install --no-save` — not added to `package.json`/lockfile) caught two real bugs that code review alone missed; both fixed and covered by new regression tests before considering this done.

**`RandomizeNode.jsx` / `CounterbalanceNode.jsx`** (`src/components/study/builder/nodes/`): dashed-border node styling to visually distinguish forks from the solid-border `BlockNode`. `RandomizeNode` renders per-arm rows (group name, weight, remove button, a distinct ReactFlow source `Handle` per arm stacked down the right edge) with "+ session"/"+ block" affordances per unwired arm; `CounterbalanceNode` renders member blocks reusing `BlockNode`'s child-row pattern, no ReactFlow group/parent-node nesting. Per-arm group/weight values are edited via the existing `EditPanel` (reusing `updateNode`); structural add/remove happens on-canvas, matching the existing Block convention.

**New `experimentGraph.js` mutators**: `addArm`/`removeArm` (removal cascades the arm's private chain, stopping at any node shared with another path so a downstream rejoin is never deleted out from under another arm), `addArmEntry` (wires a new session/block as an arm's entry), `addBlockToCounterbalance`/`removeBlockFromCounterbalance`. `removeNode()` extended to cascade correctly for randomize (arm chains) and counterbalance (block_ids) node types — previously only handled plain blocks, so removing a fork node would have orphaned its owned subtree.

**Two real bugs found via live browser testing, both fixed**:
1. `insertAfter()`/`addNode()`/`tailNode()`/`chainOrder()` assumed every node has at most one outgoing edge — true for Session/Block/Timepoint but not Randomize (one edge per arm). Toolbar-inserting a node "after" an anchor that resolved to a populated Randomize node (or inserting a new Randomize node into an existing chain) triggered `insertAfter`'s blanket `filter(e => e.from !== afterId)`, which either destroyed existing arm edges or wired a bogus "continuation" edge to whatever used to follow — `validate()` correctly caught the corruption ("has an edge that doesn't match any declared arm", "Multiple disconnected chains"), but the underlying insertion logic was wrong. Fixed: `chainOrder()` now stops at (but includes) a randomize node rather than arbitrarily following one of its edges; `insertAfter()`/`addNode()` special-case randomize nodes on either side of an edit — dropping the old continuation rather than reattaching it, since a fork's outgoing edges are exclusively author-wired arms. First fix attempt left a residual bug (old edge appended-to instead of removed, giving the anchor node two outgoing edges); caught by a debug script reproducing the exact edge list, not by re-reading the diff.
2. None on the runtime side this round — this was purely a frontend graph-mutation bug, complementing the two backend bugs found during Pass 1's live testing (`draw_assignment` value-shape mismatch, `check_schedule`'s early-return skipping the advance pass).

Both bugs are covered by a standalone regression test reproducing the exact repro steps (insert Randomize mid-chain → wire an arm → insert Counterbalance while the Randomize is the resolved anchor) — 46 assertions total pass across the two standalone test scripts (`experimentGraph.js` traversal/validation, and the fork mutators), run via `node` with a `file://`-prefixed import (a bare Windows path import fails with `ERR_UNSUPPORTED_ESM_URL_SCHEME`).

**Balance audit view** (`src/pages/admin/StudyBalancePage.jsx`, new route `/admin/studies/:id/balance`, linked from `ExperimentBuilder`'s header next to Contact settings — not added to the older `StudyDetail.jsx`, which appears to predate/parallel the Experiment Builder's graph system and still calls a legacy `scheduleGenerator.js`, left untouched as out of scope): marginal counts per randomize/counterbalance node reuse the existing `assignment_balance` view as-is (no changes needed — jsonb `GROUP BY` already handles scalar/array `value` shapes identically); the stratified cross-tab (counterbalance order balance *within* each randomize group — the actual point of the audit, not just raw counts) is a client-side pivot over raw `participant_assignments` rows, generalized across every `(randomize, counterbalance)` node pair actually present in the graph rather than hardcoded to Liliana's specific two nodes. Verified live against 6 real `draw_assignment` calls: marginal counts balanced (3/3 groups, all 6 permutations at count 1), stratified table correctly split the permutation counts by group.

**Known minor UX gap flagged at the time** (newly-added nodes could render outside the current viewport, since `fitView` only ran once at canvas mount) **— fixed below in Pass 2b's camera-habits rework**, same day.

Pushed 2026-07-08.

### Phase 2, Pass 2b — fork-authoring UX rework + camera habits

Same day as Pass 2, later session, driven entirely by live user feedback after seeing Pass 2 in the browser. Four incremental pushes, each verified live via a temporary `playwright` install against a scratch study (created and deleted via SQL each time) before pushing — no code-review-only changes in this batch.

**1. Render block sessions + counterbalance blocks as connected nodes** (commit `183f75b`). Root complaint: it wasn't clear how a Counterbalance's blocks associated with it, and there was no sane way to add/review sessions inside a block — both were previously rendered as inline text lists inside the parent's own card. Reworked `graphToRfNodes`/`graphToRfEdges`/`autoLayout` in `ExperimentBuilder.jsx` so a Block's own sessions and a Counterbalance's own blocks render as separate, connected canvas nodes via new synthetic "containment" edges (dashed, distinct from structural edges) — visual only, never added to `graph.edges`, so `validate()`'s outDegree checks and the materializer's traversal are untouched. Toolbar became context-sensitive to the selected node's type (Block selected → only "+ Session"; Counterbalance selected → only "+ Block"; previously always anchored to whatever Timepoint was selected, which is what caused the original "+Block adds sequential blocks after the counterbalance instead of forking into it" confusion). Node removal became context-aware via two new `experimentGraph.js` helpers, `findOwningBlock`/`findOwningCounterbalance` — removing a block-owned session now calls `removeSessionFromBlock` instead of generically splicing the trunk. Added an explicit "Merge into" picker in `EditPanel` (new `mergeInto` mutator) for reconverging a dead-end forked path (e.g. a randomize arm's tail) into any other top-level node — deliberately excluded for block/counterbalance-owned children, since those aren't part of the trunk. `BlockNode.jsx`/`CounterbalanceNode.jsx` simplified accordingly (count + hint text, no more inline child rows).

**2. Camera habits — pin top-left, grow downward not rightward** (commit `aa66bf2`). The canvas is narrow by design (mobile), but `autoLayout` spread sessions/blocks/arms/counterbalance children rightward and `fitView` re-centered/shrank the whole graph on every change, so elements kept landing out of frame — exactly the complaint. `autoLayout` rewritten as a single depth-first downward walk: every node gets the next Y slot in visit order; nesting (block sessions, counterbalance blocks, randomize arms) only adds a small X indent (44px/level) instead of spreading beside its parent. Replaced `fitView` with `pinViewportTopLeft`, which re-pins the current leftmost/topmost node to the canvas's top-left corner (margin only, zoom untouched — so a manual zoom isn't overridden) whenever the *set* of rendered nodes changes (add/remove), not on every render. The manual fit-view control in `<Controls />` still works for a full zoomed-out view.

**3. Camera follows selection, not a static anchor** (commit `c5cdfec`). Follow-up correction: pinning the graph's absolute leftmost/topmost node meant a newly-added element (auto-selected on creation) could still land below the fold on a tall graph. `pinViewportToSelection` now re-pins whichever node is *currently selected* to the top-left — adding an element or clicking any existing node brings it into frame the same way; falls back to leftmost/topmost when nothing's selected (first load).

**4. Stop auto-selecting newly-added nodes** (commit `2f42339`). Final correction, again from live feedback: reselecting the new node on every add (needed for #3 above to bring it into frame) had a side effect — adding a child (e.g. a Block into a selected Counterbalance) shifted focus away from the parent the user was actively working in. Removed every `setSelectedId(nid)` call after an add, across all toolbar actions and the block/counterbalance child-add callbacks. Selection is now entirely user-driven (click a node, click the pane to deselect); combined with #3, the camera still always shows whatever's selected — it just no longer decides that for the user.

All four verified live at a narrow (~600px) viewport: fresh baseline pins near the canvas's top-left; repeated session adds stack directly below with no horizontal drift; a Counterbalance with nested Blocks stays within the narrow width; selecting Counterbalance then adding a Block leaves the Counterbalance selected/pinned while the new Block appears alongside it, not stealing focus. Full 59-assertion `experimentGraph.js` standalone regression suite still passes unchanged (only additive changes there: `findOwningBlock`/`findOwningCounterbalance`/`mergeInto`, and an optional `overrideBlockId` param on `addBlockToCounterbalance`).

---

## 29. Lecture Lounge — Classroom Engagement System

### Overview

Live classroom engagement system for large lectures. Replaces the legacy Firebase app (emotion-psy341-winter2026.web.app); concepts ported, no code migrated. Goal: support community and belonging in large lecture spaces through anonymous-but-embodied participation (avatars, never names).

Core loop: instructor stages a check-in from a console, students respond on their phones via a persistent class URL, results and Claude-generated comment summaries display live.

**Status**: Designed 2026-07. **Phase 1 (WP1–WP5) implemented 2026-07-11** — schema+RLS, join/verify (account-level), planning console, lab-wide class/instructor admin at `/lecture-lounge/admin`, mobile remote at `/class/:slug/remote`, projector screen at `/class/:slug/screen`, broadcast state machine, and the check-in flow + results view. See the header updates at the top of this document for exactly what shipped, what changed from the design below during implementation, and what's still unverified (the full three-surface loop has never run through real authenticated browser sessions — every check this session was SQL-impersonation or an unauthenticated-route smoke test). **Phase 2 in progress (2026-07-12)**: participation matrix/export, question publish/upvote/answered lifecycle, the quiz activity type (staged reveal), and avatar wall presence all shipped; only Claude summarization remains. The schema tables and decisions below have not been fully reconciled against the live implementation — treat this section's *intent* as current but verify exact column names/types against `supabase/migrations/2026071*_lecture_lounge_*.sql` before relying on specifics. First platform use of the Anthropic API (still pending — Claude summarization is Phase 2 scope).

### Decisions (confirmed 2026-07)

- Students link a verified `utoronto.ca` (or `mail.utoronto.ca`) email to their existing radlab account; grade export keys on that email
- Identity in class interactions is avatar-only; usernames and identifiers never shown
- Knowledge checks use a polling window (open, answer, close, tabulate); no speed scoring, no real-time countdown
- Correct answer and response distribution shown after poll closes
- One persistent student URL per class; separate instructor console controls what that URL displays
- In-class operation is mobile-first for instructor and students; the web console is for out-of-class planning only. Three surfaces (student phone, instructor phone remote, projector screen) run off one broadcast channel
- Claude summarization runs on instructor command after a poll closes, never streaming
- Mood check-in is a single tap on a compact circumplex wheel (reuses Still Water WheelSVG + avatar feedback), not the full two-diagonal flow
- Participation credit: count of check-ins responded to per lecture day
- Open-ended responses stored linked to profile (required for participation) but displayed anonymously everywhere; moderation issues investigated directly in the database, no name reveal in any UI
- Mood has no opt-out; the neutral middle of the wheel is the escape valve
- Student questions stream live to the console during the check-in window; instructor publishes selected questions to student screens (publish tap = moderation), students upvote published questions, instructor marks questions answered
- No competitive elements ever (no class leaderboards); motivation via platform points and self-only progress
- Live emote reactions deferred

### Student experience additions (confirmed 2026-07)

- **Self-in-aggregate**: after mood submission, student sees their own dot highlighted on the class mood plot
- **Avatar arrival**: student's avatar pops onto the wall on check-in completion
- **Question lifecycle**: submitted → published (instructor tap) → upvotable by peers → answered (instructor tap); submitter sees status changes even though anonymous. Encourages questions via check-ins rather than mid-lecture interruptions
- **Platform points**: 5 points per completed check-in to `profiles.points` (same pattern as Still Water)
- **Participation streak**: self-only streak on the dashboard participation card
- **Quiz reveal order**: show response distribution first, then correct answer
- **Rejoin resilience**: refresh or reconnect restores current state from console broadcast; draft responses never lost
- **Phone-first**: student view designed for one-thumb portrait use
- **Landing page card**: public "Lecture Lounge" card with join-code entry for students plus a short instructor-facing pitch; classes are the platform's strongest organic traffic funnel
- **Cross-sell nudge**: gentle post-check-in pointer to the rest of the site (e.g. Still Water), never blocking

### Schema

#### `classes`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | e.g. `"PSY202 Fall 2026"` |
| `slug` | text | UNIQUE; stable URL key, e.g. `psy202-fall-2026` |
| `join_code` | text | Short code students enter to join |
| `active` | bool | |
| `created_by` | uuid | FK → `profiles` |
| `created_at` | timestamptz | |

#### `class_admins`

Scoped instructor access. First departure from the flat lab/participant/public role model.

| Column | Type | Notes |
|---|---|---|
| `class_id` | uuid | FK → `classes` |
| `profile_id` | uuid | FK → `profiles` |
| — | — | PK on `(class_id, profile_id)` |

#### `class_members`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `class_id` | uuid | FK → `classes` |
| `profile_id` | uuid | FK → `profiles` |
| `utoronto_email` | text | Required for grade linkage |
| `utoronto_verified_at` | timestamptz | null until magic-link verified |
| `joined_at` | timestamptz | |
| — | — | UNIQUE on `(class_id, profile_id)` |

utoronto email lives here, not on `profiles`: class-scoped, and a student may verify once per class without polluting the global profile.

#### `lectures`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `class_id` | uuid | FK → `classes` |
| `lecture_number` | int | 1-indexed within term (~12 per term) |
| `title` | text | |
| `lecture_date` | date | |

#### `checkins`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `lecture_id` | uuid | FK → `lectures` |
| `position` | int | e.g. 1–3 within the lecture |
| `config` | jsonb | Activity sequence (see config schema below) |
| `status` | text | `'draft'` \| `'open'` \| `'closed'` |
| `opened_at` | timestamptz | |
| `closed_at` | timestamptz | |

`config` jsonb schema:

```json
{
  "auto_close_seconds": 180,
  "activities": [
    { "type": "mood" },
    { "type": "pacing" },
    { "type": "prompt", "text": "What is one thing that surprised you so far?" },
    { "type": "question_box" },
    { "type": "quiz", "items": [
      { "id": "q1", "text": "...", "options": ["A", "B", "C", "D"], "correct": 1 }
    ]}
  ]
}
```

Activities are optional and ordered; instructor composes each check-in from these five types. `prompt` is instructor-authored; `question_box` is open-ended student questions. `auto_close_seconds` is optional; when set, the remote shows a countdown and the check-in closes automatically unless the instructor closes early or extends.

#### `checkin_responses`

One row per student per check-in.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `checkin_id` | uuid | FK → `checkins` |
| `profile_id` | uuid | FK → `profiles` |
| `mood` | jsonb | `{x, y, label}` from single-tap wheel; null if not in config |
| `pacing` | int | e.g. 1–5 too slow ↔ too fast; null if not in config |
| `prompt_response` | text | |
| `quiz_answers` | jsonb | `{q1: 2, q2: 0}` |
| `created_at` | timestamptz | |
| — | — | UNIQUE on `(checkin_id, profile_id)` |

RLS: students insert/update own row only while `checkins.status = 'open'`; class admins read all rows for their classes; students never read others' rows.

#### `class_questions`

Student questions get their own table (not a column on `checkin_responses`) to support the publish/answer/upvote lifecycle. A student may submit more than one question per check-in.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `checkin_id` | uuid | FK → `checkins` |
| `profile_id` | uuid | FK → `profiles` |
| `text` | text | |
| `published_at` | timestamptz | null = console-only; set by instructor tap |
| `answered_at` | timestamptz | Set by instructor tap |
| `created_at` | timestamptz | |

RLS: students insert own; students read only published rows plus their own; class admins read all for their classes and update `published_at` / `answered_at`.

#### `question_votes`

| Column | Type | Notes |
|---|---|---|
| `question_id` | uuid | FK → `class_questions` |
| `profile_id` | uuid | FK → `profiles` |
| `created_at` | timestamptz | |
| — | — | PK on `(question_id, profile_id)` |

RLS: students insert/delete own votes on published questions only; vote counts readable by class members.

#### `checkin_summaries`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `checkin_id` | uuid | FK → `checkins` |
| `field` | text | `'prompt_response'` \| `'question_text'` |
| `summary` | text | Claude output |
| `model` | text | e.g. `claude-haiku-4-5` |
| `created_at` | timestamptz | |

Cached so re-display costs nothing; regenerate overwrites.

### Surfaces and routes

In-class experience is phone-first for everyone. Less tech-savvy instructors should never juggle browser tabs on a lectern mid-lecture: they open the projector view once before class, then drive everything from their phone.

| Route | Component | Surface | Access |
|---|---|---|---|
| `/class/:slug` | `ClassRoom` | Student phone (respond) | Class members (join flow if not yet a member) |
| `/class/:slug/console` | `ClassConsole` | Web planning dashboard (out of class) | `class_admins` for that class only |
| `/class/:slug/remote` | `ClassRemote` | Instructor phone (drive, in class) | `class_admins` for that class only |
| `/class/:slug/screen` | `ClassScreen` | Projector (ambient display, zero interaction after load) | `class_admins` session on the lectern |

**Console (web, planning)**: create lectures, compose check-ins, author prompts and quizzes, participation matrix, CSV export, preview-as-student sandbox. Desktop-oriented, done before class.

**Remote (mobile, live)**: today's check-ins as a queue in planned order. Live operation is tap-through: Next, Open, Close, Show Results, Summarize. Big one-thumb buttons, live response counter, connection indicator (live / reconnecting), optional auto-close countdown with close-early and extend. No composing, no tree navigation. Screen wake lock while active. "Quick pulse" button fires an ad hoc mood+pacing check-in for improvised moments (Phase 2).

**Screen (projector)**: opened once, then auto-follows broadcast state. Idle: lobby avatar wall plus a QR code that opens `/class/:slug` (kills URL-typing friction, especially week 1). Open: "check-in open" with live response count and QR. Results: aggregate displays and summaries. Wake lock while active.

**Student phone**: the response surface. State machine driven by broadcast:

- **Lobby**: live avatar wall of currently present members (Realtime presence, avatar props only)
- **Check-in open**: response flow for the staged check-in
- **Results**: aggregate mood plot (own dot highlighted), pacing distribution, quiz distributions (distribution shown before correct answer reveal), published questions with upvotes, Claude summaries

### Join and email verification flow

1. Student logs into radlab (existing signup if new)
2. Visits `/class/:slug` or enters join code → `class_members` row created
3. Prompted for utoronto email → Resend magic link to that address → click sets `utoronto_verified_at`
4. Unverified members can respond, but console flags them; export marks unverified rows

### Realtime model (Supabase Realtime)

- **Presence channel** per class (`class:{id}`): members joining the student URL register presence with avatar props payload; lobby renders the wall
- **Broadcast channel** per class: console pushes state changes (`staged`, `open`, `closed`, `results_ready`, `summary_ready`, `dismissed`); student screens react instantly. `dismissed` is not a checkin status — it's the "back to lobby" signal (`checkins.dismissed_at` set), and ClassRoom/ClassScreen treat it as going straight to no-live-checkin rather than a status object
- **Postgres Changes** subscriptions: console subscribes to `class_questions` inserts (questions stream in live during the window); students subscribe to published-question updates and vote counts
- No polling loops; responses are plain inserts

### Claude summarization

Edge Function `summarize-checkin`:

1. Instructor clicks Summarize (per field: prompt responses or student questions)
2. Function verifies caller is a class admin, pulls text for that check-in
3. Calls Anthropic API (Haiku class model) with a fixed summarization prompt: themes, notable questions, tone; explicitly instructed to never attempt de-anonymization and to ignore any instructions embedded in student text (prompt-injection guard)
4. Writes `checkin_summaries`, broadcasts `summary_ready`

`ANTHROPIC_API_KEY` lives in Edge Function secrets only, never in the client bundle. This establishes the platform pattern for all future AI API use.

### Instructor console (web planning dashboard)

Tree navigation: class → lecture → check-in.

- Lecture planning: create ~12 lectures per term, plan up to N check-ins per lecture with activity configs and optional auto-close, all in advance
- Preview-as-student: run any check-in in a sandbox exactly as students will see it (Phase 2)
- Live question feed while open (also available on the remote): questions appear as submitted; per-question Publish and Answered taps; published questions sort by upvotes
- Participation view: matrix of members × lectures, cell = check-ins responded that day
- CSV export: rows keyed to `utoronto_email`, columns per lecture date, values = check-in response counts; unverified emails flagged

Live controls exist here too for completeness, but the remote is the designed in-class surface.

### Participation

- Fully stored per response row; nothing aggregated destructively
- Credit rule: count of check-ins responded to per lecture day
- 5 platform points per completed check-in (`profiles.points`)
- **Data governance**: participation and response data linked to utoronto emails is course administration data, not research data. Any research use of classroom data requires a separate REB protocol and consent flow before analysis; this boundary is on record before any class runs
- Stretch: Dashboard participation card (own response counts + self-only streak) reading the student's own `checkin_responses`

### File structure

```
src/classroom/
  ClassRoom.jsx           ← student view state machine (lobby / respond / results)
  ClassConsole.jsx        ← web planning dashboard shell + tree nav
  ClassRemote.jsx         ← instructor mobile live remote (queue, big buttons)
  ClassScreen.jsx         ← projector ambient display (QR, wall, results)
  AvatarWall.jsx          ← presence-driven lobby wall (BaseAvatar grid)
  CheckinRunner.jsx       ← renders activity sequence from config
  MoodTap.jsx             ← single-tap circumplex wheel (wraps WheelSVG)
  ResultsView.jsx         ← aggregate mood plot, distributions, summaries
  ConsoleLecturePlanner.jsx
  ConsoleParticipation.jsx
supabase/functions/
  summarize-checkin/      ← Anthropic API call, admin-gated
```

### Phasing

- **Phase 1 (core loop)**: schema + RLS, join flow + email verification, web console (planning), mobile remote (queue, open/close, counter, connection indicator, wake lock, auto-close), projector screen (QR, state-following display), student check-in flow (mood with self-in-aggregate, pacing, prompt, question submission), broadcast state, results view, points award
- **Phase 2**: quiz activity type + distributions, question publish/upvote/answered lifecycle with live feed on remote and console, Claude summarization Edge Function, avatar wall presence with arrival animation, preview-as-student, quick pulse
- **Phase 3**: participation matrix + CSV export, dashboard participation card with streak (stretch), public landing page card (join-code entry + instructor pitch)
- **Pre-launch gate (before first live class)**: verify Supabase Realtime concurrent-connection quota covers largest class size plus headroom; load-test a synthetic class at target scale
- **Deferred**: live emote reactions

### Key decisions and learnings

- Avatar-only identity is viable precisely because avatar options are platform-curated; no free-form content can leak identity
- Polling-window model over real-time sync cut the build scope substantially with no pedagogical loss
- New table family over reusing `studies`: classroom semantics (membership, presence, live state) diverge too far from research protocol semantics
- Three surfaces off one broadcast channel (student phone, instructor phone, projector) removes the lectern tab-juggling problem entirely; the instructor opens the screen view once and drives from their pocket

# Part IV — Operations

## 30. Key Learnings

- Safari/iOS: avoid `@keyframes` with custom properties inside SVGs, `foreignObject`, inline `<style>` in SVG groups. Move animations to document `<head>`. Use `setAttribute` + `requestAnimationFrame` for all SVG animation.
- Logo: use `RADlab_Logo.svg` (white outline) or `RADlab_Logo_light.svg` (dark outline) — never redraw. White outline sits directly on the pink nav background. Dark outline for any other light surface.
- `useRef`-based timing is the correct React pattern for RT measurement and breath timing. Never use `useState` for values read inside animation loops or timeouts.
- SVG attribute names in `setAttribute` must be hyphenated (`stop-color`, `stroke-width`, `flood-color`) — camelCase only works in CSS, not XML attributes. Gradients silently fall back to black if this is wrong.
- QUEST+ adaptive staircase (jsQuestPlus) for threshold tasks; SDT analysis for go/no-go (Pond Watch).
- **jsQuestPlus serialization**: save `normalized_posteriors` (not `pdfAll`, not `priors`) and `trial_count` per staircase. Restore by passing `saved.normalized_posteriors` as the `priors` argument to the new jsQuestPlus constructor — this seeds the new instance from the previous session's posterior. jsQuestPlus does not reconstruct `stim_list` on restore (so `stim_list.length` will be 0), but the posterior is correctly restored and `getStimParams()` will return the right next stimulus. Track `trial_count` separately in a `useRef` since jsQuestPlus doesn't restore it.
- **jsQuestPlus initialization timing**: the staircase hook must wait for the Supabase profile fetch to resolve before deciding whether to restore or initialize fresh. Use a `useEffect` that watches `savedState` and guards on `undefined` (still loading) vs `null` (confirmed no state). Initializing on mount before the fetch completes always produces fresh staircases regardless of saved data.
- **jsQuestPlus internal property**: trial count is `stim_list?.length` not `trialCount` — check the actual object shape rather than assuming property names.
- **Trials table schema**: always include `game_name` (indexed text column) and `cumulative_trial_number` (managed by a `BEFORE INSERT` Postgres trigger — never set from application code). Add `created_at TIMESTAMPTZ DEFAULT NOW()` for reliable ordering. The cumulative trigger queries `MAX(cumulative_trial_number)` across all trials joined to the same user via `game_sessions`, increments by 1, and sets it on the new row automatically.
- **Diagnosing staircase bugs**: if all staircases show identical posteriors after trials, check (1) whether `update()` is being called with the right response index (0/1/2 — never undefined), (2) whether the staircase key lookup is resolving correctly for all four conditions, (3) whether the `update()` call wraps the stimulus in an array (`staircase.update([log10Mag], responseIndex)`). A posterior identical to the prior after N trials means `update()` either wasn't called or received symmetric inputs that cancelled out.
- **New routes must be `React.lazy()`-loaded, never a static top-level import** (see CLAUDE.md's "Route code-splitting convention") — a static import in `App.jsx` pulls that whole page into the entry bundle every visitor downloads on every route. Discovered 2026-07-11 after zero code-splitting anywhere let the entry bundle grow to ~782 KB gzipped unnoticed.
- Supabase handles auth + DB — no custom backend needed.
- Windows PowerShell: no `&&` — run commands one at a time.
- For file updates: present individual changed files rather than repacking the full tarball.
- Avatar reset before each trial (including warmup start) must be synchronous: cancel `requestAnimationFrame`, call `resetAvatarToNeutral()` via direct `setAttribute` calls, then hold 1000ms via `useRef` timer before restarting the rAF loop. Any state-driven or `useEffect`-driven reset will be too slow — one or more frames will render before the reset takes effect.
- **jsQuestPlus psychometric function**: `getStimParams()` returns a plain scalar. `update()` takes a plain scalar too — `update(log10Mag, responseIndex)`, NOT `update([log10Mag], responseIndex)`. Wrapping in array causes NaN posterior silently.
- **jsQuestPlus Weibull P(correct)**: do NOT use `jsQuestPlus.weibull()` — that function returns P(incorrect). Implement P(correct) directly: `(1 - lapse) * (guess + (1 - guess) * (1 - Math.exp(-Math.pow(10, slope * (stim - threshold))))) + lapse * guess`. No `/20` divisor — slope 5.70 is already in the correct units for this parameterisation.
- **jsQuestPlus `psych_samples` order** must match the psychometric function's argument order exactly: `[thresholdSamples, slopeSamples, guessSamples, lapseSamples]`.
- **npm package name**: `jsquest-plus` (hyphenated) — not `jsquestplus`. Import as `import jsQuestPlus from 'jsquest-plus'`.
- **First Contact rolling buffer**: use a fixed-size 4-cycle buffer (`slice(-4)`) for sync scoring. Never use a cumulative mean — early poor cycles would permanently lower the score and make the 80% threshold unreachable.
- **Aura rings in SVG**: render ring circles *before* the head ellipse in SVG draw order so they appear behind the avatar, not on top of it.
- Platform theme is **awareness and attunement**, not water specifically. Game names should evoke noticing and change (Pond Watch, Ebb & Flow, First Contact, Deeper Contact) — contemplative and sensory rather than clinical.

---

---

## 31. Roadmap

> Rewritten 2026-07-02 against actual codebase state; replaces the stale "Open Next Steps." Completed history lives in git.

### P0 — Liliana's longitudinal study (pretest August, recruit September)

- [x] Experiment Builder Phase 1 WP1-WP4: authoring shell, `experimentGraph.js`, migration, `ProtocolBuilder` removed (commit 7a030c3, 2026-06)
- [x] Experiment Builder Phase 1 WP5: materializer + auto-enroll wiring (2026-07-08, deployed — see §28 Status)
- [x] Experiment Builder Phase 1 WP6: cron rewrite against live schema, `handle_unsubscribe` fix (2026-07-08, deployed and verified live — the pg_cron credential mismatch is fixed, 6 real reminder emails sent — see §28 Status)
- [x] Experiment Builder Phase 1 WP7: contact settings modal (2026-07-08, built, build passes — not yet pushed to Vercel — see §28 Status)
- [x] Experiment Builder Phase 2 Pass 1: `draw_assignment` extension, `experimentGraph.js` fork support, `materializeSchedule.ts` + `check_schedule` advance pass — implemented, verified live, and pushed 2026-07-08 (commit `8e98833`), see §28.
- [x] Experiment Builder Phase 2 Pass 2: React Flow fork UI (`RandomizeNode`/`CounterbalanceNode`), balance audit view — implemented, verified live, and pushed 2026-07-08 (commit `f7010b3`), see §28.
- [x] Experiment Builder Phase 2 Pass 2b: fork-authoring UX rework (block/counterbalance children as connected nodes, context-sensitive toolbar, merge-into picker) + camera habits (downward-growth layout, camera pins/follows the current selection, no auto-select on add) — four commits, each verified live, pushed 2026-07-08, see §28.
- [x] Session-quality scoring & midpoint feedback WP-L1: VAS↔schedule linkage migration + wiring (2026-07-08, applied + built — see §26 Daily check-in capture; full plan in `docs/markdowns/liliana_feedback_spec.md`)
- [x] WP-L2: check-in packages into all 11 existing training templates (SQL conversion from single-scale steps) + `/admin/training` wrapper demo renders live packages (2026-07-09 — see §26). Remaining ~23 daily templates follow the same 3-step shape when authored.
- [x] WP-L3: `liliana_session_metrics` view, `liliana_midpoint_feedback` snapshot table, `get_liliana_midpoint_summary`/`record_practice_decision` RPCs, `draw_assignment` cycle patch — applied + verified live with synthetic data (2026-07-09, migration `20260709_liliana_feedback_backend.sql`; details in spec doc §WP-L3)
- [x] WP-L4: `MidpointStep` component — feedback→choice / control→choice / control→preference→anti-preference-assignment (2026-07-09; backend rework applied + verified live; copy placeholder pending Liliana; end-to-end click-test happens in the WP-L5 dry run)
- [~] WP-L5 (mostly done 2026-07-09): 48/48 daily templates, dry-run study authored + compiled, 3-arm midpoint dry run fully click-tested via real participant links, 5 launch-blocking bugs fixed (see spec doc). Remaining: Phase 2 cron-advance verification, data-export coverage, unsubscribe click-test, Liliana copy/calendar sign-off, author the real study
- [ ] WP-L6 (August): metric bake-off on pilot data; freeze `metric_version`
- [ ] Verify multi-session return flow: `profile_id` continuity across participant links
- [x] Verify reminder cron end-to-end: due-check + Resend delivery confirmed live 2026-07-08 (6 real sends). [ ] opt-out (`/unsubscribe/:token` → `study_enrollments.email_reminders`) still unexercised live — code fixed in WP6 but not click-tested
- [ ] Author Liliana's study in the builder; full dry run via SONA/Prolific link flow including completion redirect
- [ ] Data export check for all her measures
- [ ] August: pilot pass and fix list; September: recruitment live, support mode

### P1 — Onboarding v2 + Ripple (Wellness Buddy v2) integration

- [x] Design brief authored 2026-07-12 (`docs/markdowns/ripple_spec.md`) from a planning session with Norm, the 2021 SSHRC grant, and the retired CRA/Firebase app (context only, nothing ported). Decisions locked: the companion is named **Ripple**; buddy and avatar merge into one FACS-expressive entity (ExpressiveAvatar becomes the single renderer, BaseAvatar deprecated); public tier opted in by default with cadence customization and full disable; check-in = condensed Still Water circumplex core + rotating slower-construct items (sampling without replacement, grant Aim 4-ready); LLM chat deferred but schema-ready; research-stream buddy-vs-control comparison designed for, not built. Extended same day after a comparative review (Finch, Tamagotchi/Duolingo cautionary patterns, AI-companion dependence literature): relationship model locked as **growth partner, not caretaking** (Norm's framing — "a partner on the user's quest for growth"); eight design guardrails adopted (spec §5 — mood-valence-neutral rewards, non-punitive continuity, no neediness/guilt levers, notification ethics, crisis pathway as launch gate, data dignity, feedback-after-capture, LLM-phase reserved conditions); borrowed features folded in: micro-intentions (grant Aim 2), game suggestions as the Finch-adventure equivalent, semester-aware greetings.
- [x] WP1 (code complete 2026-07-12; migration `20260712_ripple_wp1.sql` confirmed applied 2026-07-12) — `ripples`/`ripple_checkins`/`consents` + RLS live; `/welcome` flow ships consent + ToS (versioned, `src/ripple/consentDocs.js`) → demographics → (WP2 extended: customize → name). `ProtectedRoute` routes new public users here. Own lazy chunk + `ErrorBoundary label="Ripple"`. Click-tested by Norm 2026-07-12.
- [~] WP2 (code complete 2026-07-12, **not yet click-tested live**) — `RippleAvatar` (`src/ripple/RippleAvatar.jsx`): unified FACS+species+hair renderer replacing BaseAvatar in all static/ambient contexts (Nav, ProfilePage, AvatarEditor preview, AvatarWall); `WelcomeFlow` gains CUSTOMIZE + NAME steps (replaces bridge placeholder); `RippleName` (`src/ripple/RippleName.jsx`): migration beat at `/ripple/name` for existing users with `ripples.name IS NULL`; `needsRippleName` computed + `ProtectedRoute` guard; `checkRippleName()` in `fetchRole`. BaseAvatar deprecated for ambient use. Both components emit as their own chunks. Remaining: click-test the full new-user flow and migration beat live.
- [x] WP3 (complete 2026-07-13) — `CheckinFlow.jsx` two-phase circumplex check-in (WheelSVG + FACS RippleAvatar reveal); saves to `ripple_checkins`; streak logic + `profiles.points` (+5); wired into `WelcomeFlow` (context='onboarding') and standalone `/checkin` (context='manual'); emits its own chunk.
- [x] WP4 (complete 2026-07-14) — rotating VAS item engine (`src/ripple/itemEngine.js`); context-driven login greeting (`src/ripple/greetings.js`); `/ripple/settings` page (name edit + `check_in_enabled` toggle); Dashboard `RippleSection` gates on `check_in_enabled`; prompt cadence covered by greeting + card CTA (email cadence = WP6). Migration `20260714_ripple_settings.sql` written, **not yet applied**.
- [x] WP5 (complete 2026-07-14) — `RippleCard` mood trends: circumplex scatter + VALENCE/AROUSAL sparklines + mode label when ≥ 2 check-ins; reuses existing `SwMoodGrid`/`SwLinePlot` primitives.
- [x] WP6 (complete 2026-07-14) — `ripple_reminder` Edge Function (hourly pg_cron, three Toronto time windows); `handle_ripple_unsubscribe` + `ripple_unsubscribe_tokens`; profile reminder toggle + time-of-day picker; `Unsubscribe.jsx` extended to detect Ripple tokens. Two migrations not yet applied. pg_cron entry needs one manual SQL step. Leaderboard/streak deferred.
- [ ] Later — Aim 2 norms feedback → Aim 3 demographic contextualization → Aim 4 MMT item banks → research-stream conditions → LLM buddy chat

### P2 — Dashboard wiring

- [ ] Audit which games write to `game_sessions`/`trials`/`performance` (Pond Watch `onSessionComplete` still unwired)
- [ ] Per-game stat cards + Recharts trend charts on Dashboard
- [ ] Leaderboard page (public tier)

### P3 — Sense Foraging Foundations course (late summer)

- [ ] Curriculum development first; delivery as a self-paced study via Training Modules (§26) + Experiment Builder (§28), with games interleaved as practice

### P4 — Lecture Lounge (classroom system)

- [x] Decision made 2026-07-10: full rebuild on platform infrastructure as Lecture Lounge (see §29). Old Firebase app retired as feature reference only.
- [x] WP1 schema+RLS, WP2 join/verify, WP3a planning console + lab-wide class/instructor admin — implemented and verified live 2026-07-11 (brief: `resources/lecture_lounge_phase1_brief.md`, not `docs/markdowns/` as originally planned)
- [x] WP3b mobile live remote — implemented 2026-07-11
- [x] WP3c projector screen view — implemented 2026-07-11
- [x] WP4 broadcast state machine + student check-in state machine — implemented 2026-07-11
- [x] WP5 check-in flow (mood/pacing/prompt/question) + results view — implemented 2026-07-11
- [ ] Full three-surface loop (remote + screen + student) verified live through real authenticated browser sessions — not yet done, everything so far is SQL-impersonation/unauthenticated-route verification
- [ ] **Instructor onboarding email package** (noted 2026-07-12, not started): from `/lecture-lounge/admin`, send all instructors on a course a package showing every link they need — console (`/class/:slug/console`), remote (`/class/:slug/remote`), screen (`/class/:slug/screen`), and the student join link (`/class/:slug`). Will need QR codes per link (reuse `react-qr-code`, already a dependency) and probably a link out to onboarding training material. Design/copy/exact trigger (auto on instructor-add vs. a manual "resend" button) not yet decided.
- [x] Phase 2 — participation matrix + CSV export: implemented 2026-07-12. Console gains a Planning/Participation tab split; matrix (members x lectures, cell = check-ins responded that day) + CSV export (rows keyed to `utoronto_email`, unverified flagged), backed by new `get_class_participation` RPC (narrow SECURITY DEFINER read, same pattern as `list_class_admins` — `profiles` has no policy letting a non-lab class admin read another student's `utoronto_email`)
- [x] Phase 2 — question publish/upvote/answered lifecycle: implemented 2026-07-12. Remote gets a live question feed per open check-in (Realtime `postgres_changes` INSERT on `class_questions`) with Publish/Mark answered taps; published questions sort by upvote count. Students see published questions on `ResultsView` (both their own device and the projector screen, the latter read-only) and can upvote/un-upvote live via `question_votes` insert/delete.
- [x] Phase 2 — quiz activity type + staged reveal: implemented 2026-07-12. Console authors questions with 2-6 options + correct-answer radio (`checkin_quiz_keys`, admin-only table — correct answers never touch `checkins.config`, which students already read directly). Students answer all questions on one screen (`QuizTap`); results show a per-option distribution bar chart via new `get_checkin_quiz_results` RPC, correct answer withheld until the instructor's separate "Reveal quiz answers" tap (`checkins.quiz_revealed_at`) — Peer-Instruction style, per Norm's choice over immediate reveal. Reveal propagates live to students/screen via `postgres_changes` on `checkins` (newly added to `supabase_realtime`), no page refresh needed.
- [x] Phase 2 — avatar wall presence: implemented 2026-07-12. New `useClassPresence` hook (Realtime **Presence**, a new mechanism for this codebase — every other Lecture Lounge live path uses broadcast or postgres_changes) tracks each present class member's avatar config on a `class:{id}` channel; `AvatarWall.jsx` renders the resulting list as a `BaseAvatar` grid with a pop-in arrival animation, shown in the idle/lobby branch of both `ClassRoom` (student) and `ClassScreen` (projector, read-only). Falls back to `BaseAvatar`'s own defaults for the ~88% of profiles that have never opened the avatar editor, rather than gating tracking on an `avatars` row existing.
- [ ] Phase 2 remaining: Claude summarization Edge Function

### Housekeeping

- [ ] Rewrite `README.md` (still Vite template boilerplate); repo About URL still points to radlab.vercel.app
- [ ] Remove remaining `[QUEST]` console.logs (4 in EbbAndFlow)
- [ ] Document ColorMax, Drift, Owl Barn, Aptitude Suite (stubs at §22); document VAS system (§24)
- [ ] Refresh §7 route table (`/study`, `/admin` marked "future" but role-based redirect and admin pages exist)
- [ ] Login/Signup mobile padding; Dashboard account card responsiveness
- [ ] BreathBelt: verify LabChart comment mapping for code 13
