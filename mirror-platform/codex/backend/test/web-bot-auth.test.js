import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createWebBotAuthIdentity, webBotAuthHeaders } from '../src/lib/web-bot-auth.js';

const SECRET = 'test-only-community-garden-web-bot-auth-secret';

test('Web Bot Auth creates a stable public Ed25519 identity without exposing private material', () => {
  const first = createWebBotAuthIdentity(SECRET);
  const second = createWebBotAuthIdentity(SECRET);
  assert.equal(first.thumbprint, second.thumbprint);
  assert.equal(first.publicJwk.kty, 'OKP');
  assert.equal(first.publicJwk.crv, 'Ed25519');
  assert.equal(first.publicJwk.kid, first.thumbprint);
  assert.equal('d' in first.publicJwk, false);
});

test('Web Bot Auth signs the authority and quoted Signature-Agent with a one-minute validity window', () => {
  const identity = createWebBotAuthIdentity(SECRET);
  const headers = webBotAuthHeaders('https://en.wikipedia.org/w/api.php?q=weather', {
    identity,
    nowSeconds: 1_750_000_000,
    nonce: 'test-nonce'
  });
  assert.equal(headers['Signature-Agent'], '"https://acommunitygarden.garden"');
  assert.match(headers['Signature-Input'], /\("@authority" "signature-agent"\)/);
  assert.match(headers['Signature-Input'], /tag="web-bot-auth"/);
  assert.match(headers['Signature-Input'], /created=1750000000;expires=1750000060$/);

  const parameters = headers['Signature-Input'].replace(/^sig1=/, '');
  const signatureBase = `"@authority": en.wikipedia.org\n"signature-agent": "https://acommunitygarden.garden"\n"@signature-params": ${parameters}`;
  const signature = Buffer.from(headers.Signature.replace(/^sig1=:/, '').replace(/:$/, ''), 'base64');
  const publicKey = crypto.createPublicKey({ key: identity.publicJwk, format: 'jwk' });
  assert.equal(crypto.verify(null, Buffer.from(signatureBase), publicKey, signature), true);
});
