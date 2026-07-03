import db from '../config/database.js';

export async function listNotifications(req, res, next) {
  try {
    const notifications = await db.all(`SELECT id, title, content, type, redirectPath, isRead, createdAt FROM notifications WHERE userId = ? ORDER BY createdAt DESC`, [req.user.id]);
    return res.json({ status: 'success', data: notifications });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const { id } = req.params;
    await db.run(`UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?`, [id, req.user.id]);
    return res.json({ status: 'success', message: 'Successfully marked notification as read' });
  } catch (error) {
    next(error);
  }
}
