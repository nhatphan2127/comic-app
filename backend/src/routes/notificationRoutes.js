import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { listNotifications, markNotificationRead } from '../controllers/notificationController.js';

const router = express.Router();
router.get('/', authenticateToken, listNotifications);
router.patch('/:id/read', authenticateToken, markNotificationRead);

export default router;
