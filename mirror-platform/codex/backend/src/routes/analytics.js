import crypto from 'node:crypto';
import express from 'express';
import { verifyAccessToken } from '../auth/tokens.js';
import { query } from '../db/pool.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = express.Router();
const EVENT_TYPES = new Set(['page_view', 'cultivation', 'service_call', 'error']);
const ROOMS = new Set(['garden', 'account', 'research', 'translate', 'atlas', 'localAi', 'moduleGovernance', 'memory', 'braille', 'foundation', 'analytics', 'public', 'profile']);
const SERVICES = new Set(['mirror_runtime', 'codex', 'chromabridge', 'qwen', 'alignment', 'garden_gateway']);
const ENTRANCES = new Set(['combined_shell', 'public_entrance', 'personal_entrance', 'community_api', 'local_ai']);

router.post('/analytics/events', requireRuntimeService, async (req, res, next) => {
  try {
    const values = Array.isArray(req.body?.events) ? req.body.events : [req.body?.event];
    if (!values.length || values.length > 16) throw httpError(400, 'Provide between 1 and 16 analytics events.');
    const userId = await resolveUserId(req.body?.userToken);
    const visitorKey = privateKey(req.body?.visitorToken, 'visitor');
    const sessionKey = privateKey(req.body?.sessionToken, 'session');
    const events = values.map(normalizeAnalyticsEvent);

    for (const event of events) {
      await query(
        `INSERT INTO garden_analytics_events
          (id,event_type,visitor_key,session_key,user_id,room,service,entrance,status_code,duration_ms,success,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          crypto.randomUUID(), event.eventType, visitorKey, sessionKey, userId, event.room,
          event.service, event.entrance, event.statusCode, event.durationMs, event.success,
          JSON.stringify(event.metadata)
        ]
      );
    }

    res.status(201).json({ recorded: events.length, contentStored: false });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/summary', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const [overview, rooms, servicePerformance, errors, feedback, returning, personalGrowth] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (WHERE event_type='page_view')::int AS page_views,
          COUNT(DISTINCT visitor_key) FILTER (WHERE event_type='page_view' AND visitor_key IS NOT NULL)::int AS unique_visitors,
          COUNT(DISTINCT session_key) FILTER (WHERE event_type='page_view' AND session_key IS NOT NULL)::int AS sessions,
          COUNT(*) FILTER (WHERE event_type='cultivation' AND success=TRUE)::int AS successful_cultivations,
          COUNT(*) FILTER (WHERE event_type='cultivation')::int AS cultivation_attempts,
          MIN(created_at) AS telemetry_started_at
        FROM garden_analytics_events
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `),
      query(`
        SELECT room,COUNT(*)::int AS visits
        FROM garden_analytics_events
        WHERE event_type='page_view' AND created_at >= NOW() - INTERVAL '24 hours' AND room IS NOT NULL
        GROUP BY room ORDER BY visits DESC,room ASC
      `),
      query(`
        SELECT service,COUNT(*)::int AS calls,
          ROUND(AVG(duration_ms))::int AS average_ms,
          ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms))::int AS p95_ms,
          MAX(duration_ms)::int AS maximum_ms
        FROM garden_analytics_events
        WHERE event_type='service_call' AND created_at >= NOW() - INTERVAL '24 hours'
          AND service IS NOT NULL AND duration_ms IS NOT NULL
        GROUP BY service ORDER BY service ASC
      `),
      query(`
        SELECT service,status_code,COUNT(*)::int AS count
        FROM garden_analytics_events
        WHERE event_type='error' AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY service,status_code ORDER BY count DESC,service ASC,status_code ASC
      `),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status='proposed')::int AS proposed,
          COUNT(*) FILTER (WHERE status='accepted')::int AS accepted,
          COUNT(*) FILTER (WHERE status='rejected')::int AS rejected
        FROM local_ai_feedback
      `),
      query(`
        WITH visitor_returns AS (
          SELECT visitor_key
          FROM garden_analytics_events
          WHERE event_type='page_view' AND visitor_key IS NOT NULL
          GROUP BY visitor_key HAVING COUNT(DISTINCT session_key) >= 2
        ), account_returns AS (
          SELECT user_id
          FROM garden_analytics_events
          WHERE event_type='page_view' AND user_id IS NOT NULL
          GROUP BY user_id HAVING COUNT(DISTINCT session_key) >= 2
        )
        SELECT
          (SELECT COUNT(*)::int FROM visitor_returns) AS returning_visitors,
          (SELECT COUNT(*)::int FROM account_returns) AS returning_accounts
      `),
      query(`
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE password_hash IS NOT NULL) AS accounts,
          (SELECT COUNT(*)::int FROM users WHERE password_hash IS NOT NULL AND email_verified_at IS NOT NULL) AS verified_accounts,
          (SELECT COUNT(*)::int FROM users WHERE password_hash IS NOT NULL AND created_at >= NOW() - INTERVAL '24 hours') AS new_accounts,
          (SELECT COUNT(*)::int FROM user_graph_relationships WHERE record_status='active') AS active_personal_routes,
          (SELECT COUNT(DISTINCT user_id)::int FROM user_graph_relationships WHERE record_status='active') AS plots_with_routes,
          (SELECT COUNT(*)::int FROM braille_lesson_progress WHERE status='completed') AS completed_lessons
      `)
    ]);

    const activity = overview.rows[0] || {};
    const cultivationByEntrance = await query(`
      SELECT entrance,
        COUNT(*) FILTER (WHERE success=TRUE)::int AS successful,
        COUNT(*)::int AS attempts
      FROM garden_analytics_events
      WHERE event_type='cultivation' AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY entrance ORDER BY entrance ASC
    `);

    res.json({
      version: 'garden-analytics.v1',
      window: { label: 'Last 24 hours', hours: 24, telemetryStartedAt: activity.telemetry_started_at },
      humanActivity: {
        pageViews: activity.page_views || 0,
        uniqueVisitors: activity.unique_visitors || 0,
        sessions: activity.sessions || 0,
        accounts: personalGrowth.rows[0]?.accounts || 0,
        verifiedAccounts: personalGrowth.rows[0]?.verified_accounts || 0,
        newAccounts: personalGrowth.rows[0]?.new_accounts || 0
      },
      cultivations: {
        successful: activity.successful_cultivations || 0,
        attempts: activity.cultivation_attempts || 0,
        successRate: activity.cultivation_attempts ? Number(((activity.successful_cultivations / activity.cultivation_attempts) * 100).toFixed(1)) : 0,
        entrances: cultivationByEntrance.rows
      },
      rooms: rooms.rows,
      servicePerformance: servicePerformance.rows,
      errors: errors.rows,
      feedback: feedback.rows[0] || { proposed: 0, accepted: 0, rejected: 0 },
      returning: returning.rows[0] || { returning_visitors: 0, returning_accounts: 0 },
      personalGrowth: {
        activePersonalRoutes: personalGrowth.rows[0]?.active_personal_routes || 0,
        plotsWithRoutes: personalGrowth.rows[0]?.plots_with_routes || 0,
        completedLessons: personalGrowth.rows[0]?.completed_lessons || 0
      },
      privacy: {
        messageContentStored: false,
        rawIpStored: false,
        userAgentStored: false,
        anonymousIdentifiers: 'keyed hashes of random first-party cookies',
        accountAccess: 'administrator aggregate view only',
        boundary: 'Analytics measures use and system health. They do not become graph evidence, personal traits, or semantic meaning.'
      }
    });
  } catch (error) {
    next(error);
  }
});

export function normalizeAnalyticsEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'analytics event is required.');
  const eventType = String(value.eventType || '');
  if (!EVENT_TYPES.has(eventType)) throw httpError(400, 'Unsupported analytics event type.');
  const room = optionalEnum(value.room, ROOMS, 'room');
  const service = optionalEnum(value.service, SERVICES, 'service');
  const entrance = optionalEnum(value.entrance, ENTRANCES, 'entrance');
  const statusCode = optionalInteger(value.statusCode, 100, 599, 'statusCode');
  const durationMs = optionalInteger(value.durationMs, 0, 3_600_000, 'durationMs');
  const success = typeof value.success === 'boolean' ? value.success : null;
  if (eventType === 'page_view' && !room) throw httpError(400, 'page_view requires a room.');
  if ((eventType === 'service_call' || eventType === 'error') && !service) throw httpError(400, `${eventType} requires a service.`);
  return {
    eventType, room, service, entrance, statusCode, durationMs, success,
    metadata: {
      personalContextConsulted: value.personalContextConsulted === true,
      sourceLayer: ['approved_graph', 'chromabridge_knowledge', 'unresolved'].includes(value.sourceLayer) ? value.sourceLayer : null
    }
  };
}

async function resolveUserId(token) {
  if (typeof token !== 'string' || !token) return null;
  try {
    const payload = verifyAccessToken(token);
    const result = await query('SELECT id,token_version FROM users WHERE id=$1 AND password_hash IS NOT NULL', [payload.sub]);
    if (!result.rows.length || (payload.ver || 1) !== result.rows[0].token_version) return null;
    return result.rows[0].id;
  } catch {
    return null;
  }
}

function privateKey(value, kind) {
  if (typeof value !== 'string' || !/^[a-f0-9-]{20,80}$/i.test(value)) return null;
  const secret = process.env.RUNTIME_SERVICE_TOKEN || '';
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
}

function optionalEnum(value, values, name) {
  if (value == null || value === '') return null;
  const normalized = String(value);
  if (!values.has(normalized)) throw httpError(400, `Unsupported analytics ${name}.`);
  return normalized;
}

function optionalInteger(value, minimum, maximum, name) {
  if (value == null || value === '') return null;
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw httpError(400, `${name} is outside the supported range.`);
  return value;
}

function requireRuntimeService(req, _res, next) {
  const configuredToken = process.env.RUNTIME_SERVICE_TOKEN || '';
  if (!configuredToken) return next(httpError(503, 'Runtime analytics are not configured.'));
  const providedToken = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const provided = Buffer.from(providedToken);
  const configured = Buffer.from(configuredToken);
  if (provided.length !== configured.length || !crypto.timingSafeEqual(provided, configured)) {
    return next(httpError(401, 'Invalid runtime service token.'));
  }
  return next();
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export default router;
