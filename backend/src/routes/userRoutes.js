import express from 'express';
import * as users from '../controllers/userController.js';

// Public profiles: no login needed.
const router = express.Router();

router.get('/:userId', users.getUser);
router.get('/:userId/comments', users.listUserComments);

export default router;
