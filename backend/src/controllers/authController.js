import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export async function register(req, res, next) {
  try {
    const { userName, password, email, displayName } = req.body;
    if (!userName || !password || !email || !displayName) {
      return res.status(400).json({ status: 'fail', message: 'Missing required fields' });
    }

    const existing = await db.get('SELECT id FROM users WHERE username = ?', [userName]);
    if (existing) {
      return res.status(409).json({ status: 'fail', message: 'Username already exists' });
    }

    const id = uuidv4();
    await db.run(
      `INSERT INTO users (id, username, password, email, displayName, role) VALUES (?, ?, ?, ?, ?, 'user')`,
      [id, userName, password, email, displayName]
    );

    await db.run(
      `INSERT INTO user_preferences (userId, theme, filter) VALUES (?, 'light', 1)`,
      [id]
    );

    return res.status(201).json({
      status: 'success',
      data: { id, userName, displayName, role: 'user', createdAt: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { userName, password } = req.body;
    if (!userName || !password) {
      return res.status(400).json({ status: 'fail', message: 'Missing username or password' });
    }

    const user = await db.get(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?',
      [userName, userName, password]
    );
    if (!user) {
      return res.status(401).json({ status: 'fail', message: 'Invalid credentials' });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.run(
      `INSERT INTO sessions (id, userId, token, expiresAt) VALUES (?, ?, ?, ?)`,
      [uuidv4(), user.id, token, expiresAt]
    );

    return res.json({
      status: 'success',
      data: {
        token,
        expiresAt,
        user: { id: user.id, userName: user.username, role: user.role },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    await db.run('DELETE FROM sessions WHERE token = ?', [token]);
    return res.json({ status: 'success', message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}
