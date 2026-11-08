import crypto, { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AdminImportBatch } from '../models/index.js';
import { withTransaction } from '../config/database.js';
import * as comicRepo from '../repositories/comicRepository.js';
import * as chapterRepo from '../repositories/chapterRepository.js';
import * as comicService from './comicService.js';
import * as chapterService from './chapterService.js';
import { uploadStagedStorageFile, removeStorageObject } from './objectStorageService.js';
import { storageRoot } from '../config/storage.js';
import { ALLOWED_IMAGE_TYPES } from '../middlewares/uploadMiddleware.js';
import { detectImageType } from '../middlewares/imageSignatureMiddleware.js';
import { logger } from '../config/logger.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, PayloadTooLargeError, UnsupportedMediaTypeError } from '../errors.js';
import { MAX_IMAGE_BYTES, parseImportManifest } from './adminImportValidation.js';

const MB = 1024 * 1024;
const MAX_TOTAL_BYTES =
  (Number(process.env.ADMIN_IMPORT_MAX_UNCOMPRESSED_MB) || 4096) * MB;
const SESSION_TTL_MS = (Number(process.env.ADMIN_IMPORT_SESSION_TTL_HOURS) || 12) * 60 * 60 * 1000;
const SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const stagingRoot = process.env.ADMIN_IMPORT_STAGING_DIR ||
  path.join(path.dirname(storageRoot), 'data', 'admin-import-staging');

const sessionDirectory = (id) => {
  if (typeof id !== 'string' || !SESSION_PATTERN.test(id)) throw new NotFoundError('Import session not found');
  return path.join(stagingRoot, id);
};

const jsonPath = (directory, file) => path.join(directory, file);

async function writeJson(directory, file, value) {
  const destination = jsonPath(directory, file);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value), { flag: 'wx' });
  await fs.rename(temporary, destination);
}

async function readJson(directory, file) {
  try {
    return JSON.parse(await fs.readFile(jsonPath(directory, file), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw new NotFoundError('Import session not found or expired');
    throw error;
  }
}

async function committedResult(id, userId) {
  const batch = await AdminImportBatch.findByPk(id, { attributes: ['adminId', 'result'], raw: true });
  if (batch && userId && batch.adminId !== userId) throw new ForbiddenError('This import belongs to another administrator');
  return batch ? JSON.parse(batch.result) : null;
}

function expectedFile(manifest, fileId) {
  for (const comic of manifest.comics) {
    if (comic.cover.key === fileId) return comic.cover;
    for (const chapter of comic.chapters) {
      const page = chapter.pages.find((candidate) => candidate.key === fileId);
      if (page) return page;
    }
  }
  return null;
}

export async function getImportContext(user, id) {
  const directory = sessionDirectory(id);
  const [manifest, state] = await Promise.all([
    readJson(directory, 'manifest.json'),
    readJson(directory, 'state.json'),
  ]);
  if (state.adminId !== user.id) throw new ForbiddenError('This import session belongs to another administrator');
  if (Date.now() - Date.parse(state.createdAt) > SESSION_TTL_MS && state.status === 'receiving') {
    await fs.rm(directory, { recursive: true, force: true });
    throw new NotFoundError('Import session expired');
  }
  return { id, directory, manifest, state };
}

async function uniqueUrls(manifest) {
  const chapterUrls = new Set();
  for (const comic of manifest.comics) {
    if (await comicRepo.findIdByUrl(comic.data.url)) {
      throw new ConflictError(`Comic URL already exists: ${comic.data.url}`);
    }
    for (const chapter of comic.chapters) {
      if (chapterUrls.has(chapter.url)) throw new BadRequestError(`Duplicate chapter URL in the ZIP: ${chapter.url}`);
      chapterUrls.add(chapter.url);
      if (await chapterRepo.findIdByUrl(chapter.url)) {
        throw new ConflictError(`Chapter URL already exists: ${chapter.url}`);
      }
    }
  }
}

async function removeKeys(keys) {
  const failed = [];
  for (const key of [...new Set(keys)]) {
    try {
      await removeStorageObject(key);
    } catch (error) {
      failed.push(key);
      logger.error('Failed to clean up an uncommitted import object', { key, error: error.message });
    }
  }
  return failed;
}

async function cleanupExpiredDirectory(id, directory, state) {
  const result = await committedResult(id);
  if (!result && state.plannedKeys?.length) {
    const failed = await removeKeys(state.plannedKeys);
    if (failed.length) {
      await writeJson(directory, 'state.json', { ...state, status: 'cleanup_pending', plannedKeys: failed });
      return false;
    }
  }
  await fs.rm(directory, { recursive: true, force: true });
  return true;
}

export async function cleanupStaleAdminImports({ recoverCommitting = false } = {}) {
  await fs.mkdir(stagingRoot, { recursive: true });
  const entries = await fs.readdir(stagingRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !SESSION_PATTERN.test(entry.name)) continue;
    const directory = path.join(stagingRoot, entry.name);
    let state;
    try {
      state = await readJson(directory, 'state.json');
    } catch (error) {
      if (error instanceof NotFoundError) {
        await fs.rm(directory, { recursive: true, force: true });
        continue;
      }
      throw error;
    }
    const old = Date.now() - Date.parse(state.createdAt) > SESSION_TTL_MS;
    if (
      state.status === 'cleanup_pending' ||
      state.status === 'complete' ||
      (state.status === 'committing' && (recoverCommitting || old)) ||
      (state.status === 'receiving' && old)
    ) {
      await cleanupExpiredDirectory(entry.name, directory, state);
    }
  }
}

export async function createImport(user, input) {
  await cleanupStaleAdminImports();
  const manifest = parseImportManifest(input);
  await uniqueUrls(manifest);

  const id = randomUUID();
  const directory = sessionDirectory(id);
  await fs.mkdir(path.join(directory, 'files'), { recursive: true });
  const state = {
    adminId: user.id,
    createdAt: new Date().toISOString(),
    status: 'receiving',
    actualBytes: 0,
    uploaded: {},
  };
  try {
    await Promise.all([
      writeJson(directory, 'manifest.json', manifest),
      writeJson(directory, 'state.json', state),
    ]);
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }

  return {
    id,
    totalComics: manifest.comics.length,
    totalChapters: manifest.comics.reduce((sum, comic) => sum + comic.chapters.length, 0),
    totalItems: manifest.expectedFileCount,
    totalBytes: manifest.uploadBytes,
    warnings: manifest.warnings,
  };
}

export async function getImportStatus(user, id) {
  const result = await committedResult(id, user.id);
  if (result) return { status: 'complete', result };

  const { manifest, state } = await getImportContext(user, id);
  const uploadedItemIds = Object.keys(state.uploaded);
  return {
    status: state.status,
    totalItems: manifest.expectedFileCount,
    uploadedItems: uploadedItemIds.length,
    uploadedItemIds,
  };
}

async function imageType(file) {
  const handle = await fs.open(file.path, 'r');
  let head;
  try {
    head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    head = head.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
  // The bytes decide the type, not the declared MIME type: archives often hold a JPEG named
  // cover.png. The stored key takes its extension from this type, so it always matches the content.
  const type = detectImageType(head);
  if (!type || !ALLOWED_IMAGE_TYPES[type]) {
    throw new UnsupportedMediaTypeError(`"${file.originalname}" is not a valid JPEG, PNG, WEBP or GIF image`);
  }
  return type;
}

export async function stageImportFile(user, id, fileId, file) {
  const { directory, manifest, state } = await getImportContext(user, id);
  if (state.status !== 'receiving') throw new ConflictError('This import is no longer accepting files');

  const expected = expectedFile(manifest, fileId);
  if (!expected) throw new NotFoundError('Import item not found');
  if (state.uploaded[fileId]) throw new ConflictError('This file has already been uploaded');
  if (!file || file.originalname !== expected.name || file.size !== expected.size || file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestError('Uploaded file does not match the ZIP manifest');
  }
  const type = await imageType(file);
  if (state.actualBytes + file.size > MAX_TOTAL_BYTES || state.actualBytes + file.size > manifest.uploadBytes) {
    throw new PayloadTooLargeError('The staged import exceeds its declared size');
  }

  const next = {
    ...state,
    actualBytes: state.actualBytes + file.size,
    uploaded: {
      ...state.uploaded,
      [fileId]: {
        name: file.originalname,
        size: file.size,
        type,
        stagedName: path.basename(file.filename),
        sha256: await hashFile(file.path),
      },
    },
  };
  await writeJson(directory, 'state.json', next);
  return { fileId, uploadedItems: Object.keys(next.uploaded).length, totalItems: manifest.expectedFileCount };
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(await fs.readFile(filePath));
  return hash.digest('hex');
}

async function verifyComplete({ directory, manifest, state }) {
  const expected = manifest.comics.flatMap((comic) => [
    comic.cover,
    ...comic.chapters.flatMap((chapter) => chapter.pages),
  ]);
  if (Object.keys(state.uploaded).length !== expected.length || expected.some((file) => !state.uploaded[file.key])) {
    throw new ConflictError('The import is incomplete; no data was committed');
  }
  if (state.actualBytes !== manifest.uploadBytes) {
    throw new ConflictError('The received files do not match the ZIP manifest; no data was committed');
  }

  for (const descriptor of expected) {
    const file = state.uploaded[descriptor.key];
    const filePath = path.join(directory, 'files', file.stagedName);
    const stat = await fs.stat(filePath);
    if (stat.size !== descriptor.size || await hashFile(filePath) !== file.sha256) {
      throw new ConflictError('A staged file is missing or changed; no data was committed');
    }
    const type = await imageType({ path: filePath, originalname: file.name, mimetype: file.type });
    if (type !== file.type) throw new UnsupportedMediaTypeError(`"${file.name}" is not a valid image`);
  }
}

// autoApprove: true publishes every imported comic and chapter at once, false sends them to the
// review queue; undefined follows the site's auto-accept setting.
export async function commitImport(user, id, { autoApprove } = {}) {
  if (autoApprove !== undefined && typeof autoApprove !== 'boolean') {
    throw new BadRequestError('"autoApprove" must be a boolean');
  }
  const reviewStatus = autoApprove === undefined ? undefined : autoApprove ? 'accept' : 'pending';
  const completed = await committedResult(id, user.id);
  if (completed) return completed;

  const context = await getImportContext(user, id);
  const { directory, manifest, state } = context;
  if (state.status !== 'receiving') throw new ConflictError('This import is already being finalized');
  await verifyComplete(context);
  await uniqueUrls(manifest);

  const finalAssets = [];
  const comicAssets = manifest.comics.map((comic) => {
    const coverStage = state.uploaded[comic.cover.key];
    const coverKey = `comics/${randomUUID()}${ALLOWED_IMAGE_TYPES[coverStage.type]}`;
    finalAssets.push({ key: coverKey, stagedName: coverStage.stagedName, type: coverStage.type });
    const chapters = comic.chapters.map((chapter) => ({
      ...chapter,
      pages: chapter.pages.map((page) => {
        const pageStage = state.uploaded[page.key];
        const key = `chapter-images/${randomUUID()}${ALLOWED_IMAGE_TYPES[pageStage.type]}`;
        finalAssets.push({ key, stagedName: pageStage.stagedName, type: pageStage.type });
        return { key };
      }),
    }));
    return { ...comic, coverKey, chapters };
  });

  let committing = {
    ...state,
    status: 'committing',
    plannedKeys: finalAssets.map((asset) => asset.key),
  };
  await writeJson(directory, 'state.json', committing);

  let result;
  try {
    for (const asset of finalAssets) {
      await uploadStagedStorageFile(
        asset.key,
        path.join(directory, 'files', asset.stagedName),
        asset.type,
      );
    }

    result = await withTransaction(async () => {
      await uniqueUrls(manifest);
      const comics = [];
      for (const source of comicAssets) {
        const createdComic = await comicService.createInTransaction(
          user,
          source.data,
          path.posix.basename(source.coverKey),
          { status: reviewStatus },
        );
        const chapters = [];
        for (const chapter of source.chapters) {
          const createdChapter = await chapterService.createInTransaction(
            user,
            createdComic.id,
            { title: chapter.title, chapterNumber: chapter.chapterNumber, url: chapter.url },
            chapter.pages.map((page) => path.posix.basename(page.key)),
            { status: reviewStatus },
          );
          chapters.push({
            id: createdChapter.chapterId,
            chapterNumber: createdChapter.chapterNumber,
            title: createdChapter.title,
            pages: createdChapter.imagesCount,
            status: createdChapter.status,
          });
        }
        comics.push({
          id: createdComic.id,
          url: source.data.url,
          name: createdComic.name,
          status: createdComic.status,
          chapters,
        });
      }

      const summary = {
        comics: comics.length,
        chapters: comics.reduce((sum, comic) => sum + comic.chapters.length, 0),
        pages: comics.reduce((sum, comic) => sum + comic.chapters.reduce((count, chapter) => count + chapter.pages, 0), 0),
      };
      const response = { summary, comics };
      await AdminImportBatch.create({
        id,
        adminId: user.id,
        result: JSON.stringify(response),
        createdAt: new Date().toISOString(),
      });
      return response;
    });
  } catch (error) {
    const failedKeys = await removeKeys(committing.plannedKeys);
    if (failedKeys.length) {
      await writeJson(directory, 'state.json', { ...committing, status: 'cleanup_pending', plannedKeys: failedKeys });
    } else {
      await fs.rm(directory, { recursive: true, force: true });
    }
    throw error;
  }

  for (const comic of result.comics) {
    for (const chapter of comic.chapters) {
      if (chapter.status !== 'accept') continue;
      try {
        await chapterService.notifyCreated(user, { chapterId: chapter.id, status: chapter.status });
      } catch (error) {
        logger.error('Failed to notify readers about an imported chapter', {
          importId: id,
          chapterId: chapter.id,
          error: error.message,
        });
      }
    }
  }

  await writeJson(directory, 'state.json', { ...committing, status: 'complete' }).catch((error) => {
    logger.warn('Failed to update completed admin import staging data', { importId: id, error: error.message });
  });
  await fs.rm(directory, { recursive: true, force: true }).catch((error) => {
    logger.warn('Failed to remove completed admin import staging data', { importId: id, error: error.message });
  });
  return result;
}

export async function abortImport(user, id) {
  const result = await committedResult(id, user.id);
  if (result) throw new ConflictError('A completed import cannot be cancelled');
  const { directory, state } = await getImportContext(user, id);
  if (state.status === 'committing') throw new ConflictError('The import is being finalized');
  if (state.status === 'cleanup_pending' && !(await cleanupExpiredDirectory(id, directory, state))) {
    throw new Error('Could not remove every uncommitted storage object; cleanup will be retried');
  }
  await fs.rm(directory, { recursive: true, force: true });
}
