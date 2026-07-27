---

## 22. In-Person Study System

### Overview

Extends the study protocol system with an `in_person` delivery mode. A lab RA enrolls participants on-site using an external participant ID, runs a full session (consent → tasks → questionnaires → debrief) on a single screen, and can resume from the last completed step if the session crashes mid-run. The RA's lab account remains authenticated throughout; participants use a silently-created Supabase profile.

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
