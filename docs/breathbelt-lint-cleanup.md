# BreathBelt / study lint cleanup — options (deferred)

Snapshot: `npx eslint src/games/BreathBelt src/components/study src/components/questionnaire`
→ 32 problems (24 errors, 8 warnings). The Vite build is unaffected (it does not run ESLint),
so none of these block deploys — this is hygiene only.

## Categories

### 1. Trivially safe (5 errors) — zero behaviour risk
- Unused imports: `useEffect` (QuestionnaireRenderer.jsx:1), `useCallback` (CalibrationScreen.jsx:1)
- Unused params: `enrollment` (ConsentStep.jsx:3, DebriefStep.jsx:1)
- Empty block: BreathBelt.jsx:226 (annotate, as done for the useBeltConnection catches)
- Fix: remove the unused import/param (or prefix `_`), add a comment inside the empty block.

### 2. React-Compiler rules (~18 errors) — legitimate patterns flagged
`react-hooks/refs` ("Cannot access refs during render") + `preserve-manual-memoization`
("Compilation Skipped"). From eslint-plugin-react-hooks flat/recommended (compiler-aware).
- Locations: QuestionnaireRenderer.jsx (~13: `useRef(buildSlides(q)).current` + slide reads),
  useBeltQuestStaircases.js:72 (lazy `scRef` init), useStreamingBackup.js:97/100,
  FixedTrialsScreen.jsx:66 + StaircaseScreen.jsx:70 (trial callbacks).
- Options:
  a. **Relax in eslint.config.js** — set both rules to 'off' (or 'warn'). One-place change,
     no code churn. Recommended unless the team is adopting the React Compiler.
  b. Per-line `eslint-disable-next-line <rule>` + justification (~18 comments). Keeps rules on.
  c. Restructure (useState lazy-init / useMemo / dep fixes). Most work + real behaviour risk.

### 3. exhaustive-deps (8 warnings)
- 6 are **intentional** FSM omissions in BreathBelt (missing belt/session/studyId/participantId)
  + the BaselineScreen breath effect — adding deps would wrongly re-run effects (re-fire
  triggers / re-start the session). Leave, or suppress with a one-line disable + comment.
- 2 are the stable `sessionStartMsRef` (FixedTrialsScreen / StaircaseScreen submitResponse) —
  safe to add to the dep array.

## Why "restructure" (option 2c) is deferred / risky
- **Wiping experimental state**: `scRef`/session refs hold the live QUEST posterior across
  trials; converting to memo/state with deps can recreate them mid-session and wipe the
  posterior → corrupts the threshold estimate.
- **Compute-once → recompute**: `useRef(buildSlides(q)).current` builds the slide list once;
  `useMemo` recomputes on prop-identity change, desyncing `slideIdx` / resetting a
  questionnaire mid-administration.
- **Stale-closure / double-fire** in the trial callbacks if memoization deps are restructured.
- **No tests + hardware-only validation**: BLE + serial triggers + real-time animation;
  regressions surface only in a live participant session and can corrupt the physio-alignment
  timing logs. Net: trading known-good behaviour for lint-clean code.

## Recommended deferred path (low risk)
1. Category 1 (safe errors).
2. Add the 2 stable-ref deps (`sessionStartMsRef`).
3. Relax the two React-Compiler rules in eslint.config.js (option 2a).
4. Suppress the 6 intentional FSM exhaustive-deps with one-line disables + comments (or leave).
5. Do NOT restructure refs unless adopting the React Compiler — and if so, do it incrementally
   with live-session validation, not as a lint sweep.

## Reproduce
`npx eslint src/games/BreathBelt src/components/study src/components/questionnaire`
