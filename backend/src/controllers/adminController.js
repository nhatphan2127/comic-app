// /admin and /moderation. Role checks are on the routers (requireRole).
import asyncHandler from '../utils/asyncHandler.js';
import { noContent, ok } from '../utils/http.js';
import { pageMeta, parseBoolean, parseEnumList, parsePagination, parseSort } from '../utils/listQuery.js';
import * as adminService from '../services/adminService.js';
import * as moderationService from '../services/moderationService.js';
import * as comicService from '../services/comicService.js';
import * as chapterService from '../services/chapterService.js';
import * as commentService from '../services/commentService.js';
import * as settingsService from '../services/settingsService.js';
import * as roleRequestService from '../services/roleRequestService.js';
import { STAFF_SORTABLE_FIELDS as COMIC_SORT_FIELDS } from '../repositories/comicRepository.js';
import { STAFF_SORTABLE_FIELDS as CHAPTER_SORT_FIELDS } from '../repositories/chapterRepository.js';
import { BadRequestError } from '../errors.js';

const SORT_FIELDS = { comic: COMIC_SORT_FIELDS, chapter: CHAPTER_SORT_FIELDS };
const idOf = (type, req) => (type === 'comic' ? req.params.comicId : req.params.chapterId);

// GET /admin/comics, /admin/chapters, /moderation/comics, /moderation/chapters
//   ?q=&status=pending,accept&visibility=hidden&sort=-updatedAt&page=&pageSize=
export const listContent = (type) =>
  asyncHandler(async (req, res) => {
    const { query } = req;
    const page = parsePagination(query);
    const statuses = parseEnumList(query.status, 'status', adminService.REVIEW_STATUSES);
    const visibilities = parseEnumList(query.visibility, 'visibility', adminService.VISIBILITIES);
    const sort = parseSort(query.sort, SORT_FIELDS[type]);
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    const { items, totalItems } = await adminService.listContent(type, { q, statuses, visibilities, sort, page });
    ok(res, items, pageMeta(page, totalItems));
  });

// ---------- Admin ----------

export const getDashboard = asyncHandler(async (req, res) => {
  ok(res, await adminService.getDashboard());
});

// GET /admin/users?q=&role=contributor,moderator&isBanned=false&page=&pageSize=
export const listUsers = asyncHandler(async (req, res) => {
  const { query } = req;
  const page = parsePagination(query);
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const roles = parseEnumList(query.role, 'role', adminService.VALID_ROLES);
  const isBanned = parseBoolean(query.isBanned, 'isBanned');
  const { items, totalItems } = await adminService.listUsers({ q, roles, isBanned, page });
  ok(res, items, pageMeta(page, totalItems));
});

// PATCH /admin/users/:userId { role?, isBanned? }
export const updateUser = asyncHandler(async (req, res) => {
  const { role, isBanned } = req.body || {};
  ok(res, await adminService.updateUser(req.user.id, req.params.userId, { role, isBanned }));
});

// PATCH /admin/comics/:comicId, /admin/chapters/:chapterId { visibility: public | hidden }
export const updateVisibility = (type) =>
  asyncHandler(async (req, res) => {
    ok(res, await adminService.setVisibility(type, idOf(type, req), req.body?.visibility));
  });

// PATCH /admin/comments/:commentId { isBanned }
export const updateComment = asyncHandler(async (req, res) => {
  const { isBanned } = req.body || {};
  if (typeof isBanned !== 'boolean') throw new BadRequestError('"isBanned" must be a boolean');
  ok(res, await commentService.setBanned(req.params.commentId, isBanned));
});

export const getSettings = asyncHandler(async (req, res) => {
  ok(res, await settingsService.getSettings());
});

// PATCH /admin/settings { autoAccept }
export const updateSettings = asyncHandler(async (req, res) => {
  ok(res, await settingsService.updateSettings(req.body || {}));
});

// GET /admin/role-requests?status=pending&page=&pageSize=
export const listRoleRequests = asyncHandler(async (req, res) => {
  const page = parsePagination(req.query);
  const statuses = parseEnumList(req.query.status, 'status', roleRequestService.STATUSES);
  const { items, totalItems } = await roleRequestService.list({ statuses, page });
  ok(res, items, pageMeta(page, totalItems));
});

// PATCH /admin/role-requests/:requestId { status: approved | rejected, note? }
export const decideRoleRequest = asyncHandler(async (req, res) => {
  ok(res, await roleRequestService.decide(req.user.id, req.params.requestId, req.body || {}));
});

// ---------- Moderation ----------

// GET /moderation/queue?comicStatus=pending&chapterStatus=pending
export const getQueue = asyncHandler(async (req, res) => {
  const statuses = adminService.REVIEW_STATUSES;
  ok(res, await moderationService.getQueue({
    comicStatuses: parseEnumList(req.query.comicStatus, 'comicStatus', statuses),
    chapterStatuses: parseEnumList(req.query.chapterStatus, 'chapterStatus', statuses),
  }));
});

export const getComicForReview = asyncHandler(async (req, res) => {
  ok(res, await comicService.getDetailForModeration(req.params.comicId));
});

// GET /moderation/chapters/:chapterId: the chapter and its pages, whatever its review state.
export const getChapterForReview = asyncHandler(async (req, res) => {
  ok(res, await chapterService.getForReview(req.params.chapterId));
});

// PATCH /moderation/comics/:comicId, /moderation/chapters/:chapterId { status: accept | reject }
export const review = (type) =>
  asyncHandler(async (req, res) => {
    ok(res, await moderationService.review(type, idOf(type, req), req.body?.status));
  });

// DELETE /moderation/comments/:commentId → 204
export const forceDeleteComment = asyncHandler(async (req, res) => {
  await commentService.forceDelete(req.params.commentId);
  noContent(res);
});
