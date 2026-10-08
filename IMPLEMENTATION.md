# Playable race milestone

Implemented four fighting AI rivals, a 4.5 km race with a four-minute limit, countdown, live rank, scoring, close-call rewards, finish marker, results and retry. Added original synthesized local sound effects, speed-dependent engine and wind, and a sound toggle. Existing single-action attacks, manual acceleration, camera and phone controls remain.

## Files

- Created `src/ai/AIRider.js`, `src/race/Race.js`, `src/audio/GameAudio.js`, `src/world/FinishLine.js` and `tests/race.test.js`.
- Created `scripts/generate-audio.py` and seven generated WAV files in `public/audio/`.
- Updated `src/main.js`, `src/entities/Rider.js`, `src/ui/HUD.js`, `src/core/manifest.js`, `src/core/constants.js`, `index.html`, `src/style.css` and `AGENTS.md`.
- New constant groups: `RACE` (race/scoring), `AI` (driving/combat), `RIVALS` (four profiles), `AUDIO` (mix/pitch).

## Verification

- Production build passes; Vite reports the existing large-bundle warning.
- All 13 Node tests pass, including a complete 4.5 km physics simulation, AI attacks, finish order, countdown/pause, scoring, control regressions and retry reset.
- Browser: startup, countdown, live game, results and retry verified; a temporary shortened race fixture exercised the finish UI and was removed.
- Landscape layout and portrait rotation prompt checked in browser. Physical phone performance, multi-touch and speaker balance still require device testing.

## Remaining roadmap

Garage/unlocks, more routes, police, selectable difficulty, richer AI tactics and imported vehicle models remain future milestones.

## Ten-racer difficulty and hit feedback update

- Nine named rivals plus the player; unique two-column grid with the player in fifth.
- Easy/Medium/Hard selects actual AI pace, acceleration, aggression, attack cadence, curve speed and catch-up. Change it at the start or results screen.
- Bat hits have stronger knockback, longer stagger, contact sparks, directional recoil, an edge flash and camera response. Three rapid hits can dismount a rider.
- Created `src/combat/HitEffects.js`; edited `src/core/constants.js`, `src/ai/AIRider.js`, `src/race/Race.js`, `src/entities/Rider.js`, `src/main.js`, `src/ui/HUD.js`, `index.html`, `src/style.css`, `tests/race.test.js` and `AGENTS.md`.
- New constants: `DIFFICULTIES` and `HIT_FX`. Added five rival profiles and tuned bat/balance constants.
- All 15 tests pass, including difficulty selection/locking, unique grid slots, attack cadence, recoil, burst reuse/reset and dismounts. Build passes with the existing large-bundle warning.

## Police and spark verification update

Existing uncommitted police/pickup/particle additions were inspected and retained. Police were missing from Combat and allocated new bodies and meshes per spawn; sparks multiplied an already tiny geometry by another tiny scale. These bugs are fixed.

- Two pooled police motorcycles with distinct touring bodywork, white panniers, tall shields and flashing red/blue lights. Police participate in Combat but never race standings.
- Automatic pursuit after 18 racing seconds or two takedowns, four-second warning, 24-second survival window, 400-point reward and 35-second cooldown. Selected difficulty applies. Timers freeze on pause and all officers park on retry/results.
- Original synthesized siren, mute/pause handling, event-driven collision and melee spark streaks, frame-rate-independent particle damping, soft radial smoke sprites, corrected negative-drift smoke and retry cleanup.
- Created `src/visuals/PoliceBike.js` and `public/audio/siren.wav`; edited existing `src/ai/Police.js`, `src/visuals/Particles.js`, `src/main.js`, `src/race/Race.js`, `src/ui/HUD.js`, `src/audio/GameAudio.js`, `src/core/constants.js`, `src/core/manifest.js`, `scripts/generate-audio.py`, `src/style.css`, `tests/race.test.js` and `AGENTS.md`.
- Expanded `POLICE` with pursuit timing/spawn/reward/audio settings; tuned `FX` emission rates. No dependencies or downloaded assets added.
- Build and 18 tests pass. Tests include natural police trigger, registration in combat, damage, pause, one-time score reward, pool reuse, spark scale, actual patrol physics movement and retry cleanup. Physical-device frame rate and speaker balance still need testing.

## Mobile zoom and human rider update

- Added `touch-action: manipulation` to page/menu controls to stop double-tap zoom; driving controls/canvas retain `none`. Menu scrolling and pinch zoom remain available. Actual iOS/Android double-tap behavior needs physical-device confirmation.
- New `src/visuals/HumanRider.js` builds a crouched human silhouette with an elliptical torso, tapered rounded limbs, proportional full-face helmet, collar/neck, bent knees/elbows, gloves, boots and restrained suit panels. Existing recoil and bike lean still apply.
- Files: `src/visuals/HumanRider.js`, `src/visuals/Vehicles.js`, `src/style.css`, `AGENTS.md`, `IMPLEMENTATION.md`. No new gameplay constants or dependencies.
- Production build and 18 regression tests pass, including close-camera fit and touch cancellation.

## Replay challenges and readable combat

- Choose five hits, five close calls or a podium finish. Finish the race to claim the 500/750-point bonus; results explain the outcome and allow choosing the next challenge.
- Best time and score persist separately for Easy/Medium/Hard on the current device. Corrupt or unavailable storage never prevents racing.
- Enemies telegraph swings for 0.35 seconds with an orange weapon glow and an in-range directional warning. Swinging arms replace resting arms during attacks and reset on interrupts.
- Created `src/race/Records.js`. Edited `src/core/constants.js`, `src/race/Race.js`, `src/combat/Melee.js`, `src/visuals/HumanRider.js`, `src/ui/HUD.js`, `src/style.css`, `index.html`, `tests/race.test.js`, `tests/ride-controls.test.js`, `AGENTS.md`, and this file. New constants: `CHALLENGES`, `REPLAY`. No new dependencies.
- All 21 regression tests pass; production build succeeds (existing bundle-size warning); mobile landscape challenge controls, portrait rotation prompt, and an isolated short-race results/retry flow checked in the browser. Physical-device checks remain outstanding.
