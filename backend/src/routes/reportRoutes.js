import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import * as reports from '../controllers/reportController.js';

// Any logged-in reader can file a report; moderators work through them under /moderation/reports.
const router = express.Router();

router.post('/', authenticateToken, reports.createReport);

export default router;
