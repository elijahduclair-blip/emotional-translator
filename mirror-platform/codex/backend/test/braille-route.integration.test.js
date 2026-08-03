import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 3105;
const API = `http://127.0.0.1:${PORT}/api/v1`;
let server;

test('Braille HTTP contract is public, bounded, and progress-protected', async () => {
  await startServer();
  const curriculum = await fetch(`${API}/braille/math/curriculum`);
  const course = await curriculum.json();
  assert.equal(curriculum.status, 200);
  assert.equal(course.lessons.length, 8);
  assert.equal(course.boundary.semanticMutationAllowed, false);

  const translated = await fetch(`${API}/braille/math/translate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ direction: 'print_to_nemeth', inputFormat: 'ascii_math', input: '3+4 = 7' })
  });
  const body = await translated.json();
  assert.equal(translated.status, 200);
  assert.equal(body.unicodeBraille, '⠼⠒⠬⠲⠀⠨⠅⠀⠼⠶');
  assert.equal(body.boundary.colorAssignmentAllowed, false);

  const unsupported = await fetch(`${API}/braille/math/translate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ direction: 'print_to_nemeth', inputFormat: 'ascii_math', input: 'sqrt(4)' })
  });
  assert.equal(unsupported.status, 422);

  const progress = await fetch(`${API}/braille/math/progress`);
  assert.equal(progress.status, 401);
});

test.after(() => server?.kill());

async function startServer() {
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, NODE_ENV: 'test', PORT: String(PORT) }, stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Braille integration API did not start.');
}
