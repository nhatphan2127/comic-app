import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export async function findUserById(id) {
  return await db.get(
    'SELECT id, avatar, displayName, username, email, bio, socialLinks, role, isBanned FROM users WHERE id = ?',
    [id]
  );
}

export async function findUserByUsername(username) {
  return await db.get('SELECT id FROM users WHERE username = ?', [username]);
}

export async function findUserByCredentials(usernameOrEmail, password) {
  return await db.get(
    'SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?',
    [usernameOrEmail, usernameOrEmail, password]
  );
}

export async function createUser(username, password, email, displayName) {
  const id = uuidv4();
  await db.run(
    `INSERT INTO users (id, username, password, email, displayName, role) VALUES (?, ?, ?, ?, ?, 'user')`,
    [id, username, password, email, displayName]
  );
  // Default preferences
  await db.run(
    `INSERT INTO user_preferences (userId, theme, filter) VALUES (?, 'light', 1)`,
    [id]
  );
  return { id, username, displayName, role: 'user' };
}

export async function updateUser(id, { avatar, displayName, email, bio, socialLinks }) {
  await db.run(
    `UPDATE users SET 
      avatar = COALESCE(?, avatar), 
      displayName = COALESCE(?, displayName), 
      email = COALESCE(?, email), 
      bio = COALESCE(?, bio), 
      socialLinks = COALESCE(?, socialLinks), 
      updatedAt = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [avatar, displayName, email, bio, socialLinks, id]
  );
  return await findUserById(id);
}

export async function updateUserPassword(id, password) {
  await db.run(
    `UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    [password, id]
  );
}

export async function getUserPreferences(userId) {
  return await db.get('SELECT theme, filter FROM user_preferences WHERE userId = ?', [userId]);
}

export async function updateUserPreferences(userId, { theme, filter }) {
  const pref = await db.get('SELECT userId FROM user_preferences WHERE userId = ?', [userId]);
  if (pref) {
    await db.run(
      `UPDATE user_preferences SET theme = COALESCE(?, theme), filter = COALESCE(?, filter) WHERE userId = ?`,
      [theme, filter, userId]
    );
  } else {
    await db.run(
      `INSERT INTO user_preferences (userId, theme, filter) VALUES (?, ?, ?)`,
      [userId, theme || 'light', filter ?? 1]
    );
  }
  return await getUserPreferences(userId);
}

export async function createSession(userId, token, expiresAt) {
  const id = uuidv4();
  await db.run(
    `INSERT INTO sessions (id, userId, token, expiresAt) VALUES (?, ?, ?, ?)`,
    [id, userId, token, expiresAt]
  );
}

export async function deleteSession(token) {
  await db.run('DELETE FROM sessions WHERE token = ?', [token]);
}
