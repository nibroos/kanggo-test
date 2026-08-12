import * as authService from '../services/auth.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { contextOf, asyncHandler } from '../utils/requestContext.js';

/**
 * Controllers only translate HTTP <-> service calls (policy §15: no business
 * logic here). `jti` is dropped from the token payload — it is a server-side
 * bookkeeping detail.
 */
function tokenPayload({ accessToken, refreshToken, tokenType, expiresIn }) {
  return { accessToken, refreshToken, tokenType, expiresIn };
}

export const register = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.register(req.body, contextOf(req));
  return sendCreated(res, {
    message: 'Registration successful',
    data: { user, ...tokenPayload(tokens) },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.login(req.body, contextOf(req));
  return sendSuccess(res, {
    message: 'Login successful',
    data: { user, ...tokenPayload(tokens) },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.refresh(req.body, contextOf(req));
  return sendSuccess(res, {
    message: 'Token refreshed',
    data: { user, ...tokenPayload(tokens) },
  });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(
    { refreshToken: req.body?.refreshToken, userId: req.user.id },
    contextOf(req),
  );
  return sendSuccess(res, { message: 'Logout successful' });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.currentUser(req.user.id);
  return sendSuccess(res, { message: 'Current user', data: { user } });
});
