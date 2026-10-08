import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../config/database.js';
import * as userRepo from '../repositories/userRepository.js';
import * as sessionRepo from '../repositories/sessionRepository.js';
import * as preferenceRepo from '../repositories/preferenceRepository.js';
import * as resetRepo from '../repositories/passwordResetRepository.js';
import { sendMail } from '../utils/mailer.js';
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from '../errors.js';

const BCRYPT_ROUNDS = 10;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72; // bcrypt ignores bytes beyond 72

const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function assertValidPassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new BadRequestError(`Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`);
  }
}

// Accepts legacy plain-text rows and upgrades them to a bcrypt hash on the first successful check.
export async function verifyPassword(user, password) {
  if (!user?.password || typeof password !== 'string') return false;

  if (isBcryptHash(user.password)) {
    return bcrypt.compare(password, user.password);
  }

  if (user.password !== password) return false;
  await userRepo.updatePassword(user.id, await hashPassword(password));
  return true;
}

export async function register({ userName, password, email, displayName }) {
  if (!userName || !password || !email || !displayName) {
    throw new BadRequestError('Missing required fields');
  }
  if (typeof userName !== 'string' || !USERNAME_PATTERN.test(userName)) {
    throw new BadRequestError('Username must be 3-32 characters: letters, numbers, _ . -');
  }
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new BadRequestError('Invalid email address');
  }
  assertValidPassword(password);
  if (typeof displayName !== 'string' || !displayName.trim() || displayName.length > 50) {
    throw new BadRequestError('Display name must be 1-50 characters');
  }

  // Hash outside the transaction: bcrypt is slow and the write lock should be held briefly.
  const passwordHash = await hashPassword(password);
  const id = uuidv4();

  await withTransaction(async () => {
    if (await userRepo.findIdByUsername(userName)) throw new ConflictError('Username already exists');
    await userRepo.insert({ id, username: userName, passwordHash, email, displayName });
    await preferenceRepo.insertDefault(id);
  });

  return { id, userName, displayName, role: 'user', createdAt: new Date().toISOString() };
}

export async function login(userName, password) {
  if (!userName || !password) throw new BadRequestError('Missing username or password');

  const user = await userRepo.findWithPasswordByLogin(userName);
  if (!(await verifyPassword(user, password))) throw new UnauthorizedError('Invalid credentials');
  if (user.isBanned) throw new ForbiddenError('This account has been banned');

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await sessionRepo.insert({ userId: user.id, token, expiresAt });

  return { token, expiresAt, user: { id: user.id, userName: user.username, role: user.role } };
}

export async function logout(token) {
  if (token) await sessionRepo.removeByToken(token);
}

// Returns the session (with user fields) for a valid, unexpired token, otherwise null.
export async function resolveSession(token) {
  const session = await sessionRepo.findWithUserByToken(token);
  if (!session) return null;
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) return null;
  return session;
}

// ---------- Password reset ----------

const RESET_TTL_MS = 30 * 60 * 1000;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Always succeeds, whether or not the email is registered, so the endpoint can't be used to find accounts.
export async function requestPasswordReset(email) {
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) throw new BadRequestError('Invalid email address');

  const users = await userRepo.listActiveByEmail(email.trim());
  const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
  for (const user of users) {
    const token = crypto.randomBytes(32).toString('hex');
    await withTransaction(async () => {
      await resetRepo.invalidateForUser(user.id);
      await resetRepo.insert({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString() });
    });
    await sendMail({
      to: user.email,
      subject: 'Reset your password',
      text:
        `Someone asked to reset the password of the account "${user.username}".\n\n` +
        `Open this link within 30 minutes to choose a new password:\n${appUrl}/reset-password?token=${token}\n\n` +
        'If it was not you, ignore this email: your password stays the same.',
    });
  }
}

// Sets the new password and logs the account out everywhere.
export async function resetPassword({ token, newPassword, confirmPassword }) {
  if (typeof token !== 'string' || !token) throw new BadRequestError('Reset token is required');
  if (newPassword !== confirmPassword) throw new BadRequestError('New passwords do not match');
  assertValidPassword(newPassword);

  const reset = await resetRepo.findUsable(hashToken(token));
  if (!reset) throw new BadRequestError('This reset link is invalid or has expired');

  const passwordHash = await hashPassword(newPassword);
  await withTransaction(async () => {
    await userRepo.updatePassword(reset.userId, passwordHash);
    await resetRepo.invalidateForUser(reset.userId);
    await sessionRepo.removeAllForUser(reset.userId);
  });
}
