# Owl Barn — Implementation TODO

## Core Gameplay (current build)
- [x] Barn viewport with camera follow (15% offset)
- [x] 10 hiding objects, evenly spaced
- [x] Mouse avatar: hiding / peeking / creeping / freeze / scurrying / swooped states
- [x] Tap handler (spacebar + screen tap)
- [x] Tap aura system (yellow 1-2 / 4-7, green flash at 3, sparkle green at 8)
- [x] Sin-function silence window generator (8-window cycles, ≥2 long per cycle)
- [x] HOOT phase — rafter glow, owl eyes animate, taps trigger swoop
- [x] SILENCE phase — tap counting, 3-tap / 8-tap resolution
- [x] SWOOPED sequence — owl drops, drags mouse back 2 steps (floor 0), lockout
- [x] WRONG COUNT sequence — creep → freeze → soft swoop, lockout only (no step penalty)
- [x] Adaptive difficulty — windows +100ms if < halfway after full cycle
- [x] BARN_CROSSED state
- [x] Trial recorder (in-memory, ready for Supabase wiring)

## Needs Calibration (stubbed with fixed values)
- [ ] CALIBRATION_3TAP phase — measure player's fast 3-tap speed
- [ ] CALIBRATION_8TAP phase — measure player's fast 8-tap speed
- [ ] Clamp logic: min_silence = clamp(3tap_ms + 50, 300, 1000)
- [ ] Clamp logic: max_silence = clamp(8tap_ms × 1.25, min + 100, 2500)
- [ ] CALIBRATION_COMPLETE screen — paw clap animation, window range visualisation
- [ ] "Too slow" retry prompt on out-of-range 3-tap result
- [ ] Stub values to remove: min_silence_ms = 500, max_silence_ms = 1500

## Needs Mindfulness Screen (stubbed with Continue button)
- [ ] Mindfulness prompt text (spec section 10)
- [ ] 5s delay before Continue appears
- [ ] 30s reward — owls descend, perch, head-tilt animation, -5s bonus
- [ ] 60s reward — amber barn pulse, -10s additional bonus
- [ ] Pass adjusted crossing time through to results

## Results Screen (stub: shows raw crossing time only)
- [ ] Owl tier calculation (% of theoretical minimum crossing time)
- [ ] Tier name + owl reaction quote
- [ ] Breakdown toggle — swoop count, 8-tap rate, windows used vs skipped
- [ ] Mindfulness badge on card if 30s or 60s reached
- [ ] "Try Again" and "Return to Safari" buttons wired up

## Supabase Wiring (deferred)
- [ ] `game_sessions` row on BARN_CROSSED
- [ ] `trials` rows — one per silence window
- [ ] `performance` row — efficiency score, rate breakdowns
- [ ] Anonymous session support via `anonymous_sessions` table
- [ ] `exhibit_bests` update on completion

## Audio (deferred)
- [ ] Hoot phase — layered owl hoot, directional variation
- [ ] Silence onset — reverb tail fade
- [ ] Tap sounds — soft pulse, pitch rise per tap
- [ ] 3-tap / 8-tap success chimes
- [ ] Swoop — wing flap, avatar squeak, thud
- [ ] Barn crossed — triumphant squeak

## Assets (deferred)
- [ ] Replace CSS object shapes with illustrated hiding spot images
- [ ] Mouse avatar sprite sheet (hiding / peek / scurry / swooped frames)
- [ ] Owl silhouette sprites (rafter idle, swoop, perch)
- [ ] Background: barn wall texture, floor texture
