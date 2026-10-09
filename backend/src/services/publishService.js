// The publishing API: contributors' scripts create comics and chapters. Input is validated more
// strictly than the web form (scripts send anything), then the same services as the Studio do the work,
// so everything still goes through moderation exactly like a manual upload.
import * as comicService from './comicService.js';
import * as chapterService from './chapterService.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import { canManageComic, isStaff } from './permissions.js';
import { parseList } from '../utils/listQuery.js';
import { slugify } from '../utils/slug.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';

export const COMIC_TYPES = ['manga', 'manhwa', 'manhua', 'other'];
export const DEMOGRAPHICS = ['josei', 'seinen', 'shoujo', 'shounen'];
export const CONTENT_RATINGS = ['safe', 'suggestive', 'erotica', 'pornographic'];
export const RELEASE_STATUSES = ['releasing', 'finished', 'on hiatus', 'discontinued'];
// Same vocabulary as the Studio form. The API only links to these, it never invents new ones.
export const GENRES = [
  'Action', 'Adult', 'Adventure', 'Boys Love', 'Comedy', 'Crime', 'Drama', 'Ecchi', 'Fantasy', 'Girls Love', 'Harem',
  'Hentai', 'Historical', 'Horror', 'Isekai', 'Magical Girls', 'Mature', 'Mecha', 'Medical', 'Mystery', 'Philosophical',
  'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Smut', 'Sports', 'Superhero', 'Thriller', 'Tragedy', 'Wuxia',
];
export const FORMATS = ['4-Koma', 'Adaptation', 'Anthology', 'Award Winning', 'Doujinshi', 'Full Color', 'Long Strip', 'Oneshot', 'Web Comic'];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LIMITS = { name: 200, url: 120, description: 5000, source: 500, person: 100, title: 200 };

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function optionalText(body, field, max) {
  const value = text(body[field]);
  if (value.length > max) throw new BadRequestError(`"${field}" must be at most ${max} characters`);
  return value || undefined;
}

function oneOf(body, field, allowed, { required = false } = {}) {
  const value = text(body[field]).toLowerCase();
  if (!value) {
    if (required) throw new BadRequestError(`"${field}" is required (one of: ${allowed.join(', ')})`);
    return undefined;
  }
  if (!allowed.includes(value)) throw new BadRequestError(`"${field}" must be one of: ${allowed.join(', ')}`);
  return value;
}

// "Action, Romance" or repeated fields → canonical names from `allowed` (case-insensitive).
function vocabulary(body, field, allowed) {
  const byLower = new Map(allowed.map((name) => [name.toLowerCase(), name]));
  const values = parseList(body[field]);
  const unknown = values.filter((v) => !byLower.has(v));
  if (unknown.length) throw new BadRequestError(`Unknown ${field}: ${unknown.join(', ')}. Allowed: ${allowed.join(', ')}`);
  return values.map((v) => byLower.get(v));
}

function slugField(body, field, fallbackSource) {
  const given = text(body[field]);
  const slug = given || slugify(fallbackSource);
  if (!slug || slug.length > LIMITS.url || !SLUG_PATTERN.test(slug)) {
    throw new BadRequestError(`"${field}" must be lowercase letters, digits and dashes (max ${LIMITS.url} characters)`);
  }
  return slug;
}

export function parseComicInput(body = {}) {
  const name = text(body.name);
  if (!name || name.length > LIMITS.name) throw new BadRequestError(`"name" is required (max ${LIMITS.name} characters)`);

  const year = text(body.releasingYear);
  const maxYear = new Date().getFullYear() + 1;
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > maxYear)) {
    throw new BadRequestError(`"releasingYear" must be a year between 1900 and ${maxYear}`);
  }

  return {
    name,
    url: slugField(body, 'url', name),
    types: oneOf(body, 'type', COMIC_TYPES, { required: true }),
    demographic: oneOf(body, 'demographic', DEMOGRAPHICS, { required: true }),
    contentRating: oneOf(body, 'contentRating', CONTENT_RATINGS, { required: true }),
    releaseStatus: oneOf(body, 'releaseStatus', RELEASE_STATUSES) ?? 'releasing',
    releasingYear: year || undefined,
    description: optionalText(body, 'description', LIMITS.description),
    source: optionalText(body, 'source', LIMITS.source),
    author: optionalText(body, 'author', LIMITS.person),
    artist: optionalText(body, 'artist', LIMITS.person),
    genres: vocabulary(body, 'genres', GENRES),
    formats: vocabulary(body, 'formats', FORMATS),
  };
}

export async function createComic(user, body, coverFile) {
  const input = parseComicInput(body);
  if (!coverFile) throw new BadRequestError('"cover" image is required');
  const created = await comicService.create(user, input, coverFile.filename);
  return { id: created.id, url: input.url, name: created.name, status: created.status };
}

export async function createChapter(user, comicKey, body = {}, pageFiles = []) {
  const comic = await comicRepo.findForPublishing(comicKey);
  // Unreviewed comics are only open to the people who contribute to them (and staff).
  if (!comic || (comic.status !== 'accept' && !(await canManageComic(user, comic.id)))) throw new NotFoundError('Comic not found');

  const rawNumber = text(body.chapterNumber);
  const number = Number(rawNumber);
  if (!rawNumber || !Number.isFinite(number) || number < 0 || number > 100000) {
    throw new BadRequestError('"chapterNumber" must be a number between 0 and 100000 (e.g. 12 or 12.5)');
  }
  const title = optionalText(body, 'title', LIMITS.title) ?? `Chapter ${number}`;
  const url = slugField(body, 'url', `${comic.url}-chapter-${String(number).replace('.', '-')}`);
  if (!pageFiles.length) throw new BadRequestError('At least one image in "pages" is required');

  const existing = await chapterRepo.findLiveByNumber(comic.id, number);
  if (existing) throw new ConflictError(`Chapter ${number} of this comic already exists (id ${existing.id}, ${existing.status})`);

  const created = await chapterService.create(user, comic.id, { title, chapterNumber: number, url }, pageFiles.map((f) => f.filename));
  return {
    id: created.chapterId,
    comic: { id: comic.id, url: comic.url, name: comic.name },
    chapterNumber: created.chapterNumber,
    title: created.title,
    url,
    pages: created.imagesCount,
    status: created.status,
  };
}

// The Studio's "Comic folders" page: every comic this user's key could upload chapters to.
export async function listUploadableComics(user, { q, limit, offset }) {
  const { rows, count } = await comicRepo.listUploadable({ userId: isStaff(user) ? null : user.id, q, limit, offset });
  const items = rows.map((comic) => ({
    ...comic,
    latestChapter: comic.latestChapter === null ? null : Number(comic.latestChapter),
    mine: Boolean(comic.mine),
  }));
  return { items, totalItems: count };
}
