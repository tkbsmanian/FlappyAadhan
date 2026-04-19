# Audio Assets Specification

## Overview

Flappy Kiro uses three in-game sound effects and one procedural background music track. Two effects are pre-recorded `.wav` files loaded at startup; the score sound is synthesised at runtime via the Web Audio API. All volumes are independently tunable via the `CONFIG` block.

---

## Sound Effects

### 1. Flap Sound — `assets/jump.wav`

| Property | Value |
|---|---|
| File | `assets/jump.wav` |
| Duration | 0.1 s |
| Character | Short whoosh — a quick upward sweep suggesting a burst of air |
| Frequency sweep | ~800 Hz → 1 200 Hz (rising) |
| Envelope | Instant attack, fast decay (no sustain, no release tail) |
| Volume constant | `C.VOL_JUMP` (default 0.4) |
| Playback | One-shot; retriggerable — a new instance plays on every flap, overlapping if needed |
| Retrigger behaviour | Each flap spawns a new `AudioBufferSourceNode`; no cancellation of previous instance |

**Web Audio synthesis recipe** (fallback if `.wav` fails to load):
```js
function synthFlap(ctx, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}
```

---

### 2. Score Sound — synthesised (no file)

| Property | Value |
|---|---|
| File | None — generated via Web Audio API |
| Duration | 0.2 s |
| Character | Pleasant chime — a bright, clean tone that rewards the player without being intrusive |
| Waveform | Sine |
| Frequency | 1 046 Hz (C6 — bright, celebratory) |
| Envelope | Fast attack (5 ms), short sustain, smooth decay to silence at 0.2 s |
| Volume constant | `C.VOL_SCORE_BEEP` (default 0.3) |
| Playback | One-shot per point scored |

**Web Audio synthesis recipe:**
```js
function synthScoreBeep(ctx, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1046, ctx.currentTime);
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005); // fast attack
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2); // decay
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}
```

---

### 3. Collision Sound — `assets/game_over.wav`

| Property | Value |
|---|---|
| File | `assets/game_over.wav` |
| Duration | 0.3 s |
| Character | Soft thud — a low, muffled impact that feels weighty but not harsh |
| Frequency range | Low-mid (100–400 Hz), no sharp high-frequency content |
| Envelope | Fast attack, medium decay, no sustain tail beyond 0.3 s |
| Volume constant | `C.VOL_GAME_OVER` (default 0.6) |
| Playback | One-shot; triggered once per collision (Invincibility Frames prevent re-trigger) |

**Web Audio synthesis recipe** (fallback if `.wav` fails to load):
```js
function synthCollision(ctx, vol) {
  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // White noise shaped by exponential decay
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, ctx.currentTime);
  source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  source.start(ctx.currentTime);
}
```

---

## Background Music

| Property | Value |
|---|---|
| File | None — generated procedurally via Web Audio API |
| Duration | Loops indefinitely |
| Character | Upbeat retro chiptune — simple repeating melody, 8-bit aesthetic |
| Waveform | Square wave (chiptune feel) |
| Tempo | ~120 BPM |
| Key | C major |
| Volume constant | `C.VOL_MUSIC` (default 0.15) |
| Playback | Starts on `PLAYING` state entry; pauses on `PAUSED`; stops on `GAME_OVER` / `MENU` |

**Note sequence** (repeating 8-bar loop, note durations in seconds at 120 BPM, one beat = 0.5 s):

| Step | Note | Freq (Hz) | Duration (s) |
|---|---|---|---|
| 1 | C5 | 523 | 0.25 |
| 2 | E5 | 659 | 0.25 |
| 3 | G5 | 784 | 0.25 |
| 4 | E5 | 659 | 0.25 |
| 5 | C5 | 523 | 0.25 |
| 6 | G4 | 392 | 0.5  |
| 7 | A4 | 440 | 0.25 |
| 8 | C5 | 523 | 0.25 |
| 9 | E5 | 659 | 0.5  |
| 10 | D5 | 587 | 0.25 |
| 11 | C5 | 523 | 0.25 |
| 12 | G4 | 392 | 0.5  |

Total loop duration: **3.5 s** — loops seamlessly.

**Web Audio scheduling recipe:**
```js
function scheduleMusicLoop(ctx, gainNode, startTime) {
  const notes = [
    [523, 0.25], [659, 0.25], [784, 0.25], [659, 0.25],
    [523, 0.25], [392, 0.5],  [440, 0.25], [523, 0.25],
    [659, 0.5],  [587, 0.25], [523, 0.25], [392, 0.5],
  ];
  let t = startTime;
  for (const [freq, dur] of notes) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(gainNode);
    osc.start(t);
    osc.stop(t + dur * 0.9); // slight gap between notes for articulation
    t += dur;
  }
  return t; // returns end time so caller can schedule next loop
}
```

---

## Asset Loading

```js
async function loadAudioBuffer(ctx, url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.warn(`[AudioManager] Failed to load ${url} — using synthesis fallback`);
    return null; // callers check for null and use synth fallback
  }
}
```

| Asset | Loaded as | Fallback |
|---|---|---|
| `assets/jump.wav` | `AudioBuffer` | `synthFlap()` |
| `assets/game_over.wav` | `AudioBuffer` | `synthCollision()` |
| Score beep | Synthesised always | N/A |
| Background music | Synthesised always | N/A |

---

## Volume Tuning Reference

All volumes are in the range `[0.0, 1.0]`. Override via URL: `?VOL_JUMP=0.8&VOL_MUSIC=0`.

| Constant | Default | Effect |
|---|---|---|
| `VOL_JUMP` | 0.4 | Flap whoosh |
| `VOL_SCORE_BEEP` | 0.3 | Score chime |
| `VOL_GAME_OVER` | 0.6 | Collision thud |
| `VOL_MUSIC` | 0.15 | Background music (kept low to avoid masking SFX) |
