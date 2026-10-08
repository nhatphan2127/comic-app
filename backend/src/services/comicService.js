import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../config/database.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import * as ratingRepo from '../repositories/ratingRepository.js';
import * as historyRepo from '../repositories/historyRepository.js';
import * as lookupRepo from '../repositories/lookupRepository.js';
import * as contributorRepo from '../repositories/contributorRepository.js';
import { canManageComic } from './permissions.js';
import { initialReviewStatus } from './settingsService.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors.js';

const LATEST_CHAPTERS_PER_COMIC = 3;

// ---------- Reading ----------

// Search, filter, sort and paginate the public catalogue. `filters` and `sort` are already
// validated by the controller (see comicController.listComics).
// Each item carries its genres and its latest chapters, so list pages need no extra requests.
export async function list({ filters, sort, page }) {
  const [comics, totalItems] = await Promise.all([
    comicRepo.listPublic({ filters, sort, limit: page.limit, offset: page.offset }),
    comicRepo.countPublic(filters),
  ]);

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

  const items = comics.map((comic) => ({
    ...comic,
    rating: Number(comic.rating || 0),
    genres: genres.filter((g) => g.comicId === comic.id).map((g) => g.name),
    latestChapters: latest[comic.id] || [],
  }));
  return { items, totalItems };
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
    demographic: comic.demographic,
    rating: comic.rating,
    view: comic.view,
    follow: comic.follow,
    releaseStatus: comic.releaseStatus,
    status: comic.status,
    visibility: comic.visibility,
    url: comic.url,
    releasingYear: comic.releasingYear,
    author: comic.authorName,
    artist: comic.artistName,
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

export async function getDetailForModeration(comicId) {
  const comic = await comicRepo.findDetailById(comicId);
  if (!comic) throw new NotFoundError('Comic not found');
  return toDetail(comic);
}

// ---------- Writing ----------

function requireComicFields(input) {
  if (!input.name || !input.types || !input.demographic || !input.url) {
    throw new BadRequestError('Missing required comic fields');
  }
}

// Turns form input into column values, creating author/artist/genre/format rows as needed.
async function resolveComicColumns(input) {
  return {
    name: input.name,
    source: input.source || null,
    types: input.types.toLowerCase(),
    contentRating: input.contentRating || 'safe',
    demographic: input.demographic.toLowerCase(),
    description: input.description || null,
    url: input.url,
    releaseStatus: (input.releaseStatus || 'releasing').toLowerCase(),
    releasingYear: input.releasingYear ? Number(input.releasingYear) : null,
    authorId: await lookupRepo.findOrCreateByName('author', input.author),
    artistId: await lookupRepo.findOrCreateByName('artist', input.artist),
  };
}

async function saveLinks(comicId, input) {
  await comicRepo.replaceGenres(comicId, await lookupRepo.findOrCreateMany('genres', input.genres));
  await comicRepo.replaceFormats(comicId, await lookupRepo.findOrCreateMany('formats', input.formats));
}

export async function create(user, input, coverFilename) {
  if (!coverFilename) throw new BadRequestError('Missing required comic fields or cover image');
  requireComicFields(input);

  const id = uuidv4();
  const coverUrl = `comics/${coverFilename}`;

  const status = await withTransaction(async () => {
    if (await comicRepo.findIdByUrl(input.url)) throw new ConflictError('Comic URL already exists');

    const initialStatus = await initialReviewStatus();
    const columns = await resolveComicColumns(input);
    await comicRepo.insert({ id, ...columns, coverUrl, status: initialStatus });
    await saveLinks(id, input);
    await contributorRepo.insertIgnore('comic', { targetId: id, userId: user.id, status: initialStatus });
    return initialStatus;
  });

  return { id, name: input.name, coverUrl, status };
}

// Editing sends the comic back to moderation.
export async function update(user, comicId, input, coverFilename) {
  const existing = await comicRepo.findById(comicId);
  if (!existing) throw new NotFoundError('Comic not found');
  if (!(await canManageComic(user, comicId))) throw new ForbiddenError('You can only edit comics you contribute to');
  requireComicFields(input);

  const coverUrl = coverFilename ? `comics/${coverFilename}` : existing.coverUrl;

  await withTransaction(async () => {
    if (await comicRepo.findOtherWithUrl(input.url, comicId)) throw new ConflictError('Comic URL already exists');

    const columns = await resolveComicColumns(input);
    await comicRepo.updateAndResubmit(comicId, { ...columns, coverUrl });
    await saveLinks(comicId, input);
    await contributorRepo.setStatusForUser('comic', comicId, user.id, 'pending');
  });

  return { id: comicId, name: input.name, coverUrl, status: 'pending' };
}
