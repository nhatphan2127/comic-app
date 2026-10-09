// CSRF protection for the cookie session: the browser attaches the cookie to requests from any site,
// so a state-changing request must come from a page we trust (OWASP "verify origin with standard headers").
// SameSite=Lax on the cookie is a second layer. Requests without a cookie and without an Origin
// (curl, scripts, API keys) carry no ambient credentials and pass.
import { readSessionCookie } from '../utils/sessionCookie.js';
import { ForbiddenError } from '../errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requestOrigin(req) {
  const origin = req.get('origin');
  if (origin && origin !== 'null') return origin;
  try {
    return new URL(req.get('referer')).origin;
  } catch {
    return null;
  }
}

export const requireTrustedOrigin = (allowedOrigins) => (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!readSessionCookie(req) && !req.get('origin')) return next();

  const origin = requestOrigin(req);
  // The API's own origin is trusted too (Swagger UI at /api/docs).
  const self = `${req.protocol}://${req.get('host')}`;
  if (origin && (origin === self || allowedOrigins.includes(origin))) return next();
  next(new ForbiddenError('Cross-site request blocked'));
};
