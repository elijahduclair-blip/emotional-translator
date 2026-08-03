import express from 'express';
import crypto from 'crypto';
import { query } from '../db/pool.js';
import { createAccessToken } from '../auth/tokens.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { limitAuthAttempts, requireAdmin, requireAuth } from '../middleware/auth.js';
import { sendAccountActionEmail } from '../auth/mailer.js';
import { createRateLimiter } from '../middleware/public-api.js';

const router = express.Router();
const genericAccountMessage = { message: 'If the account can receive this request, an email has been sent.' };
const accountActionKey = req => `${req.ip || req.socket.remoteAddress || 'unknown'}:${String(req.body?.email || '').trim().toLowerCase()}`;
const limitSignup = createRateLimiter({ name: 'account signup', windowMs: 60 * 60 * 1000, maxRequests: 5, keyGenerator: accountActionKey });
const limitRecovery = createRateLimiter({ name: 'account recovery', windowMs: 60 * 60 * 1000, maxRequests: 5, keyGenerator: accountActionKey });

router.get('/auth/status', async (req, res, next) => {
  try {
    const result = await query("SELECT COUNT(*)::int AS count FROM users WHERE password_hash IS NOT NULL");
    res.json({ configured: result.rows[0].count > 0 });
  } catch (error) { next(error); }
});

router.post('/auth/bootstrap', limitAuthAttempts, async (req, res, next) => {
  try {
    const existing = await query("SELECT COUNT(*)::int AS count FROM users WHERE password_hash IS NOT NULL");
    if (existing.rows[0].count > 0) throw httpError(409, 'Authentication is already configured.');
    const user = await createUser(req.body, 'admin');
    res.status(201).json(sessionResponse(user));
  } catch (error) { next(error); }
});

router.post('/auth/register', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const user = await createUser(req.body, 'user');
    res.status(201).json({ user });
  } catch (error) { next(error); }
});

router.post('/auth/signup', limitSignup, async (req, res, next) => {
  let user;
  try {
    if (process.env.NODE_ENV === 'production' && process.env.PUBLIC_SIGNUP_ENABLED !== 'true') throw httpError(503, 'Public signup is not enabled.');
    user = await createPublicUser(req.body);
    const token = await issueActionToken(user.id, 'verify_email', 24 * 60 * 60 * 1000);
    await sendAccountActionEmail({ to: user.email, purpose: 'verify_email', token });
    res.status(202).json({ message: 'Check your email to verify the account.' });
  } catch (error) {
    if (user?.id) await query('DELETE FROM users WHERE id=$1 AND signup_source=$2', [user.id, 'public']).catch(() => {});
    next(error);
  }
});

router.post('/auth/verify-email', limitRecovery, async (req, res, next) => {
  try {
    const userId = await consumeActionToken(req.body?.token, 'verify_email');
    if (!userId) throw httpError(400, 'Verification token is invalid or expired.');
    await query('UPDATE users SET email_verified_at=NOW(),updated_at=NOW() WHERE id=$1', [userId]);
    res.json({ verified: true });
  } catch (error) { next(error); }
});

router.post('/auth/resend-verification', limitRecovery, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const result = await query('SELECT id,email,email_verified_at FROM users WHERE email=$1 AND password_hash IS NOT NULL', [email]);
    const user = result.rows[0];
    if (user && !user.email_verified_at) {
      const token = await issueActionToken(user.id, 'verify_email', 24 * 60 * 60 * 1000);
      await sendAccountActionEmail({ to: user.email, purpose: 'verify_email', token });
    }
    res.status(202).json(genericAccountMessage);
  } catch (error) { next(error); }
});

router.post('/auth/forgot-password', limitRecovery, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const result = await query('SELECT id,email,email_verified_at FROM users WHERE email=$1 AND password_hash IS NOT NULL', [email]);
    const user = result.rows[0];
    if (user?.email_verified_at) {
      const token = await issueActionToken(user.id, 'reset_password', 60 * 60 * 1000);
      await sendAccountActionEmail({ to: user.email, purpose: 'reset_password', token });
    }
    res.status(202).json(genericAccountMessage);
  } catch (error) { next(error); }
});

router.post('/auth/reset-password', limitRecovery, async (req, res, next) => {
  try {
    const passwordHash = await hashPassword(req.body?.newPassword);
    const userId = await consumeActionToken(req.body?.token, 'reset_password');
    if (!userId) throw httpError(400, 'Reset token is invalid or expired.');
    await query(
      `UPDATE users SET password_hash=$2,password_changed_at=NOW(),must_change_password=FALSE,
       token_version=token_version+1,updated_at=NOW() WHERE id=$1`,
      [userId, passwordHash]
    );
    res.json({ reset: true });
  } catch (error) { next(error); }
});

router.post('/auth/login', limitAuthAttempts, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const result = await query('SELECT id, username, email, role, password_hash, token_version, must_change_password, email_verified_at, signup_source FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await verifyPassword(req.body?.password, user.password_hash))) throw httpError(401, 'Email or password is incorrect.');
    if (user.email_verified_at === null && user.signup_source === 'public') throw httpError(403, 'Verify your email before signing in.');
    res.json(sessionResponse(user));
  } catch (error) { next(error); }
});

router.get('/auth/me', requireAuth, async (req, res, next) => {
  try {
    const result = await query('SELECT id, username, email, role, must_change_password, created_at FROM users WHERE id = $1', [req.user.sub]);
    if (!result.rows.length) throw httpError(401, 'Account no longer exists.');
    res.json({ user: result.rows[0] });
  } catch (error) { next(error); }
});

router.post('/auth/change-password', requireAuth, async (req, res, next) => {
  try {
    const result = await query('SELECT id, username, email, role, password_hash, token_version FROM users WHERE id = $1', [req.user.sub]);
    const user = result.rows[0];
    if (!user || !(await verifyPassword(req.body?.currentPassword, user.password_hash))) throw httpError(401, 'Current password is incorrect.');
    if (req.body?.currentPassword === req.body?.newPassword) throw httpError(400, 'Choose a password you have not just used.');
    const passwordHash = await hashPassword(req.body?.newPassword);
    const updated = await query(
      `UPDATE users SET password_hash=$2, must_change_password=FALSE, token_version=token_version+1,
       password_changed_at=NOW(), updated_at=NOW() WHERE id=$1
       RETURNING id,username,email,role,token_version,must_change_password`,
      [user.id, passwordHash]
    );
    res.json(sessionResponse(updated.rows[0]));
  } catch (error) { next(error); }
});

router.get('/auth/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await query('SELECT id,username,email,role,must_change_password,created_at,updated_at FROM users WHERE password_hash IS NOT NULL ORDER BY created_at');
    res.json({ users: result.rows });
  } catch (error) { next(error); }
});

router.patch('/auth/users/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const role = req.body?.role;
    const forcePasswordChange = req.body?.forcePasswordChange;
    if (role !== undefined && !['admin', 'user'].includes(role)) throw httpError(400, 'Role must be admin or user.');
    if (req.params.id === req.user.sub && role === 'user') throw httpError(400, 'You cannot remove your own administrator role.');
    if (role === 'user') await ensureAnotherAdmin(req.params.id);
    const result = await query(
      `UPDATE users SET role=COALESCE($2,role), must_change_password=COALESCE($3,must_change_password),
       token_version=CASE WHEN $3=TRUE OR ($2 IS NOT NULL AND $2<>role) THEN token_version+1 ELSE token_version END,
       updated_at=NOW() WHERE id=$1 AND password_hash IS NOT NULL
       RETURNING id,username,email,role,must_change_password,created_at,updated_at`,
      [req.params.id, role ?? null, forcePasswordChange ?? null]
    );
    if (!result.rows.length) throw httpError(404, 'Account not found.');
    res.json({ user: result.rows[0] });
  } catch (error) { next(error); }
});

router.delete('/auth/users/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (req.params.id === req.user.sub) throw httpError(400, 'You cannot delete your own account.');
    await ensureAnotherAdmin(req.params.id);
    const result = await query('DELETE FROM users WHERE id=$1 AND password_hash IS NOT NULL RETURNING id', [req.params.id]);
    if (!result.rows.length) throw httpError(404, 'Account not found.');
    res.status(204).end();
  } catch (error) { next(error); }
});

async function createUser(value, role) {
  const email = normalizeEmail(value?.email);
  const username = String(value?.username || email.split('@')[0]).trim().slice(0, 80);
  if (!username) throw httpError(400, 'Username is required.');
  const passwordHash = await hashPassword(value?.password);
  try {
    const result = await query(
      `INSERT INTO users (id, username, email, password_hash, role, email_verified_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id, username, email, role, token_version, must_change_password, created_at`,
      [crypto.randomUUID(), username, email, passwordHash, role]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') throw httpError(409, 'That email or username is already registered.');
    throw error;
  }
}

async function createPublicUser(value) {
  const email = normalizeEmail(value?.email);
  const username = String(value?.username || email.split('@')[0]).trim().slice(0, 80);
  if (!username) throw httpError(400, 'Username is required.');
  const passwordHash = await hashPassword(value?.password);
  try {
    const result = await query(
      `INSERT INTO users (id,username,email,password_hash,role,email_verified_at,signup_source,updated_at)
       VALUES ($1,$2,$3,$4,'user',NULL,'public',NOW())
       RETURNING id,username,email,role,token_version,must_change_password,created_at`,
      [crypto.randomUUID(), username, email, passwordHash]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') throw httpError(409, 'That email or username is already registered.');
    throw error;
  }
}

async function issueActionToken(userId, purpose, ttlMs) {
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await query('UPDATE auth_action_tokens SET consumed_at=NOW() WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL', [userId, purpose]);
  await query(
    `INSERT INTO auth_action_tokens (id,user_id,purpose,token_hash,expires_at)
     VALUES ($1,$2,$3,$4,NOW()+($5 * INTERVAL '1 millisecond'))`,
    [crypto.randomUUID(), userId, purpose, hash, ttlMs]
  );
  return token;
}

async function consumeActionToken(token, purpose) {
  const value = String(token || '');
  if (!value) return null;
  const hash = crypto.createHash('sha256').update(value).digest('hex');
  const result = await query(
    `UPDATE auth_action_tokens SET consumed_at=NOW()
     WHERE token_hash=$1 AND purpose=$2 AND consumed_at IS NULL AND expires_at>NOW()
     RETURNING user_id`,
    [hash, purpose]
  );
  return result.rows[0]?.user_id || null;
}

function sessionResponse(user) {
  return { token: createAccessToken(user), user: { id: user.id, username: user.username, email: user.email, role: user.role, must_change_password: user.must_change_password } };
}

async function ensureAnotherAdmin(excludedId) {
  const result = await query("SELECT COUNT(*)::int AS count FROM users WHERE role='admin' AND password_hash IS NOT NULL AND id<>$1", [excludedId]);
  if (result.rows[0].count < 1) throw httpError(409, 'At least one administrator account must remain.');
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'A valid email address is required.');
  return email;
}

function httpError(status, message) { const error = new Error(message); error.status = status; return error; }

export default router;
