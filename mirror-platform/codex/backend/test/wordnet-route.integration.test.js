import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { normalizeTerms } from '../src/routes/wordnet.js';

const TEST_PORT = 3103;
const API_ROOT = `http://127.0.0.1:${TEST_PORT}`;
const WORDNET_TOKEN = 'test-wordnet-read-token-at-least-32-characters';
let server;

test('WordNet terms are normalized exactly and transport-bounded', () => {
  const input = [' Gold ', 'gold', 'RAIN-GRAY', ...Array.from({ length: 20 }, (_, index) => `term${index}`)];
  const terms = normalizeTerms(input);

  assert.deepEqual(terms.slice(0, 2), ['gold', 'rain gray']);
  assert.equal(terms.length, 12);
});

test('WordNet lookup exposes lexical evidence without semantic authority', async () => {
  await startServer();

  const unauthorized = await fetch(`${API_ROOT}/api/v1/wordnet/lookup?term=gold`);
  assert.equal(unauthorized.status, 401);
  assert.match(unauthorized.headers.get('www-authenticate'), /^Bearer /);

  const response = await fetch(`${API_ROOT}/api/v1/wordnet/lookup`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${WORDNET_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ terms: ['gold', 'rituals', 'unknownword'] })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.engine, 'wordnet');
  assert.equal(body.provider.mode, 'local_read_only');
  assert.equal(body.query.exactOrMorphological, true);
  assert.ok(body.matchedWords.some(item => item.word === 'gold'));
  assert.ok(body.matchedWords.some(item => item.word === 'rituals' && item.lookup === 'ritual'));
  assert.ok(body.unresolvedWords.includes('unknownword'));
  assert.equal(body.governance.mutationAllowed, false);
  assert.equal(body.governance.canAssignColor, false);
  assert.equal(body.governance.canAssignAddress, false);
  assert.equal(body.governance.canActivateRoute, false);
  assert.ok(body.boundary.includes('lexical evidence'));
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('ratelimit-limit'), '60');
});

test('WordNet GET lookup requires a term', async () => {
  const headers = { authorization: `Bearer ${WORDNET_TOKEN}` };
  const missing = await fetch(`${API_ROOT}/api/v1/wordnet/lookup`, { headers });
  const missingBody = await missing.json();
  assert.equal(missing.status, 400);
  assert.equal(missingBody.error, 'term query parameter required');

  const response = await fetch(`${API_ROOT}/api/v1/wordnet/lookup?term=gold`, { headers });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.matchedWords[0].word, 'gold');
});

test.after(() => {
  server?.kill();
});

async function startServer() {
  if (server) return;
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(TEST_PORT),
      WORDNET_READ_TOKEN: WORDNET_TOKEN
    },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${API_ROOT}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('WordNet integration test API did not start.');
}
