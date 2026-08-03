import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MirrorRuntimeService } from './services/mirror-runtime.service';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_FOUNDATION_BODY_BYTES = 64 * 1024;
const translatorPage = readFileSync(join(__dirname, '..', 'public', 'index.html'), 'utf8');

export function createMirrorHttpServer(service: MirrorRuntimeService) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://mirror.local');
      const path = url.pathname;
      if (request.method === 'GET' && path === '/') {
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          ...securityHeaders()
        });
        response.end(translatorPage);
        return;
      }

      if (request.method === 'GET' && path === '/health') {
        return sendJson(response, 200, { status: service.getStatus() });
      }

      if (request.method === 'POST' && path === '/ask') {
        const body = await readJson(request);
        const input = typeof body.input === 'string' ? body.input.trim() : '';
        if (!input) return sendJson(response, 400, { error: 'input is required.' });

        const result = await service.getRuntime().ask(input);
        return sendJson(response, 200, result);
      }

      if (request.method === 'POST' && path === '/foundation/letters/analyze') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/letters/analyze', {
          method: 'POST', body: await readJson(request, MAX_FOUNDATION_BODY_BYTES)
        }));
      }

      if (request.method === 'POST' && path === '/foundation/language-loop') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().runLanguageLoop(await readJson(request, MAX_FOUNDATION_BODY_BYTES)));
      }

      if (request.method === 'POST' && path === '/foundation/letters/compare') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/letters/compare', {
          method: 'POST', body: await readJson(request)
        }));
      }

      if (request.method === 'POST' && path === '/foundation/braille-runtime/compile') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().compileBrailleRuntime(await readJson(request)));
      }

      if (request.method === 'POST' && path === '/foundation/braille-runtime/assemble') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().assembleBrailleRuntime(await readJson(request)));
      }

      if (request.method === 'POST' && path === '/foundation/braille-runtime/modules') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/braille-runtime/modules', {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      if (request.method === 'GET' && path === '/foundation/braille-runtime/modules') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/braille-runtime/modules', { userToken: token }));
      }

      const moduleReview = path.match(/^\/foundation\/braille-runtime\/modules\/([^/]+)\/review$/);
      if (request.method === 'POST' && moduleReview) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/foundation/braille-runtime/modules/${encodeURIComponent(moduleReview[1])}/review`, {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      const moduleActivation = path.match(/^\/foundation\/braille-runtime\/modules\/([^/]+)\/activate$/);
      if (request.method === 'POST' && moduleActivation) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/foundation/braille-runtime/modules/${encodeURIComponent(moduleActivation[1])}/activate`, {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      const moduleAuthority = path.match(/^\/foundation\/braille-runtime\/modules\/([^/]+)\/authority$/);
      if (request.method === 'POST' && moduleAuthority) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/foundation/braille-runtime/modules/${encodeURIComponent(moduleAuthority[1])}/authority`, {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      const moduleEvents = path.match(/^\/foundation\/braille-runtime\/modules\/([^/]+)\/events$/);
      if (request.method === 'GET' && moduleEvents) {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/foundation/braille-runtime/modules/${encodeURIComponent(moduleEvents[1])}/events`, { userToken: token }));
      }

      if (request.method === 'GET' && path === '/braille/curriculum') {
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/braille/math/curriculum'));
      }

      if (request.method === 'POST' && path === '/braille/translate') {
        requireSameOriginMutation(request);
        return sendJson(response, 200, await service.getRuntime().translateBrailleMath(await readJson(request)));
      }

      if (request.method === 'POST' && path === '/braille/check') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/braille/math/check', { method: 'POST', body: await readJson(request) }));
      }

      if (request.method === 'GET' && path === '/braille/progress') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/braille/math/progress', { userToken: token }));
      }

      if (request.method === 'PUT' && path === '/braille/progress') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/braille/math/progress', { method: 'PUT', body: await readJson(request), userToken: token }));
      }

      const publicAccountRoutes: Record<string, string> = {
        '/account/signup': '/api/v1/auth/signup',
        '/account/verify-email': '/api/v1/auth/verify-email',
        '/account/resend-verification': '/api/v1/auth/resend-verification',
        '/account/forgot-password': '/api/v1/auth/forgot-password',
        '/account/reset-password': '/api/v1/auth/reset-password'
      };
      if (request.method === 'POST' && publicAccountRoutes[path]) {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest(publicAccountRoutes[path], { method: 'POST', body: await readJson(request) }));
      }

      if (request.method === 'POST' && path === '/account/login') {
        requireSameOriginMutation(request);
        const result = await service.getRuntime().codexRequest('/api/v1/auth/login', { method: 'POST', body: await readJson(request) });
        if (result.status < 400 && typeof result.body.token === 'string') {
          response.setHeader('set-cookie', sessionCookie(result.body.token));
          delete result.body.token;
        }
        return proxyResult(response, result);
      }

      if (request.method === 'GET' && path === '/account/me') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/auth/me', { userToken: token }));
      }

      if (request.method === 'POST' && path === '/account/logout') {
        requireSameOriginMutation(request);
        response.setHeader('set-cookie', sessionCookie('', true));
        return sendJson(response, 200, { signedOut: true });
      }

      return sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 500;
      return sendJson(response, status, { error: message });
    }
  });
}

async function readJson(request: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw httpError(413, `Request body exceeds ${Math.floor(maxBytes / 1024)} KB.`);
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw httpError(400, 'Request body must be valid JSON.');
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...securityHeaders()
  });
  response.end(JSON.stringify(body));
}

function proxyResult(response: ServerResponse, result: { status: number; body: Record<string, unknown> }) {
  return sendJson(response, result.status, result.body);
}

function requireSameOriginMutation(request: IncomingMessage) {
  if (request.headers['x-mirror-request'] !== 'same-origin') throw httpError(403, 'Same-origin request header required.');
}

function requireSession(request: IncomingMessage) {
  const cookies = Object.fromEntries(String(request.headers.cookie || '').split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const index = value.indexOf('=');
    return index < 0 ? [value, ''] : [value.slice(0, index), decodeURIComponent(value.slice(index + 1))];
  }));
  if (!cookies.mirror_session) throw httpError(401, 'Authentication required.');
  return cookies.mirror_session;
}

function sessionCookie(token: string, clear = false) {
  const parts = [`mirror_session=${encodeURIComponent(token)}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${clear ? 0 : 43_200}`];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function securityHeaders() {
  return {
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cache-control': 'no-store',
    ...(process.env.NODE_ENV === 'production' ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {})
  };
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}
