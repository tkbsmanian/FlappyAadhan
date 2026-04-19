---
inclusion: always
---

# Flappy Kiro — Visual Design Reference

This steering file covers all rendering patterns: sprite animation, particle effects, parallax clouds, screen shake, UI overlays, and the retro colour palette. All values reference `C.CONSTANT_NAME`.

---

## 1. Colour Palette

| Role | Hex | Usage |
|---|---|---|
| Sky background | `#1A1A2E` | Canvas background fill |
| Primary text | `#FFFFFF` | Most labels and HUD |
| Title / accent | `#FFD700` | High score, best label, score popup |
| Danger | `#EF5350` | Game Over title |
| Success / CTA | `#4CAF50` | Play, Restart buttons |
| Button border | `#2E7D32` | CTA button border |
| Neutral dark | `#37474F` | Secondary buttons, overlays |
| Neutral border | `#546E7A` | Secondary button border |
| Overlay bg | `rgba(0,0,0,0.55)` | Pause / High Scores dim |
| Prompt text | `#B0BEC5` | Sub-prompts, hints |
| Pipe fill | `#388E3C` | Pipe body |
| Pipe border | `#1B5E20` | Pipe edge highlight |
| Ground fill | `#5D4037` | Ground strip |
| Ground top | `#4CAF50` | Ground top edge |
| Particle | `rgba(200,230,255,0.8)` | Ghosty trail particles |
| Cloud far | `rgba(255,255,255,0.25)` | Far cloud layer alpha |
| Cloud near | `rgba(255,255,255,0.45)` | Near cloud layer alpha |

Never use raw hex strings in game logic — define colour constants in the `CONFIG` block and reference via `C.COLOUR_*`.

---

## 2. Rendering Pipeline Order

Every frame, draw back-to-front. Never deviate from this order:

```js
function renderPlaying() {
  // 1. Background
  ctx.fillStyle = C.COLOUR_SKY;
  ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

  // 2–3. Clouds (inside shake wrapper)
  ctx.save();
  effectsApplyShake(ctx);

    // 4. Far clouds (layer 0)
    cloudsDraw(ctx, 0);

    // 5. Near clouds (layer 1)
    cloudsDraw(ctx, 1);

    // 6. Pipes
    pipesDraw(ctx);

    // 7. Ground strip
    drawGround(ctx);

    // 8. Particles
    particlesDraw(ctx);

    // 9. Ghosty
    ghostyDraw(ctx);

    // 10. Score popups
    effectsDrawPopups(ctx);

  ctx.restore(); // ends shake transform

  // 11. HUD (never shaken — drawn outside shake wrapper)
  drawHUD(ctx);
}
```

The HUD (score, pause button) is drawn **outside** the shake `ctx.save/restore` so it stays stable during screen shake.

---

## 3. Sprite Rendering (Ghosty)

### Spritesheet Frame Selection

```js
function ghostyDraw(ctx) {
  if (ghosty.invincible && !ghosty.flashVisible) return; // flash skip

  if (ghostyImageLoaded) {
    ctx.drawImage(
      ghostyImage,
      ghosty.animFrame * C.GHOSTY_FRAME_W, 0,  // source x, y
      C.GHOSTY_FRAME_W, C.GHOSTY_FRAME_H,       // source w, h
      Math.round(ghosty.x), Math.round(ghosty.y), // dest x, y (rounded for crisp pixels)
      C.GHOSTY_W, C.GHOSTY_H                    // dest w, h
    );
  } else {
    // Fallback: white rectangle
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(ghosty.x, ghosty.y, C.GHOSTY_W, C.GHOSTY_H);
  }
}
```

- Round `x` and `y` to integers with `Math.round()` before `drawImage` — prevents sub-pixel blurring on pixel-art sprites.
- No rotation transform — animation state conveys movement direction.
- `ghostyImageLoaded` is a boolean set in the image `onload` handler.

### Image Loading with Fallback

```js
const ghostyImage = new Image();
let ghostyImageLoaded = false;
ghostyImage.onload  = () => { ghostyImageLoaded = true; };
ghostyImage.onerror = () => { console.warn('[Ghosty] sprite failed to load — using fallback'); };
ghostyImage.src = 'assets/ghosty.png';
```

---

## 4. Pipe Rendering

Set `fillStyle` once before the loop — never inside it:

```js
function pipesDraw(ctx) {
  // Body
  ctx.fillStyle = C.COLOUR_PIPE;
  for (const pipe of pipePool) {
    if (!pipe.active) continue;
    const halfGap = C.PIPE_GAP / 2;
    // Top pipe
    ctx.fillRect(pipe.x, 0, C.PIPE_WIDTH, pipe.gapY - halfGap);
    // Bottom pipe
    ctx.fillRect(pipe.x, pipe.gapY + halfGap, C.PIPE_WIDTH, C.CANVAS_H);
  }

  // Cap highlight (retro look — slightly lighter strip on right edge)
  ctx.fillStyle = C.COLOUR_PIPE_BORDER;
  for (const pipe of pipePool) {
    if (!pipe.active) continue;
    const halfGap = C.PIPE_GAP / 2;
    ctx.fillRect(pipe.x + C.PIPE_WIDTH - 4, 0, 4, pipe.gapY - halfGap);
    ctx.fillRect(pipe.x + C.PIPE_WIDTH - 4, pipe.gapY + halfGap, 4, C.CANVAS_H);
  }
}
```

---

## 5. Cloud Rendering

Clouds are procedural ellipses. Each cloud is a cluster of 3 overlapping ellipses for a puffy look:

```js
function drawCloud(ctx, cloud) {
  const alpha = cloud.layer === 0 ? C.CLOUD_ALPHA_FAR : C.CLOUD_ALPHA_NEAR;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  // Centre puff
  ctx.ellipse(cloud.x, cloud.y, cloud.radiusX, cloud.radiusY, 0, 0, Math.PI * 2);
  // Left puff
  ctx.ellipse(cloud.x - cloud.radiusX * 0.5, cloud.y + cloud.radiusY * 0.2,
              cloud.radiusX * 0.6, cloud.radiusY * 0.7, 0, 0, Math.PI * 2);
  // Right puff
  ctx.ellipse(cloud.x + cloud.radiusX * 0.5, cloud.y + cloud.radiusY * 0.2,
              cloud.radiusX * 0.6, cloud.radiusY * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function cloudsDraw(ctx, layer) {
  for (const cloud of cloudPool) {
    if (cloud.layer !== layer) continue;
    drawCloud(ctx, cloud);
  }
}
```

Cloud size ranges by layer:
- Layer 0 (far): `radiusX` 20–40 px, `radiusY` 10–20 px
- Layer 1 (near): `radiusX` 40–70 px, `radiusY` 20–35 px

---

## 6. Particle Trail

### Emission

Emit from Ghosty's trailing edge (left-centre of sprite) every frame during `PLAYING`:

```js
function particlesEmit(x, y) {
  for (let i = 0; i < C.PARTICLE_COUNT; i++) {
    const p = particlePool[particleHead % PARTICLE_POOL_SIZE];
    p.x = x;
    p.y = y + (Math.random() - 0.5) * C.GHOSTY_H * 0.5;
    p.vx = -(Math.random() * 40 + 20);  // leftward drift
    p.vy = (Math.random() - 0.5) * 30;  // slight vertical spread
    p.life = p.maxLife = C.PARTICLE_LIFESPAN;
    particleHead++;
  }
}

// Call site in ghostyUpdate:
particlesEmit(ghosty.x, ghosty.y + C.GHOSTY_H / 2);
```

### Drawing

One `ctx.save/restore` wraps the entire particle pass — not per particle:

```js
function particlesDraw(ctx) {
  ctx.save();
  ctx.fillStyle = C.COLOUR_PARTICLE;
  for (const p of particlePool) {
    if (p.life <= 0) continue;
    ctx.globalAlpha = (p.life / p.maxLife) * 0.8; // fade out, max 80% opacity
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
```

---

## 7. Screen Shake

Applied as a `ctx.translate` inside a `ctx.save/restore` wrapping the world (not the HUD):

```js
function effectsApplyShake(ctx) {
  if (shakeTimer <= 0) return;
  const mag = C.SHAKE_MAGNITUDE * (shakeTimer / C.SHAKE_DURATION_MS); // linear decay
  ctx.translate(
    (Math.random() * 2 - 1) * mag,
    (Math.random() * 2 - 1) * mag
  );
}
```

Trigger on collision:
```js
function effectsTriggerShake() {
  shakeTimer = C.SHAKE_DURATION_MS;
}
```

---

## 8. Canvas Button Rendering

Buttons are drawn on the canvas — no DOM elements. Consistent style across all buttons:

```js
function drawButton(ctx, btn, label, style) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(btn.x + 2, btn.y + 2, btn.w, btn.h);

  // Fill
  ctx.fillStyle = style.fill;
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);

  // Border
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

  // Label
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${style.fontSize}px "${C.FONT_FAMILY}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
}
```

Button definitions (positions match `ui-mockups.md`):

```js
const PLAY_BTN         = { x: 140, y: 320, w: 200, h: 48 };
const HIGH_SCORES_BTN  = { x: 140, y: 388, w: 200, h: 48 };
const RESTART_BTN      = { x: 140, y: 370, w: 200, h: 48 };
const MAIN_MENU_BTN    = { x: 140, y: 438, w: 200, h: 48 };
const CLOSE_BTN        = { x: 160, y: 340, w: 160, h: 40 };

const BTN_STYLE_PRIMARY   = { fill: '#4CAF50', border: '#2E7D32', fontSize: 16 };
const BTN_STYLE_SECONDARY = { fill: '#37474F', border: '#546E7A', fontSize: 14 };
```

---

## 9. Typography

All text uses the retro font loaded via `@font-face` or Google Fonts. Set `ctx.font` once per text group, not per call:

```js
// Title
ctx.font = `28px "${C.FONT_FAMILY}"`;
ctx.textAlign = 'center';
ctx.fillStyle = '#FFFFFF';
// Drop shadow
ctx.fillStyle = 'rgba(0,0,0,0.5)';
ctx.fillText('FLAPPY KIRO', C.CANVAS_W / 2 + 2, 162);
ctx.fillStyle = '#FFFFFF';
ctx.fillText('FLAPPY KIRO', C.CANVAS_W / 2, 160);

// Score HUD
ctx.font = `18px "${C.FONT_FAMILY}"`;
ctx.textAlign = 'right';
ctx.fillStyle = '#FFFFFF';
ctx.fillText(`SCORE: ${score}`, C.CANVAS_W - 20, 24);
```

Font size reference:

| Element | Size |
|---|---|
| Game title | 28 px |
| Game Over title | 24 px |
| Score / High Score | 18 px |
| Button labels | 14–16 px |
| Sub-prompts | 14 px |
| Score popup "+1" | 16 px |
| Notes / hints | 12 px |

---

## 10. HiDPI and Pixel-Perfect Rendering

```js
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = C.CANVAS_W * dpr;
  canvas.height = C.CANVAS_H * dpr;
  canvas.style.width  = C.CANVAS_W + 'px';
  canvas.style.height = C.CANVAS_H + 'px';
  ctx.scale(dpr, dpr);
  // Re-apply font after scale (ctx state is reset on resize)
  ctx.imageSmoothingEnabled = false; // keep pixel art crisp
}
```

Set `ctx.imageSmoothingEnabled = false` after every canvas resize to prevent browser interpolation blurring the sprite.

---

## 11. Ground Strip

```js
function drawGround(ctx) {
  const groundY = C.CANVAS_H - C.GROUND_HEIGHT;
  // Body
  ctx.fillStyle = C.COLOUR_GROUND;
  ctx.fillRect(0, groundY, C.CANVAS_W, C.GROUND_HEIGHT);
  // Top edge highlight
  ctx.fillStyle = C.COLOUR_GROUND_TOP;
  ctx.fillRect(0, groundY, C.CANVAS_W, 4);
}
```

Add to CONFIG: `GROUND_HEIGHT: 32`.
