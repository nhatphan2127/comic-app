import express from 'express';
import rateLimit from 'express-rate-limit';
import { TooManyRequestsError } from '../errors.js';
import { authenticateTokenOptional, authenticateToken, requireRole } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
import { comicCreateLimiter } from '../middlewares/rateLimitMiddleware.js';
import * as comics from '../controllers/comicController.js';
import * as comments from '../controllers/commentController.js';

// Search-as-you-type fires a request every few keystrokes; this still stops scripts hammering it.
const suggestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.SUGGEST_RATE_LIMIT) || 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) => next(new TooManyRequestsError('Too many searches, slow down a little')),
});

const uploaders = requireRole('contributor', 'moderator', 'admin');
const staff = requireRole('admin', 'moderator');

// ---------- /comics ----------
export const comicRouter = express.Router();

comicRouter.get('/', comics.listComics);
comicRouter.post('/', authenticateToken, uploaders, comicCreateLimiter, upload.single('coverImage'), comics.createComic);
// Before /:comicId, which would match "rankings" and "suggest".
comicRouter.get('/rankings', comics.listRankings);
comicRouter.get('/suggest', suggestLimiter, comics.suggestComics);
// Reading routes accept the comic's id or its url slug in :comicId; writing routes need the id.
comicRouter.get('/:comicId', authenticateTokenOptional, comics.getComic);
comicRouter.patch('/:comicId', authenticateToken, uploaders, upload.single('coverImage'), comics.updateComic);

comicRouter.get('/:comicId/similar', comics.listSimilarComics);

comicRouter.get('/:comicId/chapters', comics.listComicChapters);
comicRouter.post('/:comicId/chapters', authenticateToken, uploaders, upload.array('images', 50), comics.createChapter);

comicRouter.get('/:comicId/comments', authenticateTokenOptional, comments.listComments('comic'));
comicRouter.post('/:comicId/comments', authenticateToken, comments.postComment('comic'));

comicRouter.get('/:comicId/contributors', authenticateToken, staff, comics.listContributors('comic'));
comicRouter.patch('/:comicId/contributors/:userId', authenticateToken, staff, comics.updateContributor('comic'));

// ---------- /chapters ----------
export const chapterRouter = express.Router();

chapterRouter.get('/:chapterId', authenticateTokenOptional, comics.getChapter);

chapterRouter.get('/:chapterId/comments', authenticateTokenOptional, comments.listComments('chapter'));
chapterRouter.post('/:chapterId/comments', authenticateToken, comments.postComment('chapter'));

chapterRouter.get('/:chapterId/contributors', authenticateToken, staff, comics.listContributors('chapter'));
chapterRouter.patch('/:chapterId/contributors/:userId', authenticateToken, staff, comics.updateContributor('chapter'));
