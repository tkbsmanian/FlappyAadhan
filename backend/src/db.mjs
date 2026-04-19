/**
 * SQLite database setup via better-sqlite3.
 * Railway mounts a persistent volume at /data — we store the DB there.
 * Falls back to ./data locally.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? './data';
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, 'flappy.db');
export const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 67108864'); // 64 MB

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id   TEXT    NOT NULL,
    player_name TEXT    NOT NULL DEFAULT 'Anonymous',
    score       INTEGER NOT NULL CHECK(score >= 0 AND score <= 9999),
    submitted_at TEXT   NOT NULL DEFAULT (datetime('now')),
    session_id  TEXT,
    country     TEXT
  );

  -- One best-score row per player (for leaderboard)
  CREATE TABLE IF NOT EXISTS best_scores (
    player_id   TEXT    PRIMARY KEY,
    player_name TEXT    NOT NULL,
    score       INTEGER NOT NULL,
    achieved_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Raw analytics events
  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type  TEXT    NOT NULL,  -- 'game_start' | 'game_over' | 'score' | 'flap'
    player_id   TEXT,
    session_id  TEXT,
    value       INTEGER,           -- score value, flap count, etc.
    meta        TEXT,              -- JSON blob for extra fields
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_scores_player   ON scores(player_id);
  CREATE INDEX IF NOT EXISTS idx_scores_score    ON scores(score DESC);
  CREATE INDEX IF NOT EXISTS idx_events_type     ON events(event_type);
  CREATE INDEX IF NOT EXISTS idx_events_player   ON events(player_id);
  CREATE INDEX IF NOT EXISTS idx_events_created  ON events(created_at);
`);

// ── Prepared statements ───────────────────────────────────────────────────────
export const stmts = {
  insertScore: db.prepare(`
    INSERT INTO scores (player_id, player_name, score, session_id, country)
    VALUES (@playerId, @playerName, @score, @sessionId, @country)
  `),

  upsertBest: db.prepare(`
    INSERT INTO best_scores (player_id, player_name, score, achieved_at)
    VALUES (@playerId, @playerName, @score, datetime('now'))
    ON CONFLICT(player_id) DO UPDATE SET
      player_name = excluded.player_name,
      score       = excluded.score,
      achieved_at = excluded.achieved_at
    WHERE excluded.score > best_scores.score
  `),

  getLeaderboard: db.prepare(`
    SELECT player_id, player_name, score, achieved_at
    FROM   best_scores
    ORDER  BY score DESC
    LIMIT  ?
  `),

  getPlayerBest: db.prepare(`
    SELECT score, achieved_at FROM best_scores WHERE player_id = ?
  `),

  getPlayerHistory: db.prepare(`
    SELECT score, submitted_at FROM scores
    WHERE  player_id = ?
    ORDER  BY submitted_at DESC
    LIMIT  20
  `),

  insertEvent: db.prepare(`
    INSERT INTO events (event_type, player_id, session_id, value, meta)
    VALUES (@eventType, @playerId, @sessionId, @value, @meta)
  `),

  // Analytics queries
  analyticsOverview: db.prepare(`
    SELECT
      COUNT(DISTINCT player_id)                          AS total_players,
      COUNT(*)                                           AS total_games,
      ROUND(AVG(score), 1)                               AS avg_score,
      MAX(score)                                         AS top_score,
      COUNT(CASE WHEN score = 0 THEN 1 END)              AS zero_score_games,
      COUNT(CASE WHEN score >= 10 THEN 1 END)            AS games_10_plus,
      COUNT(CASE WHEN score >= 50 THEN 1 END)            AS games_50_plus
    FROM scores
    WHERE submitted_at >= datetime('now', '-30 days')
  `),

  analyticsDaily: db.prepare(`
    SELECT
      date(submitted_at)  AS day,
      COUNT(*)            AS games,
      COUNT(DISTINCT player_id) AS players,
      ROUND(AVG(score), 1) AS avg_score,
      MAX(score)          AS top_score
    FROM scores
    WHERE submitted_at >= datetime('now', '-30 days')
    GROUP BY date(submitted_at)
    ORDER BY day DESC
    LIMIT 30
  `),

  analyticsTopPipes: db.prepare(`
    SELECT score, COUNT(*) AS frequency
    FROM scores
    WHERE submitted_at >= datetime('now', '-7 days')
    GROUP BY score
    ORDER BY score DESC
    LIMIT 20
  `),

  // Crash / error report
  analyticsCrashes: db.prepare(`
    SELECT
      json_extract(meta, '$.message') AS message,
      json_extract(meta, '$.source')  AS source,
      json_extract(meta, '$.state')   AS game_state,
      COUNT(*)                        AS occurrences,
      MAX(created_at)                 AS last_seen
    FROM events
    WHERE event_type = 'js_error'
      AND created_at >= datetime('now', '-7 days')
    GROUP BY json_extract(meta, '$.message'), json_extract(meta, '$.source')
    ORDER BY occurrences DESC
    LIMIT 20
  `),

  // Performance percentiles (avg frame ms per session)
  analyticsPerf: db.prepare(`
    SELECT
      ROUND(AVG(json_extract(meta, '$.avgFrameMs')), 2)          AS avg_frame_ms,
      ROUND(AVG(json_extract(meta, '$.budgetMissRate')) * 100, 1) AS budget_miss_pct,
      COUNT(*)                                                    AS samples
    FROM events
    WHERE event_type = 'perf_sample'
      AND created_at >= datetime('now', '-7 days')
  `),

  // Asset load times
  analyticsAssets: db.prepare(`
    SELECT
      json_extract(meta, '$.asset') AS asset,
      ROUND(AVG(value), 0)          AS avg_load_ms,
      COUNT(*)                      AS loads,
      SUM(CASE WHEN event_type = 'asset_failed' THEN 1 ELSE 0 END) AS failures
    FROM events
    WHERE event_type IN ('asset_loaded', 'asset_failed')
      AND created_at >= datetime('now', '-7 days')
    GROUP BY json_extract(meta, '$.asset')
  `),

  // Collision cause breakdown
  analyticsCollisions: db.prepare(`
    SELECT
      json_extract(meta, '$.cause') AS cause,
      COUNT(*)                      AS count,
      ROUND(AVG(value), 1)          AS avg_score_at_death
    FROM events
    WHERE event_type = 'game_over'
      AND created_at >= datetime('now', '-7 days')
    GROUP BY json_extract(meta, '$.cause')
  `),
};

// Wrap upsert + insert in a transaction for atomicity
export const submitScore = db.transaction((data) => {
  stmts.insertScore.run(data);
  stmts.upsertBest.run(data);
});
