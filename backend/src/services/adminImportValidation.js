import path from 'node:path';
import { BadRequestError, PayloadTooLargeError } from '../errors.js';
import { slugify } from '../utils/slug.js';

const MB = 1024 * 1024;
// Long-strip (webtoon) pages are often 10-20 MB. Keep in sync with frontend/src/features/admin/imports/zipImport.ts.
export const MAX_IMAGE_BYTES = 32 * MB;
const MAX_COMIC_JSON_BYTES = 64 * 1024;
export const MAX_PAGES = 300;
const MAX_NAME = 200;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const COMIC_TYPES = ['manga', 'manhwa', 'manhua', 'other'];
const CONTENT_RATINGS = ['safe', 'suggestive', 'erotica', 'pornographic'];
const RELEASE_STATUSES = ['releasing', 'finished', 'on hiatus', 'discontinued'];
const GENRES = [
  'Action', 'Adult', 'Adventure', 'Boys Love', 'Comedy', 'Crime', 'Drama', 'Ecchi', 'Fantasy', 'Girls Love', 'Harem',
  'Hentai', 'Historical', 'Horror', 'Isekai', 'Magical Girls', 'Mature', 'Mecha', 'Medical', 'Mystery', 'Philosophical',
  'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Smut', 'Sports', 'Superhero', 'Thriller', 'Tragedy', 'Wuxia',
];
const FORMATS = ['4-Koma', 'Adaptation', 'Anthology', 'Award Winning', 'Doujinshi', 'Full Color', 'Long Strip', 'Oneshot', 'Web Comic'];

const MAX_ENTRIES = Number(process.env.ADMIN_IMPORT_MAX_ENTRIES) || 20000;
const MAX_TOTAL_BYTES =
  (Number(process.env.ADMIN_IMPORT_MAX_UNCOMPRESSED_MB) || 4096) * MB;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;

const text = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

// Common spellings used by other sites and older exports, mapped onto this app's values.
const ALIASES = {
  releaseStatus: {
    ongoing: 'releasing',
    publishing: 'releasing',
    completed: 'finished',
    complete: 'finished',
    ended: 'finished',
    hiatus: 'on hiatus',
    'on-hiatus': 'on hiatus',
    cancelled: 'discontinued',
    canceled: 'discontinued',
    dropped: 'discontinued',
  },
};
// Tags often listed as genres that belong to another field.
const TAG_FORMATS = {
  webtoon: 'Long Strip',
  'long strip': 'Long Strip',
  'full color': 'Full Color',
  'full colour': 'Full Color',
  webcomic: 'Web Comic',
  'web comic': 'Web Comic',
};
const TAG_TYPES = new Set(['manga', 'manhwa', 'manhua']);
const GENRE_ALIASES = {
  'sci fi': 'Sci-Fi',
  scifi: 'Sci-Fi',
  'science fiction': 'Sci-Fi',
  'shounen ai': 'Boys Love',
  'shonen ai': 'Boys Love',
  yaoi: 'Boys Love',
  'shoujo ai': 'Girls Love',
  'shojo ai': 'Girls Love',
  yuri: 'Girls Love',
  'magical girl': 'Magical Girls',
};
const DEFAULT_CONTENT_RATING = 'safe';
const tagKey = (value) => value.toLowerCase().replace(/[\s_-]+/g, ' ').trim();

function oneOf(value, field, allowed, required = false) {
  const raw = text(value).toLowerCase();
  const clean = ALIASES[field]?.[raw] ?? raw;
  if (!clean) {
    if (required) throw new BadRequestError(`"${field}" is required (one of: ${allowed.join(', ')})`);
    return undefined;
  }
  if (!allowed.includes(clean)) throw new BadRequestError(`"${field}" must be one of: ${allowed.join(', ')}`);
  return clean;
}

function optionalText(value, field, max) {
  const clean = text(value);
  if (clean.length > max) throw new BadRequestError(`"${field}" must be at most ${max} characters`);
  return clean || undefined;
}

function values(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  return typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

// Sorts genre/format tags: known ones are kept, format words are routed to their field,
// anything else is dropped and reported as a warning instead of failing the import.
function classifyTags(genreValue, formatValue) {
  const genreByKey = new Map(GENRES.map((name) => [tagKey(name), name]));
  const formatByKey = new Map(FORMATS.map((name) => [tagKey(name), name]));
  const genres = new Set();
  const formats = new Set();
  const dropped = new Set();
  for (const item of [...values(genreValue), ...values(formatValue)]) {
    const key = tagKey(item);
    if (genreByKey.has(key)) genres.add(genreByKey.get(key));
    else if (GENRE_ALIASES[key]) genres.add(GENRE_ALIASES[key]);
    else if (formatByKey.has(key)) formats.add(formatByKey.get(key));
    else if (TAG_FORMATS[key]) formats.add(TAG_FORMATS[key]);
    else if (!TAG_TYPES.has(key)) dropped.add(item);
  }
  return { genres: [...genres], formats: [...formats], dropped: [...dropped] };
}

function parseComic(info, warn = () => {}) {
  if (!info || typeof info !== 'object' || Array.isArray(info)) throw new BadRequestError('comic.json must be a JSON object');
  const name = optionalText(info.name, 'name', MAX_NAME);
  if (!name) throw new BadRequestError('"name" is required');

  const year = text(info.releasingYear);
  const maxYear = new Date().getFullYear() + 1;
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > maxYear)) {
    throw new BadRequestError(`"releasingYear" must be a year between 1900 and ${maxYear}`);
  }

  const url = text(info.url) || slugify(name);
  if (!url || url.length > 120 || !SLUG_PATTERN.test(url)) {
    throw new BadRequestError('"url" must be lowercase letters, digits and dashes (max 120 characters)');
  }

  const tags = classifyTags(info.genres, info.formats);
  let contentRating = oneOf(info.contentRating, 'contentRating', CONTENT_RATINGS);
  if (!contentRating) {
    contentRating = DEFAULT_CONTENT_RATING;
    warn(`"${name}": no content rating, using "${DEFAULT_CONTENT_RATING}"`);
  }
  if (tags.dropped.length) warn(`"${name}": skipped unknown genres ${tags.dropped.join(', ')}`);

  return {
    name,
    url,
    types: oneOf(info.type, 'type', COMIC_TYPES, true),
    contentRating,
    releaseStatus: oneOf(info.releaseStatus, 'releaseStatus', RELEASE_STATUSES) ?? 'releasing',
    releasingYear: year || undefined,
    description: optionalText(info.description, 'description', 5000),
    source: optionalText(info.source, 'source', 500),
    author: optionalText(info.author, 'author', 100),
    artist: optionalText(info.artist, 'artist', 100),
    genres: tags.genres,
    formats: tags.formats,
  };
}

function parseImageFile(file, label) {
  if (!file || typeof file !== 'object') throw new BadRequestError(`${label} is missing`);
  const name = text(file.name);
  if (!name || name !== path.posix.basename(name) || name.includes('\\') || name === '.' || name === '..') {
    throw new BadRequestError(`${label} has an invalid filename`);
  }
  if (!IMAGE_EXTENSIONS.has(path.posix.extname(name).toLowerCase())) {
    throw new BadRequestError(`"${name}" is not a supported image`);
  }
  const size = Number(file.size);
  if (!Number.isSafeInteger(size) || size <= 0) throw new BadRequestError(`"${name}" has an invalid size`);
  if (size > MAX_IMAGE_BYTES) throw new PayloadTooLargeError(`"${name}" is larger than ${MAX_IMAGE_BYTES / MB} MB`);
  return { name, size };
}

function safeKey(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) {
    throw new BadRequestError(`${label} has an invalid identifier`);
  }
  return value;
}

export function parseImportManifest(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.comics) || input.comics.length === 0) {
    throw new BadRequestError('The ZIP must contain at least one comic folder');
  }

  let totalEntries = 0;
  let totalBytes = 0;
  let uploadBytes = 0;
  const fileIds = new Set();
  const comicKeys = new Set();
  const urls = new Set();
  const warnings = [];

  const addFile = (file) => {
    totalEntries += 1;
    totalBytes += file.size;
    uploadBytes += file.size;
    if (totalEntries > MAX_ENTRIES) throw new PayloadTooLargeError(`The import has more than ${MAX_ENTRIES} files`);
    if (totalBytes > MAX_TOTAL_BYTES) throw new PayloadTooLargeError(`The import exceeds ${MAX_TOTAL_BYTES / MB} MB`);
  };

  const comics = input.comics.map((comic, comicIndex) => {
    if (!comic || typeof comic !== 'object' || Array.isArray(comic)) {
      throw new BadRequestError(`Comic ${comicIndex + 1} has invalid metadata`);
    }
    const key = safeKey(comic.key, `Comic ${comicIndex + 1}`);
    if (comicKeys.has(key)) throw new BadRequestError('Duplicate comic identifier in the ZIP');
    comicKeys.add(key);
    const data = parseComic(comic.data, (message) => warnings.push(message));
    if (urls.has(data.url)) throw new BadRequestError(`Duplicate comic URL in the ZIP: ${data.url}`);
    urls.add(data.url);

    const comicJsonBytes = Number(comic.comicJsonBytes);
    if (!Number.isSafeInteger(comicJsonBytes) || comicJsonBytes <= 0 || comicJsonBytes > MAX_COMIC_JSON_BYTES) {
      throw new PayloadTooLargeError(`comic.json for "${data.name}" must be at most ${MAX_COMIC_JSON_BYTES / 1024} KB`);
    }
    totalEntries += 1;
    totalBytes += comicJsonBytes;
    if (totalEntries > MAX_ENTRIES) throw new PayloadTooLargeError(`The import has more than ${MAX_ENTRIES} files`);
    if (totalBytes > MAX_TOTAL_BYTES) throw new PayloadTooLargeError(`The import exceeds ${MAX_TOTAL_BYTES / MB} MB`);

    const cover = parseImageFile(comic.cover, `Cover for "${data.name}"`);
    if (path.posix.parse(cover.name).name.toLowerCase() !== 'cover') {
      throw new BadRequestError(`The cover for "${data.name}" must be named cover.jpg (or another supported image extension)`);
    }
    const coverKey = safeKey(`${key}-cover`, 'Cover');
    fileIds.add(coverKey);
    cover.key = coverKey;
    addFile(cover);

    const chapters = Array.isArray(comic.chapters) ? comic.chapters : [];
    const chapterNumbers = new Set();
    const parsedChapters = chapters.map((chapter, chapterIndex) => {
      if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter)) {
        throw new BadRequestError(`Chapter ${chapterIndex + 1} of "${data.name}" has invalid metadata`);
      }
      const chapterKey = safeKey(`${key}-h${chapterIndex}`, 'Chapter');

      const chapterNumber = Number(chapter.number);
      if (!Number.isFinite(chapterNumber) || chapterNumber < 0 || chapterNumber > 100000) {
        throw new BadRequestError(`Invalid chapter number in "${text(chapter.folder) || data.name}"`);
      }
      if (chapterNumbers.has(chapterNumber)) {
        throw new BadRequestError(`Duplicate chapter number ${chapterNumber} in "${data.name}"`);
      }
      chapterNumbers.add(chapterNumber);

      const title = optionalText(chapter.title, 'chapter title', 200) ?? `Chapter ${chapterNumber}`;
      const pages = Array.isArray(chapter.pages) ? chapter.pages.map((page, pageIndex) => {
        const parsed = parseImageFile(page, `Page ${pageIndex + 1} of chapter ${chapterNumber}`);
        parsed.key = safeKey(`${chapterKey}-p${pageIndex}`, 'Chapter page');
        if (fileIds.has(parsed.key)) throw new BadRequestError('Duplicate file identifier in the ZIP');
        fileIds.add(parsed.key);
        return parsed;
      }) : [];
      if (pages.length === 0) throw new BadRequestError(`Chapter ${chapterNumber} of "${data.name}" has no pages`);
      if (pages.length > MAX_PAGES) throw new PayloadTooLargeError(`Chapter ${chapterNumber} has more than ${MAX_PAGES} pages`);
      pages.forEach(addFile);

      const url = `${data.url}-chapter-${String(chapterNumber).replace('.', '-')}`;
      if (url.length > 120 || !SLUG_PATTERN.test(url)) throw new BadRequestError(`Chapter ${chapterNumber} creates an invalid URL`);
      return {
        key: chapterKey,
        folder: text(chapter.folder),
        chapterNumber,
        title,
        url,
        pages,
      };
    });

    return { key, data, cover, coverKey, chapters: parsedChapters.sort((a, b) => a.chapterNumber - b.chapterNumber || natural(a.folder, b.folder)) };
  });

  if (totalEntries > MAX_ENTRIES) throw new PayloadTooLargeError(`The import has more than ${MAX_ENTRIES} files`);
  if (totalBytes > MAX_TOTAL_BYTES) throw new PayloadTooLargeError(`The import exceeds ${MAX_TOTAL_BYTES / MB} MB`);

  for (const comic of comics) {
    for (const chapter of comic.chapters) {
      const chapterUrl = chapter.url;
      if (comics.some((other) => other.data.url === chapterUrl)) {
        throw new BadRequestError(`Chapter URL conflicts with a comic URL: ${chapterUrl}`);
      }
    }
  }

  return {
    comics,
    expectedFileCount: comics.reduce((sum, comic) => sum + 1 + comic.chapters.reduce((count, chapter) => count + chapter.pages.length, 0), 0),
    totalEntries,
    totalBytes,
    uploadBytes,
    warnings,
  };
}
