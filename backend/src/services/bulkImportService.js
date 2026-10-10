// POST /publish/bulk: an admin imports a whole library in one request, as a zip of comic folders laid
// out exactly like the uploader script expects:
//
//   library.zip
//   └── One Piece/                       any folder holding a comic.json is a comic (at any depth)
//       ├── comic.json                   same fields as POST /publish/comics; "id" or "url" can point at an existing comic
//       ├── cover.jpg                    only needed when the comic is new
//       ├── Chapter 1 - Romance Dawn/    first number = chapter number, text after " - " = title
//       │   ├── 001.jpg                  pages in natural order (2.jpg before 10.jpg)
//       │   └── 002.jpg
//       └── Chapter 2/
//
// Every comic and chapter goes through publishService (same validation, same moderation) in its own
// transaction, so one bad chapter doesn't undo the others; the response reports each one. Importing the same
// zip again is safe: comics are matched by id or url, and chapters that already exist are skipped.
//
// The archive is checked before anything is extracted: entry count and declared sizes (no zip bombs; yauzl
// also fails an entry that inflates past its declared size), and yauzl rejects absolute paths and "..".
// Stored files get random names, and their type comes from their bytes, not from their extension.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import yauzl from 'yauzl';
import * as publishService from './publishService.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import { ALLOWED_IMAGE_TYPES, chapterImagesFolder, comicsFolder } from '../middlewares/uploadMiddleware.js';
import { detectImageType } from '../middlewares/imageSignatureMiddleware.js';
import { slugify } from '../utils/slug.js';
import { AppError, BadRequestError, NotFoundError, PayloadTooLargeError, UnsupportedMediaTypeError } from '../errors.js';

const MB = 1024 * 1024;
export const BULK_LIMITS = {
  entries: Number(process.env.BULK_MAX_ENTRIES) || 20000,
  totalBytes: (Number(process.env.BULK_MAX_UNCOMPRESSED_MB) || 4096) * MB,
  imageBytes: 10 * MB, // same as a normal upload
  comicJsonBytes: 64 * 1024,
  pagesPerChapter: 100, // same as POST /publish/comics/{comic}/chapters
};

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
// Same comic.json fields the uploader script sends.
const COMIC_FIELDS = ['name', 'url', 'type', 'demographic', 'contentRating', 'releaseStatus',
  'releasingYear', 'author', 'artist', 'description', 'source', 'genres', 'formats'];

const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;
const isImage = (name) => IMAGE_EXTENSIONS.has(path.posix.extname(name).toLowerCase());
// macOS resource forks, hidden files and Windows thumbnails are not part of anyone's comic.
const isJunk = (fileName) =>
  fileName.split('/').some((part) => part.startsWith('.') || part === '__MACOSX') || /(^|\/)(thumbs\.db|desktop\.ini)$/i.test(fileName);

// ---------- zip reading ----------

function openZip(file) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true, autoClose: false }, (err, zip) => {
      if (err) return reject(new BadRequestError(`"archive" is not a valid zip file (${err.message})`));
      if (zip.entryCount > BULK_LIMITS.entries) {
        zip.close();
        return reject(new PayloadTooLargeError(`The archive has ${zip.entryCount} entries (max ${BULK_LIMITS.entries})`));
      }
      const entries = [];
      zip.on('entry', (entry) => {
        entries.push(entry);
        zip.readEntry();
      });
      zip.on('end', () => resolve({ zip, entries }));
      zip.on('error', (error) => {
        zip.close();
        reject(new BadRequestError(`"archive" could not be read (${error.message})`));
      });
      zip.readEntry();
    });
  });
}

function readEntry(zip, entry) {
  return new Promise((resolve, reject) => {
    const fail = (error) => reject(new BadRequestError(`Could not read "${entry.fileName}" (${error.message})`));
    zip.openReadStream(entry, (err, stream) => {
      if (err) return fail(err);
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', fail);
    });
  });
}

// ---------- archive layout ----------

const chapterOf = (dirName) => {
  const match = /\d+(?:\.\d+)?/.exec(dirName);
  return match && { number: match[0], title: dirName.split(' - ').slice(1).join(' - ').trim() };
};

// Entries → [{ folder, files, chapters: [{ folder, number, title, pages }] }], sorted like the script does.
function scanEntries(entries) {
  const files = entries.filter((e) => !e.fileName.endsWith('/') && !isJunk(e.fileName));
  const declared = files.reduce((sum, e) => sum + e.uncompressedSize, 0);
  if (declared > BULK_LIMITS.totalBytes) {
    throw new PayloadTooLargeError(`The archive unpacks to more than ${BULK_LIMITS.totalBytes / MB} MB`);
  }

  // Folder ('.' = archive root) → the files directly inside it.
  const byFolder = new Map();
  for (const entry of files) {
    const folder = path.posix.dirname(entry.fileName);
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push({ name: path.posix.basename(entry.fileName), entry });
  }
  const hasComicJson = (folder) => byFolder.get(folder)?.some((f) => f.name.toLowerCase() === 'comic.json');
  const comicFolders = [...byFolder.keys()].filter(hasComicJson).sort(natural);
  if (!comicFolders.length) {
    throw new BadRequestError('No comic.json found: the archive must hold comic folders (comic.json, cover image, one sub-folder per chapter)');
  }

  return comicFolders.map((folder) => {
    const chapters = [];
    for (const [sub, subFiles] of byFolder) {
      if (sub === folder || path.posix.dirname(sub) !== folder || hasComicJson(sub)) continue;
      const chapter = chapterOf(path.posix.basename(sub));
      if (!chapter) continue;
      const pages = subFiles.filter((f) => isImage(f.name)).sort((a, b) => natural(a.name, b.name));
      chapters.push({ folder: sub, ...chapter, pages });
    }
    chapters.sort((a, b) => Number(a.number) - Number(b.number) || natural(a.folder, b.folder));
    return { folder, files: byFolder.get(folder), chapters };
  });
}

// ---------- extracting ----------

// Checks the bytes, then writes the image under a random name. Returns the stored file name.
async function storeImage(zip, { name, entry }, folder) {
  if (entry.uncompressedSize > BULK_LIMITS.imageBytes) {
    throw new PayloadTooLargeError(`"${entry.fileName}" is larger than ${BULK_LIMITS.imageBytes / MB} MB`);
  }
  const bytes = await readEntry(zip, entry);
  const type = detectImageType(bytes.subarray(0, 12));
  if (!type) throw new UnsupportedMediaTypeError(`"${name}" is not a JPEG, PNG, WEBP or GIF image`);
  const filename = `${randomUUID()}${ALLOWED_IMAGE_TYPES[type]}`;
  await fs.writeFile(path.join(folder, filename), bytes);
  return filename;
}

const removeAll = (folder, filenames) => Promise.all(filenames.map((f) => fs.rm(path.join(folder, f), { force: true })));

async function readComicJson(zip, folder) {
  const file = folder.files.find((f) => f.name.toLowerCase() === 'comic.json');
  if (file.entry.uncompressedSize > BULK_LIMITS.comicJsonBytes) throw new BadRequestError('comic.json is too large (max 64 KB)');
  let info;
  try {
    info = JSON.parse((await readEntry(zip, file.entry)).toString('utf8').trimStart()); // trimStart also drops the BOM Notepad writes
  } catch (error) {
    throw error instanceof AppError ? error : new BadRequestError(`comic.json is not valid JSON (${error.message})`);
  }
  if (!info || typeof info !== 'object' || Array.isArray(info)) throw new BadRequestError('comic.json must be a JSON object');
  return info;
}

// comic.json values → the strings a multipart form would carry (JSON may hold numbers and arrays).
const toFormBody = (info) =>
  Object.fromEntries(
    COMIC_FIELDS.filter((k) => info[k] !== undefined && info[k] !== null)
      .map((k) => [k, Array.isArray(info[k]) ? info[k].map(String) : String(info[k])])
  );

// The comic this folder belongs to: the one its id/url points at, or a new one.
async function resolveComic(user, zip, folder) {
  const info = await readComicJson(zip, folder);
  const id = typeof info.id === 'string' ? info.id.trim() : '';
  if (id) {
    const comic = await comicRepo.findForPublishing(id);
    if (!comic) throw new NotFoundError(`comic.json "id" ${id} does not match any comic`);
    return { comic, action: 'existing' };
  }

  const url = (typeof info.url === 'string' && info.url.trim()) || slugify(info.name);
  const existing = url && (await comicRepo.findForPublishing(url));
  if (existing) return { comic: existing, action: 'existing' };

  const cover = folder.files.find((f) => isImage(f.name) && path.posix.parse(f.name).name.toLowerCase() === 'cover');
  if (!cover) throw new BadRequestError('A new comic needs a cover image (cover.jpg / .png / .webp / .gif) next to comic.json');
  const filename = await storeImage(zip, cover, comicsFolder);
  try {
    const created = await publishService.createComic(user, toFormBody(info), { filename });
    return { comic: created, action: 'created' };
  } catch (error) {
    await removeAll(comicsFolder, [filename]);
    throw error;
  }
}

async function importChapter(user, zip, comic, chapter) {
  const base = { folder: chapter.folder, chapterNumber: Number(chapter.number) };
  if (!chapter.pages.length) return { ...base, action: 'skipped', reason: 'No images in this folder' };
  // Checked before extracting anything, so re-running a big import doesn't unpack what is already there.
  const existing = await chapterRepo.findLiveByNumber(comic.id, Number(chapter.number));
  if (existing) return { ...base, action: 'skipped', id: existing.id, reason: `Chapter already exists (${existing.status})` };
  if (chapter.pages.length > BULK_LIMITS.pagesPerChapter) {
    throw new PayloadTooLargeError(`${chapter.pages.length} pages (max ${BULK_LIMITS.pagesPerChapter} per chapter)`);
  }

  const stored = [];
  try {
    for (const page of chapter.pages) stored.push(await storeImage(zip, page, chapterImagesFolder));
    const body = { chapterNumber: chapter.number, ...(chapter.title && { title: chapter.title }) };
    const created = await publishService.createChapter(user, comic.id, body, stored.map((filename) => ({ filename })));
    return { ...base, action: 'created', id: created.id, title: created.title, pages: created.pages, status: created.status };
  } catch (error) {
    await removeAll(chapterImagesFolder, stored);
    throw error;
  }
}

// Business errors (bad comic.json, not an image, duplicate...) are reported per item and the import goes
// on; anything else (database or disk failure) stops it.
const reportError = (base, error) => {
  if (!(error instanceof AppError)) throw error;
  return { ...base, action: 'failed', httpStatus: error.status, reason: error.message };
};

export async function importArchive(user, archivePath) {
  const { zip, entries } = await openZip(archivePath);
  try {
    const folders = scanEntries(entries);
    const comics = [];
    for (const folder of folders) {
      let resolved;
      try {
        resolved = await resolveComic(user, zip, folder);
      } catch (error) {
        comics.push({ ...reportError({ folder: folder.folder }, error), chapters: [] });
        continue;
      }
      const { comic, action } = resolved;
      const chapters = [];
      for (const chapter of folder.chapters) {
        try {
          chapters.push(await importChapter(user, zip, comic, chapter));
        } catch (error) {
          chapters.push(reportError({ folder: chapter.folder, chapterNumber: Number(chapter.number) }, error));
        }
      }
      comics.push({ folder: folder.folder, action, id: comic.id, url: comic.url, name: comic.name, ...(comic.status && { status: comic.status }), chapters });
    }

    const count = (list, action) => list.filter((item) => item.action === action).length;
    const allChapters = comics.flatMap((c) => c.chapters);
    return {
      summary: {
        comics: { created: count(comics, 'created'), existing: count(comics, 'existing'), failed: count(comics, 'failed') },
        chapters: { created: count(allChapters, 'created'), skipped: count(allChapters, 'skipped'), failed: count(allChapters, 'failed') },
      },
      comics,
    };
  } finally {
    zip.close();
  }
}
