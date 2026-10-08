import { sequelize } from '../config/database.js';
import { TEXT, INTEGER, primaryId, ref, timestamp, withDefault, required } from './columns.js';

export const User = sequelize.define('User', {
  id: primaryId,
  avatar: TEXT,
  background: TEXT,
  displayName: TEXT,
  username: { type: TEXT, allowNull: false, unique: true },
  password: required(TEXT),
  email: TEXT,
  bio: TEXT,
  socialLinks: TEXT,
  role: withDefault(TEXT, 'user'), // user, contributor, moderator, admin
  isBanned: withDefault(INTEGER, 0),
  createdAt: timestamp(),
  updatedAt: timestamp(),
}, { tableName: 'users' });

export const UserPreference = sequelize.define('UserPreference', {
  userId: ref('users', { primaryKey: true }),
  theme: withDefault(TEXT, 'main'), // main, dark, light
  filter: withDefault(INTEGER, 1), // index into safe, suggestive, erotica, pornographic
  reader: TEXT, // reader settings as JSON; NULL = never saved
}, { tableName: 'user_preferences' });

// One-time password reset links. Only a SHA-256 hash of the token is stored.
export const PasswordReset = sequelize.define('PasswordReset', {
  id: primaryId,
  userId: ref('users'),
  tokenHash: required(TEXT),
  expiresAt: required(TEXT),
  usedAt: TEXT,
  createdAt: timestamp(),
}, { tableName: 'password_resets', indexes: [{ name: 'idx_password_resets_token', fields: ['tokenHash'], unique: true }] });

export const Session = sequelize.define('Session', {
  id: primaryId,
  userId: ref('users'),
  token: { type: TEXT, allowNull: false, unique: true },
  createdAt: timestamp(),
  expiresAt: TEXT,
}, { tableName: 'sessions' });
