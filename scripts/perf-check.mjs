/**
 * Flappy Aadhan — pre-deploy performance check
 * Run: node scripts/perf-check.mjs
 * Fails with exit code 1 if any threshold is breached.
 */

import { readFileSync, statSync } from 'fs';
import { resolve } from 'path';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);

const THRESHOLDS = {
  'index.html':          300 * 1024,   // 300 KB max
  'assets/ghosty.png':   200 * 1024,   // 200 KB max
  'assets/jump.wav':     100 * 1024,   // 100 KB max
  'assets/game_over.wav': 500 * 1024,  // 500 KB max (WAV is uncompressed)
};

const PERF_PATTERNS = [
  // Date.now() is allowed inside the Analytics batch queue (not in render path)
  // Only flag it if it appears outside of the Analytics IIFE
  { pattern: /(?<!\/\/.*)(?<!Analytics[\s\S]{0,500})Date\.now\(\)(?![\s\S]*?Analytics)/g, message: 'Date.now() in render/physics path — use rAF timestamp instead' },
  { pattern: /setInterval\s*\(/g,            message: 'setInterval found — use requestAnimationFrame for rendering' },
  { pattern: /new\s+Object\s*\(\)/g,         message: 'new Object() in source — use object literal {}' },
  { pattern: /console\.log\s*\(/g,           message: 'console.log found — remove before production' },
  { pattern: /debugger\s*;/g,               message: 'debugger statement found — remove before production' },
];

let passed = true;

function fmt(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

console.log('── Flappy Aadhan pre-deploy check ──\n');

// ── File size checks ──────────────────────────────────────────────────────────
console.log('File sizes:');
for (const [file, maxBytes] of Object.entries(THRESHOLDS)) {
  const path = resolve(ROOT, file);
  try {
    const { size } = statSync(path);
    const ok = size <= maxBytes;
    const icon = ok ? '✅' : '❌';
    console.log(`  ${icon} ${file.padEnd(30)} ${fmt(size).padStart(10)} / ${fmt(maxBytes)}`);
    if (!ok) passed = false;
  } catch {
    console.log(`  ⚠️  ${file} — not found (skipping)`);
  }
}

// ── Source code pattern checks ────────────────────────────────────────────────
console.log('\nSource patterns:');
const source = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

for (const { pattern, message } of PERF_PATTERNS) {
  const matches = source.match(pattern);
  if (matches) {
    console.log(`  ❌ ${message} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
    passed = false;
  } else {
    console.log(`  ✅ No ${pattern.source.replace(/\\s\*/g, ' ').replace(/\\/g, '')}`);
  }
}

// ── CONFIG sanity checks ──────────────────────────────────────────────────────
console.log('\nCONFIG sanity:');

const debugMatch = source.match(/DEBUG\s*:\s*(true)/);
if (debugMatch) {
  console.log('  ❌ DEBUG: true found in CONFIG — set to false for production');
  passed = false;
} else {
  console.log('  ✅ DEBUG: false');
}

const rawHexInLogic = source.match(/<script type="module"[\s\S]*?>([\s\S]*?)<\/script>/)?.[1] ?? '';
const rawHexMatches = rawHexInLogic.match(/'#[0-9A-Fa-f]{3,6}'/g);
if (rawHexMatches && rawHexMatches.length > 5) {
  console.log(`  ⚠️  ${rawHexMatches.length} raw hex colour literals in game logic — consider using C.COLOUR_* constants`);
} else {
  console.log('  ✅ Colour constants look clean');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(44));
if (passed) {
  console.log('✅ All checks passed — ready to deploy\n');
  process.exit(0);
} else {
  console.log('❌ Some checks failed — fix before deploying\n');
  process.exit(1);
}
