# Ghosty Sprite Specification

## Overview

Ghosty is the player-controlled ghost character in Flappy Kiro. All animation is driven by a single horizontal spritesheet (`assets/ghosty.png`). The game selects the appropriate frame based on the current animation state.

---

## Sprite Sheet Layout

- **File:** `assets/ghosty.png`
- **Frame size:** 32 × 32 px
- **Total frames:** 7
- **Sheet dimensions:** 224 × 32 px (7 frames × 32 px wide, 1 row)
- **Format:** PNG with transparency (alpha channel required)

```
┌────────┬────────┬────────┬────────┬────────┬────────┬────────┐
│ Idle 0 │ Idle 1 │ Idle 2 │  Flap  │ Death0 │ Death1 │ Death2 │
│  [0]   │  [1]   │  [2]   │  [3]   │  [4]   │  [5]   │  [6]   │
└────────┴────────┴────────┴────────┴────────┴────────┴────────┘
  0px      32px     64px     96px    128px    160px    192px
```

---

## Animation States

### Idle (frames 0–2)
- **Trigger:** Ghosty is on the start screen, or falling at low downward velocity (vy < TERMINAL_VELOCITY * 0.5)
- **Frames:** 0, 1, 2
- **Loop:** Yes — cycles 0 → 1 → 2 → 0
- **Frame duration:** 150 ms per frame (≈ 6.7 fps)
- **Description:** Gentle bobbing/floating motion. Ghosty's body subtly pulses or wobbles to feel alive while hovering.

### Flap (frame 3)
- **Trigger:** Immediately when the player inputs a flap (Space / tap)
- **Frames:** 3 (single frame, held briefly)
- **Loop:** No — held for 120 ms then returns to Idle or transitions based on vy
- **Frame duration:** 120 ms
- **Description:** Wings/arms spread upward. Conveys the upward impulse visually.

### Death (frames 4–6)
- **Trigger:** When a Collision is detected and Invincibility Frames begin
- **Frames:** 4, 5, 6
- **Loop:** No — plays once through, then holds on frame 6
- **Frame duration:** 80 ms per frame
- **Description:** Ghosty reacts to the hit — eyes widen, body distorts. Plays during the invincibility flash window before Game Over screen appears.

---

## Hitbox

- **Shape:** Circle (used for feel; AABB approximation used in code — see below)
- **Radius:** 12 px
- **Centre:** Sprite centre (16, 16) relative to frame origin
- **AABB approximation:** `{ x: 4, y: 4, w: 24, h: 24 }` — equivalent to `HITBOX_INSET = 4` on a 32 × 32 sprite

> The hitbox is intentionally smaller than the visible sprite to allow forgiving near-misses. The 12 px radius circle is the design intent; the 4 px inset AABB is the runtime implementation.

---

## Rendering Notes

- **Draw size:** Rendered at 40 × 40 px on the canvas (scaled up from 32 × 32 source) — controlled by `C.GHOSTY_W` and `C.GHOSTY_H`
- **Source rect:** `ctx.drawImage(img, frameIndex * 32, 0, 32, 32, ghosty.x, ghosty.y, C.GHOSTY_W, C.GHOSTY_H)`
- **No rotation:** With spritesheet animation, sprite rotation is removed. The flap frame visually communicates ascent; the idle frames communicate descent/float.
- **Flash during death:** During Invincibility Frames, the death animation plays while `flashVisible` toggles the draw call on/off every 80 ms.
- **Fallback:** If `assets/ghosty.png` fails to load, draw a 40 × 40 white rectangle at Ghosty's position.

---

## Animation State Machine

```
         ┌─────────────────────────────┐
         │                             ▼
       IDLE ──── flap input ────► FLAP (120ms)
         ▲                             │
         └──── timer expires ──────────┘
         │
         └──── collision ────────► DEATH (plays once, holds on frame 6)
```

- On game restart, animation resets to IDLE frame 0.
- FLAP → IDLE transition happens automatically after 120 ms regardless of vy.
- DEATH holds on frame 6 until the Game Over screen appears.

---

## CONFIG Values Affected

The following constants in the `CONFIG` block should be updated to match this spec:

| Key | Old Value | New Value | Reason |
|---|---|---|---|
| `GHOSTY_W` | 40 | 40 | Unchanged — render size |
| `GHOSTY_H` | 40 | 40 | Unchanged — render size |
| `GHOSTY_FRAME_W` | — | 32 | Source frame width (new) |
| `GHOSTY_FRAME_H` | — | 32 | Source frame height (new) |
| `GHOSTY_FRAME_COUNT` | — | 7 | Total frames in sheet (new) |
| `GHOSTY_IDLE_FRAMES` | — | [0,1,2] | Idle animation frame indices (new) |
| `GHOSTY_FLAP_FRAME` | — | 3 | Flap frame index (new) |
| `GHOSTY_DEATH_FRAMES` | — | [4,5,6] | Death animation frame indices (new) |
| `GHOSTY_IDLE_MS` | — | 150 | Idle frame duration ms (new) |
| `GHOSTY_FLAP_MS` | — | 120 | Flap hold duration ms (new) |
| `GHOSTY_DEATH_MS` | — | 80 | Death frame duration ms (new) |
| `HITBOX_INSET` | 4 | 4 | Unchanged — matches 12px radius intent |
