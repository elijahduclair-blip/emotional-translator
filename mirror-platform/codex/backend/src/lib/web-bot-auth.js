import crypto from 'node:crypto';

const SIGNING_CONTEXT = 'community-garden:web-bot-auth:ed25519:v1';
const SIGNATURE_AGENT = 'https://acommunitygarden.garden';

export function createWebBotAuthIdentity(secret) {
  const normalizedSecret = String(secret || '').trim();
  if (normalizedSecret.length < 32) throw new Error('GARDEN_WEB_BOT_AUTH_SECRET must contain at least 32 characters.');
  const seed = crypto.createHmac('sha256', normalizedSecret).update(SIGNING_CONTEXT).digest();
  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]),
    format: 'der',
    type: 'pkcs8'
  });
  const publicJwk = crypto.createPublicKey(privateKey).export({ format: 'jwk' });
  const thumbprint = crypto.createHash('sha256')
    .update(JSON.stringify({ crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x }))
    .digest('base64url');
  return { privateKey, publicJwk: { ...publicJwk, kid: thumbprint, use: 'sig', alg: 'EdDSA' }, thumbprint };
}

export function webBotAuthHeaders(target, options = {}) {
  const identity = options.identity || createWebBotAuthIdentity(options.secret || process.env.GARDEN_WEB_BOT_AUTH_SECRET);
  const url = target instanceof URL ? target : new URL(target);
  const created = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const expires = created + 60;
  const nonce = options.nonce || crypto.randomBytes(64).toString('base64');
  const signatureAgent = `"${SIGNATURE_AGENT}"`;
  const parameters = `("@authority" "signature-agent");alg="ed25519";keyid="${identity.thumbprint}";nonce="${nonce}";tag="web-bot-auth";created=${created};expires=${expires}`;
  const signatureBase = `"@authority": ${url.host.toLowerCase()}\n"signature-agent": ${signatureAgent}\n"@signature-params": ${parameters}`;
  const signature = crypto.sign(null, Buffer.from(signatureBase), identity.privateKey).toString('base64');
  return {
    'Signature-Agent': signatureAgent,
    'Signature-Input': `sig1=${parameters}`,
    Signature: `sig1=:${signature}:`
  };
}

export function optionalWebBotAuthHeaders(target) {
  const secret = String(process.env.GARDEN_WEB_BOT_AUTH_SECRET || '').trim();
  return secret ? webBotAuthHeaders(target, { secret }) : {};
}
