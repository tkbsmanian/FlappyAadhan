/**
 * Flappy Aadhan — Scores Lambda
 * Handlers: postScore (POST /scores), getLeaderboard (GET /scores)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE  = process.env.TABLE_NAME;
const PK     = 'GLOBAL';          // single partition — all scores in one leaderboard
const TOP_N  = 10;                 // leaderboard size

// ── Helpers ──────────────────────────────────────────────────────────────────

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function sanitisePlayerId(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, 32);          // max 32 chars
  if (!/^[a-zA-Z0-9_\- ]+$/.test(trimmed)) return null;
  return trimmed;
}

// ── POST /scores ──────────────────────────────────────────────────────────────
export async function postScore(event) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { error: 'Invalid JSON' });
  }

  const { playerId: rawId, score } = body;

  const playerId = sanitisePlayerId(rawId);
  if (!playerId) {
    return response(400, { error: 'playerId must be 1–32 alphanumeric characters' });
  }

  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 9999) {
    return response(400, { error: 'score must be a non-negative integer ≤ 9999' });
  }

  const item = {
    pk:        PK,
    playerId,
    score,
    submittedAt: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90, // 90-day TTL
  };

  await client.send(new PutCommand({
    TableName: TABLE,
    Item: item,
    // Only write if this score is higher than the existing one for this player
    ConditionExpression: 'attribute_not_exists(playerId) OR score < :newScore',
    ExpressionAttributeValues: { ':newScore': score },
  }));

  return response(201, { message: 'Score saved', playerId, score });
}

// ── GET /scores ───────────────────────────────────────────────────────────────
export async function getLeaderboard(event) {
  const limit = Math.min(
    parseInt(event.queryStringParameters?.limit ?? TOP_N, 10) || TOP_N,
    50  // hard cap — never return more than 50
  );

  const result = await client.send(new QueryCommand({
    TableName:              TABLE,
    IndexName:              'score-index',
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': PK },
    ScanIndexForward:       false,   // descending — highest score first
    Limit:                  limit,
    ProjectionExpression:   'playerId, score, submittedAt',
  }));

  return response(200, {
    leaderboard: result.Items ?? [],
    count:       result.Count ?? 0,
  });
}
