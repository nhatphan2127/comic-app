import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { getFollowStatus, followComic, unfollowComic, bookmarkComic, unbookmarkComic, rateComic, saveReadingHistory } from '../controllers/interactionController.js';

const router = express.Router();
router.get('/:comicId/follow', authenticateToken, getFollowStatus);
router.post('/:comicId/follow', authenticateToken, followComic);
router.delete('/:comicId/follow', authenticateToken, unfollowComic);
router.post('/:comicId/bookmark', authenticateToken, bookmarkComic);
router.delete('/:comicId/bookmark', authenticateToken, unbookmarkComic);
router.post('/:comicId/rate', authenticateToken, rateComic);
router.post('/chapters/:chapterId/history', authenticateToken, saveReadingHistory);
router.put('/chapters/:chapterId/history', authenticateToken, saveReadingHistory);

export default router;
