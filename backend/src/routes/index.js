// Version 1 of the API, mounted at /api/v1 in app.js. A breaking change goes into a new
// router (routes/v2) mounted next to this one, so v1 clients keep working (see docs/api-conventions.md).
import express from 'express';
import authRoutes from './authRoutes.js';
import meRoutes from './meRoutes.js';
import commentRoutes from './commentRoutes.js';
import reportRoutes from './reportRoutes.js';
import userRoutes from './userRoutes.js';
import { comicRouter, chapterRouter } from './comicRoutes.js';
import { adminRouter, moderationRouter } from './adminRoutes.js';

// Exported so tests can check that every route is documented in openapi.yaml.
export const mounts = [
  ['/auth', authRoutes],
  ['/me', meRoutes],
  ['/users', userRoutes],
  ['/comics', comicRouter],
  ['/chapters', chapterRouter],
  ['/comments', commentRoutes],
  ['/reports', reportRoutes],
  ['/moderation', moderationRouter],
  ['/admin', adminRouter],
];

const v1 = express.Router();
for (const [path, router] of mounts) v1.use(path, router);

export default v1;
