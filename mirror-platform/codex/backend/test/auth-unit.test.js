import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';
import { createAccessToken, verifyAccessToken } from '../src/auth/tokens.js';

dotenv.config();

test('passwords are salted and verifiable', async () => {
  const first = await hashPassword('StrongTest2026');
  const second = await hashPassword('StrongTest2026');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('StrongTest2026', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
});

test('signed tokens preserve identity and reject tampering', () => {
  const token = createAccessToken({ id: 'test-user', username: 'tester', email: 'test@example.com', role: 'user', token_version: 4 });
  const payload = verifyAccessToken(token);
  assert.equal(payload.sub, 'test-user');
  assert.equal(payload.ver, 4);
  assert.throws(() => verifyAccessToken(`${token.slice(0, -1)}x`));
});
