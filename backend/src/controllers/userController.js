// /users/:userId: public profiles. Everything private lives under /me.
import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';
import { pageMeta, parsePagination, parseSort } from '../utils/listQuery.js';
import * as userService from '../services/userService.js';
import * as commentService from '../services/commentService.js';
import { USER_SORTABLE_FIELDS } from '../repositories/commentRepository.js';

export const getUser = asyncHandler(async (req, res) => {
  ok(res, await userService.getPublicProfile(req.params.userId));
});

// GET /users/:userId/comments?sort=-createdAt&page=&pageSize=
export const listUserComments = asyncHandler(async (req, res) => {
  await userService.getPublicProfile(req.params.userId); // 404 for unknown or banned users
  const page = parsePagination(req.query);
  const sort = parseSort(req.query.sort, USER_SORTABLE_FIELDS, [['createdAt', 'DESC']]);
  const { items, totalItems } = await commentService.listByUser(req.params.userId, { sort, page });
  ok(res, items, pageMeta(page, totalItems));
});
