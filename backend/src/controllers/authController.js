import asyncHandler from '../utils/asyncHandler.js';
import { created, noContent, ok } from '../utils/http.js';
import * as authService from '../services/authService.js';

// POST /auth/register → 201, Location: /me
export const register = asyncHandler(async (req, res) => {
  created(res, '/me', await authService.register(req.body || {}));
});

// POST /auth/login → 200 { data: { token, expiresAt, user } }
export const login = asyncHandler(async (req, res) => {
  const { userName, password } = req.body || {};
  ok(res, await authService.login(userName, password));
});

// POST /auth/logout → 204 (the session token stops working)
export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.session.token);
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
