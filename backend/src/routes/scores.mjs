import { Router } from 'express';
import { z } from 'zod';
import { db, stmts, submitScore } from '../db.mjs';

export const scoresRouter = Router();

// ── Validation schemas ────────────────────────────────────────────────────────
const PostScoreSchema = z.object({
  playerId:   z.string().min(1).max(36).regex(/^[a-zA-Z0-9_\-]+$/),
  playerName: z.string().min(1).max(32).default('Anonymous'),
  score:      z.number().int().min(0).max(9999),
  sessionId:  z.string().max(64).optional(),
});

// ── POST /scores — submit a score ─────────────────────────────────────────────
scoresRouter.post('/', (req, res) => {
  const result = PostScoreSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid payload', details: result.error.flatten() });
  }

  const { playerId, playerName, score, sessionId } = result.data;
  const country = req.headers['x-country'] ?? req.headers['cf-ipcountry'] ?? null;

  submitScore({ playerId, playerName, score, sessionId: sessionId ?? null, country });

  const best = stmts.getPlayerBest.get(playerId);
  const isNewBest = best?.score === score;

  return res.status(201).json({
    message:   'Score saved',
    playerId,
    score,
    isNewBest,
    personalBest: best?.score ?? score,
  });
});

// ── GET /scores — leaderboard ─────────────────────────────────────────────────
scoresRouter.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? '10', 10) || 10, 100);
  const rows  = stmts.getLeaderboard.all(limit);

  return res.json({
    leaderboard: rows.map((r, i) => ({
      rank:       i + 1,
      playerId:   r.player_id,
      playerName: r.player_name,
      score:      r.score,
      achievedAt: r.achieved_at,
    })),
    count: rows.length,
  });
});

// ── GET /scores/:playerId — player profile ────────────────────────────────────
scoresRouter.get('/:playerId', (req, res) => {
  const { playerId } = req.params;
  if (!/^[a-zA-Z0-9_\-]+$/.test(playerId)) {
    return res.status(400).json({ error: 'Invalid playerId' });
  }

  const best    = stmts.getPlayerBest.get(playerId);
  const history = stmts.getPlayerHistory.all(playerId);

  if (!best) return res.status(404).json({ error: 'Player not found' });

  // Rank lookup
  const allBests = stmts.getLeaderboard.all(9999);
  const rank = allBests.findIndex(r => r.player_id === playerId) + 1;

  return res.json({
    playerId,
    personalBest: best.score,
    achievedAt:   best.achieved_at,
    rank:         rank || null,
    history:      history.map(h => ({ score: h.score, submittedAt: h.submitted_at })),
  });
});
