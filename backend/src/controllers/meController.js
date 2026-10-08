// /me: everything that belongs to the logged-in user (profile, follows, ratings,
// reading history, notifications, own comments and contributions).
import asyncHandler from '../utils/asyncHandler.js';
import { created, noContent, ok } from '../utils/http.js';
import { pageMeta, parseBoolean, parsePagination, parseSort } from '../utils/listQuery.js';
import * as userService from '../services/userService.js';
import * as interactionService from '../services/interactionService.js';
import * as notificationService from '../services/notificationService.js';
import * as commentService from '../services/commentService.js';
import * as contributorService from '../services/contributorService.js';
import { USER_SORTABLE_FIELDS as COMMENT_SORT_FIELDS } from '../repositories/commentRepository.js';
import { BadRequestError } from '../errors.js';

// ---------- Profile ----------

export const getMe = asyncHandler(async (req, res) => {
  ok(res, await userService.getProfile(req.user.id));
});

// PATCH /me: only the fields that are sent change.
export const updateMe = asyncHandler(async (req, res) => {
  const { avatar, background, displayName, username, email, bio, socialLinks } = req.body || {};
  ok(res, await userService.updateProfile(req.user.id, { avatar, background, displayName, username, email, bio, socialLinks }));
});

// PUT /me/avatar, PUT /me/background (multipart): replaces the image.
export const putProfileImage = (kind) =>
  asyncHandler(async (req, res) => {
    ok(res, await userService.setProfileImage(req.user.id, kind, req.file?.filename));
  });

// PUT /me/password → 204. Other sessions of this user are logged out.
export const changePassword = asyncHandler(async (req, res) => {
  await userService.changePassword(req.user.id, req.session.token, req.body || {});
  noContent(res);
});

export const updatePreferences = asyncHandler(async (req, res) => {
  const { theme, filter, reader } = req.body || {};
  ok(res, await userService.updatePreferences(req.user.id, { theme, filter, reader }));
});

// ---------- Following ----------

export const listFollowing = asyncHandler(async (req, res) => {
  ok(res, await userService.getFollowingList(req.user.id));
});

export const getFollow = asyncHandler(async (req, res) => {
  ok(res, await interactionService.getFollow(req.user.id, req.params.comicId));
});

// PUT /me/following/:comicId { categoryId? } → 201 when newly followed, 200 when only the category changed.
export const putFollow = asyncHandler(async (req, res) => {
  const { comicId } = req.params;
  const { created: isNew, follow } = await interactionService.followComic(req.user.id, comicId, req.body?.categoryId || null);
  if (isNew) created(res, `/me/following/${comicId}`, follow);
  else ok(res, follow);
});

export const deleteFollow = asyncHandler(async (req, res) => {
  await interactionService.unfollowComic(req.user.id, req.params.comicId);
  noContent(res);
});

export const listFollowingCategories = asyncHandler(async (req, res) => {
  ok(res, await userService.getFollowingCategories(req.user.id));
});

export const createFollowingCategory = asyncHandler(async (req, res) => {
  const data = await userService.createFollowingCategory(req.user.id, req.body?.category);
  created(res, `/me/following-categories/${data.id}`, data);
});

export const updateFollowingCategory = asyncHandler(async (req, res) => {
  ok(res, await userService.renameFollowingCategory(req.user.id, req.params.categoryId, req.body?.category));
});

export const deleteFollowingCategory = asyncHandler(async (req, res) => {
  await userService.deleteFollowingCategory(req.user.id, req.params.categoryId);
  noContent(res);
});

// ---------- Ratings ----------

// PUT /me/ratings/:comicId { rating: 1-5 }
export const putRating = asyncHandler(async (req, res) => {
  ok(res, await interactionService.rateComic(req.user.id, req.params.comicId, Number(req.body?.rating)));
});

// DELETE /me/ratings/:comicId → the comic's new average (200, not 204: the client needs it)
export const deleteRating = asyncHandler(async (req, res) => {
  ok(res, await interactionService.unrateComic(req.user.id, req.params.comicId));
});

// ---------- Reading history ----------

export const listHistory = asyncHandler(async (req, res) => {
  const page = parsePagination(req.query);
  const { items, totalItems } = await userService.getReadingHistory(req.user.id, { page });
  ok(res, items, pageMeta(page, totalItems));
});

// PUT /me/history/:chapterId { currentPage }
export const putHistory = asyncHandler(async (req, res) => {
  ok(res, await interactionService.saveReadingHistory(req.user.id, req.params.chapterId, Number(req.body?.currentPage)));
});

export const deleteHistoryEntry = asyncHandler(async (req, res) => {
  await userService.removeHistoryChapter(req.user.id, req.params.chapterId);
  noContent(res);
});

export const clearHistory = asyncHandler(async (req, res) => {
  await userService.clearReadingHistory(req.user.id);
  noContent(res);
});

// ---------- Notifications ----------

// GET /me/notifications?isRead=false&page=&pageSize=
export const listNotifications = asyncHandler(async (req, res) => {
  const page = parsePagination(req.query);
  const isRead = parseBoolean(req.query.isRead, 'isRead');
  const { items, totalItems } = await notificationService.listForUser(req.user.id, { isRead, page });
  ok(res, items, pageMeta(page, totalItems));
});

// PATCH /me/notifications/:notificationId { isRead }
export const updateNotification = asyncHandler(async (req, res) => {
  const { isRead } = req.body || {};
  if (typeof isRead !== 'boolean') throw new BadRequestError('"isRead" must be a boolean');
  ok(res, await notificationService.setRead(req.user.id, req.params.notificationId, isRead));
});

// ---------- Own comments & contributions ----------

// GET /me/comments?sort=-createdAt|-likes|-replyCount&page=&pageSize=
export const listMyComments = asyncHandler(async (req, res) => {
  const page = parsePagination(req.query);
  const sort = parseSort(req.query.sort, COMMENT_SORT_FIELDS, [['createdAt', 'DESC']]);
  const { items, totalItems } = await commentService.listByUser(req.user.id, { sort, page });
  ok(res, items, pageMeta(page, totalItems));
});

export const listMyComicContributions = asyncHandler(async (req, res) => {
  ok(res, await contributorService.listMyComicContributions(req.user.id));
});

export const listMyChapterContributions = asyncHandler(async (req, res) => {
  ok(res, await contributorService.listMyChapterContributions(req.user.id));
});
