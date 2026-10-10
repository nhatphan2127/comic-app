import { v4 as uuidv4 } from 'uuid';
import { now, select } from '../config/database.js';
import { literal } from 'sequelize';
import { Notification } from '../models/index.js';

// `isRead` undefined = both read and unread.
// createdAt only has second precision (CURRENT_TIMESTAMP), so rowid (insertion order) breaks ties:
// two notices sent in the same second still come out newest first.
export const listForUser = (userId, { isRead, limit, offset }) =>
  Notification.findAndCountAll({
    attributes: ['id', 'title', 'content', 'type', 'redirectPath', 'isRead', 'createdAt'],
    where: { userId, ...(isRead !== undefined && { isRead: isRead ? 1 : 0 }) },
    order: [['createdAt', 'DESC'], [literal('rowid'), 'DESC']],
    limit,
    offset,
    raw: true,
  });

// `userId` in the WHERE clause makes sure users can only change their own notifications.
// Returns the number of rows found (0 = no such notification for this user).
export async function setRead(id, userId, isRead) {
  const [count] = await Notification.update({ isRead: isRead ? 1 : 0 }, { where: { id, userId } });
  return count;
}

export const findForUser = (id, userId) =>
  Notification.findOne({
    attributes: ['id', 'title', 'content', 'type', 'redirectPath', 'isRead', 'createdAt'],
    where: { id, userId },
    raw: true,
  });

// rows: [{ userId, title, content, type, redirectPath }]
export const insertMany = (rows) =>
  rows.length ? Notification.bulkCreate(rows.map((row) => ({ id: uuidv4(), isRead: 0, createdAt: now(), ...row }))) : [];

// Everything a notification about a chapter needs: the chapter, its comic and whether readers can see it.
export const findChapterContext = async (chapterId) =>
  (await select(
    `SELECT ch.id, ch.chapterNumber, ch.title, ch.status, ch.visibility,
            c.id AS comicId, c.name AS comicName, c.url AS comicUrl, c.status AS comicStatus, c.visibility AS comicVisibility
     FROM chapters ch JOIN comics c ON c.id = ch.comicId
     WHERE ch.id = ? AND ch.deletedAt IS NULL AND c.deletedAt IS NULL`,
    [chapterId]
  ))[0];

export const listFollowerIds = async (comicId) =>
  (await select('SELECT userId FROM following WHERE comicId = ?', [comicId])).map((row) => row.userId);
