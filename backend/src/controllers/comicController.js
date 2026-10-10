// /comics and /chapters: the public catalogue, uploads and contributor review.
import asyncHandler from '../utils/asyncHandler.js';
import { created, ok } from '../utils/http.js';
import { pageMeta, parseEnumList, parseList, parsePagination, parseSort } from '../utils/listQuery.js';
import * as comicService from '../services/comicService.js';
import * as chapterService from '../services/chapterService.js';
import * as contributorService from '../services/contributorService.js';
import { SORTABLE_FIELDS as COMIC_SORT_FIELDS } from '../repositories/comicRepository.js';
import { SORTABLE_FIELDS as CHAPTER_SORT_FIELDS } from '../repositories/chapterRepository.js';
import { RANKING_PERIODS } from '../repositories/viewRepository.js';
import { BadRequestError } from '../errors.js';

export const CONTENT_RATINGS = ['safe', 'suggestive', 'erotica', 'pornographic'];
export const COMIC_TYPES = ['manga', 'manhwa', 'manhua', 'other'];
export const DEMOGRAPHICS = ['josei', 'seinen', 'shoujo', 'shounen'];
export const RELEASE_STATUSES = ['releasing', 'finished', 'on hiatus', 'discontinued'];

// Fields accepted from the comic form (multipart). Anything else in the body is ignored.
const pickComicInput = (body = {}) => {
  const { name, source, types, contentRating, demographic, description, url, author, artist, genres, formats, releaseStatus, releasingYear } = body;
  return { name, source, types, contentRating, demographic, description, url, author, artist, genres, formats, releaseStatus, releasingYear };
};

// ---------- Comics ----------

// GET /comics?q=&contentRating=&type=&demographic=&releaseStatus=&genre=&format=&sort=&page=&pageSize=
export const listComics = asyncHandler(async (req, res) => {
  const { query } = req;
  const page = parsePagination(query);
  const filters = {
    q: typeof query.q === 'string' ? query.q.trim() : undefined,
    contentRatings: parseEnumList(query.contentRating, 'contentRating', CONTENT_RATINGS),
    types: parseEnumList(query.type, 'type', COMIC_TYPES),
    demographics: parseEnumList(query.demographic, 'demographic', DEMOGRAPHICS),
    releaseStatuses: parseEnumList(query.releaseStatus, 'releaseStatus', RELEASE_STATUSES),
    genres: parseList(query.genre),
    formats: parseList(query.format),
  };
  const sort = parseSort(query.sort, COMIC_SORT_FIELDS);
  const { items, totalItems } = await comicService.list({ filters, sort, page });
  ok(res, items, pageMeta(page, totalItems));
});

// GET /comics/rankings?period=day|week|month|all&contentRating=&page=&pageSize=
export const listRankings = asyncHandler(async (req, res) => {
  const { query } = req;
  const page = parsePagination(query);
  const period = query.period === undefined || query.period === '' ? 'week' : query.period;
  if (!RANKING_PERIODS.includes(period)) {
    throw new BadRequestError(`Invalid "period". Allowed: ${RANKING_PERIODS.join(', ')}`);
  }
  const contentRatings = parseEnumList(query.contentRating, 'contentRating', CONTENT_RATINGS);
  const { items, totalItems } = await comicService.rankings({ period, contentRatings, page });
  ok(res, items, pageMeta(page, totalItems));
});

// GET /comics/:comicId (id or url slug)
export const getComic = asyncHandler(async (req, res) => {
  ok(res, await comicService.getPublicDetail(req.params.comicId, req.user?.id));
});

// POST /comics (multipart, field "coverImage") → 201, Location: /comics/:id
export const createComic = asyncHandler(async (req, res) => {
  const data = await comicService.create(req.user, pickComicInput(req.body), req.file?.filename);
  created(res, `/comics/${data.id}`, data);
});

// PATCH /comics/:comicId (multipart, "coverImage" optional)
export const updateComic = asyncHandler(async (req, res) => {
  ok(res, await comicService.update(req.user, req.params.comicId, pickComicInput(req.body), req.file?.filename));
});

// ---------- Chapters ----------

// GET /comics/:comicId/chapters (id or url slug)?sort=chapterNumber&page=&pageSize=
export const listComicChapters = asyncHandler(async (req, res) => {
  const page = parsePagination(req.query, { defaultPageSize: 100, maxPageSize: 1000 });
  const sort = parseSort(req.query.sort, CHAPTER_SORT_FIELDS);
  const { items, totalItems } = await chapterService.listPublicByComic(req.params.comicId, { sort, page });
  ok(res, items, pageMeta(page, totalItems));
});

// GET /chapters/:chapterId (pages + the reader's saved progress)
export const getChapter = asyncHandler(async (req, res) => {
  ok(res, await chapterService.openForReading(req.params.chapterId, req.user));
});

// POST /comics/:comicId/chapters (multipart, field "images") → 201, Location: /chapters/:id
export const createChapter = asyncHandler(async (req, res) => {
  const { title, chapterNumber, url } = req.body || {};
  const filenames = (req.files || []).map((file) => file.filename);
  const data = await chapterService.create(req.user, req.params.comicId, { title, chapterNumber, url }, filenames);
  created(res, `/chapters/${data.chapterId}`, { id: data.chapterId, ...data });
});

// ---------- Contributors (comic and chapter share the handlers; `type` is fixed per route) ----------

const targetIdOf = (type, req) => (type === 'comic' ? req.params.comicId : req.params.chapterId);

export const listContributors = (type) =>
  asyncHandler(async (req, res) => {
    ok(res, await contributorService.listForTarget(type, targetIdOf(type, req)));
  });

// PATCH /comics/:comicId/contributors/:userId { status: accept | reject }
export const updateContributor = (type) =>
  asyncHandler(async (req, res) => {
    ok(res, await contributorService.updateStatus(type, targetIdOf(type, req), req.params.userId, req.body?.status));
  });
