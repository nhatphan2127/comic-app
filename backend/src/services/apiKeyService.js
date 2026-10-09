// Personal access keys for the publishing API.
//
// A key looks like `ink_<prefix>_<secret>`:
//   - `ink_` makes leaked keys easy to recognise (and to add to secret scanners),
//   - `prefix` (12 hex chars) is public: it finds the row and is shown in the UI,
//   - `secret` (32 random bytes) never leaves the creation response; only SHA-256(key) is stored.
// SHA-256 (not bcrypt) is enough because the key is long and random, not a human password.
import crypto from 'node:crypto';
import * as apiKeyRepo from '../repositories/apiKeyRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import { verifyPassword } from './authService.js';
import { sendTo } from './notificationService.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../errors.js';

export const SCOPES = ['comics:write', 'chapters:write'];
export const EXPIRY_DAYS = [30, 90, 180, 365];
export const MAX_ACTIVE_KEYS = 10;
const NAME_MAX = 60;
const UPLOADER_ROLES = ['contributor', 'moderator', 'admin'];
const KEY_PATTERN = /^ink_([0-9a-f]{12})_([A-Za-z0-9_-]{43})$/;

const hash = (token) => crypto.createHash('sha256').update(token).digest();

const parseScopes = (raw) => {
  try {
    const scopes = JSON.parse(raw);
    return Array.isArray(scopes) ? scopes : [];
  } catch {
    return [];
  }
};

const isExpired = (key) => new Date(key.expiresAt) <= new Date();

// What the owner sees about a key (never the hash).
const toPublic = (row) => ({
  id: row.id,
  name: row.name,
  prefix: row.prefix,
  hint: `ink_${row.prefix}_…`,
  scopes: parseScopes(row.scopes),
  expiresAt: row.expiresAt,
  lastUsedAt: row.lastUsedAt,
  lastUsedIp: row.lastUsedIp,
  revokedAt: row.revokedAt,
  createdAt: row.createdAt,
  status: row.revokedAt ? 'revoked' : isExpired(row) ? 'expired' : 'active',
});

export const list = async (userId) => (await apiKeyRepo.listForUser(userId)).map(toPublic);

export async function create(user, { name, scopes, expiresInDays, password }) {
  if (!UPLOADER_ROLES.includes(user.role)) throw new ForbiddenError('Only contributors can create API keys');
  // A key outlives the session, so creating one asks for the password again (a stolen session alone can't mint one).
  if (!(await verifyPassword(await userRepo.findPasswordById(user.id), password))) throw new ForbiddenError('Password is incorrect');

  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName || cleanName.length > NAME_MAX) throw new BadRequestError(`"name" is required (max ${NAME_MAX} characters)`);

  const wanted = scopes === undefined ? SCOPES : scopes;
  if (!Array.isArray(wanted) || !wanted.length || wanted.some((s) => !SCOPES.includes(s))) {
    throw new BadRequestError(`"scopes" must be a non-empty list of: ${SCOPES.join(', ')}`);
  }

  const days = expiresInDays === undefined ? 90 : Number(expiresInDays);
  if (!EXPIRY_DAYS.includes(days)) throw new BadRequestError(`"expiresInDays" must be one of: ${EXPIRY_DAYS.join(', ')}`);

  if ((await apiKeyRepo.countActiveForUser(user.id)) >= MAX_ACTIVE_KEYS) {
    throw new ConflictError(`You already have ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
  }

  const prefix = crypto.randomBytes(6).toString('hex');
  const token = `ink_${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const row = await apiKeyRepo.insert({
    userId: user.id,
    name: cleanName,
    prefix,
    tokenHash: hash(token).toString('hex'),
    scopes: [...new Set(wanted)],
    expiresAt,
  });

  // A key appearing that its owner didn't create is the first sign of a stolen session.
  await sendTo(user.id, {
    type: 'system_security',
    title: 'New API key created',
    content: `"${cleanName}" (ink_${prefix}_…) can publish on your behalf until ${expiresAt.slice(0, 10)}. Revoke it in the Studio if this wasn't you.`,
    redirectPath: '/studio/api-keys',
  });

  return { ...toPublic((await apiKeyRepo.findForUser(row.id, user.id)) ?? row), token };
}

export async function revoke(userId, keyId) {
  const key = await apiKeyRepo.findForUser(keyId, userId);
  if (!key) throw new NotFoundError('API key not found');
  await apiKeyRepo.revoke(keyId, userId);
}

/**
 * Turns the raw `Authorization: Bearer ink_...` value into { key, user }, or throws 401/403.
 * Every failure before the hash check answers the same 401, so callers can't probe which prefixes exist.
 */
export async function authenticate(token, ip) {
  const invalid = new UnauthorizedError('Invalid API key');
  const match = typeof token === 'string' ? KEY_PATTERN.exec(token) : null;
  if (!match) throw invalid;

  const row = await apiKeyRepo.findByPrefixWithUser(match[1]);
  const expected = row ? Buffer.from(row.tokenHash, 'hex') : crypto.randomBytes(32);
  // Compare even when the row is missing, so timing doesn't reveal whether the prefix exists.
  const matches = crypto.timingSafeEqual(hash(token), expected) && Boolean(row);
  if (!matches) throw invalid;

  if (row.revokedAt) throw new UnauthorizedError('This API key was revoked');
  if (isExpired(row)) throw new UnauthorizedError('This API key has expired');
  // Role and ban are read from the users table on every request: demoting or banning someone
  // disables their keys immediately, without having to revoke them one by one.
  if (row.isBanned) throw new ForbiddenError('This account is banned');
  if (!UPLOADER_ROLES.includes(row.role)) throw new ForbiddenError('This account no longer has contributor access');

  await apiKeyRepo.touch(row.id, ip);
  return {
    key: { id: row.id, name: row.name, prefix: row.prefix, scopes: parseScopes(row.scopes), expiresAt: row.expiresAt },
    user: { id: row.userId, username: row.username, displayName: row.displayName, role: row.role },
  };
}
