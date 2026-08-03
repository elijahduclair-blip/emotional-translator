import crypto from 'crypto';

const ONE_MINUTE_MS = 60 * 1000;

export const limitPublicAnalysis = createRateLimiter({
  name: 'public analysis',
  windowMs: ONE_MINUTE_MS,
  maxRequests: 120
});

export const limitWordNetRequests = createRateLimiter({
  name: 'WordNet lookup',
  windowMs: ONE_MINUTE_MS,
  maxRequests: 60
});

export function requireWordNetAccess(req, res, next) {
  const configuredToken = String(process.env.WORDNET_READ_TOKEN || '');
  const production = process.env.NODE_ENV === 'production';

  if (!configuredToken) {
    if (!production && isLoopback(req.socket.remoteAddress)) return next();
    return next(httpError(503, 'WordNet public access is not configured.'));
  }

  const providedToken = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(providedToken, configuredToken)) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="wordnet"');
    return next(httpError(401, 'WordNet authentication required.'));
  }

  return next();
}

export function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['DATABASE_URL', 'AUTH_SECRET', 'RUNTIME_SERVICE_TOKEN', 'WORDNET_READ_TOKEN'];
  const missing = required.filter(name => !String(process.env[name] || '').trim());
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(', ')}`);

  for (const name of ['AUTH_SECRET', 'RUNTIME_SERVICE_TOKEN', 'WORDNET_READ_TOKEN']) {
    if (String(process.env[name]).length < 32) throw new Error(`${name} must contain at least 32 characters in production.`);
  }

  const origins = String(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '');
  if (!origins.trim()) throw new Error('CORS_ORIGINS is required in production.');
  if (origins.includes('*')) throw new Error('Wildcard CORS origins are not allowed in production.');

  if (process.env.PUBLIC_SIGNUP_ENABLED === 'true') {
    const mailNames = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'PUBLIC_APP_URL'];
    const missingMail = mailNames.filter(name => !String(process.env[name] || '').trim());
    if (missingMail.length) throw new Error(`Missing public-signup mail configuration: ${missingMail.join(', ')}`);
    if (!/^https:\/\//.test(process.env.PUBLIC_APP_URL)) throw new Error('PUBLIC_APP_URL must use HTTPS in production.');
  }
}

export function createRateLimiter({ name, windowMs, maxRequests, keyGenerator }) {
  const windows = new Map();
  let requestsSinceSweep = 0;

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = keyGenerator?.(req) || req.ip || req.socket.remoteAddress || 'unknown';
    const current = windows.get(key);
    const record = !current || now - current.startedAt >= windowMs
      ? { startedAt: now, count: 0 }
      : current;

    record.count += 1;
    windows.set(key, record);
    requestsSinceSweep += 1;

    if (requestsSinceSweep >= 500) {
      for (const [entryKey, entry] of windows) {
        if (now - entry.startedAt >= windowMs) windows.delete(entryKey);
      }
      requestsSinceSweep = 0;
    }

    const remaining = Math.max(maxRequests - record.count, 0);
    const resetSeconds = Math.max(Math.ceil((record.startedAt + windowMs - now) / 1000), 1);
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', String(resetSeconds));
      return next(httpError(429, `Too many ${name} requests. Try again later.`));
    }

    return next();
  };
}

function isLoopback(value) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(String(value || '').toLowerCase());
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
