---
inclusion: always
---

# Flappy Kiro — Game Mechanics Reference

This steering file is the authoritative reference for all physics, movement, collision, spawning, and scoring logic. All values reference `C.CONSTANT_NAME` from the frozen config object. Never use raw literals.

---

## 1. Physics Constants Reference

| Constant | Value | Unit | Description |
|---|---|---|---|
| `C.GRAVITY` | 800 | px/s² | Downward acceleration applied every frame |
| `C.ASCENT_VELOCITY` | -300 | px/s | Vertical velocity set on flap (negative = up) |
| `C.TERMINAL_VELOCITY` | 700 | px/s | Maximum downward speed (positive = down) |
| `C.MAX_DELTA` | 0.1 | s | dt cap to prevent physics explosion on tab blur |
| `C.PIPE_SPEED_INITIAL` | 120 | px/s | Starting horizontal scroll speed |
| `C.PIPE_SPEED_INCREMENT` | 20 | px/s | Speed added per difficulty threshold |
| `C.PIPE_SPEED_MAX` | 400 | px/s | Hard cap on pipe speed |
| `C.PIPE_SPEED_THRESHOLD` | 5 | points | Score interval triggering a speed increase |

All physics operate in **pixels per second**. Always scale by `dt` (seconds) before applying to position or velocity.

---

## 2. Ghosty Movement Physics

### Canonical Physics Step

Applied every frame while `currentState === State.PLAYING` and `ghosty.invincible === false`:

```js
function ghostyUpdate(dt) {
  // 1. Apply gravity (additive acceleration)
  ghosty.vy += C.GRAVITY * dt;

  // 2. Clamp to terminal velocity
  ghosty.vy = Math.min(ghosty.vy, C.TERMINAL_VELOCITY);

  // 3. Integrate position
  ghosty.y += ghosty.vy * dt;
}
```

### Flap Input

Flap **replaces** velocity — it does not add to it. This gives consistent, predictable jump height regardless of current fall speed:

```js
function ghostyFlap() {
  ghosty.vy = C.ASCENT_VELOCITY; // replace, not +=
  audioPlayJump();
  ghosty.animState = 'flap';
  ghosty.animTimer = 0;
  ghosty.animFrame = C.GHOSTY_FLAP_FRAME;
  particlesEmit(ghosty.x, ghosty.y + C.GHOSTY_H / 2);
}
```

### Input Responsiveness

- Flap input is processed in `handleInput()` **before** `update(dt)` runs in the same frame — the velocity change takes effect immediately, not one frame later.
- There is no flap cooldown — the player can flap every frame if desired.
- Input is consumed on state transitions to prevent carry-over (see coding standards §3).

### Momentum Conservation

Velocity carries over frame-to-frame naturally — no damping, no drag. The only forces are:
1. Gravity (constant downward acceleration)
2. Flap (instantaneous velocity replacement)
3. Terminal velocity clamp (hard cap)

### Invincibility Physics

During invincibility frames, physics **continue to run** — Ghosty still falls. Only collision detection is suppressed:

```js
function ghostyUpdate(dt) {
  // Invincibility timer ticks regardless
  if (ghosty.invincible) {
    ghosty.invincibleTimer -= dt * 1000;
    ghosty.flashVisible = Math.floor(ghosty.invincibleTimer / 80) % 2 === 0;
    if (ghosty.invincibleTimer <= 0) {
      ghosty.invincible = false;
      transitionTo(State.GAME_OVER);
    }
  }

  // Physics always run
  ghosty.vy += C.GRAVITY * dt;
  ghosty.vy = Math.min(ghosty.vy, C.TERMINAL_VELOCITY);
  ghosty.y += ghosty.vy * dt;
}
```

---

## 3. Collision Detection

### Hitbox Definition

Always test against the **inset hitbox**, never the sprite bounds. The inset makes near-misses feel fair:

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

With `C.HITBOX_INSET = 4` and `C.GHOSTY_W/H = 40`, the effective hitbox is 32×32 px centred in the 40×40 sprite — matching the 12 px radius circle intent from `ghosty-sprites.md`.

### AABB Overlap Test

```js
function rectsOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}
```

Touching edges (`a.x + a.w === b.x`) returns `false` — not a collision. This prevents false positives when Ghosty grazes a pipe edge.

### Pipe Collision Boundaries

Each active pipe generates two boundary rects on the fly — no need to store them:

```js
function getPipeBoundaries(pipe) {
  const halfGap = C.PIPE_GAP / 2;
  return [
    // Top pipe: from canvas top down to gap
    { x: pipe.x, y: 0,                  w: C.PIPE_WIDTH, h: pipe.gapY - halfGap },
    // Bottom pipe: from gap down to canvas bottom
    { x: pipe.x, y: pipe.gapY + halfGap, w: C.PIPE_WIDTH, h: C.CANVAS_H },
  ];
}
```

### Full Collision Check

Check order: invincibility guard → boundary → pipes. Cheapest checks first:

```js
function checkCollisions() {
  if (ghosty.invincible) return;          // O(1) — most common skip

  const hb = ghostyHitbox();

  // Ground and ceiling (O(1))
  if (hb.y + hb.h >= C.CANVAS_H || hb.y <= 0) {
    triggerCollision(); return;
  }

  // Pipes (O(n), n ≤ 8)
  for (const pipe of pipePool) {
    if (!pipe.active) continue;
    const [top, bottom] = getPipeBoundaries(pipe);
    if (rectsOverlap(hb, top) || rectsOverlap(hb, bottom)) {
      triggerCollision(); return;
    }
  }
}
```

### Collision Response

```js
function triggerCollision() {
  ghosty.invincible = true;
  ghosty.invincibleTimer = C.INVINCIBILITY_MS;
  ghosty.animState = 'death';
  ghosty.animFrame = C.GHOSTY_DEATH_FRAMES[0];
  ghosty.animTimer = 0;
  effectsTriggerShake();
  audioPlayGameOver();
  // State transitions to GAME_OVER when invincibleTimer expires in ghostyUpdate
}
```

---

## 4. Wall (Pipe) Generation

### Spawn Condition

A new pipe spawns when the rightmost active pipe has scrolled far enough left to open a gap:

```js
function shouldSpawnPipe() {
  let rightmostX = -Infinity;
  for (const pipe of pipePool) {
    if (pipe.active && pipe.x > rightmostX) rightmostX = pipe.x;
  }
  // Spawn when the last pipe's leading edge is one spacing from the right edge
  return rightmostX <= C.CANVAS_W - C.PIPE_PAIR_SPACING;
}
```

### Gap Position Randomisation

Gap centre is uniformly random within safe bounds. The bounds ensure the full gap is always visible and reachable:

```js
function randomGapY() {
  const range = C.PIPE_GAP_MAX_Y - C.PIPE_GAP_MIN_Y;
  return C.PIPE_GAP_MIN_Y + Math.random() * range;
}
```

With defaults: `PIPE_GAP_MIN_Y=80`, `PIPE_GAP_MAX_Y=560`, `PIPE_GAP=140` — the gap centre is always at least 80 px from the top and 80 px from the bottom, keeping the full 140 px gap on screen.

### Pool-Based Spawning

```js
function spawnPipe() {
  const pipe = pipePool.find(p => !p.active);
  if (!pipe) return; // pool exhausted — should never happen with PIPE_POOL_SIZE=8
  pipe.x = C.CANVAS_W + C.PIPE_WIDTH; // spawn just off right edge
  pipe.gapY = randomGapY();
  pipe.scored = false;
  pipe.active = true;
}
```

### Scrolling and Culling

```js
function pipesUpdate(dt) {
  const speed = currentPipeSpeed();
  for (const pipe of pipePool) {
    if (!pipe.active) continue;
    pipe.x -= speed * dt;
    // Return to pool when fully off left edge
    if (pipe.x + C.PIPE_WIDTH < 0) pipe.active = false;
  }
  if (shouldSpawnPipe()) spawnPipe();
}
```

---

## 5. Progressive Difficulty

Speed increases are computed on-the-fly from the current score — no mutable speed variable needed:

```js
function currentPipeSpeed() {
  const steps = Math.floor(score / C.PIPE_SPEED_THRESHOLD);
  return Math.min(
    C.PIPE_SPEED_INITIAL + steps * C.PIPE_SPEED_INCREMENT,
    C.PIPE_SPEED_MAX
  );
}
```

Cloud parallax speeds scale proportionally so depth effect holds at all difficulty levels:

```js
function cloudScrollSpeed(layer) {
  const multiplier = layer === 0 ? C.CLOUD_SPEED_FAR : C.CLOUD_SPEED_NEAR;
  return currentPipeSpeed() * multiplier;
}
```

---

## 6. Scoring System

### Score Increment

A pipe is scored exactly once — the `scored` flag prevents double-counting across frames:

```js
function checkScoring() {
  for (const pipe of pipePool) {
    if (!pipe.active || pipe.scored) continue;
    // Score when Ghosty's centre passes the pipe's right edge
    if (ghosty.x + C.GHOSTY_W / 2 > pipe.x + C.PIPE_WIDTH) {
      pipe.scored = true;
      score++;
      audioPlayScoreBeep();
      effectsSpawnPopup(pipe.x + C.PIPE_WIDTH / 2, pipe.gapY);
    }
  }
}
```

Call `checkScoring()` inside `pipesUpdate(dt)` after scrolling, before culling.

### High Score Persistence

```js
function updateHighScore() {
  if (score > storageGetHighScore()) {
    storageSetHighScore(score);
  }
}
```

Call `updateHighScore()` in the `enterState(State.GAME_OVER)` hook — once per game over, not per frame.

---

## 7. Obstacle Spawning Timing

At the default `PIPE_SPEED_INITIAL=120 px/s` and `PIPE_PAIR_SPACING=350 px`, a new pipe appears approximately every **2.9 seconds**. At max speed (`PIPE_SPEED_MAX=400 px/s`) this drops to **0.875 seconds**. These timings are emergent from the constants — do not add separate timers.

---

## 8. Smooth Animation Interpolation

### Sprite Animation State Machine

```js
function ghostyAnimUpdate(dt) {
  ghosty.animTimer += dt * 1000; // convert to ms

  switch (ghosty.animState) {
    case 'idle': {
      if (ghosty.animTimer >= C.GHOSTY_IDLE_MS) {
        ghosty.animTimer -= C.GHOSTY_IDLE_MS;
        const frames = C.GHOSTY_IDLE_FRAMES;
        const idx = frames.indexOf(ghosty.animFrame);
        ghosty.animFrame = frames[(idx + 1) % frames.length];
      }
      break;
    }
    case 'flap': {
      if (ghosty.animTimer >= C.GHOSTY_FLAP_MS) {
        ghosty.animState = 'idle';
        ghosty.animTimer = 0;
        ghosty.animFrame = C.GHOSTY_IDLE_FRAMES[0];
      }
      break;
    }
    case 'death': {
      const frames = C.GHOSTY_DEATH_FRAMES;
      const idx = frames.indexOf(ghosty.animFrame);
      if (ghosty.animTimer >= C.GHOSTY_DEATH_MS && idx < frames.length - 1) {
        ghosty.animTimer -= C.GHOSTY_DEATH_MS;
        ghosty.animFrame = frames[idx + 1]; // holds on last frame
      }
      break;
    }
  }
}
```

### Lerp and Clamp Utilities

```js
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
```

Use `lerp` for smooth value transitions (e.g. screen shake decay visualisation). Use `clamp` for physics bounds.

### Screen Shake Decay

Shake magnitude decays linearly over its duration — no easing curve needed:

```js
function effectsUpdate(dt) {
  if (shakeTimer > 0) {
    shakeTimer = Math.max(0, shakeTimer - dt * 1000);
  }
}

function effectsApplyShake(ctx) {
  if (shakeTimer <= 0) return;
  const mag = C.SHAKE_MAGNITUDE * (shakeTimer / C.SHAKE_DURATION_MS);
  ctx.translate(
    (Math.random() * 2 - 1) * mag,
    (Math.random() * 2 - 1) * mag
  );
}
```

### Score Popup Animation

Popup drifts upward 30 px and fades to alpha 0 over `POPUP_DURATION_MS`:

```js
function effectsDrawPopups(ctx) {
  ctx.font = `14px "${C.FONT_FAMILY}"`;
  for (const popup of scorePopups) {
    const t = popup.age / popup.maxAge;          // 0 → 1
    const alpha = 1 - t;                          // 1 → 0
    const y = popup.y - 30 * t;                  // drifts up 30px
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#FFD700';
    ctx.fillText('+1', popup.x, y);
  }
  ctx.globalAlpha = 1;
}
```

---

## 9. Parallax Cloud Movement

Two layers scroll at different speeds relative to pipe speed, creating depth:

```js
function cloudsUpdate(dt) {
  for (const cloud of cloudPool) {
    const speed = cloudScrollSpeed(cloud.layer);
    cloud.x -= speed * dt;
    // Wrap to right edge when fully off left
    if (cloud.x + cloud.radiusX < 0) {
      cloud.x = C.CANVAS_W + cloud.radiusX;
      cloud.y = randomCloudY(cloud.layer);
    }
  }
}
```

Layer 0 (far): slower, smaller, lower alpha — creates distant sky feel.
Layer 1 (near): faster, larger, slightly higher alpha — creates foreground depth.

Clouds scroll on **all states** (MENU, PLAYING, PAUSED is frozen, GAME_OVER) — only PAUSED freezes them.
