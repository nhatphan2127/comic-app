// The session token lives in an HttpOnly cookie, so page scripts (and an XSS payload) can never read it.
// COOKIE_SECURE=true is required behind HTTPS; COOKIE_SAMESITE=none (which also needs Secure) is only
// for a frontend on another site than the API — keep the default 'lax' otherwise.
export const SESSION_COOKIE = 'sid';

const secure = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure,
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  path: '/api',
};

export const readSessionCookie = (req) => req.cookies?.[SESSION_COOKIE] || null;

export const setSessionCookie = (res, token, expiresAt) =>
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, expires: new Date(expiresAt) });

export const clearSessionCookie = (res) => res.clearCookie(SESSION_COOKIE, cookieOptions);
