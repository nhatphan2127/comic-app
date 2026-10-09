import { Op } from 'sequelize';
import { now, select } from '../config/database.js';
import { User } from '../models/index.js';
import { readableSql } from './visibility.js';

const PUBLIC_COLUMNS = ['id', 'avatar', 'background', 'displayName', 'username', 'email', 'bio', 'socialLinks', 'role', 'isBanned'];

export const findById = (id) => User.findByPk(id, { attributes: PUBLIC_COLUMNS, raw: true });

// What anyone may see about a user. Banned users have no public profile.
export const findPublicById = (id) =>
  User.findOne({
    attributes: ['id', 'username', 'displayName', 'avatar', 'background', 'bio', 'socialLinks', 'role', 'createdAt'],
    where: { id, isBanned: 0 },
    raw: true,
  });

// Active accounts registered with this email (emails are not unique).
export const listActiveByEmail = (email) =>
  User.findAll({ attributes: ['id', 'username', 'email'], where: { email, isBanned: 0 }, raw: true });

export const findIdByUsername = (username) => User.findOne({ attributes: ['id'], where: { username }, raw: true });

// Includes the password hash: only for authentication, never send this row to a client.
export const findWithPasswordByLogin = (usernameOrEmail) =>
  User.findOne({ where: { [Op.or]: [{ username: usernameOrEmail }, { email: usernameOrEmail }] }, raw: true });

export const findPasswordById = (id) => User.findByPk(id, { attributes: ['id', 'password'], raw: true });

export const insert = ({ id, username, passwordHash, email, displayName }) =>
  User.create({ id, username, password: passwordHash, email, displayName, role: 'user' });

const UPDATABLE = ['avatar', 'background', 'displayName', 'username', 'email', 'bio', 'socialLinks'];
const NULL_WHEN_EMPTY = ['avatar', 'background'];

// Only updates the fields that are present (not undefined).
export async function updateProfile(id, fields) {
  const changes = {};
  for (const column of UPDATABLE) {
    if (fields[column] === undefined) continue;
    changes[column] = NULL_WHEN_EMPTY.includes(column) && fields[column] === '' ? null : fields[column];
  }
  if (!Object.keys(changes).length) return;
  await User.update({ ...changes, updatedAt: now() }, { where: { id } });
}

export const updatePassword = (id, passwordHash) => User.update({ password: passwordHash, updatedAt: now() }, { where: { id } });

export const setRole = (id, role) => User.update({ role }, { where: { id } });

export const setBanned = (id, isBanned) => User.update({ isBanned: isBanned ? 1 : 0, updatedAt: now() }, { where: { id } });

export const listRecent = (limit = 100) =>
  User.findAll({
    attributes: ['id', 'username', 'displayName', 'email', 'role', 'isBanned', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit,
    raw: true,
  });

// Admin user table: search by username / display name / email, filter by role and ban state.
export function listForAdmin({ q, roles = [], isBanned, limit, offset }) {
  const where = {};
  if (q) {
    const like = { [Op.like]: `%${q}%` };
    where[Op.or] = [{ username: like }, { displayName: like }, { email: like }];
  }
  if (roles.length) where.role = roles;
  if (isBanned !== undefined) where.isBanned = isBanned ? 1 : 0;
  return User.findAndCountAll({
    attributes: ['id', 'username', 'displayName', 'email', 'avatar', 'role', 'isBanned', 'createdAt'],
    where,
    order: [['createdAt', 'DESC'], ['id', 'ASC']],
    limit,
    offset,
    raw: true,
  });
}

// Counters shown on the profile header: the same rows the profile lists show, so follows of hidden or
// unapproved comics, and deleted, banned or hidden comments don't count.
const COMIC_COMMENTS = `FROM comic_comments cc JOIN comics c ON cc.comicId = c.id
  WHERE cc.userId = :id AND cc.deletedAt IS NULL AND cc.isBanned = 0 AND ${readableSql('c')}`;
const CHAPTER_COMMENTS = `FROM chapter_comments cc JOIN chapters ch ON cc.chapterId = ch.id JOIN comics c ON ch.comicId = c.id
  WHERE cc.userId = :id AND cc.deletedAt IS NULL AND cc.isBanned = 0 AND ${readableSql('ch')} AND ${readableSql('c')}`;

export async function stats(id) {
  const [row] = await select(
    `SELECT
       (SELECT COUNT(*) FROM following f JOIN comics c ON f.comicId = c.id
        WHERE f.userId = :id AND ${readableSql('c')}) AS following,
       (SELECT COUNT(*) FROM following_categories WHERE userId = :id) AS collections,
       (SELECT COUNT(*) ${COMIC_COMMENTS}) + (SELECT COUNT(*) ${CHAPTER_COMMENTS}) AS comments,
       (SELECT COALESCE(SUM(cc.likes), 0) ${COMIC_COMMENTS}) + (SELECT COALESCE(SUM(cc.likes), 0) ${CHAPTER_COMMENTS}) AS likes`,
    { id }
  );
  return row;
}
