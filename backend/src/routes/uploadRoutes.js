import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { health } from '../controllers/uploadController.js';

const router = express.Router();
router.get('/health', authenticateToken, health);

export default router;
