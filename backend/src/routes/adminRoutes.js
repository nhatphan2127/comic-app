import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';
import * as admin from '../controllers/adminController.js';
import * as reports from '../controllers/reportController.js';

// ---------- /admin (admins only) ----------
export const adminRouter = express.Router();
adminRouter.use(authenticateToken, requireRole('admin'));

adminRouter.get('/dashboard', admin.getDashboard);
adminRouter.get('/comics', admin.listContent('comic'));
adminRouter.patch('/comics/:comicId', admin.updateVisibility('comic'));
adminRouter.get('/chapters', admin.listContent('chapter'));
adminRouter.patch('/chapters/:chapterId', admin.updateVisibility('chapter'));
adminRouter.get('/users', admin.listUsers);
adminRouter.patch('/users/:userId', admin.updateUser);
adminRouter.get('/role-requests', admin.listRoleRequests);
adminRouter.patch('/role-requests/:requestId', admin.decideRoleRequest);
adminRouter.patch('/comments/:commentId', admin.updateComment);
adminRouter.get('/settings', admin.getSettings);
adminRouter.patch('/settings', admin.updateSettings);

// ---------- /moderation (admins and moderators) ----------
export const moderationRouter = express.Router();
moderationRouter.use(authenticateToken, requireRole('admin', 'moderator'));

moderationRouter.get('/queue', admin.getQueue);
moderationRouter.get('/comics', admin.listContent('comic'));
moderationRouter.get('/comics/:comicId', admin.getComicForReview);
moderationRouter.patch('/comics/:comicId', admin.review('comic'));
moderationRouter.get('/chapters', admin.listContent('chapter'));
moderationRouter.get('/chapters/:chapterId', admin.getChapterForReview);
moderationRouter.patch('/chapters/:chapterId', admin.review('chapter'));
moderationRouter.delete('/comments/:commentId', admin.forceDeleteComment);
moderationRouter.get('/reports', reports.listReports);
moderationRouter.patch('/reports/:reportId', reports.updateReport);
