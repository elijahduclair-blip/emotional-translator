import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_SEED_BODY_BYTES = 64 * 1024;
const DEFAULT_RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;
const entrancePage = readFileSync(join(__dirname, '..', 'public', 'entrance.html'), 'utf8');

export interface GardenPublicGatewayOptions {
  runtimeOrigin?: string;
  rateLimitMax?: number;
  authRateLimitMax?: number;
  trustProxy?: boolean;
}

export function createGardenPublicGateway(options: GardenPublicGatewayOptions = {}) {
  const runtimeOrigin = String(options.runtimeOrigin || 'http://127.0.0.1:3100').replace(/\/$/, '');
  const limitFruit = createFixedWindowRateLimiter({
    maxRequests: options.rateLimitMax || DEFAULT_RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
    trustProxy: options.trustProxy === true
  });
  const limitSession = createFixedWindowRateLimiter({
    maxRequests: options.authRateLimitMax || 5,
    windowMs: RATE_WINDOW_MS,
    trustProxy: options.trustProxy === true
  });

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://garden-entrance.local');
      const path = url.pathname;

      if ((request.method === 'GET' || request.method === 'HEAD') && (path === '/' || path === '/index.html')) {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...securityHeaders() });
        response.end(request.method === 'HEAD' ? undefined : entrancePage);
        return;
      }

      if (request.method === 'GET' && path === '/health') {
        return sendJson(response, 200, { status: 'ready', entrance: 'open', version: 'garden-entrance.v1' });
      }

      if (request.method === 'GET' && path === '/api/v1') {
        return sendJson(response, 200, publicApiIdentity());
      }

      if (request.method === 'GET' && path === '/garden/identity') {
        const result = await runtimeJson(runtimeOrigin, '/garden/identity');
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicIdentity(result.body));
      }

      if (request.method === 'POST' && path === '/garden/fruit') {
        requirePublicEntranceRequest(request);
        limitFruit(request, response);
        const body = await readJson(request);
        const input = typeof body.input === 'string' ? body.input.trim() : '';
        if (!input) return sendJson(response, 400, { error: 'A seed of information is required.' });
        const result = await runtimeJson(runtimeOrigin, '/garden/fruit', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mirror-request': 'same-origin',
            'x-forwarded-for': clientAddress(request, options.trustProxy === true)
          },
          body: JSON.stringify({ input })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicFruit(result.body));
      }

      if (request.method === 'POST' && path === '/api/v1/community/cultivate') {
        requireGardenRequest(request, 'community-api');
        limitFruit(request, response);
        const body = await readJson(request);
        const input = typeof body.input === 'string' ? body.input.trim() : '';
        if (!input) return sendJson(response, 400, { error: 'A seed of information is required.' });
        const result = await runtimeJson(runtimeOrigin, '/api/v1/community/cultivate', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mirror-request': 'same-origin',
            'x-forwarded-for': clientAddress(request, options.trustProxy === true)
          },
          body: JSON.stringify({ input })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicCommunityFruit(result.body));
      }

      if (request.method === 'POST' && path === '/api/v1/me/session') {
        requireGardenRequest(request, 'personal-entrance');
        limitSession(request, response);
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
          body: JSON.stringify(await readJson(request))
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        response.setHeader('set-cookie', secureSessionCookie(result.headers.get('set-cookie')));
        return sendJson(response, 200, publicSession(result.body));
      }

      if (request.method === 'POST' && path === '/api/v1/me/account') {
        requireGardenRequest(request, 'personal-entrance');
        limitSession(request, response);
        const body = await readJson(request);
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/account', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
          body: JSON.stringify({
            username: String(body.username || '').trim().slice(0, 80),
            email: String(body.email || '').trim().slice(0, 254),
            password: String(body.password || '').slice(0, 256)
          })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 202, publicAccountAction(result.body, 'Check your email to verify the account.'));
      }

      if (request.method === 'POST' && path === '/api/v1/me/account/verify') {
        requireGardenRequest(request, 'personal-entrance');
        limitSession(request, response);
        const body = await readJson(request);
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/account/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
          body: JSON.stringify({ token: String(body.token || '').slice(0, 512) })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, { verified: result.body.verified === true, message: 'Email verified. You may sign in.' });
      }

      if (request.method === 'POST' && path === '/api/v1/me/account/resend-verification') {
        requireGardenRequest(request, 'personal-entrance');
        limitSession(request, response);
        const body = await readJson(request);
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/account/resend-verification', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
          body: JSON.stringify({ email: String(body.email || '').trim().slice(0, 254) })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 202, publicAccountAction(result.body, 'If the account can receive this request, an email has been sent.'));
      }

      if (request.method === 'GET' && path === '/api/v1/me/session') {
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/session', {
          headers: { cookie: requirePersonalSession(request) }
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicSession(result.body));
      }

      if (request.method === 'DELETE' && path === '/api/v1/me/session') {
        requireGardenRequest(request, 'personal-entrance');
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/session', {
          method: 'DELETE',
          headers: { 'x-mirror-request': 'same-origin', cookie: requirePersonalSession(request) }
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        response.setHeader('set-cookie', secureSessionCookie(null, true));
        return sendJson(response, 200, { signedOut: true });
      }

      if (request.method === 'POST' && path === '/api/v1/me/cultivate') {
        requireGardenRequest(request, 'personal-entrance');
        limitFruit(request, response);
        const body = await readJson(request);
        const input = typeof body.input === 'string' ? body.input.trim() : '';
        if (!input) return sendJson(response, 400, { error: 'A seed of information is required.' });
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/cultivate', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mirror-request': 'same-origin',
            'x-forwarded-for': clientAddress(request, options.trustProxy === true),
            cookie: requirePersonalSession(request)
          },
          body: JSON.stringify({ input })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicPersonalFruit(result.body));
      }

      if (request.method === 'GET' && path === '/api/v1/me/garden') {
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/garden', {
          headers: { cookie: requirePersonalSession(request) }
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicPersonalGarden(result.body));
      }

      return sendJson(response, 404, { error: 'This path is not part of the public Garden Entrance.' });
    } catch (error) {
      const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 500;
      const message = status >= 500 ? 'The Garden Entrance is temporarily unavailable.' : error instanceof Error ? error.message : 'Request failed.';
      return sendJson(response, status, { error: message });
    }
  });
}

async function runtimeJson(origin: string, path: string, init?: RequestInit) {
  const response = await fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(70_000) });
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  return { status: response.status, body, headers: response.headers };
}

function publicApiIdentity() {
  return {
    version: 'garden-api.v1',
    name: 'Community Garden API',
    entrances: {
      person: {
        session: '/api/v1/me/session',
        createAccount: '/api/v1/me/account',
        verifyAccount: '/api/v1/me/account/verify',
        cultivate: '/api/v1/me/cultivate',
        garden: '/api/v1/me/garden',
        requestHeader: 'x-garden-request: personal-entrance'
      },
      people: {
        cultivate: '/api/v1/community/cultivate',
        requestHeader: 'x-garden-request: community-api'
      }
    },
    boundary: {
      crossPersonAccessAllowed: false,
      personalMemoryAvailableToCommunity: false,
      automaticLearningAllowed: false,
      sharedGraphMutationAllowed: false
    }
  };
}

function publicIdentity(body: Record<string, any>) {
  return {
    version: String(body.version || 'garden-entrance.v1'),
    name: String(body.name || 'Community Garden'),
    kind: String(body.kind || 'public_cultivation_interface'),
    purpose: String(body.purpose || ''),
    cultivationCycle: safeStringList(body.cultivationCycle, 8),
    protectedRoots: safeStringList(body.protectedRoots, 12),
    adaptation: {
      immediate: String(body.adaptation?.immediate || ''),
      personal: String(body.adaptation?.personal || ''),
      shared: String(body.adaptation?.shared || '')
    },
    boundary: {
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      sourceMutationAllowed: false,
      reason: String(body.boundary?.reason || 'Visitors do not receive direct access to protected roots.')
    }
  };
}

function publicFruit(body: Record<string, any>) {
  return {
    version: String(body.version || 'garden-entrance.v1'),
    seed: {
      received: body.seed?.received === true,
      codePointCount: Number(body.seed?.codePointCount || 0)
    },
    fruit: {
      type: 'cultivated_response',
      language: String(body.fruit?.language || 'english'),
      text: String(body.fruit?.text || '')
    },
    cultivation: {
      stages: safeStringList(body.cultivation?.stages, 8),
      graphSource: String(body.cultivation?.graphSource || 'unresolved'),
      relationshipNotice: String(body.cultivation?.relationshipNotice || ''),
      personalContextConsulted: false,
      persisted: false,
      sharedGraphMutated: false
    },
    boundary: {
      mode: 'public_fruit_read_only',
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      sourceMutationAllowed: false,
      reason: 'The public gateway returns cultivated fruit without forwarding identity cookies or exposing internal controls.'
    }
  };
}

function publicCommunityFruit(body: Record<string, any>) {
  const fruit = publicFruit(body);
  return {
    ...fruit,
    version: 'garden-api.v1',
    boundary: {
      ...fruit.boundary,
      mode: 'community_api_read_only',
      reason: 'The community API never forwards identity cookies and cannot read personal memory or mutate shared knowledge.'
    }
  };
}

function publicPersonalFruit(body: Record<string, any>) {
  const fruit = publicFruit(body);
  return {
    ...fruit,
    version: 'garden-api.v1',
    cultivation: {
      ...fruit.cultivation,
      personalContextConsulted: true,
      persisted: false,
      sharedGraphMutated: false
    },
    boundary: {
      mode: 'personal_api_private_context',
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      sourceMutationAllowed: false,
      crossPersonAccessAllowed: false,
      automaticLearningAllowed: false,
      reason: 'Only the authenticated person reviewed overlay may be consulted. The seed is not automatically saved or shared.'
    }
  };
}

function publicPersonalGarden(body: Record<string, any>) {
  const relationships = Array.isArray(body.garden?.relationships) ? body.garden.relationships.slice(0, 100) : [];
  return {
    version: 'garden-api.v1',
    garden: {
      sourceLayer: 'user_graph',
      consulted: body.garden?.consulted === true,
      relationships: relationships.map((relationship: Record<string, any>) => ({
        id: String(relationship.id || ''),
        source: String(relationship.source || '').slice(0, 120),
        target: String(relationship.target || '').slice(0, 120),
        relationshipType: String(relationship.relationshipType || '').slice(0, 80),
        confidence: String(relationship.confidence || ''),
        evidence: String(relationship.evidence || '').slice(0, 1_000),
        counterexample: String(relationship.counterexample || '').slice(0, 1_000),
        sourceLayer: 'user_graph',
        createdAt: relationship.createdAt || null
      })),
      relationshipCount: Number(body.garden?.relationshipCount || relationships.length),
      truncated: body.garden?.truncated === true
    },
    boundary: {
      mode: 'personal_garden_owner_only',
      crossPersonAccessAllowed: false,
      sharedGraphMutationAllowed: false,
      colorAtlasMutationAllowed: false,
      automaticLearningAllowed: false
    }
  };
}

function publicSession(body: Record<string, any>) {
  const user = body.user && typeof body.user === 'object' ? body.user : body;
  return {
    authenticated: true,
    user: {
      id: String(user.id || user.sub || ''),
      username: String(user.username || ''),
      email: String(user.email || ''),
      role: String(user.role || 'user'),
      mustChangePassword: user.must_change_password === true || user.mustChangePassword === true
    }
  };
}

function publicAccountAction(body: Record<string, any>, fallback: string) {
  return { message: String(body.message || fallback).slice(0, 240) };
}

function publicError(body: Record<string, any>) {
  return { error: String(body.error || 'The Garden could not cultivate this seed.').slice(0, 240) };
}

async function readJson(request: IncomingMessage) {
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    throw httpError(415, 'Content-Type must be application/json.');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_SEED_BODY_BYTES) throw httpError(413, 'Garden request exceeds 64 KB.');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>;
  } catch {
    throw httpError(400, 'Request body must be valid JSON.');
  }
}

function requirePublicEntranceRequest(request: IncomingMessage) {
  return requireGardenRequest(request, 'public-entrance');
}

function requireGardenRequest(request: IncomingMessage, expected: string) {
  if (request.headers['x-garden-request'] !== expected) throw httpError(403, `Garden request header must be ${expected}.`);
}

function requirePersonalSession(request: IncomingMessage) {
  const session = String(request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('mirror_session='));
  if (!session || session === 'mirror_session=') throw httpError(401, 'Authentication required.');
  return session;
}

function secureSessionCookie(upstreamCookie: string | null, clear = false) {
  const match = String(upstreamCookie || '').match(/(?:^|;\s*)mirror_session=([^;]*)/);
  if (!clear && !match) throw httpError(502, 'The personal session could not be established.');
  const value = clear ? '' : match![1];
  return `mirror_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${clear ? 0 : 43_200}`;
}

function createFixedWindowRateLimiter({ maxRequests, windowMs, trustProxy }: { maxRequests: number; windowMs: number; trustProxy: boolean }) {
  const windows = new Map<string, { startedAt: number; count: number }>();
  return (request: IncomingMessage, response: ServerResponse) => {
    const now = Date.now();
    const key = clientAddress(request, trustProxy);
    const current = windows.get(key);
    const record = !current || now - current.startedAt >= windowMs ? { startedAt: now, count: 0 } : current;
    record.count += 1;
    windows.set(key, record);
    const remaining = Math.max(maxRequests - record.count, 0);
    const resetSeconds = Math.max(Math.ceil((record.startedAt + windowMs - now) / 1000), 1);
    response.setHeader('RateLimit-Limit', String(maxRequests));
    response.setHeader('RateLimit-Remaining', String(remaining));
    response.setHeader('RateLimit-Reset', String(resetSeconds));
    if (record.count > maxRequests) {
      response.setHeader('Retry-After', String(resetSeconds));
      throw httpError(429, 'Too many Garden Entrance requests. Try again later.');
    }
  };
}

function clientAddress(request: IncomingMessage, trustProxy: boolean) {
  if (trustProxy) {
    const cloudflareAddress = String(request.headers['cf-connecting-ip'] || '').trim();
    if (cloudflareAddress) return cloudflareAddress;
    const forwardedAddress = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwardedAddress) return forwardedAddress;
  }
  return request.socket.remoteAddress || 'unknown';
}

function safeStringList(value: unknown, limit: number) {
  return Array.isArray(value) ? value.slice(0, limit).map(item => String(item).slice(0, 240)) : [];
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...securityHeaders() });
  response.end(JSON.stringify(body));
}

function securityHeaders() {
  return {
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cache-control': 'no-store',
    'strict-transport-security': 'max-age=31536000; includeSubDomains'
  };
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}
