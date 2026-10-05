# AGENTS.md — Road Rash-style WebGL Motorcycle Combat Game

Read this file fully before changing anything. It is the source of truth for architecture, conventions, and roadmap. If code and this file disagree, tell the developer and fix whichever is wrong.

## 1. Project summary

Arcade motorcycle combat racer inspired by classic Road Rash. Endless procedural curved road, traffic, AI rivals (in progress), melee combat (swing left/right), crashes and dismounts.

- Language: plain JavaScript, ES modules (no TypeScript yet)
- Build: Vite
- Rendering: Three.js
- Physics: cannon-es (kept behind `src/physics/PhysicsWorld.js` so Rapier could replace it)
- Audio: Howler.js (not wired in yet; planned Step 6)
- UI: HTML/CSS overlay on top of the canvas (Tailwind optional later)

## 2. Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm run build
npm run preview
```

Debug mode: open `http://localhost:5173/?debug`
- Shows Cannon colliders as green wireframes (needs `npm i -D cannon-es-debugger`)
- Shows the pink melee hitbox while a swing is active
- Exposes `window.dbg = { bike, riders, COMBAT }` in the console

## 3. Controls

| Key | Action |
|---|---|
| Automatic | Throttle starts gently and increases with riding time |
| W / ArrowUp | Hold for full throttle; release returns to automatic cruise |
| S / ArrowDown | Brake (overrides throttle) |
| A / ArrowLeft | Steer left |
| D / ArrowRight | Steer right |
| Escape | Pause / resume |
| Space Bar / left mouse click on the game | Automatically swing toward the nearest enemy in reach |

Phone: hold sideways. Left thumb steers; right thumb accelerates with GAS, brakes or attacks with one HIT button. Turning upright pauses the game; tap resume after rotating back.

## 4. Directory layout

```
index.html               Inline animated boot splash + HUD markup (ids: app, hud, speed, hpbar, stbar, msg, loading, bar)
src/
  main.js                Composition root: creates systems, wires events, runs Game loop
  style.css
  core/
    Game.js              Fixed-timestep loop (60 Hz) + render with interpolation alpha
    Renderer.js          WebGLRenderer, scene, camera, sun + shadows, fog
    Input.js             Keyboard, canvas mouse + multi-pointer touch state, edge-triggered actions, pause reset
    Events.js            Tiny event bus: events.on / events.emit
    AssetManager.js      GLTF / texture / Howler preloader
    manifest.js          Asset list (currently empty -> everything is placeholder primitives)
    constants.js         ALL tunable numbers: FIXED_DT, ROAD, BIKE, GROUP, WALL, COMBAT, UI, AUTO_DRIVE, RIDER_CAMERA
  world/
    Track.js             Procedural centerline in track space (s, lateral), project(), at(), pointAt()
    Road.js              Pooled road mesh chunks + grass plane
    Barriers.js          Pooled guardrail meshes + static Cannon colliders
    Props.js             Instanced roadside trees
  physics/
    PhysicsWorld.js      cannon-es world, ground plane, materials
  entities/
    Rider.js             Shared base class: bike physics, meters, collisions, dismount/respawn, visuals
    PlayerBike.js        Rider subclass with timed auto-throttle and keyboard/touch steering
    DummyRider.js        Rider subclass: fixed-speed lane-keeper (placeholder for real AI)
    Traffic.js           Kinematic traffic cars (two lanes, pooled)
  combat/
    Melee.js             Swing state machine, recovery input buffer, bat/kick visuals + swing trails
    Combat.js            Analytic hit detection + nearest-in-range auto-side selection and HUD queries
    Ragdoll.js           Visual-only tumbling rider after a dismount
  camera/
    RiderCamera.js       Close third-person camera, 4.2 m follow distance, mild lean and shake
  ai/                    (empty, Step 5)
  ui/HUD.js              Event-driven HUD, start screen, pause/resume, warnings
  visuals/Vehicles.js    Modern sport-bike, racing rider and coupe/fastback/sedan builders
```

## 5. Architecture rules (do not violate)

1. **Fixed timestep.** Gameplay and physics run in `fixedUpdate(dt)` at `FIXED_DT = 1/60`. Rendering and visual-only effects run in `update(alpha, dt)`. Never put gameplay logic in the render update.
2. **Render interpolation.** Entities keep `prevPos/currPos` and `prevYaw/currYaw` and lerp with `alpha` in `render()`. Keep this pattern for any new moving entity.
3. **Fixed update order** (see `main.js`): barriers.update -> traffic.fixedUpdate -> riders.fixedUpdate (which calls `think()` then `preStep()`) -> combat.fixedUpdate -> physics.step -> riders.postStep -> traffic.postStep. Insert new systems deliberately and keep this order.
4. **Track space is the shared language.** Position along the road is `s` (meters), lateral offset is `lat` (+right). Use `track.project(x, z, hintS, out)` to go world -> track, and `track.at(s, out)` / `track.pointAt(s, lat, outVec3)` to go track -> world. AI, rank, spawning, and respawning must use track space, not raw world coordinates.
5. **Hybrid arcade physics.** Riders are Cannon bodies with `fixedRotation: true`. Speed, yaw, drift, and knockback are computed in code (`Rider.preStep`) and written into `body.velocity` each step. Cannon only handles gravity and contact resolution. Do not switch to force-based vehicle simulation without discussing it.
6. **Collision classification uses `body.userData.kind`**: `'wall'`, `'traffic'`, `'bike'`. Riders also set `userData.entity`. Collision handling lives in `Rider.onCollide`; it uses the intended velocity (`rider.vx/vz`) because the solver may already have modified `body.velocity`.
7. **Collision groups** (`GROUP` in constants.js): `WORLD=1, BIKE=2, TRAFFIC=4`. Bikes collide with world, bikes, and traffic. Traffic and walls only collide with bikes.
8. **No continuous collision detection.** Walls are thick (2 m colliders) and `Rider.preStep` has an analytic backstop that snaps a rider back if it passes a rail. Keep both.
9. **Pools, not allocations.** Road chunks, barriers, traffic cars, and props are pooled or instanced. Do not create/dispose meshes, geometries, or textures per frame or per chunk. Reuse scratch vectors/objects (`this.tmp`, `this.v3`, `this.tp`).
10. **Combat is data + state machine.** Weapon numbers live in `COMBAT.weapons` in constants.js. Hit detection is analytic (`Combat.js`), not Cannon triggers. Rider-to-rider damage goes through `Rider.receiveHit()`.
11. **Cross-system communication uses `events`** from `core/Events.js`. Existing events:
    - `impact` `{rider, kind, speed, damage, nx, nz, crash, other}`
    - `swing` `{rider, side}`
    - `hit` `{attacker, target, weapon}`
    - `dismount` `{rider, attacker}`
    - `respawn` `{rider}`
    - `wrecked` is legacy from an earlier step and no longer emitted by `Rider`; remove if unused.
    UI, audio, and camera effects must subscribe to events and must not be called from inside combat or physics code.
12. **Dependencies and network.** Do not add npm dependencies or network calls without asking the developer first.

## 6. Conventions

- **Coordinates:** world forward is **-Z**. Heading `h`: forward = `(-sin h, 0, -cos h)`, right = `(cos h, 0, -sin h)`. Positive heading/yaw turns **left**. Steering input: `+1 = left`, `-1 = right`. Lateral offset `lat`: `+ = right`.
- **Units:** meters, seconds, radians. Speeds in m/s (HUD multiplies by 3.6 for km/h).
- **Tunable numbers belong in `constants.js`**, not hard-coded in classes (exceptions: purely visual tweaks).
- **Data-driven additions:** new weapons go in `COMBAT.weapons` with the same fields as `bat`/`kick`.
- **New rider types** extend `Rider` and override `think(dt)`, returning `{throttle, brake, steer, attackL, attackR}`. Never duplicate bike physics.
- **Style:** ES modules, no default exports for classes, small files, no new dependencies without asking. Keep comments for the *why*.
- **Hot-path rules:** no `new THREE.Vector3()` inside `fixedUpdate` or `render`, no array allocations per frame, no `filter/map` in per-step loops where avoidable.

## 7. Current state (done)

1. Core skeleton: loop, renderer, lighting, shadows, input
2. Procedural curved track, pooled road chunks, roadside trees, asset manager (empty manifest)
3. Guardrails, two-way traffic, impact response, camera shake, event bus
4. Melee (bat/kick), hit detection, stamina/balance meters, stagger, dismount + ragdoll + respawn, four DummyRiders for testing
5. Detailed procedural vehicles, warm tone-mapped lighting, layered trees and metallic guardrails
6. Responsive HUD, distance/takedown counters, event banners, start and pause screens (including pause on focus loss). UI.messageDuration and UI.lowHealthPercent tune feedback.
7. Close third-person camera showing the complete bike and rider, and timed auto-throttle: 18 m/s initial cruise target, 8 s warmup, +0.4 m/s each riding second, capped at 58 m/s; acceleration capped at 6 m/s². Holding W/Up (or GAS on touch) requests full throttle beyond cruise; release restores cruise. Braking overrides throttle. Paused/down time does not advance progression.
8. Landscape touch steering, brake and combat buttons with multi-pointer cancellation. Portrait phone layouts pause with a rotation prompt; returning to landscape requires explicit resume.
9. Inline CSS animated loading splash hides unstyled markup until shaders compile and the first scene renders; startup failures show a reload message.
10. Bat active window is 0.22 s with 2.4 m reach; shared range queries power one Space/click/HIT action that selects the closest eligible rider on either side. No target in reach means no swing or stamina cost; Enter no longer attacks. Silver bat, swing trail, hit marker and damage text clarify hits. Recovery inputs buffer for COMBAT.inputBuffer (0.2 s); interrupts clear the buffer. COMBAT.targetHalfWidth/targetHalfLength define target padding, and UI.hitMarkerDuration controls visual feedback.

## 8. Known limitations / tech debt

- Track is flat. No hills; hills would need a heightfield or trimesh collider and track-space `y`.
- `Track` stores every centerline sample forever (about 25k per 50 km). Fine for now; use a ring buffer later.
- Ragdoll is visual only and does not collide with guardrails.
- HUD is owned by `src/ui/HUD.js`; it displays free-ride progress rather than race rank.
- Vehicles are original modern designs with sculpted procedural bodywork, not branded replicas or photorealistic assets. `AssetManager` and `manifest.js` exist for GLB models and audio but nothing is loaded yet.
- No sound at all yet.
- Mobile uses touch buttons, not device-tilt steering or forced orientation locking. Phone layout is browser-verified; physical-device performance and multi-touch still need device testing.
- Mirrors use decorative glass, not rendered rear views.
- Shadow shimmer is possible at high speed because the sun follows the player each frame (texel snapping not implemented).
- `DummyRider` is a placeholder brain, not real AI.
- Start and pause are implemented; no finite race, finish or results state yet.

## 9. Roadmap

**Step 5 — AI competitors (`src/ai/`)**
- `AIRider extends Rider`, racing-line following with curvature look-ahead, speed management
- Aggression state machine: race -> approach -> sideswipe -> swing, target selection, attack when the player is in the swing zone
- Rubber-banding and difficulty tiers
- Rank/position tracking (sort riders by `s`), exposed for the HUD

**Step 6 — Audio (Howler)**
- Engine loop with pitch tied to speed, hit/swing/crash/dismount sounds from the event bus, ambient wind, "click to start" overlay for audio unlock
- Register sounds in `manifest.js`; load via `AssetManager`

**Step 7 — UI & HUD (`src/ui/`)**
- Done: animated boot splash, single-action auto-side attacks, combat reach cues and hit feedback, HUD module, speedometer, health/stamina, low-health/off-road warnings and takedown banners. Remaining: position/rank, wrong-way and rearview indicators.
- Done: start and pause menus. Remaining: game over/results
- Tailwind optional; keep the HUD out of `main.js`

**Step 8 — Polish & content**
- Done: close third-person rider camera, modern sculpted sport-bike and three car body styles, touch landscape layout and progressive auto-throttle. Remaining: physical-device performance pass and optional tilt steering.
- GLB models for bikes/riders/cars, weapon variety (pipe, chain), pickups, police/pursuit, track themes, shadow texel snapping, performance pass (instancing, LOD)

## 10. How to verify any change

1. `npm run dev` starts with no console errors.
2. Bike accelerates, steers, leans, and the camera FOV widens with speed.
3. Curves look continuous, with no seams at chunk boundaries every 64 m; lane dashes stay continuous.
4. Rail hit at an angle: bounce or scrape, HP drops, camera shakes, no tunneling at top speed.
5. Traffic spawns ahead, despawns behind, and collisions hurt.
6. Space/click/HIT automatically chooses the nearest enemy in reach and swings on that side, cost stamina, and regen after about 0.7 s.
7. Hitting a dummy staggers it; about three quick hits dismount it; it respawns upright on the road with a blink.
8. In a long drive, `renderer.info.memory.geometries` and `.textures` stay flat (no leaks).
9. `npm run build` succeeds.
10. `node --test tests/ride-controls.test.js` verifies the speed ramp/cap, brake override, camera attachment, touch cancellation, manual throttle override, combat sides/range/one-hit limit and buffered attacks.
11. At 844×390 verify landscape controls; at 390×844 verify rotation pause. Confirm held touch inputs clear on pause/focus loss and resume never happens automatically.

## 11. Working agreement for AI agents

- Read the relevant files before editing; do not assume.
- Make small, focused changes; explain what changed and why in the final message.
- Keep the architecture rules in section 5. If a request conflicts with them, say so and propose an alternative before coding.
- When adding a feature, list the files created/edited and any new constants.
- Update this file (sections 4, 7, 8, 9) when you add systems, events, or constants.
- Do not rewrite working files wholesale just to restyle them.
- Never remove the debug hooks (`?debug`, `window.dbg`).