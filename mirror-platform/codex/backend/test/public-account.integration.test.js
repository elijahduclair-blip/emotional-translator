import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { query, pool } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/passwords.js';
import { createAccessToken } from '../src/auth/tokens.js';

dotenv.config();
const PORT = 3106;
const API = `http://127.0.0.1:${PORT}/api/v1`;
let server;

test('public account verification and reset tokens are single-use and non-enumerating', async () => {
  await startServer();
  const unique = crypto.randomUUID();
  const email = `braille-${unique}@local.test`;
  const username = `braille-${unique.slice(0, 8)}`;
  try {
    const signup = await post('/auth/signup', { email, username, password: 'LearningPass2026' });
    assert.equal(signup.status, 202);

    const blocked = await post('/auth/login', { email, password: 'LearningPass2026' });
    assert.equal(blocked.status, 403);

    const user = (await query('SELECT id FROM users WHERE email=$1', [email])).rows[0];
    await installToken(user.id, 'verify_email', 'known-verification-token');
    assert.equal((await post('/auth/verify-email', { token: 'known-verification-token' })).status, 200);
    assert.equal((await post('/auth/verify-email', { token: 'known-verification-token' })).status, 400);

    const login = await post('/auth/login', { email, password: 'LearningPass2026' });
    assert.equal(login.status, 200);

    const knownAgentStart = await post('/auth/agent-claim/start', { email });
    const unknownAgentStart = await post('/auth/agent-claim/start', { email: `missing-${unique}@local.test` });
    assert.equal(knownAgentStart.status, 202, JSON.stringify(knownAgentStart.body));
    assert.equal(unknownAgentStart.status, 202);
    assert.equal(knownAgentStart.body.message, unknownAgentStart.body.message);
    assert.equal(knownAgentStart.body.status, 'pending_user_verification');

    const claimId = await installToken(user.id, 'agent_claim', 'known-agent-claim-token');
    const completedClaim = await post('/auth/agent-claim/complete', { claimId, verificationToken: 'known-agent-claim-token' });
    assert.equal(completedClaim.status, 200);
    assert.equal(completedClaim.body.user.id, user.id);
    assert.equal(typeof completedClaim.body.token, 'string');
    assert.equal((await post('/auth/agent-claim/complete', { claimId, verificationToken: 'known-agent-claim-token' })).status, 400);

    const knownRecovery = await post('/auth/forgot-password', { email });
    const unknownRecovery = await post('/auth/forgot-password', { email: `missing-${unique}@local.test` });
    assert.equal(knownRecovery.status, 202);
    assert.deepEqual(knownRecovery.body, unknownRecovery.body);

    await installToken(user.id, 'reset_password', 'known-reset-token');
    assert.equal((await post('/auth/reset-password', { token: 'known-reset-token', newPassword: 'Replacement2026' })).status, 200);
    assert.equal((await post('/auth/reset-password', { token: 'known-reset-token', newPassword: 'AnotherPass2026' })).status, 400);
    assert.equal((await post('/auth/login', { email, password: 'LearningPass2026' })).status, 401);
    assert.equal((await post('/auth/login', { email, password: 'Replacement2026' })).status, 200);
  } finally {
    await query('DELETE FROM users WHERE email=$1', [email]);
  }
});

test('Braille progress is isolated by account and does not return raw answers', async () => {
  const first = await installVerifiedUser('progress-one');
  const second = await installVerifiedUser('progress-two');
  try {
    const saved = await fetch(`${API}/braille/math/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${createAccessToken(first)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ lessonId: 'cells-and-numbers', status: 'completed', score: 100, correct: true, durationMs: 900, direction: 'print_to_nemeth', mistakeCategories: [] })
    });
    assert.equal(saved.status, 200);

    const firstProgress = await authenticatedGet(first);
    const secondProgress = await authenticatedGet(second);
    assert.equal(firstProgress.progress.length, 1);
    assert.equal(firstProgress.attempts.length, 1);
    assert.equal(secondProgress.progress.length, 0);
    assert.equal(secondProgress.attempts.length, 0);
    assert.equal('answer' in firstProgress.attempts[0], false);
    assert.equal('input' in firstProgress.attempts[0], false);
  } finally {
    await query('DELETE FROM users WHERE id=$1 OR id=$2', [first.id, second.id]);
  }
});

test('private conversation memory preserves ordered turns and isolates accounts', async () => {
  const first = await installVerifiedUser('conversation-one');
  const second = await installVerifiedUser('conversation-two');
  const interactionId = `interaction-${crypto.randomUUID()}`;
  try {
    const userEvent = await conversationRequest(first, '/conversation-memory/events', {
      method: 'POST',
      body: { interactionId, role: 'user', content: 'Can you follow this context?', metadata: { source: 'personal_entrance' } }
    });
    const assistantEvent = await conversationRequest(first, '/conversation-memory/events', {
      method: 'POST',
      body: {
        interactionId,
        role: 'assistant',
        content: 'Yes. I will keep the order.',
        metadata: {
          source: 'personal_entrance',
          comparison: {
            version: 'ari-comparison.v1', mode: 'untrusted-mode', comparedObservationSequences: [1, 1, -2],
            strongestObservationSequence: 1, repeatedTokenCount: 2, repeatedPhraseCount: 1,
            comparisonCreatesMeaning: true, graphMutationAllowed: true, extra: 'must-not-persist'
          }
        }
      }
    });
    assert.equal(userEvent.status, 201);
    assert.equal(assistantEvent.status, 201);
    assert.ok(userEvent.body.event.sequence < assistantEvent.body.event.sequence);
    assert.deepEqual(assistantEvent.body.event.metadata.comparison, {
      version: 'ari-comparison.v1', mode: 'observation_only', comparedObservationSequences: [1],
      strongestObservationSequence: 1, repeatedTokenCount: 2, repeatedPhraseCount: 1,
      comparisonCreatesMeaning: false, graphMutationAllowed: false
    });

    const duplicate = await conversationRequest(first, '/conversation-memory/events', {
      method: 'POST',
      body: { interactionId, role: 'user', content: 'Can you follow this context?', metadata: { source: 'personal_entrance' } }
    });
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.idempotent, true);

    const context = await conversationRequest(first, '/conversation-memory/context?maxEvents=24&maxCharacters=12000');
    assert.deepEqual(context.body.events.map(event => event.role), ['user', 'assistant']);
    assert.deepEqual(context.body.events.map(event => event.content), [
      'Can you follow this context?',
      'Yes. I will keep the order.'
    ]);
    assert.equal(context.body.boundary.sharedGraphMutationAllowed, false);

    const transcript = await conversationRequest(first, '/conversation-memory/transcript?limit=100');
    const isolated = await conversationRequest(second, '/conversation-memory/transcript?limit=100');
    assert.equal(transcript.body.count, 2);
    assert.equal(isolated.body.count, 0);
    assert.equal(transcript.body.events[0].interactionId, interactionId);
    assert.equal(transcript.body.events[1].metadata.comparison.graphMutationAllowed, false);
    assert.equal('extra' in transcript.body.events[1].metadata.comparison, false);
  } finally {
    await query('DELETE FROM users WHERE id=$1 OR id=$2', [first.id, second.id]);
  }
});

test.after(async () => { server?.kill(); await pool.end(); });

async function installToken(userId, purpose, token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const id = crypto.randomUUID();
  await query('DELETE FROM auth_action_tokens WHERE user_id=$1 AND purpose=$2', [userId, purpose]);
  await query(
    `INSERT INTO auth_action_tokens (id,user_id,purpose,token_hash,expires_at) VALUES ($1,$2,$3,$4,NOW()+INTERVAL '1 hour')`,
    [id, userId, purpose, hash]
  );
  return id;
}

async function installVerifiedUser(prefix) {
  const id = crypto.randomUUID();
  const email = `${prefix}-${id}@local.test`;
  const result = await query(
    `INSERT INTO users (id,username,email,password_hash,role,email_verified_at,signup_source,token_version)
     VALUES ($1,$2,$3,$4,'user',NOW(),'public',1)
     RETURNING id,username,email,role,token_version,must_change_password`,
    [id, `${prefix}-${id.slice(0, 8)}`, email, await hashPassword('ProgressPass2026')]
  );
  return result.rows[0];
}

async function authenticatedGet(user) {
  const response = await fetch(`${API}/braille/math/progress`, { headers: { authorization: `Bearer ${createAccessToken(user)}` } });
  assert.equal(response.status, 200);
  return response.json();
}

async function conversationRequest(user, path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    method: options.method || 'GET',
    headers: {
      authorization: `Bearer ${createAccessToken(user)}`,
      'content-type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return { status: response.status, body: await response.json() };
}

async function post(path, body) {
  const response = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

async function startServer() {
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'test', SMTP_CAPTURE_ONLY: 'true', PUBLIC_SIGNUP_ENABLED: 'true', PORT: String(PORT) },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Public-account integration API did not start.');
}
