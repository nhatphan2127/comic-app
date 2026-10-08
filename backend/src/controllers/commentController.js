// Comments: listed and created under their parent (/comics/:comicId/comments, /chapters/:chapterId/comments),
// read and changed by id (/comments/:commentId).
import asyncHandler from '../utils/asyncHandler.js';
import { created, noContent, ok } from '../utils/http.js';
import { pageMeta, parsePagination } from '../utils/listQuery.js';
import { BadRequestError } from '../errors.js';
import * as commentService from '../services/commentService.js';

const targetIdOf = (type, req) => (type === 'comic' ? req.params.comicId : req.params.chapterId);

// GET .../comments?sort=-score|-createdAt|createdAt&page=&pageSize=
export const listComments = (type) =>
  asyncHandler(async (req, res) => {
    const page = parsePagination(req.query, { defaultPageSize: 10, maxPageSize: 50 });
    const sort = req.query.sort ?? '-score';
    if (!commentService.SORTS.includes(sort)) {
      throw new BadRequestError(`"sort" must be one of: ${commentService.SORTS.join(', ')}`);
    }
    const { items, totalItems } = await commentService.listForTarget(type, targetIdOf(type, req), { sort, page }, req.user?.id);
    ok(res, items, pageMeta(page, totalItems));
  });

// POST .../comments { content, parentCommentId? } → 201, Location: /comments/:id
export const postComment = (type) =>
  asyncHandler(async (req, res) => {
    const { content, parentCommentId } = req.body || {};
    const data = await commentService.post(type, targetIdOf(type, req), req.user.id, { content, parentCommentId });
    created(res, `/comments/${data.id}`, data);
  });

// GET /comments/:commentId (with all replies)
export const getComment = asyncHandler(async (req, res) => {
  ok(res, await commentService.getWithReplies(req.params.commentId, req.user?.id));
});

// PATCH /comments/:commentId { content }
export const editComment = asyncHandler(async (req, res) => {
  ok(res, await commentService.edit(req.params.commentId, req.user.id, req.body?.content));
});

// DELETE /comments/:commentId → 204
export const deleteComment = asyncHandler(async (req, res) => {
  await commentService.remove(req.params.commentId, req.user.id);
  noContent(res);
});

// PUT /comments/:commentId/reaction { type: like | dislike }
export const setReaction = asyncHandler(async (req, res) => {
  ok(res, await commentService.setReaction(req.params.commentId, req.user.id, req.body?.type));
});

// DELETE /comments/:commentId/reaction → 204
export const removeReaction = asyncHandler(async (req, res) => {
  await commentService.removeReaction(req.params.commentId, req.user.id);
  noContent(res);
});
