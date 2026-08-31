import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { runtimeError } from './store.mjs';

const MAX_BODY_BYTES = 64 * 1024;

export function createAriHttpServer({ runtime, store, controlKey }) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://ari.local');
      if (request.method === 'GET' && url.pathname === '/health') return send(response, 200, await runtime.health());
      authorize(request, controlKey);
      const ownerKey = ownerHash(request.headers['x-ari-owner'] || 'local-owner');
      if (request.method === 'GET' && url.pathname === '/v1/runtime') return send(response, 200, await runtime.health());
      if (request.method === 'POST' && url.pathname === '/v1/runtime/pause') {
        store.setRuntimePaused(true); return send(response, 200, await runtime.health());
      }
      if (request.method === 'POST' && url.pathname === '/v1/runtime/resume') {
        store.setRuntimePaused(false); void runtime.runOnce(); return send(response, 200, await runtime.health());
      }
      if (request.method === 'POST' && url.pathname === '/v1/runtime/wake') {
        void runtime.runOnce(); return send(response, 202, { accepted: true });
      }
      if (request.method === 'GET' && url.pathname === '/v1/objectives') {
        return send(response, 200, { version: 'ari-independent-runtime.v1', objectives: store.listObjectives(ownerKey), lessons: store.lessonsFor(ownerKey) });
      }
      if (request.method === 'POST' && url.pathname === '/v1/objectives') {
        const objective = store.createObjective(ownerKey, await readBody(request));
        void runtime.runOnce();
        return send(response, 201, { version: 'ari-independent-runtime.v1', objective });
      }
      const match = url.pathname.match(/^\/v1\/objectives\/([^/]+)$/);
      if (match && request.method === 'GET') {
        const objective = store.getObjective(ownerKey, decodeURIComponent(match[1]));
        return send(response, 200, { objective, lessons: store.lessonsFor(ownerKey, objective.id), events: store.recentEvents(ownerKey) });
      }
      if (match && request.method === 'PATCH') {
        const body = await readBody(request);
        const objective = store.controlObjective(ownerKey, decodeURIComponent(match[1]), String(body.action || ''));
        if (body.action === 'resume' || body.action === 'wake') void runtime.runOnce();
        return send(response, 200, { objective });
      }
      throw runtimeError(404, 'ARI runtime route was not found.');
    } catch (error) {
      send(response, Number(error?.status || 500), { error: error instanceof Error ? error.message : 'ARI runtime failed.' });
    }
  });
}

function authorize(request, controlKey) {
  const supplied = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const left = Buffer.from(supplied); const right = Buffer.from(controlKey);
  if (!supplied || left.length !== right.length || !crypto.timingSafeEqual(left, right)) throw runtimeError(401, 'ARI runtime control key is required.');
}

function ownerHash(value) { return crypto.createHash('sha256').update(String(value)).digest('base64url'); }

async function readBody(request) {
  const chunks = []; let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw runtimeError(413, 'ARI runtime request exceeds 64 KB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw runtimeError(400, 'ARI runtime request must contain valid JSON.'); }
}

function send(response, status, body) {
  const value = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(value) });
  response.end(value);
}
