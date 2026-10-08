import { resolveSession } from '../services/authService.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';

function readBearerToken(req) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
}

function attachUser(req, session) {
  req.user = {
    id: session.userId,
    username: session.username,
    displayName: session.displayName,
    email: session.email,
    avatar: session.avatar,
    role: session.role,
  };
  req.session = session;
}

/**
 * Middleware: token required (authentication).
 */
export async function authenticateToken(req, res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) throw new UnauthorizedError('Missing Authorization header');

    const session = await resolveSession(token);
    if (!session) throw new UnauthorizedError('Invalid or expired session token');

    attachUser(req, session);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: token optional. A missing or invalid token continues as a guest.
 */
export async function authenticateTokenOptional(req, res, next) {
  try {
    const token = readBearerToken(req);
    const session = token ? await resolveSession(token) : null;
    if (session) attachUser(req, session);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: role check (coarse authorization). Ownership checks ("is this MY comic?")
 * need the resource, so they live in the services instead.
 */
export function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError('Authentication required'));
    if (!allowed.includes(req.user.role)) return next(new ForbiddenError('Insufficient permissions'));
    next();
  };
}
