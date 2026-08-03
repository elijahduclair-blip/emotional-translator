import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { query, pool } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/passwords.js';

dotenv.config();
const TEST_PORT = 3101;
const API = `http://localhost:${TEST_PORT}/api/v1`;
let server;

async function startServer() {
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${TEST_PORT}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Isolated test API did not start.');
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

test('authentication, rotation, roles, and invalidation work end to end', async () => {
  await startServer();
  const id = crypto.randomUUID();
  const childEmail = `auth-child-${id}@local.test`;
  const email = `auth-test-${id}@local.test`;
  await query(
    `INSERT INTO users (id,username,email,password_hash,role,must_change_password,token_version)
     VALUES ($1,$2,$3,$4,'admin',TRUE,1)`,
    [id, `auth-test-${id.slice(0, 8)}`, email, await hashPassword('InitialPass2026')]
  );
  try {
    const login = await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'InitialPass2026' }) });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.user.must_change_password, true);
    const oldToken = login.body.token;

    const blocked = await request('/graph/proposals', { headers: { Authorization: `Bearer ${oldToken}` } });
    assert.equal(blocked.response.status, 403);

    const changed = await request('/auth/change-password', { method: 'POST', headers: { Authorization: `Bearer ${oldToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: 'InitialPass2026', newPassword: 'Replacement2026' }) });
    assert.equal(changed.response.status, 200);
    assert.equal(changed.body.user.must_change_password, false);

    const expired = await request('/auth/me', { headers: { Authorization: `Bearer ${oldToken}` } });
    assert.equal(expired.response.status, 401);

    const token = changed.body.token;
    const created = await request('/auth/register', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: childEmail, username: 'managed-test', password: 'ManagedPass2026' }) });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.user.role, 'user');

    const forced = await request(`/auth/users/${created.body.user.id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ forcePasswordChange: true }) });
    assert.equal(forced.response.status, 200);
    assert.equal(forced.body.user.must_change_password, true);

    const removed = await request(`/auth/users/${created.body.user.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    assert.equal(removed.response.status, 204);
  } finally {
    await query('DELETE FROM users WHERE email=$1 OR email=$2', [email, childEmail]);
  }
});

test.after(async () => {
  server?.kill();
  await pool.end();
});
