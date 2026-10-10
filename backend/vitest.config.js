import { defineConfig } from 'vitest/config';
import os from 'node:os';
import path from 'node:path';

export default defineConfig({
  test: {
    // Read before src/config/database.js is imported, so every test file gets its own in-memory DB.
    env: {
      DB_PATH: ':memory:',
      STORAGE_ROOT: path.join(os.tmpdir(), 'comic-app-test-storage'),
      AUTH_RATE_LIMIT: '10000',
      COMIC_CREATE_RATE_LIMIT: '10000',
    },
  },
});
