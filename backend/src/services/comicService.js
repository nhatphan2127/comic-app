import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../config/database.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import * as ratingRepo from '../repositories/ratingRepository.js';
import * as historyRepo from '../repositories/historyRepository.js';
import * as viewRepo from '../repositories/viewRepository.js';
import * as lookupRepo from '../repositories/lookupRepository.js';
import * as contributorRepo from '../repositories/contributorRepository.js';
import { canManageComic } from './permissions.js';
import { initialReviewStatus } from './settingsService.js';
import { removeStoredFiles } from '../utils/storedFiles.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors.js';

const LATEST_CHAPTERS_PER_COMIC = 3;
const COMIC_TYPES = ['manga', 'manhwa', 'manhua', 'other'];
const CONTENT_RATINGS = ['safe', 'suggestive', 'erotica', 'pornographic'];

function normalizeEnum(value, field, allowed) {
  if (typeof value !== 'string') {
    throw new BadRequestError(`"${field}" must be one of: ${allowed.join(', ')}`);
  }
  const normalized = value.trim().toLowerCase();
  if (!allowed.includes(normalized)) {
    throw new BadRequestError(`"${field}" must be one of: ${allowed.join(', ')}`);
  }
  return normalized;
}

// ---------- Reading ----------

// Search, filter, sort and paginate the public catalogue. `filters` and `sort` are already
// validated by the controller (see comicController.listComics).
// Each item carries its genres and its latest chapters, so list pages need no extra requests.
export async function list({ filters, sort, page }) {
  const [comics, totalItems] = await Promise.all([
    comicRepo.listPublic({ filters, sort, limit: page.limit, offset: page.offset }),
    comicRepo.countPublic(filters),
  ]);
  return { items: await withGenresAndLatestChapters(comics), totalItems };
}

export const SUGGEST_LIMIT = 8;
export const SUGGEST_MIN_LENGTH = 2;

// Search-as-you-type. Too short a query matches almost everything, so it answers nothing instead.
export async function suggest({ q, contentRatings }) {
  if (q.length < SUGGEST_MIN_LENGTH) return [];
  const rows = await comicRepo.suggest({ q, contentRatings, limit: SUGGEST_LIMIT });
  return rows.map((row) => ({ ...row, rating: Number(row.rating || 0) }));
}

// Most active comics of the period (see viewRepository.listRanked), as catalogue items plus `rank` and `score`.
export async function rankings({ period, contentRatings, page }) {
  const [comics, totalItems] = await Promise.all([
    viewRepo.listRanked({ period, contentRatings, limit: page.limit, offset: page.offset }),
    viewRepo.countRanked({ period, contentRatings }),
  ]);
  const items = (await withGenresAndLatestChapters(comics))
    .map((comic, index) => ({ ...comic, rank: page.offset + index + 1, score: Number(comic.score) }));
  return { items, totalItems };
}

// Catalogue items (genres and latest chapters added), same order as `comics`. Also used by recommendations.
export async function withGenresAndLatestChapters(comics) {
  const ids = comics.map((c) => c.id);
  const [genres, chapters] = ids.length
    ? await Promise.all([comicRepo.listGenresForComics(ids), chapterRepo.listPublicForComics(ids)])
    : [[], []];

  // Chapter rows are ordered by chapterNumber DESC per comic, so the first ones are the latest.
  const latest = {};
  chapters.forEach((ch) => {
    latest[ch.comicId] ??= [];
    if (latest[ch.comicId].length < LATEST_CHAPTERS_PER_COMIC) {
      latest[ch.comicId].push({ id: ch.id, chapterNumber: ch.chapterNumber, title: ch.title, updatedAt: ch.updatedAt });
    }
  });

  return comics.map((comic) => ({
    ...comic,
    rating: Number(comic.rating || 0),
    genres: genres.filter((g) => g.comicId === comic.id).map((g) => g.name),
    latestChapters: latest[comic.id] || [],
  }));
}

// Shared by the public detail page and the moderation detail page.
async function toDetail(comic) {
  const [genres, formats] = await Promise.all([
    comicRepo.listGenreNames(comic.id),
    comicRepo.listFormatNames(comic.id),
  ]);
  return {
    id: comic.id,
    name: comic.name,
    description: comic.description,
    coverUrl: comic.coverUrl,
    source: comic.source,
    types: comic.types,
    contentRating: comic.contentRating,
    rating: comic.rating,
    view: comic.view,
    follow: comic.follow,
    releaseStatus: comic.releaseStatus,
    status: comic.status,
    visibility: comic.visibility,
    url: comic.url,
    releasingYear: comic.releasingYear,
    author: comic.author,
    artist: comic.artist,
    genres,
    formats,
  };
}

// `key` is the comic's id or its url slug.
export async function getPublicDetail(key, viewerId = null) {
  const comic = await comicRepo.findPublicDetail(key);
  if (!comic) throw new NotFoundError('Comic not found');

  const [detail, otherNames, userRating, history] = await Promise.all([
    toDetail(comic),
    comicRepo.listOtherNames(comic.id),
    viewerId ? ratingRepo.findUserRating(viewerId, comic.id) : null,
    viewerId ? historyRepo.listForComic(viewerId, comic.id) : [],
  ]);

  return {
    ...detail,
    names: [{ name: comic.name, country: 'global' }, ...otherNames.map(({ name, country }) => ({ name, country }))],
    userRating: userRating ? Number(userRating) : 0,
    // Where the viewer left off, for "Continue reading" and marking read chapters. null = never opened.
    progress: history.length
      ? { lastChapterId: history[0].chapterId, lastPage: history[0].currentPage, readChapterIds: history.map((h) => h.chapterId) }
      : null,
  };
}

// A comic as it will look once its parked edit (if any) is accepted: what moderators review and what the
// studio editor starts from. `pendingEdit` tells whether readers currently see an older, approved version.
async function toLatestDetail(comic) {
  const detail = await toDetail(comic);
  if (!comic.pendingChanges) return { ...detail, pendingEdit: false };
  const { columns, author, artist, genres, formats } = JSON.parse(comic.pendingChanges);
  const fields = { ...columns };
  delete fields.authorId;
  delete fields.artistId;
  fields.author ??= author;
  fields.artist ??= artist;
  delete fields.demographic;
  const names = (values) => (Array.isArray(values) ? values : values ? [values] : []);
  return {
    ...detail,
    ...fields,
    author: author || null,
    artist: artist || null,
    genres: names(genres),
    formats: names(formats),
    status: 'pending',
    pendingEdit: true,
  };
}

export async function getDetailForModeration(comicId) {
  const comic = await comicRepo.findDetailById(comicId);
  if (!comic) throw new NotFoundError('Comic not found');
  return toLatestDetail(comic);
}

// The studio editor: `key` is the id or url slug of a comic the user may manage, in any review state.
export async function getForEditing(user, key) {
  const comic = await comicRepo.findDetailForEditing(key);
  if (!comic || !(await canManageComic(user, comic.id))) throw new NotFoundError('Comic not found');
  const [detail, otherNames] = await Promise.all([toLatestDetail(comic), comicRepo.listOtherNames(comic.id)]);
  return {
    ...detail,
    names: [{ name: detail.name, country: 'global' }, ...otherNames.map(({ name, country }) => ({ name, country }))],
  };
}

// ---------- Writing ----------

function requireComicFields(input) {
  if (!input.name || !input.types || !input.url) {
    throw new BadRequestError('Missing required comic fields');
  }
}

// Turns form input into comic column values.
async function resolveComicColumns(input) {
  return {
    name: input.name,
    source: input.source || null,
    types: normalizeEnum(input.types, 'type', COMIC_TYPES),
    contentRating: input.contentRating
      ? normalizeEnum(input.contentRating, 'contentRating', CONTENT_RATINGS)
      : 'safe',
    description: input.description || null,
    url: input.url,
    releaseStatus: (input.releaseStatus || 'releasing').toLowerCase(),
    releasingYear: input.releasingYear ? Number(input.releasingYear) : null,
    author: input.author?.trim() || null,
    artist: input.artist?.trim() || null,
  };
}

async function saveLinks(comicId, input) {
  await comicRepo.replaceGenres(comicId, await lookupRepo.findOrCreateMany('genres', input.genres));
  await comicRepo.replaceFormats(comicId, await lookupRepo.findOrCreateMany('formats', input.formats));
}

// `status` overrides the site's review default (the admin ZIP import chooses it per import).
export async function createInTransaction(user, input, coverFilename, { status: statusOverride } = {}) {
  if (!coverFilename) throw new BadRequestError('Missing required comic fields or cover image');
  requireComicFields(input);

  const id = uuidv4();
  const coverUrl = `comics/${coverFilename}`;

  if (await comicRepo.findIdByUrl(input.url)) throw new ConflictError('Comic URL already exists');

  const status = statusOverride ?? (await initialReviewStatus());
  const columns = await resolveComicColumns(input);
  await comicRepo.insert({ id, ...columns, coverUrl, status });
  await saveLinks(id, input);
  await contributorRepo.insertIgnore('comic', { targetId: id, userId: user.id, status });
  return { id, name: input.name, coverUrl, status };
}

export async function create(user, input, coverFilename) {
  return withTransaction(() => createInTransaction(user, input, coverFilename));
}

// Every edit goes through moderation. A comic that is not live yet is edited in place and goes back to
// "pending". A live (approved) comic must stay readable meanwhile, so the edit is parked in
// `pendingChanges` and only applied when a moderator accepts it; rejecting it keeps the approved version.
// Cover files nothing points to any more are deleted once the change has committed; a new upload is
// deleted when the edit fails.
export async function update(user, comicId, input, coverFilename) {
  const newCover = coverFilename ? `comics/${coverFilename}` : null;
  try {
    const existing = await comicRepo.findById(comicId);
    if (!existing) throw new NotFoundError('Comic not found');
    if (!(await canManageComic(user, comicId))) throw new ForbiddenError('You can only edit comics you contribute to');
    requireComicFields(input);

    const live = existing.status === 'accept';
    const parked = existing.pendingChanges ? JSON.parse(existing.pendingChanges) : null;
    // A new edit of a live comic starts from the cover of the edit it replaces, if any.
    const coverUrl = newCover ?? (live && parked ? parked.columns.coverUrl : existing.coverUrl);

    await withTransaction(async () => {
      if (await comicRepo.findOtherWithUrl(input.url, comicId)) throw new ConflictError('Comic URL already exists');

      const columns = await resolveComicColumns(input);
      if (live) {
        await comicRepo.setPendingChanges(comicId, {
          columns: { ...columns, coverUrl },
          author: input.author || null,
          artist: input.artist || null,
          genres: input.genres ?? [],
          formats: input.formats ?? [],
        });
      } else {
        await comicRepo.updateAndResubmit(comicId, { ...columns, coverUrl });
        await saveLinks(comicId, input);
      }
      await contributorRepo.setStatusForUser('comic', comicId, user.id, 'pending');
    });

    // Live: the replaced edit's own cover. Not live: the old cover, replaced in place.
    const unused = live ? parked?.columns.coverUrl : existing.coverUrl;
    if (unused && unused !== coverUrl && unused !== existing.coverUrl) await removeStoredFiles([unused]);
    if (!live && existing.coverUrl !== coverUrl) await removeStoredFiles([existing.coverUrl]);

    return { id: comicId, name: input.name, coverUrl, status: 'pending' };
  } catch (err) {
    if (newCover) await removeStoredFiles([newCover]);
    throw err;
  }
}

// Moderation decided on a parked edit (call inside the review transaction). Accepting makes it the live
// version; rejecting drops it. Either way the comic itself stays approved and readable.
// Returns the cover files no longer used, for the caller to delete once the transaction has committed.
export async function settlePendingEdit(comicId, accept) {
  const comic = await comicRepo.findById(comicId);
  if (!comic?.pendingChanges) return [];
  const { columns: pendingColumns, author, artist, genres, formats } = JSON.parse(comic.pendingChanges);
  const columns = {
    ...pendingColumns,
    author: pendingColumns.author ?? author ?? null,
    artist: pendingColumns.artist ?? artist ?? null,
  };
  delete columns.authorId;
  delete columns.artistId;
  delete columns.demographic;
  const changedCover = columns.coverUrl !== comic.coverUrl;
  if (!accept) {
    await comicRepo.setPendingChanges(comicId, null);
    return changedCover ? [columns.coverUrl] : [];
  }
  // The url was free when the edit was made, but another comic may have taken it since.
  if (await comicRepo.findOtherWithUrl(columns.url, comicId)) throw new ConflictError('Comic URL already exists');
  await comicRepo.applyPendingChanges(comicId, columns);
  await saveLinks(comicId, { genres, formats });
  return changedCover ? [comic.coverUrl] : [];
}
