import db from '../config/database.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'fail', message: 'Missing Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const session = await db.get(
    `SELECT s.*, u.id AS userId, u.username, u.displayName, u.email, u.avatar, u.role
     FROM sessions s
     JOIN users u ON s.userId = u.id
     WHERE s.token = ?`,
    [token]
  );

  if (!session) {
    return res.status(401).json({ status: 'fail', message: 'Invalid session token' });
  }

  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    return res.status(401).json({ status: 'fail', message: 'Token has expired' });
  }

  req.user = {
    id: session.userId,
    username: session.username,
    displayName: session.displayName,
    email: session.email,
    avatar: session.avatar,
    role: session.role,
  };
  req.session = session;
  next();
}

export async function authenticateTokenOptional(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  const session = await db.get(
    `SELECT s.*, u.id AS userId, u.username, u.displayName, u.email, u.avatar, u.role
     FROM sessions s
     JOIN users u ON s.userId = u.id
     WHERE s.token = ?`,
    [token]
  );

  if (!session) {
    return next();
  }

  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    return next();
  }

  req.user = {
    id: session.userId,
    username: session.username,
    displayName: session.displayName,
    email: session.email,
    avatar: session.avatar,
    role: session.role,
  };
  req.session = session;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'fail', message: 'Authentication required' });
    }

    const allowed = roles.flat();
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ status: 'fail', message: 'Insufficient permissions' });
    }

    next();
  };
}
