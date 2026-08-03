import { verifyAccessToken } from '../auth/tokens.js';
import { query } from '../db/pool.js';

export async function requireAuth(req, res, next) {
  try {
    const authorization = String(req.headers.authorization || '');
    if (!authorization.startsWith('Bearer ')) {
      const error = new Error('Authentication required.');
      error.status = 401;
      throw error;
    }
    const tokenUser = verifyAccessToken(authorization.slice(7));
    const result = await query('SELECT id, username, email, role, token_version, must_change_password FROM users WHERE id = $1 AND password_hash IS NOT NULL', [tokenUser.sub]);
    if (!result.rows.length) {
      const error = new Error('Account no longer exists.');
      error.status = 401;
      throw error;
    }
    if ((tokenUser.ver || 1) !== result.rows[0].token_version) {
      const error = new Error('Session expired. Please sign in again.');
      error.status = 401;
      throw error;
    }
    req.user = { ...result.rows[0], sub: result.rows[0].id };
    next();
  } catch (error) {
    next(error);
  }
}

const authAttempts = new Map();

export function limitAuthAttempts(req, res, next) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const recent = (authAttempts.get(key) || []).filter(timestamp => now - timestamp < windowMs);
  if (recent.length >= 10) {
    res.setHeader('Retry-After', '900');
    const error = new Error('Too many authentication attempts. Try again in 15 minutes.');
    error.status = 429;
    return next(error);
  }
  recent.push(now);
  authAttempts.set(key, recent);
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.must_change_password) {
    const error = new Error('Change your password before using protected account features.');
    error.status = 403;
    return next(error);
  }
  if (req.user?.role !== 'admin') {
    const error = new Error('Administrator access required.');
    error.status = 403;
    return next(error);
  }
  next();
}

export function requirePasswordCurrent(req, res, next) {
  if (req.user?.must_change_password) {
    const error = new Error('Change your password before using protected account features.');
    error.status = 403;
    return next(error);
  }
  next();
}

export function requireSelfOrAdmin(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.sub !== req.params.id) {
    const error = new Error('You can only access your own profile.');
    error.status = 403;
    return next(error);
  }
  next();
}
