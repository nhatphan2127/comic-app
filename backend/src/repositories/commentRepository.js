// One repository for both comic comments and chapter comments. The two kinds live in separate
// tables with identical shapes, so every function takes `type` ('comic' | 'chapter') and picks the
// models (and, for the raw SQL tree queries, the table names) from TARGETS.
//
// Table names are interpolated into the raw SQL below. That is safe ONLY because they come from this
// fixed whitelist and never from user input; values always go through `?` placeholders.
import { col, fn, literal } from 'sequelize';
import { now, select } from '../config/database.js';
import { ChapterComment, ChapterCommentReaction, ComicComment, ComicCommentReaction } from '../models/index.js';
import { BadRequestError } from '../errors.js';
import { readableSql } from './visibility.js';

const TARGETS = {
  comic: {
    Comment: ComicComment,
    Reaction: ComicCommentReaction,
    table: 'comic_comments',
    reactions: 'comic_comment_reactions',
    fk: 'comicId',
    idColumns: 'cc.comicId, NULL AS chapterId',
    // Joins from a comment `cc` to what it is posted on, and the condition for readers to see it.
    joins: 'JOIN comics c ON cc.comicId = c.id',
    readable: `cc.deletedAt IS NULL AND cc.isBanned = 0 AND ${readableSql('c')}`,
  },
  chapter: {
    Comment: ChapterComment,
    Reaction: ChapterCommentReaction,
    table: 'chapter_comments',
    reactions: 'chapter_comment_reactions',
    fk: 'chapterId',
    idColumns: 'NULL AS comicId, cc.chapterId',
    joins: 'JOIN chapters ch ON cc.chapterId = ch.id JOIN comics c ON ch.comicId = c.id',
    readable: `cc.deletedAt IS NULL AND cc.isBanned = 0 AND ${readableSql('ch')} AND ${readableSql('c')}`,
  },
};

export const COMMENT_TYPES = Object.keys(TARGETS);

function target(type) {
  const t = TARGETS[type];
  if (!t) throw new BadRequestError('Unsupported target type');
  return t;
}

const COUNTER = { like: 'likes', dislike: 'dislikes' };

// ---------- Comment trees (recursive CTE, kept in SQL) ----------

// Columns shared by every tree query. `cc` = comment, `u` = author, `r` = the viewer's reaction.
const treeColumns = (t) => `cc.id, ${t.idColumns}, cc.userId, cc.content, cc.parentCommentId, cc.createdAt, cc.updatedAt,
  cc.likes, cc.dislikes, u.displayName, u.avatar, COALESCE(r.reactionType, 'none') AS userReaction`;
const treeJoins = (t) => `FROM ${t.table} cc
  LEFT JOIN users u ON cc.userId = u.id
  LEFT JOIN ${t.reactions} r ON r.commentId = cc.id AND r.userId = ?`;

// ORDER BY for each allowed `sort` value. Only these fixed strings ever reach the SQL.
export const ROOT_ORDERS = {
  '-score': 'cc.likes - cc.dislikes DESC, cc.createdAt DESC',
  '-createdAt': 'cc.createdAt DESC',
  createdAt: 'cc.createdAt ASC',
};

// A page of root comments (ordered by `sort`, a key of ROOT_ORDERS) plus all of their
// descendants, as a flat list.
export function listPageWithReplies(type, targetId, { viewerId, sort, limit, offset }) {
  const t = target(type);
  const orderBy = ROOT_ORDERS[sort];
  if (!orderBy) throw new BadRequestError('Unsupported sort');
  return select(
    `WITH RECURSIVE
       roots AS (
         SELECT cc.id FROM ${t.table} cc
         WHERE cc.${t.fk} = ? AND cc.parentCommentId IS NULL
         ORDER BY ${orderBy}, cc.id
         LIMIT ? OFFSET ?
       ),
       tree(id) AS (
         SELECT id FROM roots
         UNION ALL
         SELECT cc.id FROM ${t.table} cc JOIN tree ON cc.parentCommentId = tree.id
       )
     SELECT ${treeColumns(t)}
     ${treeJoins(t)}
     WHERE cc.id IN (SELECT id FROM tree)`,
    [targetId, limit, offset, viewerId]
  );
}

// One comment and all of its descendants, as a flat list.
export function listSubtree(type, commentId, viewerId) {
  const t = target(type);
  return select(
    `WITH RECURSIVE tree(id) AS (
       SELECT id FROM ${t.table} WHERE id = ?
       UNION ALL
       SELECT cc.id FROM ${t.table} cc JOIN tree ON cc.parentCommentId = tree.id
     )
     SELECT ${treeColumns(t)}
     ${treeJoins(t)}
     WHERE cc.id IN (SELECT id FROM tree)`,
    [commentId, viewerId]
  );
}

// ---------- Single comments ----------

export const countRoots = (type, targetId) => {
  const t = target(type);
  return t.Comment.count({ where: { [t.fk]: targetId, parentCommentId: null } });
};

export const findById = (type, id) => target(type).Comment.findByPk(id, { attributes: ['id', 'userId'], raw: true });

// A comment readers may see and act on: not deleted or banned, on a readable comic / chapter.
export const findReadable = async (type, id) => {
  const t = target(type);
  const [row] = await select(`SELECT cc.id, cc.userId FROM ${t.table} cc ${t.joins} WHERE cc.id = ? AND ${t.readable}`, [id]);
  return row ?? null;
};

export const findInTarget = (type, id, targetId) => {
  const t = target(type);
  return t.Comment.findOne({ attributes: ['id'], where: { id, [t.fk]: targetId }, raw: true });
};

export const insert = (type, { id, targetId, userId, content, parentCommentId }) => {
  const t = target(type);
  return t.Comment.create({ id, [t.fk]: targetId, userId, content, parentCommentId, likes: 0, dislikes: 0 });
};

export const updateContent = (type, id, content) =>
  target(type).Comment.update({ content, updatedAt: now() }, { where: { id } });

// Soft delete: replies and reactions keep a valid parent row.
export const softDelete = (type, id) =>
  target(type).Comment.update({ content: '', deletedAt: now() }, { where: { id } });

export const setBanned = (type, id, isBanned) =>
  target(type).Comment.update({ isBanned: isBanned ? 1 : 0 }, { where: { id } });

// ---------- Reactions ----------

export async function findReaction(type, userId, commentId) {
  const row = await target(type).Reaction.findOne({ attributes: ['reactionType'], where: { userId, commentId }, raw: true });
  return row?.reactionType || null;
}

export const insertReaction = (type, userId, commentId, reactionType) =>
  target(type).Reaction.create({ userId, commentId, reactionType });

export const updateReaction = (type, userId, commentId, reactionType) =>
  target(type).Reaction.update({ reactionType, createdAt: now() }, { where: { userId, commentId } });

export const deleteReaction = (type, userId, commentId) => target(type).Reaction.destroy({ where: { userId, commentId } });

// Adjusts the denormalized likes/dislikes counters, e.g. adjustCounters('comic', id, { like: -1, dislike: +1 }).
// Counters never go below 0. Deltas are numbers built by the service, never user input.
export async function adjustCounters(type, commentId, deltas) {
  const changes = {};
  for (const [reaction, delta] of Object.entries(deltas)) {
    if (!delta) continue;
    const column = COUNTER[reaction];
    changes[column] = literal(`MAX(${column} + ${Number(delta)}, 0)`);
  }
  if (Object.keys(changes).length) {
    await target(type).Comment.update(changes, { where: { id: commentId } });
  }
}

export async function countReactions(type, commentId) {
  const row = await target(type).Reaction.findOne({
    attributes: [
      [fn('COALESCE', fn('SUM', literal("reactionType = 'like'")), 0), 'likes'],
      [fn('COALESCE', fn('SUM', literal("reactionType = 'dislike'")), 0), 'dislikes'],
    ],
    where: { commentId },
    raw: true,
  });
  return { likes: row.likes, dislikes: row.dislikes };
}

// ---------- Cross-type listings ----------

// A user's comments of both kinds in one list (UNION, kept in SQL). Only what readers can see:
// banned comments and comments on hidden or unapproved comics / chapters are left out, on the
// user's own profile as well as on someone else's.
const userComments = () => `
     SELECT * FROM (
       SELECT cc.id, cc.content, cc.createdAt, cc.likes, cc.dislikes,
              c.name AS targetName, c.url AS targetUrl, c.coverUrl AS targetCoverUrl,
              NULL AS chapterId, 'comic' AS type,
              (SELECT COUNT(*) FROM comic_comments WHERE parentCommentId = cc.id) AS replyCount
       FROM comic_comments cc
       ${TARGETS.comic.joins}
       WHERE cc.userId = ? AND ${TARGETS.comic.readable}

       UNION ALL

       SELECT cc.id, cc.content, cc.createdAt, cc.likes, cc.dislikes,
              c.name AS targetName, c.url AS targetUrl, c.coverUrl AS targetCoverUrl,
              cc.chapterId AS chapterId, 'chapter' AS type,
              (SELECT COUNT(*) FROM chapter_comments WHERE parentCommentId = cc.id) AS replyCount
       FROM chapter_comments cc
       ${TARGETS.chapter.joins}
       WHERE cc.userId = ? AND ${TARGETS.chapter.readable}
     )`;

export const USER_SORTABLE_FIELDS = ['createdAt', 'likes', 'replyCount'];

// `sort` is [[field, direction], ...] already validated against USER_SORTABLE_FIELDS.
export function listByUser(userId, { sort, limit, offset }) {
  const orderBy = [...sort, ['id', 'ASC']].map(([field, direction]) => `${field} ${direction}`).join(', ');
  return select(`${userComments()} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [userId, userId, limit, offset]);
}

export async function countByUser(userId) {
  const [row] = await select(`SELECT COUNT(*) AS total FROM (${userComments()})`, [userId, userId]);
  return row.total;
}

export const listRecent = async (type, limit = 50) => {
  const t = target(type);
  const rows = await t.Comment.findAll({
    attributes: ['id', 'userId', [col(t.fk), 'targetId'], 'content', 'isBanned', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit,
    raw: true,
  });
  return rows.map((row) => ({ source: type, ...row }));
};
