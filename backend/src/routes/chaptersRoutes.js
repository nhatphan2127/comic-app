import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';
import {
  getContributorsByChapter,
  updateChapterContributorStatus,
  markChapterContributorRead,
} from '../controllers/comicController.js';

const router = express.Router();

// Admin / moderator: list contributors for a chapter
router.get('/:chapterId/contributors', authenticateToken, requireRole('admin', 'moderator'), getContributorsByChapter);

// Update contributor status (accept/reject) - moderators/admins
router.put('/:chapterId/contributors/:userId', authenticateToken, requireRole('admin', 'moderator'), updateChapterContributorStatus);

// Mark contributor notification as read - contributor
router.patch('/:chapterId/contributors/:userId/read', authenticateToken, markChapterContributorRead);

export default router;
