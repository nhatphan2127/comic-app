// `api_keys`: personal access keys for the publishing API. The full key is never stored.
import { v4 as uuidv4 } from 'uuid';
import { Op, col } from 'sequelize';
import { ApiKey, User } from '../models/index.js';

const PUBLIC_COLUMNS = ['id', 'name', 'prefix', 'scopes', 'expiresAt', 'lastUsedAt', 'lastUsedIp', 'revokedAt', 'createdAt'];

export const insert = ({ userId, name, prefix, tokenHash, scopes, expiresAt }) =>
  ApiKey.create({ id: uuidv4(), userId, name, prefix, tokenHash, scopes: JSON.stringify(scopes), expiresAt });

export const listForUser = (userId) =>
  ApiKey.findAll({ attributes: PUBLIC_COLUMNS, where: { userId }, order: [['createdAt', 'DESC'], ['id', 'ASC']], raw: true });

export const findForUser = (id, userId) => ApiKey.findOne({ attributes: PUBLIC_COLUMNS, where: { id, userId }, raw: true });

// Keys that still work: not revoked and not expired.
export const countActiveForUser = (userId) =>
  ApiKey.count({ where: { userId, revokedAt: null, expiresAt: { [Op.gt]: new Date().toISOString() } } });

// The key row plus what authorization needs to know about its owner, read fresh on every request.
export const findByPrefixWithUser = (prefix) =>
  ApiKey.findOne({
    attributes: [
      'id', 'userId', 'name', 'prefix', 'tokenHash', 'scopes', 'expiresAt', 'revokedAt',
      [col('user.username'), 'username'],
      [col('user.displayName'), 'displayName'],
      [col('user.role'), 'role'],
      [col('user.isBanned'), 'isBanned'],
    ],
    include: [{ model: User, as: 'user', attributes: [], required: true }],
    where: { prefix },
    raw: true,
  });

export const revoke = (id, userId) => ApiKey.update({ revokedAt: new Date().toISOString() }, { where: { id, userId, revokedAt: null } });

export const revokeAllForUser = (userId) => ApiKey.update({ revokedAt: new Date().toISOString() }, { where: { userId, revokedAt: null } });

export const touch = (id, ip) => ApiKey.update({ lastUsedAt: new Date().toISOString(), lastUsedIp: ip }, { where: { id } });
