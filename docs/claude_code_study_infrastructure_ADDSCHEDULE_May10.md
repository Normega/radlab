# Claude Code Prompt — Study Infrastructure & Schedule Generator

## Context

You are working on the RADlab Come, See platform. Read `website.md` in full before making any changes. The stack is React + Vite + Tailwind CSS v3 + Supabase (PostgreSQL + Auth). All schema changes go to Supabase via SQL migrations. All new frontend files follow the existing project structure in `src/`.

This prompt covers: new database schema for the study infrastructure, and a schedule generator function. Do not touch any existing game files, Nav.jsx, or Hub.jsx.

---

## Goal

Build the backend schema and a `generateSchedule` utility function that powers participant scheduling for research studies on the platform. This is infrastructure only — no admin UI yet.

---

## 1. Database Migrations

Create a single migration file at `supabase/migrations/YYYYMMDD_study_infrastructure.sql`. Run in order.

### 1.1 Activities Registry

```sql
CREATE TABLE activities (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category        text NOT NULL CHECK (category IN ('form', 'game', 'questionnaire')),
  subcategory     text NOT NULL,  -- e.g. 'consent', 'debrief', 'panas', 'pond_watch'
  label           text NOT NULL,
  description     text,
  estimated_minutes int,
  config_schema   jsonb,          -- activity-specific config options
  is_active       bool DEFAULT true,
  created_at      timestamptz DEFAULT now()
);
```

Seed with initial rows for:
- Forms: `consent`, `debrief`
- Questionnaires: `panas`, `ders`
- Games: `pond_watch`, `ebb_and_flow`, `farm_joy`

### 1.2 Session Templates

Reusable ordered activity sequences. Templates are lab-scoped and cloneable.

```sql
CREATE TABLE session_templates (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id          uuid REFERENCES profiles(id),
  label           text NOT NULL,
  description     text,
  cloned_from     uuid REFERENCES session_templates(id),
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE session_template_nodes (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_template_id  uuid REFERENCES session_templates(id) ON DELETE CASCADE,
  order_index          int NOT NULL,
  activity_id          uuid REFERENCES activities(id),
  label                text,
  created_at           timestamptz DEFAULT now()
);
```

### 1.3 Study Protocols

Platform-level reusable templates, not bound to a single study.

```sql
CREATE TABLE study_protocols (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id                  uuid REFERENCES profiles(id),
  label                   text NOT NULL,
  created_by              uuid REFERENCES profiles(id),
  is_template             bool DEFAULT false,
  cloned_from             uuid REFERENCES study_protocols(id),
  visibility              text DEFAULT 'private' CHECK (visibility IN ('private', 'platform')),
  protocol_type           text DEFAULT 'scheduled' CHECK (protocol_type IN ('single_shot', 'scheduled')),
  enrollment_protocol_id  uuid REFERENCES study_protocols(id),  -- if set, completion triggers this protocol's schedule generation
  allow_restart           bool DEFAULT false,
  max_attempts            int DEFAULT 1,
  reminders_enabled       bool DEFAULT false,
  reminder_interval_hours int,
  reminder_max            int,
  created_at              timestamptz DEFAULT now()
);

CREATE TABLE study_protocol_assignments (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  study_id     uuid REFERENCES studies(id),
  protocol_id  uuid REFERENCES study_protocols(id),
  assigned_at  timestamptz DEFAULT now(),
  notes        text
);
```

### 1.4 Protocol Nodes

Ordered sequence of activities or branch points within a protocol.

```sql
CREATE TABLE protocol_nodes (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id     uuid REFERENCES study_protocols(id) ON DELETE CASCADE,
  parent_node_id  uuid REFERENCES protocol_nodes(id),  -- null = root
  order_index     int NOT NULL,
  node_type       text DEFAULT 'activity' CHECK (node_type IN ('activity', 'branch')),
  activity_id     uuid REFERENCES activities(id),
  branch_config   jsonb,  -- reserved for future branching: {"strategy": "randomize", "arms": [...]}
  label           text,
  created_at      timestamptz DEFAULT now()
);
```

### 1.5 Studies (additions)

```sql
ALTER TABLE studies
  ADD COLUMN IF NOT EXISTS messaging_required bool NOT NULL DEFAULT false;
```

### 1.6 Study Tasks

PI-defined task templates with unlock conditions.

```sql
CREATE TABLE study_tasks (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  study_id         uuid REFERENCES studies(id),
  protocol_id      uuid REFERENCES study_protocols(id),
  order_index      int NOT NULL,
  task_type        text CHECK (task_type IN ('game', 'questionnaire', 'form')),
  task_ref_id      uuid REFERENCES activities(id),
  repeatable       bool DEFAULT false,
  unlock_conditions jsonb DEFAULT '[]',
  -- e.g. [
  --   {"type": "days_in_study", "value": 3},
  --   {"type": "task_completed", "task_id": "uuid"},
  --   {"type": "score_threshold", "metric": "d_prime", "min": 1.5}
  -- ]
  -- All conditions are AND logic
  -- Score conditions evaluate only sessions tagged to this study
  window_hours     int DEFAULT 48,
  label            text,
  created_at       timestamptz DEFAULT now()
);
```

### 1.7 Protocol Study Days & Contacts

```sql
CREATE TABLE protocol_study_days (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id  uuid REFERENCES study_protocols(id) ON DELETE CASCADE,
  day_number   int NOT NULL,           -- logical study day (1, 2, 3...)
  day_of_week  text CHECK (day_of_week IN ('mon','tue','wed','thu','fri','sat','sun')),
  label        text,                   -- e.g. "Week 1 Monday"
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE protocol_day_contacts (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  study_day_id         uuid REFERENCES protocol_study_days(id) ON DELETE CASCADE,
  contact_order        int NOT NULL,    -- order within the day
  send_time            time NOT NULL,   -- e.g. 09:00
  session_template_id  uuid REFERENCES session_templates(id),
  link_expires_hours   int DEFAULT 48,
  label                text,
  created_at           timestamptz DEFAULT now()
);
```

### 1.8 Participant Consent

```sql
CREATE TABLE participant_consent (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id      uuid REFERENCES profiles(id),
  study_id            uuid REFERENCES studies(id),
  consented_at        timestamptz DEFAULT now(),
  email_reminders     bool DEFAULT false,
  sms_reminders       bool DEFAULT false,
  esm_prompts         bool DEFAULT false,
  messaging_basis     text CHECK (messaging_basis IN ('research_exemption', 'explicit_consent')),
  -- Set automatically at enrollment:
  -- if study.messaging_required = true → 'research_exemption'
  -- else → 'explicit_consent'
  consent_version     text,            -- tracks which consent language was shown
  withdrawn_at        timestamptz
);
```

### 1.9 Participant Links

```sql
CREATE TABLE participant_links (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token                 text UNIQUE NOT NULL,    -- URL slug: radlab.vercel.app/s/{token}
  participant_id        uuid REFERENCES profiles(id),
  protocol_id           uuid REFERENCES study_protocols(id),
  schedule_instance_id  uuid,                   -- FK added after participant_schedule is created
  attempt_number        int DEFAULT 1,
  created_at            timestamptz DEFAULT now(),
  expires_at            timestamptz,
  used_at               timestamptz,            -- first click timestamp
  status                text DEFAULT 'active' CHECK (status IN ('active','expired','completed','revoked'))
);

-- Enforce one active link per participant at all times
CREATE UNIQUE INDEX one_active_link_per_participant
ON participant_links (participant_id)
WHERE status = 'active';
```

### 1.10 Participant Schedule

Fully materialized per-participant schedule, generated at enrollment. Long format — one row per task instance.

```sql
CREATE TABLE participant_schedule (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id        uuid REFERENCES profiles(id),
  study_id              uuid REFERENCES studies(id),
  protocol_id           uuid REFERENCES study_protocols(id),
  study_task_id         uuid REFERENCES study_tasks(id),
  study_day_id          uuid REFERENCES protocol_study_days(id),
  day_contact_id        uuid REFERENCES protocol_day_contacts(id),
  session_template_id   uuid REFERENCES session_templates(id),
  study_day             int,              -- day number since enrollment
  study_week            int,              -- derived convenience column
  period_of_day         text CHECK (period_of_day IN ('morning','afternoon','evening')),
  rep_index             int DEFAULT 1,    -- rep within a day if task repeats intraday
  contact_order         int,             -- order within the day
  condition_arm         text,            -- randomization result, set at generation time
  scheduled_for         timestamptz,     -- null for single_shot
  unlocked_at           timestamptz,
  completed_at          timestamptz,
  expired_at            timestamptz,
  attempts              int DEFAULT 0,
  status                text DEFAULT 'pending' CHECK (status IN ('pending','link_sent','unlocked','completed','expired','blocked')),
  link_id               uuid REFERENCES participant_links(id),
  enrolled_at           timestamptz,     -- set when participant first clicks the link (for single_shot, this becomes the enrollment date)
  created_at            timestamptz DEFAULT now()
);

-- Add deferred FK now that participant_schedule exists
ALTER TABLE participant_links
  ADD CONSTRAINT fk_schedule_instance
  FOREIGN KEY (schedule_instance_id) REFERENCES participant_schedule(id);
```

### 1.11 Message Log

```sql
CREATE TABLE message_log (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id     uuid REFERENCES profiles(id),
  study_message_id   uuid,
  sent_at            timestamptz DEFAULT now(),
  channel            text CHECK (channel IN ('email','sms')),
  status             text CHECK (status IN ('sent','delivered','failed','opted_out','suppressed')),
  suppressed_reason  text     -- 'new_link_imminent' | 'max_attempts_reached'
);
```

### 1.12 Participant Activity Log

Lean spine table — one row per completed activity, no payload data.

```sql
CREATE TABLE participant_activity_log (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id        uuid REFERENCES profiles(id),
  schedule_instance_id  uuid REFERENCES participant_schedule(id),
  protocol_node_id      uuid REFERENCES protocol_nodes(id),
  activity_id           uuid REFERENCES activities(id),
  started_at            timestamptz,
  completed_at          timestamptz,
  order_index           int,            -- position in sequence when completed
  result_table          text,           -- 'game_sessions' | 'questionnaire_responses' | 'form_submissions'
  result_id             uuid            -- pointer to the relevant row in result_table
  -- FK lives on the data table pointing back here, not here
);
```

Add back-reference FK to existing data tables:

```sql
ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS activity_log_id uuid REFERENCES participant_activity_log(id),
  ADD COLUMN IF NOT EXISTS study_id uuid REFERENCES studies(id);
```

### 1.13 RLS Policies

Apply RLS to all new tables:

- `participant_consent`, `participant_schedule`, `participant_links`, `participant_activity_log`, `message_log`: users read/write only their own rows (`participant_id = auth.uid()`)
- Lab members (`profiles.role = 'lab'`) can read all rows in their lab's studies
- `activities`, `session_templates`, `study_protocols`, `protocol_nodes`, `protocol_study_days`, `protocol_day_contacts`, `study_tasks`: read-only for authenticated users; write restricted to `role = 'lab'`

---

## 2. Schedule Generator Function

Create `src/lib/scheduleGenerator.js`.

### Responsibilities

- Takes a `participantId`, `protocolId`, and `enrolledAt` (Date object)
- Queries the protocol's study days and contacts from Supabase
- Resolves `scheduled_for` timestamps for each contact using `nextOccurrence` logic
- Inserts all rows into `participant_schedule` in a single batch upsert
- Returns the inserted rows

### Two cases to implement

**Case 1 — single_shot:**
- Insert one row into `participant_schedule`
- `scheduled_for = null`
- `status = 'pending'`
- No study days queried
- If `protocol.enrollment_protocol_id` is set, register a trigger: on completion of this row, call `generateSchedule` with the downstream protocol and `completed_at` as `enrolledAt`

**Case 2 — scheduled:**
- Fetch all `protocol_study_days` for the protocol, ordered by `day_number`
- For each study day, fetch its `protocol_day_contacts` ordered by `contact_order`
- Compute `calendar_date = nextOccurrence(enrolledAt, studyDay.day_of_week)`
- Compute `scheduled_for = calendar_date + contact.send_time`
- Derive `study_week = Math.ceil(studyDay.day_number / 7)`
- Derive `period_of_day` from `send_time`: before 12:00 = `morning`, 12:00–17:00 = `afternoon`, after 17:00 = `evening`
- Set `condition_arm = null` for now (branching not yet implemented)
- Insert one row per contact into `participant_schedule`

### nextOccurrence logic

```js
// Returns the next calendar date (as a Date) on or after baseDate
// that falls on the given day_of_week ('mon'|'tue'|...|'sun')
function nextOccurrence(baseDate, dayOfWeek) {
  const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const target = dayMap[dayOfWeek];
  const date = new Date(baseDate);
  const current = date.getDay();
  const diff = (target - current + 7) % 7;
  date.setDate(date.getDate() + diff);
  return date;
}
```

### Token generation

Each participant_schedule row does not yet have a link. A separate function `issueLink(scheduleInstanceId)` should:
- Generate a cryptographically random token (`crypto.randomUUID()` or similar)
- Insert into `participant_links` with `status = 'active'`
- Update `participant_schedule.link_id` and `status = 'link_sent'`
- Enforce the unique active link constraint (catch and surface the error cleanly if violated)

Implement `issueLink` in the same file as a named export.

### Link suppression check

Implement `shouldSuppressReminder(participantId, upcomingLinkWithinHours)` as a named export:

```
1. Check for active link → if none, return { suppress: true, reason: 'no_active_link' }
2. Check if a pending schedule row has scheduled_for within upcomingLinkWithinHours → if yes, return { suppress: true, reason: 'new_link_imminent' }
3. Check max_attempts reached → if yes, return { suppress: true, reason: 'max_attempts_reached' }
4. Return { suppress: false }
```

---

## 3. Link Resolution Route

Create `src/pages/SessionEntry.jsx` mounted at `/s/:token`.

### Resolution state machine

On mount, fetch the token from `participant_links`:

| State | Condition | UI |
|---|---|---|
| Not found | No row for token | "This link is not valid." |
| Revoked | `status = 'revoked'` | "This link is no longer active. Please contact your researcher." |
| Completed | `status = 'completed'` | "You have already completed this session." |
| Expired | `status = 'expired'` | "This session window has closed. Your next check-in is scheduled for [scheduled_for of next pending slot]." |
| Too early | `scheduled_for > now()` | "Your session opens on [date]." |
| Active | `status = 'active'` | Log `used_at` on first click (if null), set `enrolled_at` on schedule row if null, redirect to session runner |

### Session runner

Once a valid active link is resolved, render a simple sequential activity runner:
- Fetch the `session_template_nodes` for the link's `session_template_id`, ordered by `order_index`
- Render activities one at a time in order
- Track completion in `participant_activity_log`
- Sessions are atomic: no resume. If the user navigates away, the session remains `active` until it expires.
- On final activity completion: mark `participant_links.status = 'completed'`, update `participant_schedule.status = 'completed'` and `completed_at`
- If `protocol.enrollment_protocol_id` is set and this was a `single_shot`: call `generateSchedule` with the downstream protocol

For now, stub each activity type with a placeholder screen that shows the activity label and a "Complete" button. Real activity components will be wired in separately.

---

## 4. Test Cases to Verify

### Test 1 — Single-shot link

1. Create a session template with 3 nodes: consent form → PANAS → debrief
2. Create a `single_shot` protocol pointing to that template
3. Call `generateSchedule(participantId, protocolId, new Date())`
4. Verify: one row in `participant_schedule` with `scheduled_for = null`, `status = 'pending'`
5. Call `issueLink(scheduleInstanceId)`
6. Verify: one row in `participant_links` with a valid token and `status = 'active'`
7. Navigate to `/s/{token}` → verify state machine resolves to session runner
8. Click through all 3 activity stubs → verify link and schedule row both marked `completed`

### Test 2 — Scheduled single-shot

1. Create the same session template
2. Create a `scheduled` protocol with one study day: `day_number = 1`, `day_of_week = 'mon'`, one contact at `send_time = 09:00`
3. Call `generateSchedule(participantId, protocolId, new Date())` on a Wednesday
4. Verify: one row in `participant_schedule` with `scheduled_for` = the following Monday at 09:00
5. Call `issueLink(scheduleInstanceId)`
6. Navigate to `/s/{token}` before Monday → verify "too early" state
7. Manually set `scheduled_for` to past in DB → refresh → verify session runner loads

---

## 5. File Checklist

```
supabase/
  migrations/
    YYYYMMDD_study_infrastructure.sql   ← all schema above

src/
  lib/
    scheduleGenerator.js                ← generateSchedule, issueLink, shouldSuppressReminder
  pages/
    SessionEntry.jsx                    ← /s/:token route
```

Add the `/s/:token` route to `App.jsx`:

```jsx
<Route path="/s/:token" element={<SessionEntry />} />
```

No nav, no layout wrapper — `SessionEntry` is a standalone full-screen page.

---

## Notes

- Use `supabase-js` for all DB operations (already configured at `src/lib/supabase.js`)
- Do not use any ORM
- All timestamps are `timestamptz`, always store and compare in UTC
- Use `crypto.randomUUID()` for token generation (available in modern browsers and Node)
- Do not build any admin UI for protocol or study day configuration yet — that is a separate workstream
- Keep `scheduleGenerator.js` free of React dependencies — pure JS utility functions only
- Follow existing code style in the repo (functional components, hooks, no class components)

## Existing Schema
```
| table_name             | column_name            | data_type                | is_nullable |
| ---------------------- | ---------------------- | ------------------------ | ----------- |
| avatar_unlocks         | id                     | uuid                     | NO          |
| avatar_unlocks         | user_id                | uuid                     | YES         |
| avatar_unlocks         | feature                | text                     | NO          |
| avatar_unlocks         | item_id                | text                     | NO          |
| avatar_unlocks         | unlocked_at            | timestamp with time zone | YES         |
| avatars                | id                     | uuid                     | NO          |
| avatars                | user_id                | uuid                     | YES         |
| avatars                | skin_color             | text                     | NO          |
| avatars                | eye_color              | text                     | NO          |
| avatars                | ear_type               | text                     | YES         |
| avatars                | nose_type              | text                     | YES         |
| avatars                | mouth_type             | text                     | YES         |
| avatars                | hair_type              | text                     | YES         |
| avatars                | hair_color             | text                     | YES         |
| avatars                | tail_type              | text                     | YES         |
| avatars                | accessory              | text                     | YES         |
| avatars                | aura_type              | text                     | YES         |
| avatars                | scar_type              | text                     | YES         |
| avatars                | updated_at             | timestamp with time zone | YES         |
| avatars                | species                | text                     | NO          |
| avatars                | aura                   | jsonb                    | YES         |
| drift_performance      | id                     | uuid                     | NO          |
| drift_performance      | session_id             | uuid                     | YES         |
| drift_performance      | user_id                | uuid                     | YES         |
| drift_performance      | mean_ratio             | numeric                  | YES         |
| drift_performance      | mean_abs_error_ms      | integer                  | YES         |
| drift_performance      | trial_count            | integer                  | YES         |
| drift_performance      | created_at             | timestamp with time zone | YES         |
| drift_trials           | id                     | uuid                     | NO          |
| drift_trials           | session_id             | uuid                     | YES         |
| drift_trials           | trial_num              | integer                  | NO          |
| drift_trials           | target_duration_ms     | integer                  | NO          |
| drift_trials           | avatar_emotion_id      | integer                  | NO          |
| drift_trials           | avatar_zone            | integer                  | NO          |
| drift_trials           | avatar_emotion_name    | text                     | NO          |
| drift_trials           | reproduced_duration_ms | integer                  | NO          |
| drift_trials           | ratio                  | numeric                  | NO          |
| drift_trials           | abs_error_ms           | integer                  | NO          |
| drift_trials           | created_at             | timestamp with time zone | YES         |
| face_read_performance  | id                     | uuid                     | NO          |
| face_read_performance  | session_id             | uuid                     | YES         |
| face_read_performance  | user_id                | uuid                     | YES         |
| face_read_performance  | mean_score             | double precision         | YES         |
| face_read_performance  | valence_accuracy       | double precision         | YES         |
| face_read_performance  | arousal_accuracy       | double precision         | YES         |
| face_read_performance  | trials_completed       | integer                  | YES         |
| face_read_performance  | created_at             | timestamp with time zone | YES         |
| face_read_trials       | id                     | uuid                     | NO          |
| face_read_trials       | session_id             | uuid                     | YES         |
| face_read_trials       | user_id                | uuid                     | YES         |
| face_read_trials       | trial_number           | integer                  | YES         |
| face_read_trials       | target_sector_id       | integer                  | YES         |
| face_read_trials       | target_sector_name     | text                     | YES         |
| face_read_trials       | target_zone            | integer                  | YES         |
| face_read_trials       | target_intensity_t     | double precision         | YES         |
| face_read_trials       | target_valence         | double precision         | YES         |
| face_read_trials       | target_arousal         | double precision         | YES         |
| face_read_trials       | clicked_sector_id      | integer                  | YES         |
| face_read_trials       | clicked_zone           | integer                  | YES         |
| face_read_trials       | clicked_valence        | double precision         | YES         |
| face_read_trials       | clicked_arousal        | double precision         | YES         |
| face_read_trials       | distance               | double precision         | YES         |
| face_read_trials       | trial_score            | integer                  | YES         |
| face_read_trials       | response_time_ms       | integer                  | YES         |
| face_read_trials       | created_at             | timestamp with time zone | YES         |
| farm_joy_feedback      | id                     | uuid                     | NO          |
| farm_joy_feedback      | session_id             | uuid                     | YES         |
| farm_joy_feedback      | user_id                | uuid                     | YES         |
| farm_joy_feedback      | round_triggered        | integer                  | YES         |
| farm_joy_feedback      | user_responded         | boolean                  | YES         |
| farm_joy_feedback      | suggested_value        | text                     | YES         |
| farm_joy_feedback      | values_sampled         | jsonb                    | YES         |
| farm_joy_feedback      | created_at             | timestamp with time zone | YES         |
| farm_joy_performance   | id                     | uuid                     | NO          |
| farm_joy_performance   | session_id             | uuid                     | YES         |
| farm_joy_performance   | user_id                | uuid                     | YES         |
| farm_joy_performance   | values_sampled         | jsonb                    | YES         |
| farm_joy_performance   | values_planted         | jsonb                    | YES         |
| farm_joy_performance   | values_greenhouse      | jsonb                    | YES         |
| farm_joy_performance   | values_final           | jsonb                    | YES         |
| farm_joy_performance   | ended_early            | boolean                  | YES         |
| farm_joy_performance   | duration_ms            | integer                  | YES         |
| farm_joy_performance   | created_at             | timestamp with time zone | YES         |
| farm_joy_trials        | id                     | uuid                     | NO          |
| farm_joy_trials        | session_id             | uuid                     | YES         |
| farm_joy_trials        | user_id                | uuid                     | YES         |
| farm_joy_trials        | trial_number           | integer                  | YES         |
| farm_joy_trials        | value_word             | text                     | YES         |
| farm_joy_trials        | category               | text                     | YES         |
| farm_joy_trials        | veggie                 | text                     | YES         |
| farm_joy_trials        | round1_choice          | text                     | YES         |
| farm_joy_trials        | in_greenhouse          | boolean                  | YES         |
| farm_joy_trials        | in_final               | boolean                  | YES         |
| farm_joy_trials        | created_at             | timestamp with time zone | YES         |
| farm_joy_trials        | round1_rt_ms           | integer                  | YES         |
| farm_joy_value_history | id                     | uuid                     | NO          |
| farm_joy_value_history | user_id                | uuid                     | YES         |
| farm_joy_value_history | value_word             | text                     | YES         |
| farm_joy_value_history | times_shown            | integer                  | YES         |
| farm_joy_value_history | times_planted          | integer                  | YES         |
```

## Existing Files (do not modify unless instructed)

### src/App.jsx
\```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase, savePondWatchSession, saveEbbFlowSession } from './lib/supabase'

import Landing        from './pages/Landing'
import SessionEntry  from './pages/SessionEntry'
import PlatformPage from './pages/PlatformPage'
import Login        from './pages/Login'
import Signup       from './pages/Signup'
import Dashboard    from './pages/Dashboard'
import GamesPage    from './pages/GamesPage'
import ProfilePage  from './pages/ProfilePage'
import Nav          from './components/Nav'
import PondWatch    from './games/PondWatch'
import OwlBarn      from './games/OwlBarn'
import AvatarEditor  from './components/Avatar/AvatarEditor'
import EbbAndFlow    from './games/EbbAndFlow/EbbAndFlow'
import FirstContact  from './games/FirstContact/FirstContact'
import AuraFilterDef from './components/AuraFilterDef'
import StillWater   from './games/StillWater/StillWater'
import FaceRead     from './games/FaceRead/FaceRead'
import Drift        from './games/Drift/Drift'
import FarmJoy      from './games/FarmJoy/FarmJoy'

const queryClient = new QueryClient()

function roleToPath(role) {
  if (role === 'lab')         return '/admin'
  if (role === 'participant') return '/study'
  return '/dashboard'
}

// Guards /games/ebb-flow: redirects to /games/first-contact when not yet complete.
// Renders nothing while firstContactComplete is still loading (undefined).
function EbbFlowGuard({ firstContactComplete, children }) {
  if (firstContactComplete === undefined) return null
  if (firstContactComplete === false)
    return <Navigate to="/games/first-contact?from=ebb-flow" replace />
  return children
}

// Requires auth + avatar. If no avatar row exists, redirects to /profile/avatar.
function ProtectedRoute({ session, hasAvatar, children }) {
  if (session === undefined) return null                          // auth loading
  if (!session) return <Navigate to="/login" replace />
  if (hasAvatar === undefined) return null                       // avatar check in progress
  if (hasAvatar === false) return <Navigate to="/profile/avatar" replace />
  return children
}

// Requires auth only — used for /profile/avatar so the guard doesn't loop.
function AuthRoute({ session, children }) {
  if (session === undefined) return null
  if (!session) return <Navigate to="/login" replace />
  return children
}

function PublicOnlyRoute({ session, role, children }) {
  if (session === undefined || (session && role === undefined)) return null
  if (session) return <Navigate to={roleToPath(role)} replace />
  return children
}

export default function App() {
  const [session,              setSession]              = useState(undefined)
  const [role,                 setRole]                 = useState(undefined)
  const [hasAvatar,            setHasAvatar]            = useState(undefined)
  const [firstContactComplete, setFirstContactComplete] = useState(undefined)

  async function fetchRole(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role, first_contact_complete')
      .eq('id', userId)
      .single()
    setRole(data?.role ?? 'public')
    setFirstContactComplete(data?.first_contact_complete ?? false)
  }

  async function checkAvatar(userId) {
    const { data } = await supabase.from('avatars').select('id').eq('user_id', userId).maybeSingle()
    setHasAvatar(!!data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session ?? null
      setSession(s)
      if (s) { fetchRole(s.user.id); checkAvatar(s.user.id) }
      else   { setRole(null); setHasAvatar(undefined) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      const sess = s ?? null
      setSession(sess)
      if (sess) { fetchRole(sess.user.id); checkAvatar(sess.user.id) }
      else      { setRole(null); setHasAvatar(undefined); setFirstContactComplete(undefined) }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuraFilterDef />
      <BrowserRouter>
        <Routes>
          <Route path="/"         element={<Landing      session={session} />} />
          <Route path="/platform" element={<PlatformPage session={session} />} />
          <Route path="/login"  element={<PublicOnlyRoute session={session} role={role}><Login /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute session={session} role={role}><Signup /></PublicOnlyRoute>} />

          <Route path="/dashboard" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <Dashboard session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <GamesPage session={session} firstContactComplete={firstContactComplete} />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <ProfilePage session={session} />
            </ProtectedRoute>
          } />

          {/* AuthRoute (no avatar guard) — this IS the onboarding screen */}
          <Route path="/profile/avatar" element={
            <AuthRoute session={session}>
              <AvatarEditor session={session} setHasAvatar={setHasAvatar} />
            </AuthRoute>
          } />

          <Route path="/games/pond-watch" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <Nav session={session} />
              <PondWatch userId={session?.user?.id} studyId={null} onSessionComplete={savePondWatchSession} />
            </ProtectedRoute>
          } />

          <Route path="/games/first-contact" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <FirstContact
                session={session}
                onComplete={() => setFirstContactComplete(true)}
              />
            </ProtectedRoute>
          } />

          <Route path="/games/ebb-flow" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <EbbFlowGuard firstContactComplete={firstContactComplete}>
                <EbbAndFlow session={session} onSessionComplete={saveEbbFlowSession} />
              </EbbFlowGuard>
            </ProtectedRoute>
          } />

          <Route path="/games/owl-barn" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <Nav session={session} />
              <OwlBarn userId={session?.user?.id} studyId={null} />
            </ProtectedRoute>
          } />

          <Route path="/games/still-water" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <StillWater session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/face-read" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <FaceRead session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/drift" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <Drift session={session} />
            </ProtectedRoute>
          } />

          <Route path="/games/farm-joy" element={
            <ProtectedRoute session={session} hasAvatar={hasAvatar}>
              <FarmJoy session={session} />
            </ProtectedRoute>
          } />

          {/* Standalone participant link — no nav or auth guard */}
          <Route path="/s/:token" element={<SessionEntry />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

\```

### src/lib/supabase.js
\```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Save a completed PondWatch session to Supabase.
// Inserts game_sessions → trials (bulk) → performance in sequence.
export async function savePondWatchSession({ userId, studyId, gameName, startedAt, endedAt, trials, metrics }) {
  const { data: session, error: sessionErr } = await supabase
    .from('game_sessions')
    .insert({ user_id: userId, game_name: gameName, study_id: studyId, started_at: startedAt, ended_at: endedAt })
    .select('id')
    .single()

  if (sessionErr) { console.error('savePondWatchSession: session insert failed', sessionErr); return null }

  const sessionId = session.id

  const { error: trialsErr } = await supabase.from('trials').insert(
    trials.map(t => ({
      session_id:       sessionId,
      trial_number:     t.trialNumber,
      stimulus_type:    t.stimulusType,
      is_target:        t.isTarget,
      responded:        t.responded,
      reaction_time_ms: t.reactionTime,
    }))
  )
  if (trialsErr) console.error('savePondWatchSession: trials insert failed', trialsErr)

  const { error: perfErr } = await supabase.from('performance').insert({
    session_id:       sessionId,
    hit_rate:         metrics.hitRate,
    false_alarm_rate: metrics.falseAlarmRate,
    d_prime:          metrics.dPrime,
    criterion:        metrics.criterion,
    median_rt_ms:     metrics.medianRtMs,
    rt_sd_ms:         metrics.rtSdMs,
    accuracy:         metrics.accuracy,
  })
  if (perfErr) console.error('savePondWatchSession: performance insert failed', perfErr)

  return sessionId
}

// Save a completed First Contact / Deeper Contact session to Supabase.
// Updates deeper_contact_* columns on profiles; sets first_contact_complete on first run.
export async function saveFirstContactSession({
  userId, rollingMean, previousBest, previousSessions, isFirstTime,
}) {
  const now = new Date().toISOString();

  const update = {
    deeper_contact_best_sync: Math.max(rollingMean, previousBest ?? 0),
    deeper_contact_last_sync: rollingMean,
    deeper_contact_sessions:  (previousSessions ?? 0) + 1,
  };

  if (isFirstTime) {
    update.first_contact_complete    = true;
    update.first_contact_complete_at = now;
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', userId);
  if (error) console.error('saveFirstContactSession: profile update failed', error);
}

// Save a completed Ebb & Flow session to Supabase.
// Inserts game_sessions → trials (bulk), updates profiles ebb_flow_* columns.
export async function saveEbbFlowSession({
  user_id, trials, session_score, total_score, total_trials,
  quest_state, game_mode, new_mode_unlocked, session_sync_mean,
}) {
  const now = new Date().toISOString()

  // Insert game session record
  const { data: gameSession, error: sessionErr } = await supabase
    .from('game_sessions')
    .insert({ user_id, game_name: 'ebb_flow', started_at: now, ended_at: now })
    .select('id')
    .single()

  if (sessionErr) { console.error('saveEbbFlowSession: session insert failed', sessionErr); return null }

  const sessionId = gameSession.id

  // Insert per-trial rows (metrics as JSONB)
  if (trials?.length) {
    const { error: trialsErr } = await supabase.from('trials').insert(
      trials.map(t => ({
        session_id:       sessionId,
        trial_number:     t.trial_number,
        stimulus_type:    t.trial_type,
        is_target:        t.trial_type !== 'catch',
        responded:        t.response !== null,
        reaction_time_ms: t.reaction_time_ms,
        metrics:          t,
      }))
    )
    if (trialsErr) console.error('saveEbbFlowSession: trials insert failed', trialsErr)
  }

  // Update profiles ebb_flow_* columns
  const profileUpdate = {
    ebb_flow_total_trials:   total_trials,
    ebb_flow_total_score:    total_score,
    ebb_flow_quest_state:    quest_state,
    ebb_flow_game_mode:      game_mode,
    ebb_flow_last_session_at: now,
    points:                  total_score, // mirror to main points column
  }
  if (new_mode_unlocked === 'listener') profileUpdate.ebb_flow_listener_unlocked_at = now
  if (new_mode_unlocked === 'empath')   profileUpdate.ebb_flow_empath_unlocked_at   = now

  const { error: profileErr } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user_id)
  if (profileErr) console.error('saveEbbFlowSession: profile update failed', profileErr)

  return sessionId
}

\```