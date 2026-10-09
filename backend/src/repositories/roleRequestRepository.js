// `role_requests`: readers asking to become contributors. Listing joins the applicant so admins
// see who is asking without an extra request per row.
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { now, select } from '../config/database.js';
import { RoleRequest } from '../models/index.js';

const COLUMNS = ['id', 'userId', 'requestedRole', 'reason', 'portfolio', 'status', 'reviewNote', 'createdAt', 'updatedAt'];

export const insert = ({ userId, requestedRole, reason, portfolio }) =>
  RoleRequest.create({ id: uuidv4(), userId, requestedRole, reason, portfolio, status: 'pending', createdAt: now(), updatedAt: now() });

export const findById = (id) => RoleRequest.findByPk(id, { attributes: COLUMNS, raw: true });

// The user's newest request that was not withdrawn: what the profile shows.
export const findLatestForUser = (userId) =>
  RoleRequest.findOne({
    attributes: COLUMNS,
    where: { userId, status: { [Op.ne]: 'cancelled' } },
    order: [['createdAt', 'DESC']],
    raw: true,
  });

export const findPendingForUser = (userId) =>
  RoleRequest.findOne({ attributes: COLUMNS, where: { userId, status: 'pending' }, raw: true });

export const setStatus = (id, { status, reviewerId = null, reviewNote = null }) =>
  RoleRequest.update({ status, reviewerId, reviewNote, updatedAt: now() }, { where: { id } });

// `updatedAt` is SQLite text, so the age is computed by SQLite itself.
export async function daysSinceUpdate(id) {
  const [row] = await select(`SELECT julianday('now') - julianday(updatedAt) AS days FROM role_requests WHERE id = ?`, [id]);
  return row ? row.days : null;
}

const LIST = `
  SELECT
    r.id, r.requestedRole, r.reason, r.portfolio, r.status, r.reviewNote, r.createdAt, r.updatedAt,
    u.id AS userId, u.username, u.displayName, u.avatar, u.role AS userRole, u.createdAt AS userCreatedAt,
    v.username AS reviewerUsername, v.displayName AS reviewerDisplayName
  FROM role_requests r
  JOIN users u ON u.id = r.userId
  LEFT JOIN users v ON v.id = r.reviewerId`;

const statusWhere = (statuses) =>
  statuses.length ? { sql: ` WHERE r.status IN (${statuses.map(() => '?').join(', ')})`, values: statuses } : { sql: '', values: [] };

export function list({ statuses = [], limit, offset }) {
  const where = statusWhere(statuses);
  return select(`${LIST}${where.sql} ORDER BY r.createdAt DESC, r.id ASC LIMIT ? OFFSET ?`, [...where.values, limit, offset]);
}

export async function count({ statuses = [] }) {
  const where = statusWhere(statuses);
  const [row] = await select(`SELECT COUNT(*) AS total FROM role_requests r${where.sql}`, where.values);
  return row.total;
}
