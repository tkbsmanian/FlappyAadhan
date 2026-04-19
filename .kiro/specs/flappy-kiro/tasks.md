# Implementation Plan: Flappy Kiro

## Overview

Build a single `index.html` browser game using vanilla JavaScript (ES2020), HTML5 Canvas, and the Web Audio API. The implementation follows the 10-component architecture defined in the design, with a frozen `C` config object, a fixed-size pipe pool, a particle ring buffer, and a 4-state machine. All 20 correctness properties are covered by fast-check property-based tests.

## Tasks

- [x] 1. Scaffold `index.html` with CONFIG block and canvas layout
  - Create `index.html` with the `<script id="config">` block containing all constants from the CONFIG table (CANVAS_W, CANVAS_H, GRAVITY, ASCENT_VELOCITY, TERMINAL_VELOCITY, all PIPE_*, GHOSTY_*, HITBOX_INSET, INVINCIBILITY_MS, SHAKE_*, PARTICLE_*, POPUP_DURATION_MS, MAX_DELTA, CLOUD_SPEED_*, VOL_*)
  - Add the `<canvas>` element and minimal CSS: centered in viewport, `object-fit: contain` wrapper, retro pixel-art font via `@font-face` or Google Fonts import
  - Add the main `<script type="module">` tag (empty for now)
  - _Requirements: 8.1, 8.4, 8.5, 9.1_

- [x] 2. Implement ConfigLoader and frozen `C` object
  - [x] 2.1 Implement `ConfigLoader.load(defaults)` that merges `CONFIG` with URL query parameter overrides
    - Parse `window.location.search` via `URLSearchParams`
    - Only accept keys present in `defaults`; parse values as `Number`, skip non-finite results
    - Return merged object; caller wraps with `Object.freeze`
    - Produce the final `const C = Object.freeze(ConfigLoader.load(CONFIG))` used by all game code
    - _Requirements: 9.1_

  - [ ]* 2.2 Write property tests for ConfigLoader
    - **Property: URL overrides replace defaults only for known finite-number keys**
    - Use fast-check to generate arbitrary key/value pairs and verify unknown keys are ignored and non-finite values fall back to defaults
    - Tag: `// Feature: flappy-kiro, ConfigLoader override correctness`

- [x] 3. Implement HiDPI canvas sizing and game loop skeleton
  - [x] 3.1 Implement `resizeCanvas()` using `devicePixelRatio`, set `canvas.width/height` and `ctx.scale(dpr, dpr)`
    - Call once on load; never resize during gameplay
    - _Requirements: 8.4, 8.5_

  - [x] 3.2 Implement `GameLoop` with `requestAnimationFrame`, `performance.now()` timestamps, and `dt` clamped to `C.MAX_DELTA`
    - Dispatch `update(dt)` and `render()` based on `currentState`
    - Add `setTimeout(gameLoop, 16)` fallback if `requestAnimationFrame` is unavailable
    - _Requirements: 11.6, 13.2_

- [x] 4. Implement GameState machine
  - [x] 4.1 Define `State` enum (`MENU`, `PLAYING`, `PAUSED`, `GAME_OVER`) and `currentState` variable
    - Implement `transitionTo(newState)` with enter/exit hooks and an input-consumed flag to prevent carry-over events
    - _Requirements: 13.1, 13.7_

  - [x] 4.2 Wire keyboard and pointer input handlers
    - Space / tap → start or flap or restart depending on state
    - Escape / P → toggle pause
    - Mark input as consumed on state transition so the same event cannot also fire a Flap
    - _Requirements: 1.5, 2.2, 2.3, 13.3, 13.6_

- [x] 5. Implement StorageManager
  - [x] 5.1 Implement `storageGetHighScore()` and `storageSetHighScore(n)` with `localStorage` and in-memory fallback
    - Wrap `localStorage` access in try/catch to handle `SecurityError`
    - _Requirements: 1.4, 5.3, 5.4, 5.5_

  - [ ]* 5.2 Write property test for StorageManager round-trip
    - **Property 14: High Score Persistence Round-Trip**
    - **Validates: Requirements 1.4, 5.3, 5.4**
    - Use fast-check to generate arbitrary non-negative integers; verify `storageGetHighScore()` returns exactly what was written, for both real and mocked-unavailable `localStorage`

- [x] 6. Implement Ghosty physics and rendering
  - [x] 6.1 Implement `ghostyReset()`, `ghostyFlap()`, and `ghostyUpdate(dt)` with gravity, terminal velocity clamp, position update, rotation mapping, and invincibility timer
    - Use `C.GRAVITY`, `C.ASCENT_VELOCITY`, `C.TERMINAL_VELOCITY`, `C.HITBOX_INSET`, `C.INVINCIBILITY_MS`
    - Rotation: map `vy` range `[ASCENT_VELOCITY, TERMINAL_VELOCITY]` → `[-PI/6, PI/2]`
    - Invincibility flash: toggle `flashVisible` every 80 ms; call `transitionTo(State.GAME_OVER)` when timer expires
    - _Requirements: 2.1, 2.2, 2.5, 4.6, 4.7, 4.8, 4.9, 4.10, 11.1–11.7_

  - [ ]* 6.2 Write property test: Gravity and Momentum Conservation
    - **Property 1: Gravity and Momentum Conservation**
    - **Validates: Requirements 2.1, 11.1, 11.4, 11.5**

  - [ ]* 6.3 Write property test: Flap Always Sets Ascent Velocity
    - **Property 2: Flap Always Sets Ascent Velocity**
    - **Validates: Requirements 2.2, 11.2**

  - [ ]* 6.4 Write property test: Terminal Velocity Clamp
    - **Property 3: Terminal Velocity Clamp**
    - **Validates: Requirements 11.3**

  - [ ]* 6.5 Write property test: Rotation Monotonically Tracks Velocity
    - **Property 4: Rotation Monotonically Tracks Velocity**
    - **Validates: Requirements 2.5**

  - [x] 6.6 Implement `ghostyHitbox()` returning `{ x, y, w, h }` inset by `C.HITBOX_INSET`
    - _Requirements: 4.1_

  - [ ]* 6.7 Write property test: Hitbox Inset Correctness
    - **Property 10: Hitbox Inset Correctness**
    - **Validates: Requirements 4.1**

  - [x] 6.8 Implement `ghostyDraw(ctx)` — draw `assets/ghosty.png` sprite with rotation transform; fall back to a white rectangle if the image failed to load
    - Apply `flashVisible` to skip draw during invincibility flash frames
    - _Requirements: 2.4, 4.9, 9.2, 9.3_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement PipeManager with object pool
  - [x] 8.1 Pre-allocate `pipePool` of size `C.PIPE_POOL_SIZE` (8 slots) at startup; implement `spawnPipe()` that finds an inactive slot and sets `x`, `gapY`, `scored`, `active`
    - `gapY` randomised within `[C.PIPE_GAP_MIN_Y, C.PIPE_GAP_MAX_Y]`
    - _Requirements: 3.3, 3.5, 3.6_

  - [ ]* 8.2 Write property test: Pipe Gap Position Always Within Bounds
    - **Property 6: Pipe Gap Position Always Within Bounds**
    - **Validates: Requirements 3.5, 3.6**

  - [x] 8.3 Implement `pipesUpdate(dt)` — scroll active pipes, deactivate off-screen pipes (return to pool), spawn when gap opens, handle scoring with `pipe.scored` flag
    - No `Array.push/shift/splice` in the loop — pool only
    - _Requirements: 3.1, 3.2, 3.3, 3.7, 5.1_

  - [ ]* 8.4 Write property test: Pipe Scrolling Correctness
    - **Property 5: Pipe Scrolling Correctness**
    - **Validates: Requirements 3.1**

  - [ ]* 8.5 Write property test: Off-Screen Pipes Are Removed
    - **Property 7: Off-Screen Pipes Are Removed**
    - **Validates: Requirements 3.7**

  - [ ]* 8.6 Write property test: Score Increments Exactly Once Per Pipe
    - **Property 13: Score Increments Exactly Once Per Pipe**
    - **Validates: Requirements 5.1**

  - [x] 8.7 Implement `pipesDraw(ctx)` — draw top and bottom pipe rects with retro colour scheme; set `fillStyle` once before the loop
    - _Requirements: 8.2_

  - [x] 8.8 Implement `pipesReset()` — mark all pool slots inactive, reset spawn state
    - _Requirements: 7.7, 12.6_

- [x] 9. Implement progressive difficulty
  - [x] 9.1 Implement `currentPipeSpeed()` using `floor(score / C.PIPE_SPEED_THRESHOLD) * C.PIPE_SPEED_INCREMENT + C.PIPE_SPEED_INITIAL`, capped at `C.PIPE_SPEED_MAX`
    - _Requirements: 12.1–12.4_

  - [ ]* 9.2 Write property test: Progressive Speed Formula and Cap
    - **Property 8: Progressive Speed Formula and Cap**
    - **Validates: Requirements 12.3, 12.4**

- [x] 10. Implement collision detection
  - [x] 10.1 Implement `rectsOverlap(a, b)` AABB test and `checkCollisions()` — ground/ceiling check then pipe loop; call `triggerCollision()` on hit; skip if `ghosty.invincible`
    - `triggerCollision()` sets `ghosty.invincible = true`, starts `invincibleTimer`, plays game-over sound, triggers screen shake
    - _Requirements: 4.2–4.8, 4.11_

  - [ ]* 10.2 Write property test: Collision Detection Completeness
    - **Property 11: Collision Detection Completeness**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

  - [ ]* 10.3 Write property test: Invincibility Suppresses Collisions
    - **Property 12: Invincibility Suppresses Collisions**
    - **Validates: Requirements 4.7**

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement CloudManager with parallax layers
  - [x] 12.1 Implement `cloudsInit()` — populate two layers of cloud objects with randomised `x`, `y`, `radiusX`, `radiusY`; layer 0 = far/slow/small, layer 1 = near/fast/large
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 12.2 Implement `cloudsUpdate(dt)` — scroll each cloud by `currentPipeSpeed() * C.CLOUD_SPEED_[layer] * dt`; wrap to right edge when `cloud.x + cloud.radiusX < 0`
    - _Requirements: 10.5, 12.5_

  - [ ]* 12.3 Write property test: Cloud Speed Proportional to Pipe Speed
    - **Property 9: Cloud Speed Proportional to Pipe Speed**
    - **Validates: Requirements 12.5**

  - [ ]* 12.4 Write property test: Cloud Wrapping Maintains Continuous Coverage
    - **Property 20: Cloud Wrapping Maintains Continuous Coverage**
    - **Validates: Requirements 10.5**

  - [x] 12.5 Implement `cloudsDraw(ctx)` — draw semi-transparent ellipses; layer 0 lower alpha, layer 1 slightly higher alpha
    - _Requirements: 10.4_

- [x] 13. Implement ParticleSystem with ring buffer
  - [x] 13.1 Pre-allocate `particlePool` ring buffer of size `C.PARTICLE_COUNT * C.PARTICLE_LIFESPAN * 2`; implement `particlesEmit(x, y)` that overwrites slots in-place via `particleHead % PARTICLE_POOL_SIZE`
    - No array allocation in the emit path
    - _Requirements: 14.3, 14.4, 14.5_

  - [x] 13.2 Implement `particlesUpdate(dt)` — decrement `life` for all particles with `life > 0`; skip dead particles
    - _Requirements: 14.4_

  - [ ]* 13.3 Write property test: Particle Opacity Decreases Monotonically with Age
    - **Property 18: Particle Opacity Decreases Monotonically with Age**
    - **Validates: Requirements 14.4**

  - [x] 13.4 Implement `particlesDraw(ctx)` — draw each live particle; alpha derived from `life / maxLife`; retro colour (semi-transparent white or light blue)
    - Set `ctx.save/restore` once around the particle pass, not per particle
    - _Requirements: 14.4, 14.5_

  - [x] 13.5 Implement `particlesReset()` — zero out all `life` values in the pool
    - _Requirements: 7.7_

- [x] 14. Implement EffectsManager (screen shake and score popups)
  - [x] 14.1 Implement `effectsTriggerShake()`, `effectsApplyShake(ctx)` with linear decay (`SHAKE_MAGNITUDE * shakeTimer / SHAKE_DURATION_MS`), and `effectsUpdate(dt)` to decrement `shakeTimer`
    - _Requirements: 14.1, 14.2_

  - [ ]* 14.2 Write property test: Screen Shake Decays Linearly
    - **Property 17: Screen Shake Decays Linearly**
    - **Validates: Requirements 14.1, 14.2**

  - [x] 14.3 Implement `effectsSpawnPopup(x, y)`, `effectsDrawPopups(ctx)` — "+1" text drifts upward and fades; alpha = `1 - age/maxAge`; use retro font
    - _Requirements: 14.6, 14.7_

  - [ ]* 14.4 Write property test: Score Popup Drifts Up and Fades with Age
    - **Property 19: Score Popup Drifts Up and Fades with Age**
    - **Validates: Requirements 14.6**

  - [x] 14.5 Implement `effectsReset()` — clear `shakeTimer` and `scorePopups` array
    - _Requirements: 7.7_

- [x] 15. Implement AudioManager
  - [x] 15.1 Implement `audioInit()` — create `AudioContext` deferred to first user input; load `assets/jump.wav` and `assets/game_over.wav` via `fetch` + `decodeAudioData`; log warning and no-op on load failure
    - _Requirements: 6.7, 6.8, 9.2, 9.3_

  - [x] 15.2 Implement `audioPlayJump()` and `audioPlayGameOver()` — play decoded buffers via `AudioBufferSourceNode` with respective volume constants
    - _Requirements: 6.1, 6.2_

  - [x] 15.3 Implement `audioPlayScoreBeep()` — synthesise a short high-pitched beep via `OscillatorNode` + `GainNode` with `C.VOL_SCORE_BEEP`
    - _Requirements: 6.3_

  - [x] 15.4 Implement `audioBgStart()`, `audioBgPause()`, `audioBgResume()`, `audioBgStop()` — procedural looping background music via a repeating note sequence scheduled on an `OscillatorNode`; volume `C.VOL_MUSIC`
    - _Requirements: 6.4, 6.5, 6.6_

- [x] 16. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Wire all components into the game loop and state machine
  - [x] 17.1 Implement `update(dt)` dispatcher — branch on `currentState`:
    - `MENU`: `cloudsUpdate(dt)`
    - `PLAYING`: `ghostyUpdate(dt)`, `pipesUpdate(dt)`, `cloudsUpdate(dt)`, `particlesUpdate(dt)`, `effectsUpdate(dt)`, `checkCollisions()`
    - `PAUSED`: no updates
    - `GAME_OVER`: `cloudsUpdate(dt)`
    - _Requirements: 13.2, 13.4_

  - [ ]* 17.2 Write property test: Pause Freezes All Game Object Positions
    - **Property 15: Pause Freezes All Game Object Positions**
    - **Validates: Requirements 13.4, 14.8**

  - [x] 17.3 Implement `render()` dispatcher — draw layers back-to-front per the rendering pipeline (clear → background → far clouds → near clouds → pipes → ground strip → particles → Ghosty → popups → HUD → state overlay); wrap steps 2–10 in `effectsApplyShake`
    - _Requirements: 8.3_

  - [x] 17.4 Implement state enter/exit hooks in `transitionTo`:
    - Enter `PLAYING`: call `ghostyReset()` / `pipesReset()` / `particlesReset()` / `effectsReset()` on fresh start; `audioBgStart()` or `audioBgResume()`
    - Enter `PAUSED`: `audioBgPause()`
    - Enter `GAME_OVER`: `audioBgStop()`; update high score via `storageSetHighScore`
    - Enter `MENU`: `audioBgStop()`
    - _Requirements: 6.5, 6.6, 7.7, 12.6_

  - [ ]* 17.5 Write property test: Restart Resets All Game State to Initial Values
    - **Property 16: Restart Resets All Game State to Initial Values**
    - **Validates: Requirements 7.7**

- [x] 18. Implement all screen overlays (HUD and state screens)
  - [x] 18.1 Implement MENU overlay — "Flappy Kiro" title, high score, "Press Space or Tap to Start" prompt; retro font
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 18.2 Implement PLAYING HUD — current score displayed top-centre each frame
    - _Requirements: 5.2_

  - [x] 18.3 Implement PAUSED overlay — "Paused" text and "Press Escape or P to Resume" prompt
    - _Requirements: 13.5_

  - [x] 18.4 Implement GAME_OVER overlay — "Game Over", final score, high score, "New Best!" highlight if applicable, restart prompt
    - _Requirements: 7.1–7.6_

- [x] 19. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All game logic references `C.CONSTANT_NAME` — never raw numeric literals
- Property tests use **fast-check** and run a minimum of 100 iterations each
- Each property test is tagged: `// Feature: flappy-kiro, Property N: <text>`
- The pipe pool (8 slots) and particle ring buffer produce zero GC pressure in the hot path
- `dt` is always clamped to `C.MAX_DELTA` (0.1 s) before any physics update
