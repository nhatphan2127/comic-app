import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
import * as me from '../controllers/meController.js';

const router = express.Router();

// Everything under /me belongs to the logged-in user.
router.use(authenticateToken);

router.get('/', me.getMe);
router.patch('/', me.updateMe);
router.put('/avatar', upload.single('avatar'), me.putProfileImage('avatar'));
router.put('/background', upload.single('background'), me.putProfileImage('background'));
router.put('/password', me.changePassword);
router.patch('/preferences', me.updatePreferences);

router.get('/following', me.listFollowing);
router.get('/following/:comicId', me.getFollow);
router.put('/following/:comicId', me.putFollow);
router.delete('/following/:comicId', me.deleteFollow);

router.get('/following-categories', me.listFollowingCategories);
router.post('/following-categories', me.createFollowingCategory);
router.patch('/following-categories/:categoryId', me.updateFollowingCategory);
router.delete('/following-categories/:categoryId', me.deleteFollowingCategory);

router.put('/ratings/:comicId', me.putRating);
router.delete('/ratings/:comicId', me.deleteRating);

router.get('/history', me.listHistory);
router.delete('/history', me.clearHistory);
router.put('/history/:chapterId', me.putHistory);
router.delete('/history/:chapterId', me.deleteHistoryEntry);

router.get('/notifications', me.listNotifications);
router.patch('/notifications/:notificationId', me.updateNotification);

router.get('/comments', me.listMyComments);
router.get('/contributions/comics', me.listMyComicContributions);
router.get('/contributions/chapters', me.listMyChapterContributions);

export default router;
