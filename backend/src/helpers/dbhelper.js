import db from '../config/database.js';
export default async function getValidSession(token) {
  const session = await db.get(
    `SELECT s.*, u.id AS userId, u.username, u.displayName, u.email, u.avatar, u.role
     FROM sessions s
     JOIN users u ON s.userId = u.id
     WHERE s.token = ?`,
    [token]
  );

  if (!session) {
    return null;
  }

  // Kiểm tra thời hạn session (đảm bảo expiresAt được lưu ở dạng chuẩn UTC hoặc timestamp)
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    return null;
  }

  return session;
}
