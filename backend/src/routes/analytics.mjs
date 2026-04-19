import { Router } from 'express';
import { z } from 'zod';
import { stmts } from '../db.mjs';

export const analyticsRouter = Router();

// Simple API key guard for analytics endpoints
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!process.env.ANALYTICS_API_KEY) return next(); // no key configured — open in dev
  if (key !== process.env.ANALYTICS_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── GET /analytics/overview — 30-day summary ─────────────────────────────────
analyticsRouter.get('/overview', requireApiKey, (req, res) => {
  const overview = stmts.analyticsOverview.get();
  return res.json({ period: '30d', ...overview });
});

// ── GET /analytics/daily — daily breakdown ────────────────────────────────────
analyticsRouter.get('/daily', requireApiKey, (req, res) => {
  const rows = stmts.analyticsDaily.all();
  return res.json({ period: '30d', days: rows });
});

// ── GET /analytics/scores — score distribution ────────────────────────────────
analyticsRouter.get('/scores', requireApiKey, (req, res) => {
  const rows = stmts.analyticsTopPipes.all();
  return res.json({ period: '7d', distribution: rows });
});

// ── GET /analytics/crashes — JS error report ──────────────────────────────────
analyticsRouter.get('/crashes', requireApiKey, (req, res) => {
  const rows = stmts.analyticsCrashes.all();
  return res.json({ period: '7d', crashes: rows });
});

// ── GET /analytics/performance — frame budget metrics ─────────────────────────
analyticsRouter.get('/performance', requireApiKey, (req, res) => {
  const perf   = stmts.analyticsPerf.get();
  const assets = stmts.analyticsAssets.all();
  return res.json({ period: '7d', frameMetrics: perf, assets });
});

// ── GET /analytics/behaviour — collision causes + session depth ───────────────
analyticsRouter.get('/behaviour', requireApiKey, (req, res) => {
  const collisions = stmts.analyticsCollisions.all();
  return res.json({ period: '7d', collisions });
});

// ── POST /analytics/event — ingest a single game event ───────────────────────
const EventSchema = z.object({
  eventType: z.enum(['game_start', 'game_over', 'flap', 'pipe_passed', 'impossible_triggered',
                     'flap_milestone', 'score_milestone', 'laser_fired',
                     'pause', 'resume', 'tab_hidden', 'tab_visible', 'session_end',
                     'perf_sample', 'asset_loaded', 'asset_failed',
                     'js_error', 'unhandled_rejection']),
  playerId:  z.string().max(36).optional(),
  sessionId: z.string().max(64).optional(),
  value:     z.number().int().optional().nullable(),
  meta:      z.record(z.unknown()).optional().nullable(),
  ts:        z.number().optional(),
});

function ingestEvent(raw) {
  const result = EventSchema.safeParse(raw);
  if (!result.success) return false;
  const { eventType, playerId, sessionId, value, meta, ts } = result.data;
  stmts.insertEvent.run({
    eventType,
    playerId:  playerId  ?? null,
    sessionId: sessionId ?? null,
    value:     value     ?? null,
    meta:      meta ? JSON.stringify(meta) : null,
  });
  return true;
}

analyticsRouter.post('/event', (req, res) => {
  const ok = ingestEvent(req.body);
  if (!ok) return res.status(400).json({ error: 'Invalid event' });
  return res.status(202).json({ accepted: true });
});

// ── POST /analytics/batch — ingest multiple events at once ────────────────────
analyticsRouter.post('/batch', (req, res) => {
  const { batch } = req.body ?? {};
  if (!Array.isArray(batch) || batch.length === 0) {
    return res.status(400).json({ error: 'batch must be a non-empty array' });
  }
  if (batch.length > 100) {
    return res.status(400).json({ error: 'batch too large (max 100)' });
  }

  let accepted = 0;
  for (const event of batch) {
    if (ingestEvent(event)) accepted++;
  }

  return res.status(202).json({ accepted, total: batch.length });
});
