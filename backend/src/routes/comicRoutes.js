import express from 'express';
import { authenticateTokenOptional, authenticateToken, requireRole } from '../middlewares/authMiddleware.js';
import { 
  listComics, 
  popularComics, 
  getComicDetail, 
  getChapterDetail, 
  createComic, 
  createChapter,
  getMyComicContributions,
  getMyChapterContributions,
  updateComicContributorStatus,
  markComicContributorRead,
  updateChapterContributorStatus,
  markChapterContributorRead,
  getContributorsByComic
} from '../controllers/comicController.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();
router.get('/', listComics);
router.get('/popular', popularComics);
router.get('/:comicUrl', authenticateTokenOptional, getComicDetail);
router.get('/chapters/:chapterId', authenticateTokenOptional, getChapterDetail);
router.post('/', authenticateToken, requireRole('contributor', 'moderator', 'admin'), upload.single('coverImage'), createComic);
router.post('/:comicId/chapters', authenticateToken, requireRole('contributor', 'moderator', 'admin'), upload.array('images', 50), createChapter);

// Contributor routes
router.get('/:comicId/contributors', authenticateToken, getContributorsByComic);
router.put('/:comicId/contributors/:userId', authenticateToken, updateComicContributorStatus);
router.patch('/:comicId/contributors/:userId/read', authenticateToken, markComicContributorRead);

router.get('/:chapterId/contributors', authenticateToken, (req, res, next) => {
  // This would be for admins to view contributors - TODO
  res.status(501).json({ status: 'fail', message: 'Not implemented' });
});
router.put('/:chapterId/contributors/:userId', authenticateToken, updateChapterContributorStatus);
router.patch('/:chapterId/contributors/:userId/read', authenticateToken, markChapterContributorRead);

export default router;
