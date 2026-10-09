import asyncHandler from '../utils/asyncHandler.js';
import { created, noContent, ok } from '../utils/http.js';
import * as authService from '../services/authService.js';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from '../utils/sessionCookie.js';

// POST /auth/register → 201, Location: /me
export const register = asyncHandler(async (req, res) => {
  created(res, '/me', await authService.register(req.body || {}));
});

// POST /auth/login → 200 { data: { expiresAt, user } } + Set-Cookie: sid (HttpOnly, never in the body)
export const login = asyncHandler(async (req, res) => {
  const { userName, password } = req.body || {};
  const { token, ...session } = await authService.login(userName, password);
  setSessionCookie(res, token, session.expiresAt);
  ok(res, session);
});

// POST /auth/logout → 204 (the session ends on the server and the cookie is cleared).
// Works without a valid session too, so a stale cookie can always be dropped.
export const logout = asyncHandler(async (req, res) => {
  await authService.logout(readSessionCookie(req));
  clearSessionCookie(res);
  noContent(res);
});

// POST /auth/password-reset { email } → 204 whether or not the email is registered
export const requestPasswordReset = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body?.email);
  noContent(res);
});

// POST /auth/password-reset/confirm { token, newPassword, confirmPassword } → 204
export const confirmPasswordReset = asyncHandler(async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body || {};
  await authService.resetPassword({ token, newPassword, confirmPassword });
  noContent(res);
});
