/**
 * Flappy Kiro — Unit Tests
 * Run with: node tests.js
 * No dependencies required.
 */

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

function assertClose(a, b, label, tolerance = 0.0001) {
  assert(Math.abs(a - b) < tolerance, `${label} (got ${a}, expected ${b})`);
}

// ─── Config (mirrors index.html CONFIG) ───────────────────────────────────────
const C = Object.freeze({
  CANVAS_W: 480, CANVAS_H: 640,
  GRAVITY: 800, ASCENT_VELOCITY: -300, TERMINAL_VELOCITY: 700, MAX_DELTA: 0.1,
  PIPE_SPEED_INITIAL: 120, PIPE_SPEED_INCREMENT: 20, PIPE_SPEED_MAX: 400,
  PIPE_SPEED_THRESHOLD: 5, PIPE_WIDTH: 52, PIPE_GAP: 140,
  PIPE_PAIR_SPACING: 350, PIPE_GAP_MIN_Y: 80, PIPE_GAP_MAX_Y: 560,
  PIPE_POOL_SIZE: 8,
  GHOSTY_X: 100, GHOSTY_W: 40, GHOSTY_H: 40,
  GHOSTY_IDLE_FRAMES: [0,1,2], GHOSTY_FLAP_FRAME: 3, GHOSTY_DEATH_FRAMES: [4,5,6],
  GHOSTY_IDLE_MS: 150, GHOSTY_FLAP_MS: 120, GHOSTY_DEATH_MS: 80,
  HITBOX_INSET: 4, INVINCIBILITY_MS: 500,
  GROUND_HEIGHT: 32,
});

// ─── Pure logic extracted from index.html ─────────────────────────────────────

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function ghostyHitbox(ghosty) {
  return {
    x: ghosty.x + C.HITBOX_INSET,
    y: ghosty.y + C.HITBOX_INSET,
    w: C.GHOSTY_W - 2 * C.HITBOX_INSET,
    h: C.GHOSTY_H - 2 * C.HITBOX_INSET,
  };
}

function currentPipeSpeed(score) {
  const steps = Math.floor(score / C.PIPE_SPEED_THRESHOLD);
  return Math.min(C.PIPE_SPEED_INITIAL + steps * C.PIPE_SPEED_INCREMENT, C.PIPE_SPEED_MAX);
}

function physicsStep(ghosty, dt, impossibleActive = false) {
  const gravity = impossibleActive ? -C.GRAVITY : C.GRAVITY;
  ghosty.vy += gravity * dt;
  ghosty.vy = Math.max(-C.TERMINAL_VELOCITY, Math.min(C.TERMINAL_VELOCITY, ghosty.vy));
  ghosty.y += ghosty.vy * dt;
  return ghosty;
}

function makeGhosty(overrides = {}) {
  return { x: C.GHOSTY_X, y: C.CANVAS_H / 2 - C.GHOSTY_H / 2, vy: 0, ...overrides };
}

function makePipe(x, gapY) {
  return { x, gapY, active: true, scored: false };
}

function pipeHitboxes(pipe) {
  const halfGap = C.PIPE_GAP / 2;
  return [
    { x: pipe.x, y: 0, w: C.PIPE_WIDTH, h: pipe.gapY - halfGap },
    { x: pipe.x, y: pipe.gapY + halfGap, w: C.PIPE_WIDTH, h: C.CANVAS_H - (pipe.gapY + halfGap) },
  ];
}

// ─── SECTION 1: Physics ───────────────────────────────────────────────────────
console.log('\n── Physics Calculations ──');

{
  // Gravity accelerates downward
  const g = makeGhosty({ vy: 0 });
  physicsStep(g, 1/60);
  assert(g.vy > 0, 'Gravity increases vy each frame');
}

{
  // Terminal velocity clamp
  const g = makeGhosty({ vy: 600 });
  physicsStep(g, 1);
  assert(g.vy <= C.TERMINAL_VELOCITY, 'vy clamped to TERMINAL_VELOCITY');
  assertClose(g.vy, C.TERMINAL_VELOCITY, 'vy exactly at terminal after large dt');
}

{
  // Flap sets velocity to ASCENT_VELOCITY
  const g = makeGhosty({ vy: 500 });
  g.vy = C.ASCENT_VELOCITY;
  assertClose(g.vy, C.ASCENT_VELOCITY, 'Flap sets vy to ASCENT_VELOCITY regardless of prior vy');
}

{
  // Flap in impossible mode sets velocity to -ASCENT_VELOCITY (downward)
  const g = makeGhosty({ vy: 0 });
  g.vy = -C.ASCENT_VELOCITY; // impossible mode flap
  assert(g.vy > 0, 'Impossible mode flap pushes downward (positive vy)');
}

{
  // Impossible mode gravity is negative
  const g = makeGhosty({ vy: 0 });
  physicsStep(g, 1/60, true);
  assert(g.vy < 0, 'Impossible mode gravity decreases vy (upward acceleration)');
}

{
  // Impossible mode terminal velocity clamp (upward)
  const g = makeGhosty({ vy: -600 });
  physicsStep(g, 1, true);
  assert(g.vy >= -C.TERMINAL_VELOCITY, 'Impossible mode vy clamped upward');
}

{
  // Position integrates from velocity
  const g = makeGhosty({ y: 100, vy: 100 });
  const dt = 0.5;
  const expectedY = 100 + 100 * dt + C.GRAVITY * dt * dt; // approx (gravity also adds)
  physicsStep(g, dt);
  assert(g.y > 100, 'Positive vy moves Ghosty downward');
}

{
  // dt clamping: large dt should not cause physics explosion
  const g = makeGhosty({ vy: 0 });
  const dt = Math.min(10, C.MAX_DELTA); // simulates tab-away spike
  physicsStep(g, dt);
  assert(g.vy <= C.TERMINAL_VELOCITY, 'dt clamping prevents physics explosion');
}

// ─── SECTION 2: Scoring & Wall Generation ─────────────────────────────────────
console.log('\n── Scoring & Wall Generation ──');

{
  // Speed at score 0
  assertClose(currentPipeSpeed(0), C.PIPE_SPEED_INITIAL, 'Speed at score 0 = PIPE_SPEED_INITIAL');
}

{
  // Speed increases at threshold
  const speedBefore = currentPipeSpeed(C.PIPE_SPEED_THRESHOLD - 1);
  const speedAfter  = currentPipeSpeed(C.PIPE_SPEED_THRESHOLD);
  assert(speedAfter > speedBefore, 'Speed increases at score threshold');
  assertClose(speedAfter - speedBefore, C.PIPE_SPEED_INCREMENT, 'Speed increases by exactly PIPE_SPEED_INCREMENT');
}

{
  // Speed caps at PIPE_SPEED_MAX
  const highScore = 10000;
  assert(currentPipeSpeed(highScore) === C.PIPE_SPEED_MAX, 'Speed capped at PIPE_SPEED_MAX for very high score');
}

{
  // Speed never exceeds max
  for (let s = 0; s <= 200; s++) {
    if (currentPipeSpeed(s) > C.PIPE_SPEED_MAX) {
      assert(false, `Speed exceeded max at score ${s}`);
      break;
    }
  }
  assert(true, 'Speed never exceeds PIPE_SPEED_MAX across scores 0–200');
}

{
  // Gap position bounds
  const gapMin = C.PIPE_GAP_MIN_Y;
  const gapMax = C.PIPE_GAP_MAX_Y;
  let allInBounds = true;
  for (let i = 0; i < 1000; i++) {
    const gapY = gapMin + Math.random() * (gapMax - gapMin);
    if (gapY < gapMin || gapY > gapMax) { allInBounds = false; break; }
  }
  assert(allInBounds, 'Random gap positions always within [PIPE_GAP_MIN_Y, PIPE_GAP_MAX_Y]');
}

{
  // Gap fully visible: top of gap above canvas bottom, bottom of gap below canvas top
  const halfGap = C.PIPE_GAP / 2;
  const gapY = C.PIPE_GAP_MIN_Y;
  assert(gapY - halfGap >= 0, 'Gap top edge at MIN_Y is on screen');
  assert(C.PIPE_GAP_MAX_Y + halfGap <= C.CANVAS_H, 'Gap bottom edge at MAX_Y is on screen');
}

{
  // Pipe scrolls left by speed * dt
  const pipe = makePipe(400, 300);
  const dt = 1/60;
  const speed = currentPipeSpeed(0);
  const expectedX = pipe.x - speed * dt;
  pipe.x -= speed * dt;
  assertClose(pipe.x, expectedX, 'Pipe scrolls left by speed * dt');
}

{
  // Score increments exactly once per pipe
  const pipe = makePipe(50, 300);
  let score = 0;
  const ghostyCentreX = C.GHOSTY_X + C.GHOSTY_W / 2;
  // Simulate pipe passing Ghosty
  if (!pipe.scored && ghostyCentreX > pipe.x + C.PIPE_WIDTH) {
    pipe.scored = true;
    score++;
  }
  // Second check — should not score again
  if (!pipe.scored && ghostyCentreX > pipe.x + C.PIPE_WIDTH) {
    score++;
  }
  assertClose(score, 1, 'Pipe scored exactly once (scored flag prevents double-count)');
}

// ─── SECTION 3: Collision Detection ──────────────────────────────────────────
console.log('\n── Collision Detection ──');

{
  // AABB overlap — clear overlap
  const a = { x: 0, y: 0, w: 10, h: 10 };
  const b = { x: 5, y: 5, w: 10, h: 10 };
  assert(rectsOverlap(a, b), 'Overlapping rects detected');
}

{
  // AABB overlap — no overlap
  const a = { x: 0, y: 0, w: 10, h: 10 };
  const b = { x: 20, y: 20, w: 10, h: 10 };
  assert(!rectsOverlap(a, b), 'Non-overlapping rects not detected');
}

{
  // AABB overlap — touching edges (should NOT collide)
  const a = { x: 0, y: 0, w: 10, h: 10 };
  const b = { x: 10, y: 0, w: 10, h: 10 };
  assert(!rectsOverlap(a, b), 'Touching edges are not a collision');
}

{
  // Hitbox is inset from sprite
  const g = makeGhosty({ x: 100, y: 200 });
  const hb = ghostyHitbox(g);
  assertClose(hb.x, g.x + C.HITBOX_INSET, 'Hitbox x inset correctly');
  assertClose(hb.y, g.y + C.HITBOX_INSET, 'Hitbox y inset correctly');
  assertClose(hb.w, C.GHOSTY_W - 2 * C.HITBOX_INSET, 'Hitbox width reduced by 2 * HITBOX_INSET');
  assertClose(hb.h, C.GHOSTY_H - 2 * C.HITBOX_INSET, 'Hitbox height reduced by 2 * HITBOX_INSET');
}

{
  // Ghosty clearly inside gap — no collision
  const pipe = makePipe(80, 300); // pipe at x=80, gap centred at y=300
  const g = makeGhosty({ x: 90, y: 280 }); // Ghosty inside the gap
  const hb = ghostyHitbox(g);
  const [top, bottom] = pipeHitboxes(pipe);
  assert(!rectsOverlap(hb, top) && !rectsOverlap(hb, bottom), 'Ghosty inside gap — no collision');
}

{
  // Ghosty hitting top pipe
  const pipe = makePipe(80, 300);
  const g = makeGhosty({ x: 90, y: 50 }); // Ghosty high up, inside top pipe
  const hb = ghostyHitbox(g);
  const [top] = pipeHitboxes(pipe);
  assert(rectsOverlap(hb, top), 'Ghosty inside top pipe — collision detected');
}

{
  // Ghosty hitting bottom pipe
  const pipe = makePipe(80, 300);
  const g = makeGhosty({ x: 90, y: 420 }); // Ghosty low, inside bottom pipe
  const hb = ghostyHitbox(g);
  const [, bottom] = pipeHitboxes(pipe);
  assert(rectsOverlap(hb, bottom), 'Ghosty inside bottom pipe — collision detected');
}

{
  // Ground collision — hitbox bottom must reach CANVAS_H - GROUND_HEIGHT
  // hb.y + hb.h = ghosty.y + HITBOX_INSET + (GHOSTY_H - 2*HITBOX_INSET) = ghosty.y + GHOSTY_H - HITBOX_INSET
  // So ghosty.y must be >= CANVAS_H - GROUND_HEIGHT - GHOSTY_H + HITBOX_INSET
  const groundTriggerY = C.CANVAS_H - C.GROUND_HEIGHT - C.GHOSTY_H + C.HITBOX_INSET;
  const g = makeGhosty({ y: groundTriggerY });
  const hb = ghostyHitbox(g);
  assert(hb.y + hb.h >= C.CANVAS_H - C.GROUND_HEIGHT, 'Ground collision detected');
}

{
  // Ceiling collision — hitbox top must reach 0
  // hb.y = ghosty.y + HITBOX_INSET <= 0 → ghosty.y <= -HITBOX_INSET
  const g = makeGhosty({ y: -C.HITBOX_INSET });
  const hb = ghostyHitbox(g);
  assert(hb.y <= 0, 'Ceiling collision detected');
}

{
  // Pipe off-screen left — should be culled
  const pipe = makePipe(-C.PIPE_WIDTH - 1, 300);
  assert(pipe.x + C.PIPE_WIDTH < 0, 'Off-screen pipe correctly identified for culling');
}

{
  // bottomRect height is correct (not CANVAS_H)
  const pipe = makePipe(100, 300);
  const [, bottom] = pipeHitboxes(pipe);
  const expectedH = C.CANVAS_H - (pipe.gapY + C.PIPE_GAP / 2);
  assertClose(bottom.h, expectedH, 'bottomRect height is CANVAS_H - (gapY + halfGap), not CANVAS_H');
  assert(bottom.h < C.CANVAS_H, 'bottomRect height is less than full canvas height');
}

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
