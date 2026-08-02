import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';
import {
  assignUserRole,
  getAdminDashboard,
  setAutoAccept,
  toggleUserBan,
  toggleCommentBan,
  updateComicVisibility,
  updateChapterVisibility,
  getAdminComicsForDashboard,
  getAdminChaptersForDashboard,
} from '../controllers/adminController.js';

const router = express.Router();

router.get('/dashboard', authenticateToken, requireRole('admin'), getAdminDashboard);
router.get('/comics-dashboard', authenticateToken, requireRole('admin'), getAdminComicsForDashboard);
router.get('/chapters-dashboard', authenticateToken, requireRole('admin'), getAdminChaptersForDashboard);
router.patch('/comics/:comicId/visibility', authenticateToken, requireRole('admin'), updateComicVisibility);
router.patch('/chapters/:chapterId/visibility', authenticateToken, requireRole('admin'), updateChapterVisibility);
router.patch('/settings/auto-accept', authenticateToken, requireRole('admin'), setAutoAccept);
router.patch('/users/:userId/ban', authenticateToken, requireRole('admin'), toggleUserBan);
router.patch('/comments/:targetType/:commentId/ban', authenticateToken, requireRole('admin'), toggleCommentBan);
router.patch('/users/:userId/role', authenticateToken, requireRole('admin'), assignUserRole);

export default router;
