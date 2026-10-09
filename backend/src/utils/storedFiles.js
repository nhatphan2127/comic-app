import fs from 'node:fs/promises';
import path from 'node:path';
import { storageRoot } from '../middlewares/uploadMiddleware.js';

// Deletes uploaded files by their stored path relative to the storage folder (e.g. 'comics/<uuid>.png').
// Best effort: a file that is already gone, or a path outside the storage folder, is ignored. Call it only
// after the database change that stopped referencing the files has committed.
export async function removeStoredFiles(relativePaths) {
  const root = path.resolve(storageRoot);
  await Promise.all(
    [...new Set(relativePaths.filter(Boolean))].map(async (relative) => {
      const full = path.resolve(root, relative);
      if (!full.startsWith(root + path.sep)) return;
      await fs.unlink(full).catch(() => {});
    })
  );
}
