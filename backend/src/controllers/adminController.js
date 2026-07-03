import db from '../config/database.js';

export async function assignUserRole(req, res, next) {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ status: 'fail', message: 'Role is required' });
    }

    const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    await db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    return res.json({ status: 'success', data: { userId, role } });
  } catch (error) {
    next(error);
  }
}

export async function forceDeleteComicComment(req, res, next) {
  try {
    const { commentId } = req.params;
    await db.run('DELETE FROM comic_comments WHERE id = ?', [commentId]);
    return res.json({ status: 'success', message: 'The comment was force-removed by the administration team' });
  } catch (error) {
    next(error);
  }
}

export async function forceDeleteChapterComment(req, res, next) {
  try {
    const { commentId } = req.params;
    await db.run('DELETE FROM chapter_comments WHERE id = ?', [commentId]);
    return res.json({ status: 'success', message: 'The chapter comment was force-removed by the administration team' });
  } catch (error) {
    next(error);
  }
}
