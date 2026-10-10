import express from 'express';
import { authenticateTokenOptional, authenticateToken, requireRole } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
import * as comics from '../controllers/comicController.js';
import * as comments from '../controllers/commentController.js';

const uploaders = requireRole('contributor', 'moderator', 'admin');
const staff = requireRole('admin', 'moderator');

// ---------- /comics ----------
export const comicRouter = express.Router();

comicRouter.get('/', comics.listComics);
comicRouter.post('/', authenticateToken, uploaders, upload.single('coverImage'), comics.createComic);
comicRouter.get('/rankings', comics.listRankings); // before /:comicId, which would match "rankings"
// Reading routes accept the comic's id or its url slug in :comicId; writing routes need the id.
comicRouter.get('/:comicId', authenticateTokenOptional, comics.getComic);
comicRouter.patch('/:comicId', authenticateToken, uploaders, upload.single('coverImage'), comics.updateComic);

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
