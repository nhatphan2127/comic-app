import { logger } from '../config/logger.js';
import { removeStorageObject } from '../services/objectStorageService.js';

// Deletes uploaded files by their stored path relative to the storage folder (e.g. 'comics/<uuid>.png').
// Best effort: a file that is already gone, or a path outside the storage folder, is ignored. Call it only
// after the database change that stopped referencing the files has committed.
export async function removeStoredFiles(relativePaths) {
  await Promise.all(
    [...new Set(relativePaths.filter(Boolean))].map(async (relative) => {
      try {
        await removeStorageObject(relative);
      } catch (error) {
        logger.warn('Failed to remove an unreferenced storage object', {
          key: relative,
          error: error.message,
        });
      }
    })
  );
}
