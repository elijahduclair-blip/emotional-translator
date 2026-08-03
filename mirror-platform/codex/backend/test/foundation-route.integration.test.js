import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';

const TEST_PORT = 3102;
const API_ROOT = `http://localhost:${TEST_PORT}`;
let server;

async function startServer() {
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${API_ROOT}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Foundation integration test API did not start.');
}

test('foundation analyze route returns the structure-only contract', async () => {
  await startServer();
  const response = await fetch(`${API_ROOT}/api/v1/foundation/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Gold ritual gold icon memory' })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.engine, 'foundation');
  assert.equal(body.version, '1.0.0');
  assert.equal(typeof body.boundary, 'string');
  assert.equal(body.stats.totalWords, 5);
  assert.ok(Array.isArray(body.wordCounts));
  assert.ok(Array.isArray(body.coOccurrences));
  assert.ok(Array.isArray(body.pareto));
  assert.ok(Array.isArray(body.patterns));
  assert.equal(body.wordCounts[0].word, 'gold');
});

test.after(() => {
  server?.kill();
});
