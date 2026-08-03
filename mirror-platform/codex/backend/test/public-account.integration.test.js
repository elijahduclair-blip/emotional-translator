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

test.after(async () => { server?.kill(); await pool.end(); });

async function installToken(userId, purpose, token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await query('DELETE FROM auth_action_tokens WHERE user_id=$1 AND purpose=$2', [userId, purpose]);
  await query(
    `INSERT INTO auth_action_tokens (id,user_id,purpose,token_hash,expires_at) VALUES ($1,$2,$3,$4,NOW()+INTERVAL '1 hour')`,
    [crypto.randomUUID(), userId, purpose, hash]
  );
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
