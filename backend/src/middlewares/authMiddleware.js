import { resolveSession } from '../services/authService.js';
import { ForbiddenError, UnauthorizedError } from '../errors.js';
import { readSessionCookie } from '../utils/sessionCookie.js';

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
 * Middleware: session cookie required (authentication).
 */
export async function authenticateToken(req, res, next) {
  try {
    const token = readSessionCookie(req);
    if (!token) throw new UnauthorizedError('Authentication required');

    const session = await resolveSession(token);
    if (!session) throw new UnauthorizedError('Invalid or expired session token');

    attachUser(req, session);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: session cookie optional. A missing or invalid session continues as a guest.
 */
export async function authenticateTokenOptional(req, res, next) {
  try {
    const token = readSessionCookie(req);
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
