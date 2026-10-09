import { v4 as uuidv4 } from 'uuid';
import { select } from '../config/database.js';
import { Following } from '../models/index.js';
import { readableSql } from './visibility.js';

export const find = (userId, comicId) =>
  Following.findOne({ attributes: ['id', 'comicId', ['followingCategoryId', 'categoryId'], 'createdAt'], where: { userId, comicId }, raw: true });

export const insert = ({ userId, comicId, categoryId }) =>
  Following.create({ id: uuidv4(), userId, comicId, followingCategoryId: categoryId });

export const updateCategory = (userId, comicId, categoryId) =>
  Following.update({ followingCategoryId: categoryId }, { where: { userId, comicId } });

export const remove = (userId, comicId) => Following.destroy({ where: { userId, comicId } });

export const clearCategory = (userId, categoryId) =>
  Following.update({ followingCategoryId: null }, { where: { followingCategoryId: categoryId, userId } });

// The "following" page: one row per followed comic with its category and reading progress.
// Only comics readers can see; follows of hidden or unapproved comics stay in the table but out of sight.
// Kept in SQL because of the per-row subqueries.
export const listForUser = (userId) =>
  select(
    `SELECT
       f.userId,
       f.updatedAt AS followingUpdatedAt,
       fc.id AS categoryId,
       fc.category AS categoryName,
       c.id AS comicId,
       c.name AS comicName,
       c.url AS comicUrl,
       c.coverUrl AS comicCoverUrl,
       c.description AS comicDescription,
       c.updatedAt AS comicUpdatedAt,
       c.types AS comicTypes,
       c.contentRating AS comicContentRating,
       c.demographic AS comicDemographic,
       c.releaseStatus AS comicReleaseStatus,
       c.releasingYear AS comicReleasingYear,
       c.rating AS comicRating,
       c.view AS comicView,
       c.follow AS comicFollow,
       au.name AS authorName,
       ar.name AS artistName,
       (SELECT rating FROM rating_history WHERE userId = f.userId AND comicId = c.id) AS userRating,
       -- Number of chapters that are not soft-deleted
       (SELECT COUNT(*) FROM chapters WHERE comicId = c.id AND deletedAt IS NULL AND status = 'accept' AND visibility = 'public') AS totalChapters,
       -- Readable chapters numbered after the furthest one the user has opened
       (SELECT COUNT(*) FROM chapters ch2
        WHERE ch2.comicId = c.id AND ch2.deletedAt IS NULL AND ch2.status = 'accept' AND ch2.visibility = 'public'
          AND ch2.chapterNumber > COALESCE((
            SELECT MAX(ch.chapterNumber) FROM read_history rh JOIN chapters ch ON rh.chapterId = ch.id
            WHERE ch.comicId = c.id AND rh.userId = f.userId), -1)) AS unreadChapters,
       (SELECT MAX(updatedAt) FROM chapters WHERE comicId = c.id AND deletedAt IS NULL AND status = 'accept' AND visibility = 'public') AS latestChapterAt,
       (SELECT MAX(rh.readAt) FROM read_history rh JOIN chapters ch ON rh.chapterId = ch.id
        WHERE ch.comicId = c.id AND rh.userId = f.userId AND ${readableSql('ch')}) AS lastReadAt,
       f.createdAt AS followedAt,
       -- Chapter number of the most recently read chapter
       (SELECT ch.chapterNumber
        FROM read_history rh
        JOIN chapters ch ON rh.chapterId = ch.id
        WHERE ch.comicId = c.id AND rh.userId = f.userId AND ${readableSql('ch')}
        ORDER BY rh.readAt DESC
        LIMIT 1) AS readedChapter
     FROM following f
     JOIN comics c ON f.comicId = c.id
     LEFT JOIN following_categories fc ON f.followingCategoryId = fc.id
     LEFT JOIN author au ON c.authorId = au.id
     LEFT JOIN artist ar ON c.artistId = ar.id
     WHERE f.userId = ? AND ${readableSql('c')}
     ORDER BY c.name`,
    [userId]
  );
