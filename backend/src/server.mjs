/**
 * Flappy Aadhan — Express backend
 * Runs on Railway with SQLite persisted to a volume at /data
 */

import express from 'express';
import { scoresRouter }    from './routes/scores.mjs';
import { analyticsRouter } from './routes/analytics.mjs';

const app  = express();
const PORT = process.env.PORT ?? 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));

// CORS — allow the Netlify frontend and localhost dev
const ALLOWED_ORIGINS = new Set([
  'http://localhost:8765',
  'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) ?? []),
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.has(origin) || process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Basic rate limiting — 60 req/min per IP (no external dependency)
const rateLimitMap = new Map();
app.use((req, res, next) => {
  const ip  = req.headers['x-forwarded-for']?.split(',')[0].trim() ?? req.socket.remoteAddress;
  const now = Date.now();
  const win = rateLimitMap.get(ip) ?? { count: 0, reset: now + 60_000 };

  if (now > win.reset) { win.count = 0; win.reset = now + 60_000; }
  win.count++;
  rateLimitMap.set(ip, win);

  if (win.count > 60) {
    return res.status(429).json({ error: 'Too many requests — slow down' });
  }
  next();
});

// Clean up rate limit map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, win] of rateLimitMap) {
    if (now > win.reset) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/scores',    scoresRouter);
app.use('/analytics', analyticsRouter);

// 404 handler
app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));

// Error handler
app.use((err, req, res, _next) => {
  console.error('[server error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Flappy Aadhan backend running on port ${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`   DB path:  ${process.env.RAILWAY_VOLUME_MOUNT_PATH ?? './data'}/flappy.db`);
});
