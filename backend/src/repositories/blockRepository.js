import { select } from '../config/database.js';
import { UserBlock } from '../models/index.js';

// SQL condition "the author `column` is not someone viewer ? blocked", for the comment queries.
// Bind the viewer's id (or null for guests, who have blocked no one) to the `?`.
export const notBlockedBy = (column) => `${column} NOT IN (SELECT blockedId FROM user_blocks WHERE blockerId = ?)`;

export const exists = async (blockerId, blockedId) =>
  Boolean(await UserBlock.findOne({ attributes: ['blockerId'], where: { blockerId, blockedId }, raw: true }));

// Blocking twice keeps the first row (and its date).
export const insertIfMissing = (blockerId, blockedId) => UserBlock.findOrCreate({ where: { blockerId, blockedId } });

export const remove = (blockerId, blockedId) => UserBlock.destroy({ where: { blockerId, blockedId } });

// Most recently blocked first. Banned users stay listed so they can still be unblocked.
export const listForUser = (blockerId, { limit, offset }) =>
  select(
    `SELECT u.id, u.username, u.displayName, u.avatar, b.createdAt AS blockedAt
     FROM user_blocks b
     JOIN users u ON u.id = b.blockedId
     WHERE b.blockerId = ?
     ORDER BY b.createdAt DESC, u.id
     LIMIT ? OFFSET ?`,
    [blockerId, limit, offset]
  );

export const countForUser = (blockerId) => UserBlock.count({ where: { blockerId } });
