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

  const sessions = await fetch(`${API_ROOT}/api/v1/foundation/sessions`);
  const sessionsBody = await sessions.json();
  assert.equal(sessions.status, 401);
  assert.equal(sessionsBody.error, 'Authentication required.');
});

test('letter accountability routes expose complete bounded structural records', async () => {
  const analyzed = await fetch(`${API_ROOT}/api/v1/foundation/letters/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'CAT, cat letter' })
  });
  const analyzedBody = await analyzed.json();
  assert.equal(analyzed.status, 200);
  assert.equal(analyzedBody.engine, 'foundation_letters');
  assert.equal(analyzedBody.signatures.length, 2);
  assert.deepEqual(analyzedBody.wordSequence.map(item => item.signatureId), ['w1', 'w1', 'w2']);
  assert.equal(analyzedBody.boundary.brailleMeaningInherited, false);

  const compared = await fetch(`${API_ROOT}/api/v1/foundation/letters/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ left: 'CAT', right: 'BAT' })
  });
  const comparedBody = await compared.json();
  assert.equal(compared.status, 200);
  assert.deepEqual(comparedBody.differences, [{ operation: 'substitution', leftPosition: 1, rightPosition: 1, left: 'c', right: 'b' }]);

  const oversized = await fetch(`${API_ROOT}/api/v1/foundation/letters/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'a'.repeat(10001) })
  });
  assert.equal(oversized.status, 413);
});

test('Braille Runtime compiler remains proposal-only and rejects arbitrary actions', async () => {
  const compiled = await fetch(`${API_ROOT}/api/v1/foundation/braille-runtime/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: 'When pattern count >= 3, then propose a route.', observedValue: 4 })
  });
  const body = await compiled.json();
  assert.equal(compiled.status, 200);
  assert.equal(body.instruction.action, 'propose_route');
  assert.equal(body.instruction.authority, 'proposal_only');
  assert.equal(body.proposal.status, 'proposed');
  assert.equal(body.boundary.sourceMutationAllowed, false);
  assert.equal(body.boundary.generatedCodeExecutionAllowed, false);

  const rejected = await fetch(`${API_ROOT}/api/v1/foundation/braille-runtime/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: 'When pattern count >= 3, execute generated code.' })
  });
  assert.equal(rejected.status, 422);

  const assembled = await fetch(`${API_ROOT}/api/v1/foundation/braille-runtime/assemble`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: 'When pattern count >= 3, then propose a route.',
      observedValue: 4,
      proposalDecision: 'approved'
    })
  });
  const assembledBody = await assembled.json();
  assert.equal(assembled.status, 200);
  assert.equal(assembledBody.module.templateId, 'route_proposal_v1');
  assert.equal(assembledBody.execution.output.status, 'ready_for_review');
  assert.equal(assembledBody.boundary.externalMutationAllowed, false);

  const dormantAssembly = await fetch(`${API_ROOT}/api/v1/foundation/braille-runtime/assemble`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: 'When pattern count >= 3, then propose a route.',
      observedValue: 2,
      proposalDecision: 'approved'
    })
  });
  assert.equal(dormantAssembly.status, 409);
});

test('language loop returns English through UEB and exact machine cells', async () => {
  const response = await fetch(`${API_ROOT}/api/v1/foundation/language-loop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Gold memory moves.' })
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.originalEnglish, 'Gold memory moves.');
  assert.equal(body.decoding.english, 'Gold memory moves.');
  assert.equal(body.decoding.roundTripExact, true);
  assert.ok(body.encoding.cells.length > 0);
  assert.equal(body.encoding.numericSequence.length, body.encoding.cells.length);
  assert.equal(body.boundary.encodingCreatesMeaning, false);
  assert.ok(['approved_graph', 'unresolved'].includes(body.meaning.approvedGraph.sourceLayer));
});

test.after(() => {
  server?.kill();
});
