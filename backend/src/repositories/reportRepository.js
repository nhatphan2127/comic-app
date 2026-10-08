// `reports`: readers flagging a comic or a comment. Listing joins the target so moderators
// see what was reported without an extra request per row.
import { v4 as uuidv4 } from 'uuid';
import { now, select } from '../config/database.js';
import { Report } from '../models/index.js';

export const insert = ({ userId, targetType, targetId, reason, details }) =>
  Report.create({ id: uuidv4(), userId, targetType, targetId, reason, details, createdAt: now(), updatedAt: now() });

export const findOpen = (userId, targetType, targetId) =>
  Report.findOne({ attributes: ['id'], where: { userId, targetType, targetId, status: 'open' }, raw: true });

export const findById = (id) => Report.findByPk(id, { attributes: ['id', 'status'], raw: true });

export const setStatus = (id, status, moderatorId) =>
  Report.update({ status, resolvedBy: moderatorId, updatedAt: now() }, { where: { id } });

// A comment can live in comic_comments or chapter_comments; both are joined and one of them matches.
const LIST = `
  SELECT
    r.id, r.targetType, r.targetId, r.reason, r.details, r.status, r.createdAt, r.updatedAt,
    u.username AS reporterUsername, u.displayName AS reporterDisplayName,
    c.name AS comicName, c.url AS comicUrl,
    COALESCE(cc.content, hc.content) AS commentContent,
    CASE WHEN cc.id IS NOT NULL THEN 'comic' WHEN hc.id IS NOT NULL THEN 'chapter' END AS commentSource,
    COALESCE(ccc.name, hcc.name) AS commentComicName,
    COALESCE(ccc.url, hcc.url) AS commentComicUrl,
    hc.chapterId AS commentChapterId
  FROM reports r
  LEFT JOIN users u ON u.id = r.userId
  LEFT JOIN comics c ON r.targetType = 'comic' AND c.id = r.targetId
  LEFT JOIN comic_comments cc ON r.targetType = 'comment' AND cc.id = r.targetId
  LEFT JOIN comics ccc ON ccc.id = cc.comicId
  LEFT JOIN chapter_comments hc ON r.targetType = 'comment' AND hc.id = r.targetId
  LEFT JOIN chapters h ON h.id = hc.chapterId
  LEFT JOIN comics hcc ON hcc.id = h.comicId`;

const statusWhere = (statuses) =>
  statuses.length ? { sql: ` WHERE r.status IN (${statuses.map(() => '?').join(', ')})`, values: statuses } : { sql: '', values: [] };

export function list({ statuses = [], limit, offset }) {
  const where = statusWhere(statuses);
  return select(`${LIST}${where.sql} ORDER BY r.createdAt DESC, r.id ASC LIMIT ? OFFSET ?`, [...where.values, limit, offset]);
}

export async function count({ statuses = [] }) {
  const where = statusWhere(statuses);
  const [row] = await select(`SELECT COUNT(*) AS total FROM reports r${where.sql}`, where.values);
  return row.total;
}
