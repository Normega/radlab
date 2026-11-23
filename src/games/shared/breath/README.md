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

## Microphone prototype (`useMicBreath`) — no belt

**`/dev/mic-breath`** asks whether an ordinary webcam/laptop/phone mic can hear breathing
rate. `micBreath.js` is the pure DSP (tested headless in `micBreath.test.mjs`);
`useMicBreath.js` opens the mic with noise suppression / AGC / echo cancellation **off**
(noise suppression deletes breath sounds) and feeds it a spectrum every 50 ms.

- Signal = dB above a rolling noise floor in a breath band (250–2500 Hz) and a "wind"
  band (< 200 Hz, exhaling onto the capsule), with tonal sound (voice) gated out by
  spectral flatness → hysteresis bursts → rate from burst intervals, cross-checked by
  autocorrelation.
- The core ambiguity: one burst per breath (exhale only — typical at webcam distance)
  or two (inhale + exhale — typical close up). `pairing: 'auto'` decides from gap
  alternation and loudness/pitch alternation; inhale vs exhale is *inferred* from timing,
  never measured. A mic hears airflow, not lung volume — there is no `value` 0–1.
- Ground truth on the page: Space-bar taps at each in-breath, or the built-in pacer.
  CSV + raw-audio download for offline tuning. Nothing is saved or uploaded.
- Any game using it must not play breath-band audio through speakers (Kite's
  `breathAudio.js` would be heard as breathing) — mute it or require headphones.
