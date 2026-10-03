import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  uploadBackground,
  updatePassword,
  updatePreferences,
  getFollowingList,
  getFollowingCategories,
  createFollowingCategory,
  updateFollowingCategory,
  deleteFollowingCategory,
  updateFollowingComicCategory,
  getBookmarks,
  getReadingHistory,
  removeHistoryChapter,
  clearReadingHistory
} from '../controllers/userController.js';
import {
  getMyComicContributions,
  getMyChapterContributions
} from '../controllers/comicController.js';

const router = express.Router();
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.put('/profile/avatar', authenticateToken, upload.single('avatar'), uploadAvatar);
router.put('/profile/background', authenticateToken, upload.single('background'), uploadBackground);
router.put('/password-reset', authenticateToken, updatePassword);
router.get('/following', authenticateToken, getFollowingList);
router.get('/following/categories', authenticateToken, getFollowingCategories);
router.post('/following/categories', authenticateToken, createFollowingCategory);
router.put('/following/categories/:categoryId', authenticateToken, updateFollowingCategory);
router.delete('/following/categories/:categoryId', authenticateToken, deleteFollowingCategory);
router.put('/following/:comicId/category', authenticateToken, updateFollowingComicCategory);

router.put('/preferences', authenticateToken, updatePreferences);
router.get('/bookmarks', authenticateToken, getBookmarks);
router.get('/history', authenticateToken, getReadingHistory);
router.delete('/history/:chapterId', authenticateToken, removeHistoryChapter);
router.delete('/history', authenticateToken, clearReadingHistory);

// Contributor routes
router.get('/comic-contributions', authenticateToken, getMyComicContributions);
router.get('/chapter-contributions', authenticateToken, getMyChapterContributions);

export default router;
