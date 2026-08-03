import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { query, pool } from '../src/db/pool.js';
import { createAccessToken } from '../src/auth/tokens.js';

dotenv.config();

const PORT = 3108;
const API = `http://127.0.0.1:${PORT}/api/v1`;
let server;

test('saved Foundation sessions include letter accountability while legacy rows remain valid', async () => {
  await startServer();
  const admin = await installAdmin();
  const legacyId = crypto.randomUUID();
  let createdId;
  try {
    const response = await fetch(`${API}/foundation/sessions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${createAccessToken(admin)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Accountability', text: 'CAT cat letter' })
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    createdId = body.session.id;
    assert.equal(body.session.analysisVersion, '1.0.0');
    assert.equal(body.session.letterAccountability.signatures.length, 2);
    assert.deepEqual(body.session.letterAccountability.wordSequence.map(item => item.signatureId), ['w1', 'w1', 'w2']);

    await query(`INSERT INTO foundation_sessions (id,title,input_text) VALUES ($1,'Legacy','old words')`, [legacyId]);
    const legacy = await fetch(`${API}/foundation/sessions/${legacyId}`, { headers: { authorization: `Bearer ${createAccessToken(admin)}` } });
    const legacyBody = await legacy.json();
    assert.equal(legacy.status, 200);
    assert.equal(legacyBody.session.letterAccountability, null);
    assert.equal(legacyBody.session.analysisVersion, null);
  } finally {
    if (createdId) await query('DELETE FROM foundation_sessions WHERE id=$1', [createdId]);
    await query('DELETE FROM foundation_sessions WHERE id=$1', [legacyId]);
    await query('DELETE FROM users WHERE id=$1', [admin.id]);
  }
});

test.after(async () => { server?.kill(); await pool.end(); });

async function installAdmin() {
  const id = crypto.randomUUID();
  const result = await query(
    `INSERT INTO users (id,username,email,password_hash,role,email_verified_at,signup_source,token_version,must_change_password)
     VALUES ($1,$2,$3,'test-only','admin',NOW(),'legacy',1,FALSE)
     RETURNING id,username,email,role,token_version,must_change_password`,
    [id, `foundation-${id.slice(0, 8)}`, `foundation-${id}@local.test`]
  );
  return result.rows[0];
}

async function startServer() {
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Foundation session API did not start.');
}
