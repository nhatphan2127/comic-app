// A single comment, addressed by id. Listing and posting live under the parent:
// /comics/:comicId/comments and /chapters/:chapterId/comments (see comicRoutes.js).
import express from 'express';
import { authenticateToken, authenticateTokenOptional } from '../middlewares/authMiddleware.js';
import * as comments from '../controllers/commentController.js';

const router = express.Router();

router.get('/:commentId', authenticateTokenOptional, comments.getComment);
router.patch('/:commentId', authenticateToken, comments.editComment);
router.delete('/:commentId', authenticateToken, comments.deleteComment);
router.put('/:commentId/reaction', authenticateToken, comments.setReaction);
router.delete('/:commentId/reaction', authenticateToken, comments.removeReaction);

export default router;
