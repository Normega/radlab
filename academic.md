# academic.md — every property a class needs on the academic side

> Companion to `website.md` (§29 Lecture Lounge, §29a Academic Partition & Field Guide). Those
> sections are the *build history* — the running log of how each piece came to exist. **This file
> is the current-state reference**: what a course consists of, where each property lives, and the
> ordered checklist for standing up a new class. When behavior changes, update both: the log entry
> goes in website.md, the changed property goes here.

Last verified against live schema: 2026-09-01.

---

## 1. What "a class" is

One course = rows in **two Supabase projects** plus entries in **four frontend registries**. The
projects share no keys and no auth; the *entire* bridge between them is the course code and the
student's verified U of T email.

| Side | Project | Holds |
|---|---|---|
| **Lecture Lounge** | main (`radlab`) | class, lectures, check-ins, members, avatars, participation |
| **Field Guide** | `radlab-academic` (ref `qldgwpneygvgcvexlduz`) | course, wiki, gaps, claims, roster, enrollments |

The join key discipline, everywhere: **`classes.slug` (main) = lowercase of `courses.code`
(academic) = the `:courseCode` URL param.** `PSY240` in the academic DB, `psy240` in URLs and the
main DB. Break this and CourseHome, TrackingPage, and the join funnel all silently lose half the
course.

**Header chrome**: Field Guide pages carry an avatar menu top-right (`AvatarMenu.jsx`) — the
avatar itself comes from the MAIN project via a main-site session sharing the browser (initial
fallback otherwise); the menu is course-flavored (Class dashboard / Gap board or Submissions /
Account / Tour / Sign out).

MCP access: `supabase` = main, `supabase-academic` = Field Guide. Anything applied via MCP is
**live immediately** — there is no staging backend (website.md, *Live dev site*).

---

## 2. Main project — the Lecture Lounge half

### `classes` row
| column | convention |
|---|---|
| `slug` | lowercase course code (`psy240`) — the printed/QR URL is `/class/<slug>`, an immortal alias |
| `name` | display name (`PSY240 Fall 2026`) |
| `field_guide_url` | link shown on the class page — point at `/academic/<code>/wiki` |
| `archived` | end-of-term switch |

### `class_admins`
One row per staff member (main-site `user_id`). Gates the console, remote, screen, slides, and
`get_class_participation()`. **TAs need a row here** or the tracking page's Lounge columns show
"—" for them.

### `lectures`
`number` = **meeting index, not week**: it counts scheduled meetings including exam-only ones
(PSY240 #6 is the midterm — no deck), and is the number the deck filename and icon registry key
off. `title`, `lecture_date` complete the row.

### `checkins`
`kind` is `'live'` (in-lecture) or `'weekly'` (Question-of-the-Week wall). Live check-ins are
seeded per lecture as `status='planned'` (invisible to students until opened from the console),
with `position` giving the in-lecture order. The PSY240 rhythm, which new classes should copy:

| position | check-in | when |
|---|---|---|
| 1 | arrival | start of lecture |
| 20 | break 1 | ~60 min |
| 40 | break 2 | ~120 min |
| 90 | check-out | end |

`config` carries `{activities: [...], prompt_text}`; the open-ended question in `prompt_text`
should match the question printed on the deck's corresponding slide.

### Slide decks — `public/<course>/L<n>.html`
Static HTML, deliberately not React (website.md §29). One `<section>` per slide;
`data-kind="title|divider|activity|break"`; `class="hidden-until"` staged reveals; `<aside
class="notes">` speaker notes; footer chrome is bare `#bar/#num/#clock/#help` (no wrappers —
`slides.js` queries those ids). Copy `slides.css`/`slides.js` into the course dir; restyle via
`--accent`, but leave `--do` as caution-orange (`.box.warn` shares it). Every deck carries the
four check-in slides above, with the arrival question on-screen in a qbox and the class QR
(`assets/<course>-qr.png`) beside the dashboard URL on the arrival and break slides.

### Week icons — `src/assets/week-icons/<course>.<week>.<name>.{svg,png,webp}`
Globbed by filename; `<week>` here is the **calendar week**, mapped from lecture number by the
`iconWeek` function in the DECKS registry (below) — for a fall course with reading week after
meeting 7, that's `n <= 7 ? n : n + 1`.

---

## 3. Academic project — the Field Guide half

### `courses` row
`code` (uppercase), `name`, `term` (`'2026F'` — year + season letter), `is_public` (whether anon
can read the course row; needed for CourseHome's overlay before login on a public course).
**Term ordering is the archiving mechanism**: `/academic/psy240` always resolves to the newest
term's row, so next year's course archives this year's simply by existing. Never reuse a row
across terms.

### `identity.roster`
The class list as registrar facts: `full_name`, `email`, `student_number`, `status`
(`added → invited → enrolled`, plus `bounced`/`dropped`), `notes`, invite bookkeeping, and
`person_id` once matched. Imported and invited via `/academic/<code>/roster` (RosterAdmin) —
never hand-assemble a real roster in SQL.

### `identity.people` + `enrollments`
`people.onboarded_at` stamps the first-sign-in tour (three role-branched cards on the wiki and
submissions pages; `my_onboarding()`/`mark_onboarded()` RPCs; "Tour" in the avatar menu reopens
it). `people.auth_user_id` is **nullable** — a person can exist (and hold claims, for tests) with no
auth account. `enrollments` link person↔course with `role` (`student`/`ta`/`instructor`) and
`status` (`active`/`inactive`).

**The `identity` schema is not on PostgREST’s exposed-schema list** — that is where the PII lives — so
`.schema('identity').from(...)` fails with *“Invalid schema”* from any client, service key included. Reach it
through a `SECURITY DEFINER` RPC (`roster_invite_targets` is the pattern), or sidestep it: `enrollments` is in
`public` and its RLS is `person_id = current_person_id()`, so reading it with the **student’s own JWT** answers
“what is this person enrolled in” without a person-id lookup at all. Both `roster-invite` and `lounge-continue`
hit this; in the second it was invisible, because the discarded error read to the student as a considered refusal.

**Staff access = an active `ta` or `instructor` enrollment.** That single fact gates every
`/academic/<code>/{ingest,review,submissions,corrections,roster,read,reports,tracking}` page via
`FieldGuideStaffRoute` + `staffCourses.resolveCourse` (a code that doesn't resolve never falls
back to another course).

### The contribution pipeline, end to end
`claim_gap()` → student writes a summary **and captures the source**
(`/api/claim-source`: open-access full text resolved from the DOI — every OA copy is tried, not
just the publisher's, because publishers commonly answer a bot with a challenge page — or an
uploaded PDF; only extracted text is cached, on `gap_claims.source_fulltext`) → `submit_claim()`
→ precheck → **the source comparison runs on submission** (and can be re-run from `/submissions`) (`/api/integrate-claim` with `file:false`: reads the paper, judges the student’s summary against it, stores the verdict and the drafted section on the claim — shown in the queue beside the student’s words, so the comparison informs the decision instead of following it) → staff accept → **the same endpoint files that draft** (Sonnet; the student's summary is judged, not copied, and divergence is
reported back on the claim) → the draft lands as a `pending` proposal in the same review queue
ingest uses → `review_proposal()` publishes it. **Nothing auto-publishes.** Cached source text is
purged once the claim resolves (`purge_claim_sources`).

### Wiki + contribution pipeline
`wiki_pages` (versioned; `edit_page()` for edits), `page_gaps` (`status` is only
`open`/`retired` — *availability* is computed from claims, don't touch status to "close" a gap),
`gap_claims` (lifecycle `claimed → submitted → accepted`; send-back = back to `claimed` **with
`note` set** — current state, not an event log). Claims are created through `claim_gap()`; the
`gap_claims_guard()` trigger blocks direct writes unless
`set_config('radlab.claim_flow','1',true)` is set (seeding/reset scripts only).
**Server-side writes must go through an RPC that sets that flag** — the service key carries no
person identity, so `current_person_id()` is null and the guard raises *'not your claim'* on a
plain update. `record_claim_source()` and `record_claim_integration()` are those RPCs; the guard
lets a change confined to bookkeeping columns through when the flag is set.

### RPCs a class relies on
- `contribution_tracking(p_course_id)` — staff-only (checks `is_course_staff`), one JSON row per
  roster student with pipeline counts. Feeds the tracking page.
- `is_course_staff(course_id)` — the authorization primitive above.
- Main-project counterpart: `get_class_participation(p_class_id)` (class-admin/lab only) —
  members, lectures, response counts. The tracking page joins the two **client-side on
  normalized email** (`@mail.`/`@alum.` utoronto.ca collapse to `@utoronto.ca`).

---

## 4. Frontend registries — one entry each, or the class half-works

| Registry | File | What a new class adds |
|---|---|---|
| Routes | `src/App.jsx` | nothing — all `/academic/:courseCode/*` routes are param-driven |
| Path vocabulary | `src/academic/courseRoutes.js` | nothing per-class — but **any new staff/wiki URL segment must join `FIELD_GUIDE_SEGMENTS`** (see §5) |
| Feature switches | `src/academic/courseFeatures.js` | only to turn something OFF (default is full-featured). `contributions: false` = participation-only tracking page; `gaps: false` = no gap board, no per-page gap boxes or flag control; `ingest: false` = no ingest portal or links, edit hint drops the ingest pitch. All three off for PSY309 (its guide is authored whole; direct /gaps and /ingest URLs bounce to the wiki index) |
| Slide decks | `DECKS` in `src/academic/lecture-lounge/ClassSlides.jsx` | `{ dir, file, iconWeek }` for the course |
| Week icons | `src/assets/week-icons/` | one file per week, named per §2 |

All route pages are `lazy()` imports (website.md, *Route code-splitting*); after adding any, check
`dist/assets/` for the component's own chunk.

---

### Crossing between the two projects

A student signed in to one half is a stranger to the other, because the halves are different
Supabase projects. Both directions are bridged rather than asking for a second signup, and both
rest on the same argument: **holding a session on either side already proves control of the U of T
mailbox**, which is the standard the other side's verification asks for.

- `api/fieldguide-continue` — Lounge → Field Guide, spending a just-consumed verify token.
- `api/lounge-continue` — Field Guide → Lounge. Verifies the academic JWT against the academic
  project, requires an active enrollment, matches an existing main profile by verified U of T
  address **before** creating anything (so a student who joined months ago under a personal address
  keeps that account, avatar and participation), stamps `utoronto_verified_at`, joins the class,
  and returns only a `hashed_token` for the browser to exchange with `verifyOtp`. No access token
  is ever put in a response body or a URL.

Both fail soft: a broken bridge shows the ordinary signup card, never a locked door.

## 5. The two auth doors — and the trap between them

Each project sends its own magic links, and each lands on its own routes:

- **Main project** links land on `/class/<slug>` (signup confirmation — printed on QR codes,
  never move it) and `/academic/<code>/lounge*`.
- **Academic project** links land on `/academic/<code>/join`, `/wiki`, and the staff segments.

**Sign-in never hands a live token to a GET.** University mail runs Microsoft Defender Safe
Links, which fetches every URL in every message; a Supabase magic link is single-use, so the
scanner redeems it seconds after delivery and the student's own tap lands on a spent token.
Confirmed 2026-09-04 on a real student: six sessions minted against her account, every one from
an Azure IP with a rotating desktop user agent, none from her iPhone. The emailed link therefore points at
**our own** `/academic/:courseCode/signin` page carrying `properties.hashed_token`, and that page is
INERT until a human presses its button — a scanner's GET receives static HTML and spends
nothing; only the click calls `verifyOtp({token_hash, type})`. Verified with a headless load: zero
auth requests fire before the click. The same email also carries `properties.email_otp` as an
independent second path, typed on the join door, which survives even a scanner that presses
buttons. **Any new email carrying a sign-in link must assume the link is opened by a machine
first: the human's click has to be what consumes it.** Never auto-verify in an effect on that
page — it reintroduces the whole bug.

The inert-until-pressed doors that implement the rule: `/academic/:course/signin` (Field Guide
sign-in, `SignInConfirm`), `/class/confirm` (Lounge signup confirmation, `ClassConfirmSignup` +
`api/lounge-signup`), and `/class/verify` (U of T address verification, `ClassVerifyEmail` —
button-gated since 2026-09-04; it used to verify in a mount effect, so JS-executing scanners
verified on the student's behalf and fired its roster-join side effect unasked). Never route a
student email through `supabase.auth.signUp`, `resetPasswordForEmail`, or
`properties.action_link` — all of those produce links to `/auth/v1/verify`, which spends the
token on a plain GET.

The main client decides whether to consume an auth code by route
(`src/lib/authDetectRoutes.js`). **A staff/wiki segment missing from `FIELD_GUIDE_SEGMENTS` in
`courseRoutes.js` means the main client eats academic auth codes on that page** — the failure is
silent in both directions (a burned single-use code, no error). The spec table in
`src/lib/authDetectRoutes.test.mjs` is the contract: add rows for any new segment *first*, then
make them pass. (`tracking` was caught missing exactly this way, 2026-09-01.)

Both Supabase projects also keep redirect-URL allowlists in their auth settings; a genuinely new
landing path needs adding there (dashboard, per project).

---

## 6. The URLs of a class

Student-facing: `/academic/<code>` (course home — the one front door, unguarded),
`/class/<slug>` = `/academic/<code>/lounge` (the Lounge), `/lounge/slides` (deck index — any
signed-in user; the lecture list under it is RLS-gated to class members, and the deck files in
`public/<course>/` are world-readable statics either way), `/academic/<code>/join` (Field Guide
sign-in), `/academic/<code>/wiki`, `/gaps`, `/whats-new`.

Staff (academic-project auth): `/ingest`, `/review`, `/submissions`, `/corrections`, `/roster`,
`/read`, `/reports`, `/tracking`. Lounge staff (main auth + class_admins): `/lounge/console`,
`/remote`, `/screen`. Lab-wide: `/academic/admin`.

The course home shows the staff grid to academic staff **or** main-site lab/superadmin, and links
every surface above — it's the bookmark to give TAs.

---

## 7. Checklist — standing up a new class

Ordered so nothing references a thing that doesn't exist yet:

1. **Academic**: `courses` row (code, name, term, `is_public`). Migration file in
   `supabase/migrations/`, applied via MCP, row added to the manifest README.
2. **Academic**: staff — people + active `instructor`/`ta` enrollments for everyone who'll mark.
3. **Main**: `classes` row (slug = lowercase code, `field_guide_url`), `class_admins` for the
   same staff, `lectures` for every meeting.
4. **Repo**: deck dir under `public/<course>/`, `DECKS` entry, week icons, any
   `courseFeatures` override. New URL segments (rare) → `FIELD_GUIDE_SEGMENTS` + test rows.
5. **Main**: seed planned check-ins (four per lecture, positions 1/20/40/90) matching the deck
   questions; weekly (QotW) check-ins as the term plan requires.
6. **Academic**: roster CSV through RosterAdmin; invites from there, not by hand.
7. **Verify like the ingest test** (see §8): a seeded fake student through join → claim → submit
   → send-back → approve, and the tracking page showing it, *before* real students arrive.
8. Syllabus/QR artifacts print `/class/<slug>` and `/academic/<code>` only — those two URLs are
   forever.

Frontend goes to `dev` first; anything touching either Supabase project ships with its frontend
to `main` together (website.md, *Branch policy*). **This repo is public** — no exam items, answer
keys, or study-arm names in it, ever.

### 7a. End of term

Set `classes.archived`; next term's `courses` row auto-archives the academic side (§3). Roster,
claims, and responses stay — they are the record.

## 8. The resettable test-cohort pattern

Proven 2026-09-01 (tracking-page ingest test): seed `teststudentN@radlab.zone` people (**no auth
accounts** — `auth_user_id` stays null), roster rows tagged `TEST ROW …` in `notes`, enrollments,
and claims in each pipeline state via the `radlab.claim_flow` flag; on the main side, point a test
profile's `utoronto_email` at one of them and insert tagged `checkin_responses`. Everything is
tagged so a short SQL file removes it exactly — pattern lives in
`Teaching\2026\RESET_ingest_test_2026-09-01.sql`. Claims against real gaps hold those gaps while
seeded — reset promptly.
