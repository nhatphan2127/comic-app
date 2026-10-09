import express from 'express';
import rateLimit from 'express-rate-limit';
import { TooManyRequestsError } from '../errors.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
import * as me from '../controllers/meController.js';
import * as publish from '../controllers/publishController.js';

const router = express.Router();

// Creating a key checks the password, so it is limited like a login: 10 attempts per user per 15 minutes.
const createKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.id}`,
  handler: (req, res, next) => next(new TooManyRequestsError('Too many attempts, please try again later')),
});

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

router.get('/role-request', me.getRoleRequest);
router.post('/role-request', me.createRoleRequest);
router.delete('/role-request', me.cancelRoleRequest);

// Keys for the publishing API. Creating one needs contributor access (checked in the service);
// listing and revoking stay open so a demoted user can still clean up.
router.get('/uploadable-comics', publish.listUploadableComics);
router.get('/editable-comics/:comicId', me.getEditableComic);
router.get('/api-keys', publish.listKeys);
router.post('/api-keys', createKeyLimiter, publish.createKey);
router.delete('/api-keys/:keyId', publish.revokeKey);

export default router;
