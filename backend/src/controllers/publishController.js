// /publish (API key) and /me/api-keys (session): the contributors' publishing API.
import asyncHandler from '../utils/asyncHandler.js';
import { created, noContent, ok } from '../utils/http.js';
import { pageMeta, parsePagination } from '../utils/listQuery.js';
import * as publishService from '../services/publishService.js';
import * as apiKeyService from '../services/apiKeyService.js';

// ---------- Publishing (Authorization: Bearer ink_...) ----------

// GET /publish/whoami → which account and key a script is using
export const whoami = asyncHandler(async (req, res) => {
  ok(res, { user: req.user, key: req.apiKey });
});

// POST /publish/comics (multipart: fields + "cover") → 201, Location: /comics/:id
export const createComic = asyncHandler(async (req, res) => {
  const data = await publishService.createComic(req.user, req.body, req.file);
  created(res, `/comics/${data.id}`, data);
});

// POST /publish/comics/:comic/chapters (multipart: fields + "pages", in reading order) → 201, Location: /chapters/:id
export const createChapter = asyncHandler(async (req, res) => {
  const data = await publishService.createChapter(req.user, req.params.comic, req.body, req.files || []);
  created(res, `/chapters/${data.id}`, data);
});

// ---------- Key management (logged-in session) ----------

// GET /me/uploadable-comics?q=&page=&pageSize= → comics the user can add chapters to
export const listUploadableComics = asyncHandler(async (req, res) => {
  const page = parsePagination(req.query);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const { items, totalItems } = await publishService.listUploadableComics(req.user, { q, ...page });
  ok(res, items, pageMeta(page, totalItems));
});

export const listKeys = asyncHandler(async (req, res) => {
  ok(res, await apiKeyService.list(req.user.id));
});

// POST /me/api-keys { name, scopes?, expiresInDays? } → the key, including `token` this one time only
export const createKey = asyncHandler(async (req, res) => {
  const key = await apiKeyService.create(req.user, req.body || {});
  created(res, `/me/api-keys/${key.id}`, key);
});

export const revokeKey = asyncHandler(async (req, res) => {
  await apiKeyService.revoke(req.user.id, req.params.keyId);
  noContent(res);
});
