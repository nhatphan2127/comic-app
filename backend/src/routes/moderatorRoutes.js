import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';
import {
  forceDeleteComicComment,
  forceDeleteChapterComment,
  getAdminChapters,
  getAdminComics,
  getModerationQueue,
  reviewSubmission,
  updateChapterStatus,
  updateComicStatus,
  getModerationComicDetail,
} from '../controllers/adminController.js';

const router = express.Router();

router.get('/queue', authenticateToken, requireRole('admin', 'moderator'), getModerationQueue);
router.get('/comic/:comicId', authenticateToken, requireRole('admin', 'moderator'), getModerationComicDetail);
router.patch('/:targetType/:targetId', authenticateToken, requireRole('admin', 'moderator'), reviewSubmission);
router.get('/comics', authenticateToken, requireRole('admin', 'moderator'), getAdminComics);
router.patch('/comics/:comicId/status', authenticateToken, requireRole('admin', 'moderator'), updateComicStatus);
router.get('/chapters', authenticateToken, requireRole('admin', 'moderator'), getAdminChapters);
router.patch('/chapters/:chapterId/status', authenticateToken, requireRole('admin', 'moderator'), updateChapterStatus);
router.delete('/comments/comics/:commentId', authenticateToken, requireRole('admin', 'moderator'), forceDeleteComicComment);
router.delete('/comments/chapters/:commentId', authenticateToken, requireRole('admin', 'moderator'), forceDeleteChapterComment);

export default router;
