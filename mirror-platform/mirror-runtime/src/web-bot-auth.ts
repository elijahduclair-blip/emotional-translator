import crypto, { KeyObject } from 'node:crypto';

const DIRECTORY_MEDIA_TYPE = 'application/http-message-signatures-directory+json';
const DIRECTORY_TAG = 'http-message-signatures-directory';
const REQUEST_TAG = 'web-bot-auth';
const SIGNING_CONTEXT = 'community-garden:web-bot-auth:ed25519:v1';

export interface WebBotAuthIdentity {
  privateKey: KeyObject;
  publicJwk: {
    kty: 'OKP';
    crv: 'Ed25519';
    x: string;
    kid: string;
    use: 'sig';
    alg: 'EdDSA';
  };
  thumbprint: string;
}

export interface WebBotAuthDirectoryResponse {
  body: string;
  headers: Record<string, string>;
}

export function createWebBotAuthIdentity(secret: string): WebBotAuthIdentity {
  const normalizedSecret = String(secret || '').trim();
  if (normalizedSecret.length < 32) {
    throw new Error('GARDEN_WEB_BOT_AUTH_SECRET must contain at least 32 characters.');
  }

  const seed = crypto.createHmac('sha256', normalizedSecret).update(SIGNING_CONTEXT).digest();
  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]),
    format: 'der',
    type: 'pkcs8'
  });
  const exported = crypto.createPublicKey(privateKey).export({ format: 'jwk' }) as {
    kty?: string;
    crv?: string;
    x?: string;
  };
  if (exported.kty !== 'OKP' || exported.crv !== 'Ed25519' || !exported.x) {
    throw new Error('Could not derive the Community Garden Ed25519 public key.');
  }

  const thumbprint = crypto.createHash('sha256')
    .update(JSON.stringify({ crv: 'Ed25519', kty: 'OKP', x: exported.x }))
    .digest('base64url');
  return {
    privateKey,
    thumbprint,
    publicJwk: {
      kty: 'OKP',
      crv: 'Ed25519',
      x: exported.x,
      kid: thumbprint,
      use: 'sig',
      alg: 'EdDSA'
    }
  };
}

export function createWebBotAuthDirectoryResponse(
  identity: WebBotAuthIdentity,
  authority: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  nonce = crypto.randomBytes(64).toString('base64')
): WebBotAuthDirectoryResponse {
  const normalizedAuthority = String(authority || '').trim().toLowerCase();
  if (!normalizedAuthority || /[\r\n]/.test(normalizedAuthority)) throw new Error('A valid directory authority is required.');
  const expires = nowSeconds + 86_400;
  const parameters = `("@authority";req);alg="ed25519";keyid="${identity.thumbprint}";nonce="${nonce}";tag="${DIRECTORY_TAG}";created=${nowSeconds};expires=${expires}`;
  const signatureBase = `"@authority";req: ${normalizedAuthority}\n"@signature-params": ${parameters}`;
  const signature = crypto.sign(null, Buffer.from(signatureBase), identity.privateKey).toString('base64');
  const body = JSON.stringify({ keys: [identity.publicJwk] }, null, 2);

  return {
    body,
    headers: {
      'content-type': DIRECTORY_MEDIA_TYPE,
      'cache-control': 'public, max-age=86400',
      signature: `sig1=:${signature}:`,
      'signature-input': `sig1=${parameters}`
    }
  };
}

export const webBotAuthConstants = {
  directoryMediaType: DIRECTORY_MEDIA_TYPE,
  directoryTag: DIRECTORY_TAG,
  requestTag: REQUEST_TAG
} as const;
