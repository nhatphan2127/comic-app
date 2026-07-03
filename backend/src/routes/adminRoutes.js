import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';
import { assignUserRole, forceDeleteComicComment, forceDeleteChapterComment } from '../controllers/adminController.js';

const router = express.Router();
router.patch('/users/:userId/role', authenticateToken, requireRole('admin'), assignUserRole);
router.delete('/comments/comics/:commentId', authenticateToken, requireRole('admin', 'moderator'), forceDeleteComicComment);
router.delete('/comments/chapters/:commentId', authenticateToken, requireRole('admin', 'moderator'), forceDeleteChapterComment);

export default router;
