import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'wts_session';
const SESSION_DAYS = 30;
const PASSWORD_MAX = 128;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function normalizeEmail(email) {
  if (typeof email !== 'string') throw new Error('A valid email address is required.');
  const normalized = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized) || normalized.length > 254) {
    throw new Error('A valid email address is required.');
  }
  return normalized;
}

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > PASSWORD_MAX) {
    throw new Error('Password must be between 8 and 128 characters.');
  }
}

export async function hashPassword(password) {
  assertPassword(password);
  const salt = randomBytes(16).toString('base64url');
  const key = await scrypt(password, salt, 64, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${Buffer.from(key).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  try {
    assertPassword(password);
    const [algorithm, n, r, p, salt, expected] = String(encoded || '').split('$');
    if (algorithm !== 'scrypt' || n !== String(SCRYPT_N) || r !== String(SCRYPT_R) || p !== String(SCRYPT_P) || !salt || !expected) return false;
    const key = await scrypt(password, salt, 64, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
    const actual = Buffer.from(key);
    const wanted = Buffer.from(expected, 'base64url');
    return actual.length === wanted.length && timingSafeEqual(actual, wanted);
  } catch {
    return false;
  }
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function parseCookies(request) {
  const cookie = request.headers?.get?.('cookie') || request.headers?.cookie || '';
  return Object.fromEntries(cookie.split(';').map(part => {
    const index = part.indexOf('=');
    if (index === -1) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function cookieString(token, maxAge) {
  const secure = process.env.VERCEL_ENV ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token ? encodeURIComponent(token) : ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, maxAge)}${secure}`;
}

export function clearSessionCookie() {
  return cookieString('', 0);
}

export function sessionCookie(token) {
  return cookieString(token, SESSION_DAYS * 24 * 60 * 60);
}

export async function createSession(userId) {
  const sql = db();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await sql`insert into app_sessions (user_id, token_hash, expires_at) values (${userId}::uuid, ${tokenHash}, ${expiresAt}::timestamptz)`;
  return token;
}

export async function destroySession(request) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return;
  const sql = db();
  await sql`delete from app_sessions where token_hash = ${hashToken(token)}`;
}

export async function requireAuth(request, { roles = [] } = {}) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) throw Object.assign(new Error('Authentication required.'), { status: 401 });

  const tokenHash = hashToken(token);
  const sql = db();
  const [row] = await sql`
    select
      u.id as user_id,
      u.email,
      u.full_name,
      u.role as account_role,
      w.id as workspace_id,
      w.name as workspace_name,
      wm.role as workspace_role,
      s.expires_at
    from app_sessions s
    join app_users u on u.id = s.user_id
    join workspace_members wm on wm.user_id = s.user_id
    join workspaces w on w.id = wm.workspace_id
    where s.token_hash = ${tokenHash}
      and s.expires_at > now()
    order by wm.created_at asc
    limit 1
  `;

  if (!row) throw Object.assign(new Error('Your session has expired. Please sign in again.'), { status: 401 });
  if (roles.length && !roles.includes(row.account_role) && !roles.includes(row.workspace_role)) {
    throw Object.assign(new Error('You do not have permission to perform this action.'), { status: 403 });
  }

  await sql`update app_sessions set last_seen_at = now() where token_hash = ${tokenHash}`;
  return {
    user: { id: row.user_id, email: row.email, full_name: row.full_name, role: row.account_role },
    workspace: { id: row.workspace_id, name: row.workspace_name, role: row.workspace_role },
  };
}

export function authErrorStatus(error) {
  return Number.isInteger(error?.status) ? error.status : 500;
}

export { normalizeEmail };
