# Shared breath-signal layer (`useBreathSignal`)

Real-time Polar H10 breath biofeedback for any game, extracted from BreathBelt's
`useBeltConnection` minus the study machinery (event triggers, trial labelling,
Supabase buffers). One hook gives a game a calibrated breath signal plus derived
features; the game is just a visual/audio mapping on top.

**Live instrumentation page: `/dev/breath-lab`** (append `?sim=1` to run without
hardware). If a feedback mapping looks good there, it will feel right in a game.

## Quick start

```jsx
const breath = useBreathSignal({ isSimMode })

// 1. Connect + calibrate (CalibrationScreen from BreathBelt works as-is):
breath.connect()                       // Web Bluetooth chooser → Polar H10
<CalibrationScreen
  calibPhase={breath.calibPhase} calibReviewData={breath.calibReviewData}
  startCalibration={breath.startCalibration} beginCalibCollection={breath.beginCalibCollection}
  acceptCalibration={breath.acceptCalibration} redoCalibration={breath.redoCalibration}
  avatarProps={...} />

// 2. In the game loop (rAF or interval), poll — never via React state:
const s = breath.signalRef.current
```

Sim mode: `breath.startSimulation()` + `breath.acceptSimCalib()` replaces
connect/calibrate; `breath.setSimPeriodMs(ms)` retunes the fake breather live.

## The data, and what each field is good for

`signalRef.current` (updates ~25 Hz on real belt, 25 Hz in sim):

| Field | What it is | Responsiveness | Good for |
|---|---|---|---|
| `value` | Breath amplitude 0–1 (0 = exhale trough, 1 = inhale peak) | ~25 Hz updates, but carries **300–900 ms filter+BLE lag** (see `lagMs`) | Direct control: altitude, size, position, drawing the world |
| `phase` | `'inhale' \| 'exhale' \| 'pause'` (slope classifier with deadband — breath holds read as `pause`) | flips within ~0.4 s of a true phase turn | Phase-contingent events: exhale-only targets, end-exhale triggers |
| `lastPeriodMs` | Most recent breath duration (onset-to-onset) | updates once per breath, immediately | Fast rate feedback; detecting the *last* breath's speed |
| `bpm` | Median rate over last 6 breaths | lags ~4 breaths behind a rate change (verified in lab) | Stable rate targets ("get to 6 bpm"), scoring, thresholds |
| `regularitySdMs` | SD of recent breath periods (ms); lower = steadier | needs ≥3 breaths; ~30 s to fully settle after start | Smoothness/calm feedback: settling particles, still water; display/analytics |
| `regularityCv` | Coefficient of variation of recent periods (SD ÷ mean, unitless) | as above | Regularity-gated feedback — fairer than SD across rates (long periods carry larger absolute jitter). Ember's warmth gate uses this |
| `hr` | Heart rate, bpm (1 Hz from belt) | ~1 s | Ambient display, arousal context |
| `rsaMs` | max−min RR interval over last 12 s — breath-driven heart-rate swing | rolls over ~2–3 breaths | Coherence/resonance feedback; grows as breathing slows toward ~6 bpm |
| `lagMs` | Calibrated belt latency v