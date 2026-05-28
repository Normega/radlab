# In-Person Study System — Claude Code Build Brief

> Read `website.md` fully before starting. All design tokens, component patterns,
> and DB conventions are defined there.

---

## Overview

Add an **in-person delivery mode** to the existing study system. This lets a lab RA
enroll participants on-site, run a full study session (consent → tasks →
questionnaires → debrief) on a single screen, and resume from the last completed
step if the session crashes.

Nothing in the existing codebase is deleted. All changes are additive except the
`studies.protocol` column format (see migration below — all existing data is test
data and can be reset).

---

## 1. SQL Migration — `inperson_study_migration.sql`

Place at project root. Run manually in Supabase SQL editor.

```sql
-- 1. delivery_mode on studies
ALTER TABLE studies
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'remote'
  CHECK (delivery_mode IN ('remote', 'in_person'));

-- 2. Reset protocol column to new typed format (all existing data is test data)
UPDATE studies SET protocol = '[]'::jsonb;
-- protocol items are now objects: { type: 'consent'|'game'|'questionnaire'|'debrief', slug: string }
-- 'consent' and 'debrief' steps have slug = 'consent' / 'debrief' (no questionnaire lookup needed)
-- 'game' slug matches a game route key (e.g. 'breath_belt')
-- 'questionnaire' slug matches questionnaires.slug

-- 3. study_enrollments table
CREATE TABLE IF NOT EXISTS study_enrollments (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  study_id         uuid        NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  participant_id   text        NOT NULL,
  user_id          uuid        REFERENCES profiles(id),
  enrolled_by      uuid        NOT NULL REFERENCES profiles(id),
  enrolled_at      timestamptz DEFAULT now(),
  status           text        NOT NULL DEFAULT 'enrolled'
                               CHECK (status IN ('enrolled','in_progress','completed','withdrawn')),
  current_step     int         NOT NULL DEFAULT 0,
  completed_steps  jsonb       NOT NULL DEFAULT '[]',
  started_at       timestamptz,
  completed_at     timestamptz,
  notes            text,
  UNIQUE(study_id, participant_id)
);

ALTER TABLE study_enrollments ENABLE ROW LEVEL SECURITY;

-- Lab members: full access
CREATE POLICY "lab_full_access" ON study_enrollments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lab')
  );

-- Participants: read own row only
CREATE POLICY "participant_read_own" ON study_enrollments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

---

## 2. File Structure (new files only)

```
src/
  pages/
    admin/
      StudiesPage.jsx           ← study list (may already exist — extend or create)
      StudyDetailPage.jsx       ← study detail + enrollment panel (NEW)
      StudyFormPage.jsx         ← create/edit study form (NEW)
      StudySessionRunner.jsx    ← full-screen session runner (NEW)
  components/
    study/
      ProtocolBuilder.jsx       ← drag-to-reorder step list with type+slug pickers (NEW)
      EnrollmentPanel.jsx       ← enrolled participants list + enroll form (NEW)
      StepDispatcher.jsx        ← renders correct component for a protocol step (NEW)
      ConsentStep.jsx           ← consent step screen (NEW)
      DebriefStep.jsx           ← debrief step screen (NEW)
  lib/
    createParticipantAccount.js ← silent Supabase account creation utility (NEW)
inperson_study_migration.sql
```

---

## 3. Routes (add to `App.jsx`)

All inside the existing `AdminRoute` guard (requires `profiles.role === 'lab'`).

```jsx
<Route path="/admin/studies"            element={<StudiesPage />} />
<Route path="/admin/studies/new"        element={<StudyFormPage />} />
<Route path="/admin/studies/:id/edit"   element={<StudyFormPage />} />
<Route path="/admin/studies/:id"        element={<StudyDetailPage />} />
<Route path="/admin/studies/:id/session/:enrollmentId"
                                        element={<StudySessionRunner />} />
```

---

## 4. `createParticipantAccount.js`

```js
// src/lib/createParticipantAccount.js
//
// Creates a silent Supabase auth account for an in-person participant.
// Uses a SECONDARY supabase client so the RA's session is not disturbed.
// The participant never knows their credentials.
//
// Returns: { userId, error }

import { createClient } from '@supabase/supabase-js'

const secondaryClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export async function createParticipantAccount(participantId, studyId) {
  const email    = `p-${participantId.toLowerCase().replace(/\s+/g, '-')}@radlab.internal`
  const password = crypto.randomUUID()           // never stored or shown

  const { data, error: signUpError } = await secondaryClient.auth.signUp({
    email,
    password,
    options: { data: { display_name: `Participant ${participantId}` } }
  })

  if (signUpError) return { userId: null, error: signUpError }

  const userId = data.user?.id
  if (!userId) return { userId: null, error: new Error('No user ID returned') }

  // profiles row is created by existing trigger; update role + study_id
  // Use the PRIMARY supabase client (RA is logged in with service-level access
  // via RLS policy allowing lab members to update participant profiles).
  // If that RLS policy doesn't exist yet, add it:
  //   CREATE POLICY "lab_can_update_participant_profiles" ON profiles
  //   FOR UPDATE TO authenticated
  //   USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'lab'))
  //   WITH CHECK (role = 'participant');

  const { error: updateError } = await import('../lib/supabase.js').then(m =>
    m.default
      .from('profiles')
      .update({ role: 'participant', study_id: studyId })
      .eq('id', userId)
  )

  if (updateError) return { userId, error: updateError }
  return { userId, error: null }
}
```

> **Note**: In production, move this to a Supabase Edge Function with service role
> key so the anon client can't be abused. For now, secondary anon client + RLS is
> sufficient for lab use.

---

## 5. `StudyFormPage.jsx`

Create/edit form for a study. Handles both `/admin/studies/new` and
`/admin/studies/:id/edit` (detect by presence of `id` param).

### Fields

| Field | Type | Notes |
|---|---|---|
| Study name | text input | required |
| Delivery mode | radio: Remote / In-Person | controls which other fields show |
| Protocol | `<ProtocolBuilder />` | step list |
| Active | toggle | |

**Remote-only fields** (hide entirely when delivery_mode = 'in_person'):
- Reminder settings
- Enrollment email template
- Messaging options

**Protocol validation** (both modes):
- Must have at least one step
- Warn (not block) if no consent step
- Warn if no debrief step

### Supabase writes

```js
// create
supabase.from('studies').insert({
  name, delivery_mode, protocol, active, created_by: currentUser.id
})

// edit
supabase.from('studies').update({ name, delivery_mode, protocol, active }).eq('id', id)
```

---

## 6. `ProtocolBuilder.jsx`

Drag-to-reorder list of protocol steps. Each step:

```js
{ type: 'consent' | 'game' | 'questionnaire' | 'debrief', slug: string }
```

**UI per step:**
- Type selector (pill tabs or select)
- Slug selector:
  - `consent`: fixed, no selector
  - `debrief`: fixed, no selector
  - `game`: hardcoded list of available games: `[{slug:'breath_belt', label:'Breath Belt'}, ...]`
  - `questionnaire`: dropdown populated by `SELECT slug, name FROM questionnaires WHERE locked = true`
- Remove button
- Drag handle (use `@dnd-kit/sortable` if installed, else simple up/down arrow buttons)

Render constraint: consent step always shown first if present (visually distinct, cannot be reordered below position 0). Same for debrief at the end.

---

## 7. `StudyDetailPage.jsx`

Route: `/admin/studies/:id`

### Layout

```
[Back to Studies]
Study name               [Edit Study]   [Active toggle]
Delivery mode badge      Protocol step count

──────────────────────────────────────
Protocol Overview
  Step 1: Consent
  Step 2: Breath Belt
  Step 3: PANAS
  Step 4: Debrief

──────────────────────────────────────
Enrolled Participants     [Enroll New Participant ▾]
  ┌──────────────────────────────────────────────────────────┐
  │ ID        Enrolled    Status        Step     Actions      │
  │ P-001     May 27      in_progress   2 of 4   Resume Reset │
  │ P-002     May 27      completed     4 of 4   Reset        │
  └──────────────────────────────────────────────────────────┘
```

### Enroll New Participant (inline form, collapses on submit)

```
External Participant ID: [____________]  [Enroll & Begin Session →]
```

On submit:
1. Call `createParticipantAccount(participantId, studyId)` → get `userId`
2. Insert into `study_enrollments`: `{ study_id, participant_id, user_id, enrolled_by, status: 'enrolled', current_step: 0 }`
3. Navigate to `/admin/studies/:id/session/:enrollmentId`

Show error inline if `UNIQUE(study_id, participant_id)` constraint fires (duplicate ID).

### Resume button

Navigates directly to `/admin/studies/:id/session/:enrollmentId`.

### Reset menu (three-dot button per row)

Options:
- **Reset to beginning** — sets `current_step = 0`, `completed_steps = []`, `status = 'enrolled'`
- **Reset to step N** — dropdown of completed steps by name; sets `current_step = N`
- **Mark withdrawn** — sets `status = 'withdrawn'`

Reset does NOT delete game/questionnaire data rows — those remain in their tables.
Confirm dialog before any reset action.

---

## 8. `StudySessionRunner.jsx`

Route: `/admin/studies/:id/session/:enrollmentId`

This is the full-screen session runner. The RA hands the device to the participant
after navigation. The RA account remains logged in.

### On mount

```js
// 1. Fetch enrollment row
const { data: enrollment } = await supabase
  .from('study_enrollments')
  .select('*, studies(protocol, name)')
  .eq('id', enrollmentId)
  .single()

// 2. Fetch study protocol steps
const steps = enrollment.studies.protocol  // typed step array

// 3. Resume from current_step
setCurrentStep(enrollment.current_step)
```

### State machine

```
LOADING → RUNNING_STEP → SAVING → RUNNING_STEP → ... → COMPLETE
```

`SAVING` is a brief state between steps where the enrollment row is updated.
Show a spinner during this state so the participant doesn't advance by accident.

### Step advancement

```js
async function completeStep(stepData) {
  setPhase('SAVING')

  const newCompleted = [...enrollment.completed_steps, {
    step: currentStep,
    slug: steps[currentStep].slug,
    type: steps[currentStep].type,
    completed_at: new Date().toISOString(),
    ...stepData   // any step-specific summary data (score, etc.)
  }]

  await supabase.from('study_enrollments').update({
    current_step:    currentStep + 1,
    completed_steps: newCompleted,
    status:          currentStep + 1 >= steps.length ? 'completed' : 'in_progress',
    started_at:      enrollment.started_at ?? new Date().toISOString(),
    completed_at:    currentStep + 1 >= steps.length ? new Date().toISOString() : null,
  }).eq('id', enrollmentId)

  setCurrentStep(s => s + 1)
  setPhase('RUNNING_STEP')
}
```

### `<StepDispatcher>` props

```jsx
<StepDispatcher
  step={steps[currentStep]}        // { type, slug }
  enrollment={enrollment}          // full enrollment row (has user_id, study_id)
  stepIndex={currentStep}
  totalSteps={steps.length}
  onComplete={completeStep}        // called with optional stepData summary
/>
```

### Progress indicator

Thin progress bar at the top of the screen. Shows `currentStep / steps.length`.
Step labels (e.g. "Step 2 of 4 — Questionnaire") shown in small text beneath bar.
Never shows the full protocol list to the participant.

---

## 9. `StepDispatcher.jsx`

Renders the correct component based on `step.type`:

```jsx
switch (step.type) {
  case 'consent':
    return <ConsentStep onComplete={onComplete} enrollment={enrollment} />

  case 'debrief':
    return <DebriefStep onComplete={onComplete} enrollment={enrollment} />

  case 'questionnaire':
    return <QuestionnaireStepWrapper
             slug={step.slug}
             enrollment={enrollment}
             stepIndex={stepIndex}
             totalSteps={totalSteps}
             onComplete={onComplete}
           />

  case 'game':
    return <GameStepWrapper
             slug={step.slug}
             enrollment={enrollment}
             onComplete={onComplete}
           />
}
```

---

## 10. `ConsentStep.jsx`

Simple full-screen consent screen.

- Title: "Before We Begin"
- Body: placeholder text (lorem) — real consent text will be provided separately and can be stored in a `study_consent_text` column on `studies` (add to migration) or hardcoded per study. For now use a clearly marked placeholder block.
- Checkbox: "I have read and understood the above, and agree to participate."
- Button: "I Agree — Begin Study" (disabled until checkbox checked)
- `onComplete({ consented: true, consented_at: ISO string })`

---

## 11. `DebriefStep.jsx`

Full-screen debrief screen.

- Title: "Thank You"
- Body: placeholder debrief text — same approach as consent (placeholder, real text TBD)
- Button: "Complete Session"
- `onComplete({ debriefed_at: ISO string })`
- After `onComplete`, the runner will set `status = 'completed'` and show a final "Session complete" screen before returning to the study detail page (RA takes back the device).

### Final "Session Complete" screen (in `StudySessionRunner`)

Shown when `currentStep >= steps.length`:

```
✓  Session Complete
   Participant P-001 has finished all steps.
   
   [Return to Study →]
```

Link navigates to `/admin/studies/:id`.

---

## 12. `QuestionnaireStepWrapper.jsx`

Fetches the questionnaire definition by slug, then renders `<QuestionnaireRenderer>`.

```js
// Fetch
const { data: q } = await supabase
  .from('questionnaires')
  .select('definition')
  .eq('slug', slug)
  .single()

// Render
<QuestionnaireRenderer
  questionnaire={q.definition}
  partNumber={stepIndex + 1}
  totalParts={totalSteps}
  onComplete={responses => {
    // Write to questionnaire_responses
    await supabase.from('questionnaire_responses').insert({
      user_id:            enrollment.user_id,
      questionnaire_slug: slug,
      responses,
      completed_at:       new Date().toISOString(),
    })
    onComplete({ responses_count: Object.keys(responses).length })
  }}
/>
```

---

## 13. `GameStepWrapper.jsx`

Renders the correct game component by slug. For now, only `breath_belt` is a study
game. The wrapper passes `studyMode={true}`, `userId={enrollment.user_id}`, and
`studyId={enrollment.study_id}` as props so the game can tag its Supabase writes.

```jsx
const GAME_COMPONENTS = {
  breath_belt: BreathBelt,
  // add more as games become study-ready
}

const GameComponent = GAME_COMPONENTS[slug]
if (!GameComponent) return <div>Unknown game: {slug}</div>

return (
  <GameComponent
    studyMode
    userId={enrollment.user_id}
    studyId={enrollment.study_id}
    onSessionComplete={result => onComplete({ game_slug: slug, ...result })}
  />
)
```

> BreathBelt currently gates on `profiles.role === 'lab'`. For participant access in
> study mode, check for `studyMode === true` as an additional allowed condition in
> `BreathBelt.jsx`'s access guard.

---

## 14. `StudiesPage.jsx` (study list)

If this page already exists, add an "In-Person" badge to studies where
`delivery_mode = 'in_person'`. If it doesn't exist, create a minimal list:

```
Studies                              [+ New Study]

  Emotion Regulation Study 1   Remote     Active    [View]
  BreathBelt Pilot             In-Person  Active    [View]
```

---

## 15. Design notes

Follow the existing platform design system exactly:
- Background: `#FCF0F5`, cards: white, accent: `#f068a4`, neutral: `#abadb0`
- Fonts: DM Serif Display (headings), Space Mono (data/IDs), DM Sans (body)
- Tone: quiet, professional, not clinical

`StudySessionRunner` steps should be full-screen with no admin chrome visible —
the participant sees only the current step. Progress bar at top is the only
persistent UI element during steps.

Admin pages (`StudyDetailPage`, `StudyFormPage`, `StudiesPage`) use the existing
`AdminLayout` wrapper.

---

## 16. RLS policy additions (add to migration)

```sql
-- Allow lab members to update participant profiles
-- (needed for createParticipantAccount to set role + study_id)
CREATE POLICY "lab_can_update_participant_profiles" ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'lab')
  )
  WITH CHECK (role = 'participant');

-- Allow authenticated users to insert their own profile
-- (needed after silent signUp — trigger should handle this, but belt-and-suspenders)
CREATE POLICY "participant_read_own_profile" ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
```

---

## 17. Checklist

> Status as of 2026-05-27: migration not run; no new files created; all items open.
> Notes on existing files: `StudyLibrary.jsx`, `StudyBuilder.jsx`, `StudyDetail.jsx` exist
> but use the old `study_protocols` schema — they need extension, not replacement.
> `src/pages/admin/ProtocolBuilder.jsx` is an email-scheduling builder; it is unrelated
> to the new step-sequence `ProtocolBuilder` component (create the new one in `components/study/`).

### Database

- [x] Run `inperson_study_migration.sql` in Supabase SQL editor
- [x] Add `study_consent_text` column to `studies` in migration (nullable text)
- [x] Add RLS policies from §16 to migration

### New utility

- [x] Create `src/lib/createParticipantAccount.js`

### New components (`src/components/study/`)

- [x] Create `ProtocolBuilder.jsx` — step-sequence drag-to-reorder builder (§6)
- [x] Create `EnrollmentPanel.jsx` — participant list + enroll form (§7)
- [x] Create `StepDispatcher.jsx` — routes a protocol step to its component (§9)
- [x] Create `ConsentStep.jsx` (§10)
- [x] Create `DebriefStep.jsx` (§11)
- [x] Create `QuestionnaireStepWrapper.jsx` (§12)
- [x] Create `GameStepWrapper.jsx` (§13)

### Admin pages (extend or create)

- [x] Extend `StudyLibrary.jsx` — add delivery_mode badge for in-person studies (§14)
- [x] Create `StudyFormPage.jsx` — delivery_mode radio + ProtocolBuilder; replaces StudyBuilder at `/new` (§5)
- [x] Extend `StudyDetail.jsx` → renders `<EnrollmentPanel>` for in-person studies; adds Edit link (§7)
- [x] Create `src/pages/admin/StudySessionRunner.jsx` — full-screen session runner (§8)

### Routing (`App.jsx`)

- [x] Add `/admin/studies/:id/edit` route → `StudyFormPage`
- [x] Add `/admin/studies/:id/session/:enrollmentId` route → `StudySessionRunner` (outside AdminLayout)
- [x] Replace `/admin/studies/new` → `StudyFormPage`

### BreathBelt

- [x] Patch `BreathBelt.jsx` access guard to allow `studyMode === true` alongside `role === 'lab'` (§13)
