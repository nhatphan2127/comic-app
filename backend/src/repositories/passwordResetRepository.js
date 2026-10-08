import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { now } from '../config/database.js';
import { PasswordReset } from '../models/index.js';

export const insert = ({ userId, tokenHash, expiresAt }) =>
  PasswordReset.create({ id: uuidv4(), userId, tokenHash, expiresAt, createdAt: now() });

// Unused and not expired. `expiresAt` is an ISO string, so string comparison orders correctly.
export const findUsable = (tokenHash) =>
  PasswordReset.findOne({
    attributes: ['id', 'userId'],
    where: { tokenHash, usedAt: null, expiresAt: { [Op.gt]: new Date().toISOString() } },
    raw: true,
  });

export const markUsed = (id) => PasswordReset.update({ usedAt: now() }, { where: { id } });

// A new link or a successful reset makes every older link of the user useless.
export const invalidateForUser = (userId) =>
  PasswordReset.update({ usedAt: now() }, { where: { userId, usedAt: null } });
