# UI Mockups — Flappy Kiro

All screens render on a **480 × 640 px** canvas, centred in the browser viewport and scaled to fit smaller screens. Font is a pixel/retro style (e.g. "Press Start 2P" from Google Fonts). All coordinates are in logical canvas pixels.

---

## Screen 1 — Main Menu (`MENU` state)

```
┌─────────────────────────────────────┐  y=0
│                                     │
│         [clouds scrolling]          │  y=80
│                                     │
│        ╔═══════════════════╗        │
│        ║   FLAPPY KIRO     ║        │  y=160  title, 28px, white, shadow
│        ╚═══════════════════╝        │
│                                     │
│           👻  [ghosty]              │  y=240  idle animation, centred
│                                     │
│   ┌─────────────────────────────┐   │
│   │          ▶  PLAY            │   │  y=320  button, 200×48px, green fill
│   └─────────────────────────────┘   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │       🏆  HIGH SCORES       │   │  y=388  button, 200×48px, dark fill
│   └─────────────────────────────┘   │
│                                     │
│        BEST: 42                     │  y=480  14px, yellow, centred
│                                     │
│   [ground strip]                    │  y=608
└─────────────────────────────────────┘  y=640
```

### Element Specifications

| Element | Position (x, y) | Size | Style |
|---|---|---|---|
| Title "FLAPPY KIRO" | centre, y=160 | 28 px font | White, 2 px dark drop shadow |
| Ghosty idle sprite | centre, y=240 | 40×40 px | Animated (idle frames 0–2) |
| PLAY button | centre, y=320 | 200×48 px | Fill `#4CAF50`, border `#2E7D32` 2px, text white 16px |
| HIGH SCORES button | centre, y=388 | 200×48 px | Fill `#37474F`, border `#546E7A` 2px, text white 14px |
| "BEST: {n}" | centre, y=480 | 14 px font | Yellow `#FFD700` |
| Ground strip | full width, y=608 | 32 px tall | Retro green/brown |

### Interactions

- **PLAY button click/tap** → transition to `PLAYING` state (same as Space key)
- **HIGH SCORES button click/tap** → open High Scores overlay (see Screen 5)
- **Space key** → same as PLAY button (existing behaviour preserved)
- Button hover state: lighten fill by 15%, cursor `pointer`
- Button active/press state: darken fill by 10%, translate y+2px

---

## Screen 2 — In-Game HUD (`PLAYING` state)

```
┌─────────────────────────────────────┐  y=0
│  [P] PAUSE          SCORE: 7        │  y=24   HUD bar
│─────────────────────────────────────│
│                                     │
│         [clouds scrolling]          │
│                                     │
│    ║          ║                     │  pipes
│    ║          ║                     │
│    ║          ║                     │
│              GAP
│    ║          ║                     │
│    ║    👻    ║                     │  ghosty
│    ║          ║                     │
│                                     │
│                          +1         │  score popup (fades up)
│                                     │
│   [ground strip]                    │  y=608
└─────────────────────────────────────┘  y=640
```

### Element Specifications

| Element | Position (x, y) | Size | Style |
|---|---|---|---|
| Score "SCORE: {n}" | right-aligned, x=460, y=24 | 18 px font | White, 1 px dark shadow |
| Pause button "[P]" | left-aligned, x=20, y=24 | 14 px font | White, semi-transparent |
| Score popup "+1" | at pipe gap x, animates up | 16 px font | Yellow `#FFD700`, fades out over 600 ms |
| Particle trail | behind Ghosty | 3 px dots | Semi-transparent white/light blue |

### Interactions

- **[P] text / Escape / P key** → transition to `PAUSED` state
- Score updates in real time each time a pipe is cleared
- "+1" popup spawns at the pipe gap position and drifts upward 30 px over 600 ms while fading to alpha 0

---

## Screen 3 — Pause Overlay (`PAUSED` state)

```
┌─────────────────────────────────────┐
│                                     │
│   [frozen game frame underneath]    │
│                                     │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │  semi-transparent dark overlay
│   ░                               ░ │  rgba(0,0,0,0.55)
│   ░         ⏸  PAUSED             ░ │  y=280  24px, white
│   ░                               ░ │
│   ░   Press P or Esc to Resume    ░ │  y=330  14px, light grey
│   ░                               ░ │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│                                     │
└─────────────────────────────────────┘
```

### Element Specifications

| Element | Position (x, y) | Size | Style |
|---|---|---|---|
| Dark overlay | 0, 0 | 480×640 px | `rgba(0,0,0,0.55)` |
| "PAUSED" | centre, y=280 | 24 px font | White |
| Resume prompt | centre, y=330 | 14 px font | `#B0BEC5` light grey |

### Interactions

- **P / Escape key** → resume to `PLAYING`
- No buttons — keyboard/tap only (game is already in progress)

---

## Screen 4 — Game Over (`GAME_OVER` state)

```
┌─────────────────────────────────────┐
│                                     │
│         [clouds still scroll]       │
│                                     │
│        ╔═══════════════════╗        │
│        ║    GAME  OVER     ║        │  y=160  24px, red #EF5350, shadow
│        ╚═══════════════════╝        │
│                                     │
│           SCORE    42               │  y=240  18px, white
│           BEST     99               │  y=270  18px, yellow if new best
│                                     │
│        ✨ NEW BEST! ✨               │  y=310  16px, gold — only if new best
│                                     │
│   ┌─────────────────────────────┐   │
│   │        🔄  RESTART          │   │  y=370  button, 200×48px, green fill
│   └─────────────────────────────┘   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │        🏠  MAIN MENU        │   │  y=438  button, 200×48px, dark fill
│   └─────────────────────────────┘   │
│                                     │
│   [ground strip]                    │  y=608
└─────────────────────────────────────┘
```

### Element Specifications

| Element | Position (x, y) | Size | Style |
|---|---|---|---|
| "GAME OVER" | centre, y=160 | 24 px font | Red `#EF5350`, 2 px dark shadow |
| "SCORE {n}" | centre, y=240 | 18 px font | White |
| "BEST {n}" | centre, y=270 | 18 px font | Yellow `#FFD700` if new best, white otherwise |
| "✨ NEW BEST! ✨" | centre, y=310 | 16 px font | Gold `#FFC107` — only shown if new best |
| RESTART button | centre, y=370 | 200×48 px | Fill `#4CAF50`, border `#2E7D32` 2px, text white 16px |
| MAIN MENU button | centre, y=438 | 200×48 px | Fill `#37474F`, border `#546E7A` 2px, text white 14px |
| Ground strip | full width, y=608 | 32 px tall | Retro green/brown |

### Interactions

- **RESTART button click/tap** → reset all state, transition to `PLAYING`
- **MAIN MENU button click/tap** → transition to `MENU` state
- **Space key** → same as RESTART (existing behaviour preserved)
- Clouds continue scrolling in the background

---

## Screen 5 — High Scores Overlay (from MENU)

```
┌─────────────────────────────────────┐
│                                     │
│   [main menu underneath, dimmed]    │
│                                     │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│   ░                               ░ │
│   ░       🏆 HIGH SCORES          ░ │  y=180  20px, yellow
│   ░  ─────────────────────────── ░ │
│   ░   1.  99                      ░ │  y=230  session best
│   ░   (no persistent leaderboard) ░ │  y=260  14px, grey note
│   ░                               ░ │
│   ░   ┌───────────────────────┐   ░ │
│   ░   │        CLOSE          │   ░ │  y=340  button, 160×40px
│   ░   └───────────────────────┘   ░ │
│   ░                               ░ │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│                                     │
└─────────────────────────────────────┘
```

### Element Specifications

| Element | Position (x, y) | Size | Style |
|---|---|---|---|
| Dark overlay | 0, 0 | 480×640 px | `rgba(0,0,0,0.65)` |
| "HIGH SCORES" | centre, y=180 | 20 px font | Yellow `#FFD700` |
| Best score row | centre, y=230 | 16 px font | White |
| Note text | centre, y=260 | 12 px font | `#78909C` grey |
| CLOSE button | centre, y=340 | 160×40 px | Fill `#37474F`, text white 14px |

### Interactions

- **CLOSE button / Escape key** → dismiss overlay, return to `MENU`
- Only the persistent high score is shown (single entry — no full leaderboard in this version)

---

## Button Hit Detection

Buttons are rendered on the canvas (not DOM elements). Hit detection uses AABB point-in-rect testing on `click` and `touchstart` events:

```js
function isPointInButton(px, py, btn) {
  return px >= btn.x && px <= btn.x + btn.w &&
         py >= btn.y && py <= btn.y + btn.h;
}
```

Canvas pointer coordinates must be scaled from CSS pixels to logical canvas pixels:

```js
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = C.CANVAS_W / rect.width;
  const scaleY = C.CANVAS_H / rect.height;
  const lx = (e.clientX - rect.left) * scaleX;
  const ly = (e.clientY - rect.top)  * scaleY;
  handleClick(lx, ly);
});
```

---

## Colour Palette Reference

| Role | Hex | Usage |
|---|---|---|
| Primary text | `#FFFFFF` | Most labels |
| Title / accent | `#FFD700` | High score, best label |
| Danger | `#EF5350` | Game Over title |
| Success / CTA | `#4CAF50` | Play, Restart buttons |
| Neutral dark | `#37474F` | Secondary buttons, overlays |
| Overlay bg | `rgba(0,0,0,0.55)` | Pause / High Scores dim |
| Score popup | `#FFD700` | "+1" animation |
| Prompt text | `#B0BEC5` | Sub-prompts, hints |
