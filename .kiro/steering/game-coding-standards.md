---
inclusion: always
---

# Flappy Kiro — Game Coding Standards

These standards apply to all implementation work on `index.html`. They are derived from the design document and must be followed consistently across all components.

---

## 1. General JavaScript Conventions

- **ES2020 vanilla JS only** — no frameworks, no build tools, no npm packages.
- **No raw numeric literals in game logic** — every number must reference `C.CONSTANT_NAME` from the frozen config object.
- **`const` by default** — use `let` only when reassignment is genuinely required. Never use `var`.
- **Named functions over anonymous** — prefer `function ghostyUpdate(dt)` over `const ghostyUpdate = (dt) =>` for top-level game functions; aids stack traces.
- **One responsibility per function** — update functions update state, draw functions draw, never both.
- **No side effects in draw functions** — `*Draw(ctx)` functions must only call canvas API methods. They must not modify game state.

### Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Config constants | `UPPER_SNAKE_CASE` | `C.PIPE_SPEED_INITIAL` |
| Game state variables | `camelCase` | `currentState`, `score` |
| Component functions | `componentVerb` | `ghostyUpdate`, `pipesDraw` |
| Pool/buffer arrays | `camelCase` + noun | `pipePool`, `particlePool` |
| State enum values | `UPPER_SNAKE_CASE` | `State.PLAYING` |
| Boolean flags | `is` / `has` prefix | `isInvincible`, `hasScored` |
| Timers | `*Timer` suffix | `invincibleTimer`, `shakeTimer` |

---

## 2. Game Loop Structure

The game loop follows a strict **update → render** separation driven by `requestAnimationFrame`.

```js
let lastTimestamp = 0;

function gameLoop(timestamp) {
  const rawDt = (timestamp - lastTimestamp) / 1000; // seconds
  const dt = Math.min(rawDt, C.MAX_DELTA);          // clamp spike on tab blur
  lastTimestamp = timestamp;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame((t) => { lastTimestamp = t; requestAnimationFrame(gameLoop); });
```

**Rules:**
- `dt` is always in **seconds**, never milliseconds, in update functions.
- `dt` is always clamped to `C.MAX_DELTA` before any physics calculation.
- `update(dt)` and `render()` are the only two calls in the loop body.
- Never call `render()` from inside `update()` or vice versa.
- Never use `setInterval` or `setTimeout` for rendering.

### Update Dispatcher

```js
function update(dt) {
  switch (currentState) {
    case State.MENU:      updateMenu(dt);     break;
    case State.PLAYING:   updatePlaying(dt);  break;
    case State.PAUSED:    /* nothing */       break;
    case State.GAME_OVER: updateGameOver(dt); break;
  }
}
```

### Render Dispatcher

```js
function render() {
  ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);
  switch (currentState) {
    case State.MENU:      renderMenu();     break;
    case State.PLAYING:   renderPlaying();  break;
    case State.PAUSED:    renderPaused();   break;
    case State.GAME_OVER: renderGameOver(); break;
  }
}
```

---

## 3. State Machine Pattern

The game uses an explicit 4-state machine. All state transitions go through `transitionTo()` — never set `currentState` directly.

```js
const State = Object.freeze({
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
});

let currentState = State.MENU;
let inputConsumed = false; // prevents carry-over events across transitions

function transitionTo(newState) {
  exitState(currentState);
  currentState = newState;
  inputConsumed = true; // consume the triggering input
  enterState(newState);
}
```

**Input consumption pattern** — prevents a single Space press from both starting the game AND triggering a flap:

```js
function handleInput() {
  if (inputConsumed) { inputConsumed = false; return; }
  // ... handle input for currentState
}
```

**Enter/exit hooks** keep state transition logic centralised:

```js
function enterState(state) {
  switch (state) {
    case State.PLAYING:
      ghostyReset(); pipesReset(); particlesReset(); effectsReset();
      audioBgStart();
      break;
    case State.PAUSED:  audioBgPause();  break;
    case State.GAME_OVER: audioBgStop(); storageSetHighScore(score); break;
    case State.MENU:    audioBgStop();   break;
  }
}

function exitState(state) {
  // Clean up any state-specific resources if needed
}
```

---

## 4. Component / Module Pattern

Each logical system is a plain object or set of functions grouped by prefix. No classes — the game is too small to benefit from class overhead and prototype chains.

```js
// GOOD — flat functions with clear prefix
function ghostyUpdate(dt) { ... }
function ghostyDraw(ctx)  { ... }
function ghostyReset()    { ... }

// AVOID — unnecessary class wrapper
class Ghosty {
  update(dt) { ... }
  draw(ctx)  { ... }
}
```

**Component interface contract** — every component exposes:

| Function | Purpose |
|---|---|
| `*Update(dt)` | Advance state by `dt` seconds |
| `*Draw(ctx)` | Render current state to canvas |
| `*Reset()` | Restore to initial state for game restart |

Components that manage pools also expose:
- `*Init()` — one-time setup at startup (allocate pool, set initial positions)

---

## 5. Memory Management

### Object Pooling (Pipes)

Never allocate pipe objects during gameplay. Pre-allocate at startup and reuse slots:

```js
// GOOD — pool allocated once, reused in place
const pipePool = Array.from({ length: C.PIPE_POOL_SIZE },
  () => ({ x: 0, gapY: 0, scored: false, active: false }));

function spawnPipe() {
  const pipe = pipePool.find(p => !p.active);
  if (!pipe) return;
  pipe.x = C.CANVAS_W;
  pipe.gapY = randomGapY();
  pipe.scored = false;
  pipe.active = true;
}

// AVOID — allocating in the game loop
function spawnPipe() {
  pipes.push({ x: C.CANVAS_W, gapY: randomGapY(), scored: false }); // GC pressure
}
```

### Ring Buffer (Particles)

Particles use a fixed-size ring buffer. The write head wraps around, overwriting the oldest dead particles:

```js
const PARTICLE_POOL_SIZE = C.PARTICLE_COUNT * C.PARTICLE_LIFESPAN * 2;
const particlePool = Array.from({ length: PARTICLE_POOL_SIZE },
  () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0 }));
let particleHead = 0;

function particlesEmit(x, y) {
  for (let i = 0; i < C.PARTICLE_COUNT; i++) {
    const p = particlePool[particleHead % PARTICLE_POOL_SIZE];
    p.x = x; p.y = y;
    p.vx = (Math.random() - 0.5) * 60;
    p.vy = (Math.random() - 0.5) * 60;
    p.life = p.maxLife = C.PARTICLE_LIFESPAN;
    particleHead++;
  }
}
```

### General Rules

- **No `Array.push/pop/shift/splice` in the game loop hot path** — use pool slots and `active` flags instead.
- **No object literals `{}` or array literals `[]` inside `update()` or `render()`** — allocate everything at startup.
- **Reuse objects in place** — overwrite properties, never replace the object reference.
- **Score popups are the exception** — they are infrequent (one per point) and short-lived; a small array with `push/filter` is acceptable.

---

## 6. Canvas API Patterns

### Context State Management

Minimise `ctx.save()` / `ctx.restore()` calls — they are not free. Only use them when you genuinely need to isolate transform or style state:

```js
// GOOD — one save/restore wrapping the entire particle pass
ctx.save();
for (const p of particlePool) {
  if (p.life <= 0) continue;
  ctx.globalAlpha = p.life / p.maxLife;
  ctx.fillRect(p.x, p.y, 3, 3);
}
ctx.restore(); // restores globalAlpha once

// AVOID — save/restore per particle
for (const p of particlePool) {
  ctx.save();
  ctx.globalAlpha = p.life / p.maxLife;
  ctx.fillRect(p.x, p.y, 3, 3);
  ctx.restore(); // called hundreds of times per frame
}
```

### Batching by Style

Group draw calls that share the same `fillStyle`, `strokeStyle`, or `font` to avoid redundant state changes:

```js
// GOOD — set fillStyle once for all pipes
ctx.fillStyle = C.PIPE_COLOUR;
for (const pipe of pipePool) {
  if (!pipe.active) continue;
  ctx.fillRect(pipe.x, 0, C.PIPE_WIDTH, pipe.gapY - C.PIPE_GAP / 2);
  ctx.fillRect(pipe.x, pipe.gapY + C.PIPE_GAP / 2, C.PIPE_WIDTH, C.CANVAS_H);
}

// AVOID — setting fillStyle inside the loop
for (const pipe of pipePool) {
  ctx.fillStyle = '#4CAF50'; // redundant repeated assignment
  ctx.fillRect(...);
}
```

### Sprite Rendering

```js
// Draw a spritesheet frame
ctx.drawImage(
  ghostyImage,              // HTMLImageElement
  frameIndex * C.GHOSTY_FRAME_W, 0,          // source x, y
  C.GHOSTY_FRAME_W, C.GHOSTY_FRAME_H,        // source w, h
  ghosty.x, ghosty.y,                         // dest x, y
  C.GHOSTY_W, C.GHOSTY_H                      // dest w, h
);
```

- The `Image` object is decoded once at load time — never re-created.
- Always check `imageLoaded` flag before calling `drawImage`; fall back to `fillRect` if false.

### HiDPI Scaling

Set up once at load, never touch again during gameplay:

```js
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = C.CANVAS_W * dpr;
  canvas.height = C.CANVAS_H * dpr;
  canvas.style.width  = C.CANVAS_W + 'px';
  canvas.style.height = C.CANVAS_H + 'px';
  ctx.scale(dpr, dpr);
}
```

---

## 7. Collision Detection

### AABB Overlap Test

The canonical collision function — used for all pipe and boundary checks:

```js
function rectsOverlap(a, b) {
  // Returns true only for genuine overlap; touching edges = false
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}
```

### Hitbox vs Sprite

Always test against the **hitbox**, never the sprite bounds:

```js
function ghostyHitbox() {
  return {
    x: ghosty.x + C.HITBOX_INSET,
    y: ghosty.y + C.HITBOX_INSET,
    w: C.GHOSTY_W - 2 * C.HITBOX_INSET,
    h: C.GHOSTY_H - 2 * C.HITBOX_INSET,
  };
}
```

### Collision Check Order

Always check boundary conditions before pipe loops — boundaries are cheaper and more common:

```js
function checkCollisions() {
  if (ghosty.invincible) return; // early exit — most common case during flash

  const hb = ghostyHitbox();

  // 1. Boundary checks (O(1))
  if (hb.y + hb.h >= C.CANVAS_H || hb.y <= 0) {
    triggerCollision(); return;
  }

  // 2. Pipe loop (O(n), n ≤ 8)
  for (const pipe of pipePool) {
    if (!pipe.active) continue;
    const topRect    = { x: pipe.x, y: 0,                          w: C.PIPE_WIDTH, h: pipe.gapY - C.PIPE_GAP / 2 };
    const bottomRect = { x: pipe.x, y: pipe.gapY + C.PIPE_GAP / 2, w: C.PIPE_WIDTH, h: C.CANVAS_H };
    if (rectsOverlap(hb, topRect) || rectsOverlap(hb, bottomRect)) {
      triggerCollision(); return;
    }
  }
}
```

---

## 8. Event Handling

### Input Normalisation

All input (keyboard + pointer) funnels through a single `handleInput()` function to avoid duplicated logic:

```js
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space')  { e.preventDefault(); handleInput('action'); }
  if (e.code === 'Escape' || e.code === 'KeyP') handleInput('pause');
});

canvas.addEventListener('click',      (e) => handlePointer(e));
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handlePointer(e.touches[0]); });

function handlePointer(e) {
  const rect = canvas.getBoundingClientRect();
  const lx = (e.clientX - rect.left) * (C.CANVAS_W / rect.width);
  const ly = (e.clientY - rect.top)  * (C.CANVAS_H / rect.height);
  handleInput('tap', lx, ly);
}
```

### Button Hit Detection

Canvas buttons use AABB point-in-rect — no DOM elements:

```js
function isPointInButton(px, py, btn) {
  return px >= btn.x && px <= btn.x + btn.w &&
         py >= btn.y && py <= btn.y + btn.h;
}

// Usage in handleInput
function handleInput(type, px, py) {
  if (inputConsumed) { inputConsumed = false; return; }

  if (currentState === State.MENU) {
    if (type === 'action' || (type === 'tap' && isPointInButton(px, py, PLAY_BTN))) {
      transitionTo(State.PLAYING);
    }
  }
  // ... other states
}
```

### Audio Initialisation Gate

Web Audio API requires a user gesture. Gate all audio behind a one-time init:

```js
let audioReady = false;

function ensureAudio() {
  if (audioReady) return;
  audioInit(); // creates AudioContext, loads buffers
  audioReady = true;
}

// Call ensureAudio() at the top of handleInput() before any audio playback
```

---

## 9. Physics Conventions

- All velocities and positions are in **pixels per second** — never pixels per frame.
- Always multiply by `dt` before applying to position or velocity.
- Gravity is **additive** each frame: `vy += C.GRAVITY * dt`
- Flap **replaces** velocity: `vy = C.ASCENT_VELOCITY` (not `+=`)
- Terminal velocity is a **max clamp**: `vy = Math.min(vy, C.TERMINAL_VELOCITY)`
- Delta-time is always clamped: `dt = Math.min(rawDt, C.MAX_DELTA)`

```js
// Canonical physics step
ghosty.vy += C.GRAVITY * dt;
ghosty.vy  = Math.min(ghosty.vy, C.TERMINAL_VELOCITY);
ghosty.y  += ghosty.vy * dt;
```

---

## 10. Error Handling and Fallbacks

| Scenario | Pattern |
|---|---|
| Asset image fails to load | Set `imageLoaded = false`; draw `fillRect` fallback in draw function |
| Audio file fails to load | Set buffer to `null`; play function checks `if (!buffer) synthFallback()` |
| `localStorage` throws | Wrap in `try/catch`; use `inMemoryHighScore` variable as fallback |
| `requestAnimationFrame` unavailable | `(window.requestAnimationFrame \|\| ((cb) => setTimeout(cb, 16)))(gameLoop)` |
| `AudioContext` blocked by autoplay | Create context inside first `handleInput()` call, not at module load |

---

## 11. Debug Mode

All profiling and debug rendering is gated behind `C.DEBUG` (default `false`). Never ship debug code unconditionally:

```js
if (C.DEBUG) {
  // Draw hitboxes
  ctx.strokeStyle = 'rgba(255,0,0,0.7)';
  const hb = ghostyHitbox();
  ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);

  // Frame timing
  performance.mark('frameStart');
}
```

Add `DEBUG` to the `CONFIG` block:
```js
DEBUG: false, // set to true via URL: ?DEBUG=1
```
