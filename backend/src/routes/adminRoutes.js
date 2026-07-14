import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';
import {
  assignUserRole,
  forceDeleteComicComment,
  forceDeleteChapterComment,
  getAdminChapters,
  getAdminComics,
  getModerationQueue,
  reviewSubmission,
  getAdminDashboard,
  setAutoAccept,
  toggleUserBan,
  toggleCommentBan,
  updateChapterStatus,
  updateComicStatus,
  updateComicVisibility,
  updateChapterVisibility,
  getAdminComicsForDashboard,
  getAdminChaptersForDashboard,
} from '../controllers/adminController.js';

const router = express.Router();
router.get('/moderation/queue', authenticateToken, requireRole('admin', 'moderator'), getModerationQueue);
router.patch('/moderation/:targetType/:targetId', authenticateToken, requireRole('admin', 'moderator'), reviewSubmission);
router.get('/dashboard', authenticateToken, requireRole('admin'), getAdminDashboard);
router.get('/comics', authenticateToken, requireRole('admin', 'moderator'), getAdminComics);
router.get('/comics-dashboard', authenticateToken, requireRole('admin'), getAdminComicsForDashboard);
router.patch('/comics/:comicId/status', authenticateToken, requireRole('admin', 'moderator'), updateComicStatus);
router.patch('/comics/:comicId/visibility', authenticateToken, requireRole('admin'), updateComicVisibility);
router.get('/chapters', authenticateToken, requireRole('admin', 'moderator'), getAdminChapters);
router.get('/chapters-dashboard', authenticateToken, requireRole('admin'), getAdminChaptersForDashboard);
router.patch('/chapters/:chapterId/status', authenticateToken, requireRole('admin', 'moderator'), updateChapterStatus);
router.patch('/chapters/:chapterId/visibility', authenticateToken, requireRole('admin'), updateChapterVisibility);
router.patch('/settings/auto-accept', authenticateToken, requireRole('admin'), setAutoAccept);
router.patch('/users/:userId/ban', authenticateToken, requireRole('admin'), toggleUserBan);
router.patch('/comments/:targetType/:commentId/ban', authenticateToken, requireRole('admin'), toggleCommentBan);
router.patch('/users/:userId/role', authenticateToken, requireRole('admin'), assignUserRole);
router.delete('/comments/comics/:commentId', authenticateToken, requireRole('admin', 'moderator'), forceDeleteComicComment);
router.delete('/comments/chapters/:commentId', authenticateToken, requireRole('admin', 'moderator'), forceDeleteChapterComment);

export default router;
