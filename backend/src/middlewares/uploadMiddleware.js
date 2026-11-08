import multer from 'multer';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { UnsupportedMediaTypeError } from '../errors.js';
import { avatarsFolder, backgroundsFolder, chapterImagesFolder, comicsFolder, storageRoot } from '../config/storage.js';
import { logger } from '../config/logger.js';
import { removeStoredFiles } from '../utils/storedFiles.js';
import { STORAGE_DRIVER, uploadStorageFile } from '../services/objectStorageService.js';

// SVG is intentionally excluded: it can carry scripts and is served from our own origin.
export const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export { chapterImagesFolder, comicsFolder, storageRoot };

const storage = multer.diskStorage({
  destination(req, file, cb) {
    let folder;
    if (file.fieldname === 'coverImage') {
      folder = comicsFolder;
    } else if (file.fieldname === 'avatar') {
      folder = avatarsFolder;
    } else if (file.fieldname === 'background') {
      folder = backgroundsFolder;
    } else {
      folder = chapterImagesFolder;
    }
    cb(null, folder);
  },
  filename(req, file, cb) {
    // Extension comes from the validated MIME type, never from the client-supplied filename.
    cb(null, `${randomUUID()}${ALLOWED_IMAGE_TYPES[file.mimetype]}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
    return cb(new UnsupportedMediaTypeError('Only JPEG, PNG, WEBP or GIF images are allowed'));
  }
  cb(null, true);
}

// Multer writes files before the controller runs; delete them if the request ends up failing
// (validation error, 403, 409, ...) so rejected uploads don't pile up in /storage.
export function cleanupUploadsOnFailure(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    const files = [
      ...(req.file ? [req.file] : []),
      ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat()),
    ];
    Promise.all([
      removeStoredFiles(files.map((file) => file.storageKey).filter(Boolean)),
      ...files.map((file) => fs.promises.unlink(file.path).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      })),
    ]).catch((error) => logger.error('Failed to clean up rejected uploads', { error: error.message }));
  });
  next();
}

function objectFolder(fieldname) {
  if (fieldname === 'coverImage') return 'comics';
  if (fieldname === 'avatar') return 'avatars';
  if (fieldname === 'background') return 'backgrounds';
  return 'chapter-images';
}

export async function persistUploadedFiles(req, res, next) {
  const files = [
    ...(req.file ? [req.file] : []),
    ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat()),
  ];
  if (STORAGE_DRIVER === 'local' || files.length === 0) return next();

  const uploadedKeys = [];
  try {
    for (const file of files) {
      const key = `${objectFolder(file.fieldname)}/${file.filename}`;
      await uploadStorageFile(key, file.path, file.mimetype);
      file.storageKey = key;
      uploadedKeys.push(key);
      await fs.promises.unlink(file.path);
    }
    next();
  } catch (error) {
    await removeStoredFiles(uploadedKeys);
    next(error);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per image
    files: 100,
  },
});
export default upload;
