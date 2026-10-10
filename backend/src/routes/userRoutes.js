import express from 'express';
import { authenticateTokenOptional } from '../middlewares/authMiddleware.js';
import * as users from '../controllers/userController.js';

// Public profiles: no login needed.
const router = express.Router();

router.get('/:userId', authenticateTokenOptional, users.getUser);
router.get('/:userId/comments', users.listUserComments);

export default router;
