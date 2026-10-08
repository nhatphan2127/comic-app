// Comment logic shared by comic and chapter comments. `type` is 'comic' or 'chapter'.
// Routes address a single comment only by its id (/comments/:commentId), so findComment()
// looks it up in both tables.
import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../config/database.js';
import * as commentRepo from '../repositories/commentRepository.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import { buildCommentTree } from '../helpers/helpers.js';
import { notifyReply } from './notificationService.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors.js';

export const SORTS = Object.keys(commentRepo.ROOT_ORDERS); // '-score' (best), '-createdAt' (newest), 'createdAt' (oldest)
const TREE_SORT = { '-score': 'best', '-createdAt': 'newest', createdAt: 'oldest' };
const REACTIONS = ['like', 'dislike'];

const TARGET_LOOKUP = {
  comic: { find: comicRepo.findById, notFound: 'Comic not found' },
  chapter: { find: chapterRepo.findById, notFound: 'Chapter not found' },
};

async function assertTargetExists(type, targetId) {
  const lookup = TARGET_LOOKUP[type];
  if (!(await lookup.find(targetId))) throw new NotFoundError(lookup.notFound);
}

// Finds a comment in whichever table holds it: { type, comment } or a 404.
async function findComment(commentId) {
  for (const type of commentRepo.COMMENT_TYPES) {
    const comment = await commentRepo.findById(type, commentId);
    if (comment) return { type, comment };
  }
  throw new NotFoundError('Comment not found');
}

async function findOwnedComment(commentId, userId, action) {
  const found = await findComment(commentId);
  if (found.comment.userId !== userId) throw new ForbiddenError(`You can only ${action} your own comment`);
  return found;
}

// One page of root comments (with all their replies nested). Returns { items, totalItems }.
export async function listForTarget(type, targetId, { sort, page }, viewerId = null) {
  await assertTargetExists(type, targetId);
  const [rows, totalItems] = await Promise.all([
    commentRepo.listPageWithReplies(type, targetId, { viewerId, sort, limit: page.limit, offset: page.offset }),
    commentRepo.countRoots(type, targetId),
  ]);
  return { items: buildCommentTree(rows, TREE_SORT[sort]), totalItems };
}

export async function getWithReplies(commentId, viewerId = null) {
  const { type } = await findComment(commentId);
  const rows = await commentRepo.listSubtree(type, commentId, viewerId);
  return { ...buildCommentTree(rows, 'best')[0], type };
}

export async function post(type, targetId, userId, { content, parentCommentId }) {
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) throw new BadRequestError('Comment content is required');

  await assertTargetExists(type, targetId);
  if (parentCommentId && !(await commentRepo.findInTarget(type, parentCommentId, targetId))) {
    throw new NotFoundError('Parent comment not found');
  }

  const id = uuidv4();
  await commentRepo.insert(type, { id, targetId, userId, content: text, parentCommentId: parentCommentId || null });
  if (parentCommentId) await notifyReply(type, targetId, parentCommentId, id, userId, text);
  return { id, type, content: text, parentCommentId: parentCommentId || null, userReaction: 'none' };
}

export async function edit(commentId, userId, content) {
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) throw new BadRequestError('Comment content is required');
  const { type } = await findOwnedComment(commentId, userId, 'edit');
  await commentRepo.updateContent(type, commentId, text);
  return { id: commentId, type, content: text };
}

export async function remove(commentId, userId) {
  const { type } = await findOwnedComment(commentId, userId, 'delete');
  await commentRepo.softDelete(type, commentId);
}

// PUT semantics: after the call the viewer's reaction IS `reactionType` (repeating it changes nothing).
// The reaction row and the likes/dislikes counters change together in one transaction.
export async function setReaction(commentId, userId, reactionType) {
  if (!REACTIONS.includes(reactionType)) throw new BadRequestError(`"type" must be one of: ${REACTIONS.join(', ')}`);
  const { type } = await findComment(commentId);

  return withTransaction(async () => {
    const previous = await commentRepo.findReaction(type, userId, commentId);
    if (previous !== reactionType) {
      if (previous) {
        await commentRepo.updateReaction(type, userId, commentId, reactionType);
        await commentRepo.adjustCounters(type, commentId, { [previous]: -1, [reactionType]: +1 });
      } else {
        await commentRepo.insertReaction(type, userId, commentId, reactionType);
        await commentRepo.adjustCounters(type, commentId, { [reactionType]: +1 });
      }
    }
    const counts = await commentRepo.countReactions(type, commentId);
    return { commentId, userReaction: reactionType, likes: counts.likes, dislikes: counts.dislikes };
  });
}

export async function removeReaction(commentId, userId) {
  const { type } = await findComment(commentId);
  await withTransaction(async () => {
    const previous = await commentRepo.findReaction(type, userId, commentId);
    if (!previous) return;
    await commentRepo.deleteReaction(type, userId, commentId);
    await commentRepo.adjustCounters(type, commentId, { [previous]: -1 });
  });
}

// `sort` is validated against commentRepo.USER_SORTABLE_FIELDS by the controller.
export async function listByUser(userId, { sort, page, publicOnly = false }) {
  const [items, totalItems] = await Promise.all([
    commentRepo.listByUser(userId, { sort, limit: page.limit, offset: page.offset, publicOnly }),
    commentRepo.countByUser(userId, { publicOnly }),
  ]);
  return { items, totalItems };
}

// ---------- Moderation (role checks happen in the routes) ----------

export async function forceDelete(commentId) {
  const { type } = await findComment(commentId);
  await commentRepo.softDelete(type, commentId);
}

export async function setBanned(commentId, isBanned) {
  const { type } = await findComment(commentId);
  await commentRepo.setBanned(type, commentId, isBanned);
  return { id: commentId, type, isBanned };
}

export async function listRecentForDashboard(limit = 50) {
  const lists = await Promise.all(commentRepo.COMMENT_TYPES.map((type) => commentRepo.listRecent(type, limit)));
  return lists.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
