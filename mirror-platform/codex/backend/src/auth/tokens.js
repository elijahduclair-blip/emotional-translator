import crypto from 'crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 12;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    const error = new Error('AUTH_SECRET must contain at least 32 characters.');
    error.status = 500;
    throw error;
  }
  return value;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function createAccessToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: user.id, username: user.username, email: user.email, role: user.role, ver: user.token_version || 1, iat: now, exp: now + TOKEN_TTL_SECONDS });
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifyAccessToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw unauthorized();
  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(unsigned));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw unauthorized();
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw unauthorized();
  }
  if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) throw unauthorized('Session expired. Please sign in again.');
  return payload;
}

function unauthorized(message = 'Authentication required.') {
  const error = new Error(message);
  error.status = 401;
  return error;
}
