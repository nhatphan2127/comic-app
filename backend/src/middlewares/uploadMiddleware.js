import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { UnsupportedMediaTypeError } from '../errors.js';

// SVG is intentionally excluded: it can carry scripts and is served from our own origin.
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const storageRoot = process.env.STORAGE_ROOT || path.join(__dirname, '..', '..', 'storage');
const comicsFolder = path.join(storageRoot, 'comics');
const chapterImagesFolder = path.join(storageRoot, 'chapter-images');
const userAvatarsFolder = path.join(storageRoot, 'avatars');
const userBackgroundsFolder = path.join(storageRoot, 'backgrounds');

[comicsFolder, chapterImagesFolder, userAvatarsFolder, userBackgroundsFolder].forEach((folder) => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination(req, file, cb) {
    let folder;
    if (file.fieldname === 'coverImage') {
      folder = comicsFolder;
    } else if (file.fieldname === 'avatar') {
      folder = userAvatarsFolder;
    } else if (file.fieldname === 'background') {
      folder = userBackgroundsFolder;
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
    files.forEach((file) => fs.unlink(file.path, () => {}));
  });
  next();
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
