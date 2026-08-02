import express from 'express';
import { authenticateToken, authenticateTokenOptional } from '../middlewares/authMiddleware.js';
import {
  getComicComments,
  postComicComment,
  editComment,
  deleteComment,
  reactComment,
  removeCommentReaction,
  getChapterComments,
  postChapterComment,
  editChapterComment,
  deleteChapterComment,
  reactChapterComment,
  removeChapterCommentReaction,
  getUserComments,
  getSingleComment
} from '../controllers/commentController.js';

const router = express.Router();
router.get('/user', authenticateToken, getUserComments);
router.get('/comics/:comicId', authenticateTokenOptional, getComicComments);
router.post('/comics/:comicId', authenticateToken, postComicComment);
router.patch('/comics/:commentId', authenticateToken, editComment);
router.delete('/comics/:commentId', authenticateToken, deleteComment);
router.post('/comics/:commentId/react', authenticateToken, reactComment);
router.delete('/comics/:commentId/react', authenticateToken, removeCommentReaction);

router.get('/chapters/:chapterId', authenticateTokenOptional, getChapterComments);
router.post('/chapters/:chapterId', authenticateToken, postChapterComment);
router.patch('/chapters/:commentId', authenticateToken, editChapterComment);
router.delete('/chapters/:commentId', authenticateToken, deleteChapterComment);
router.post('/chapters/:commentId/react', authenticateToken, reactChapterComment);
router.delete('/chapters/:commentId/react', authenticateToken, removeChapterCommentReaction);


router.get('/detail/:commentId', getSingleComment);
export default router;
