// Multer trusts the Content-Type the client sends for each file. Scripts can send anything, so the
// publishing API also checks the first bytes of every uploaded file against the declared image type.
// A mismatch fails the request; cleanupUploadsOnFailure then deletes the files.
import fs from 'node:fs/promises';
import { UnsupportedMediaTypeError } from '../errors.js';

const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

// The image type a file really is, from its first 12 bytes (null = none we accept).
export const detectImageType = (head) => Object.keys(SIGNATURES).find((type) => head.length >= 12 && SIGNATURES[type](head)) ?? null;

async function readHead(path) {
  const handle = await fs.open(path, 'r');
  try {
    const buffer = Buffer.alloc(12);
    await handle.read(buffer, 0, 12, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}

export async function verifyImageSignatures(req, res, next) {
  try {
    const files = [...(req.file ? [req.file] : []), ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())];
    for (const file of files) {
      const check = SIGNATURES[file.mimetype];
      if (!check || !check(await readHead(file.path))) {
        throw new UnsupportedMediaTypeError(`"${file.originalname}" is not a valid ${file.mimetype} image`);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}
