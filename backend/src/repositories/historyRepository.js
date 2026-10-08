import { now, select } from '../config/database.js';
import { ReadHistory } from '../models/index.js';

// upsert = INSERT, or UPDATE the given fields when (userId, chapterId) already exists.
export const savePage = (userId, chapterId, currentPage) =>
  ReadHistory.upsert({ userId, chapterId, currentPage, readAt: now() });

// Opening a chapter bumps readAt but keeps the saved page and scroll position.
export const touch = (userId, chapterId) => ReadHistory.upsert({ userId, chapterId, readAt: now() });

export const findCurrentPage = (userId, chapterId) =>
  ReadHistory.findOne({ attributes: ['currentPage'], where: { userId, chapterId }, raw: true });

// Most recently read first.
export const listForUser = (userId, { limit, offset }) =>
  select(
    `SELECT rh.chapterId,
            rh.scrollPosition,
            rh.currentPage,
            rh.readAt,
            c.name AS comicName,
            c.url AS comicUrl,
            c.coverUrl AS coverUrl,
            ch.title AS chapterTitle,
            ch.url AS chapterUrl,
            ch.chapterNumber AS chapterNumber,
            (SELECT COUNT(*) FROM chapter_images WHERE chapterId = ch.id) AS totalPage
     FROM read_history rh
     JOIN chapters ch ON rh.chapterId = ch.id
     JOIN comics c ON ch.comicId = c.id
     WHERE rh.userId = ?
     ORDER BY rh.readAt DESC, rh.chapterId
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

// Same joins as listForUser, so the total matches what the pages can show.
export const countForUser = async (userId) =>
  (await select(
    `SELECT COUNT(*) AS total FROM read_history rh
     JOIN chapters ch ON rh.chapterId = ch.id
     JOIN comics c ON ch.comicId = c.id
     WHERE rh.userId = ?`,
    [userId]
  ))[0].total;

// The viewer's chapters of one comic, most recently read first.
export const listForComic = (userId, comicId) =>
  select(
    `SELECT rh.chapterId, rh.currentPage, rh.readAt
     FROM read_history rh
     JOIN chapters ch ON rh.chapterId = ch.id
     WHERE rh.userId = ? AND ch.comicId = ? AND ch.deletedAt IS NULL
     ORDER BY rh.readAt DESC, rh.chapterId`,
    [userId, comicId]
  );

export const remove = (userId, chapterId) => ReadHistory.destroy({ where: { userId, chapterId } });

export const clear = (userId) => ReadHistory.destroy({ where: { userId } });
