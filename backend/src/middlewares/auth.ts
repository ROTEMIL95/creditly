import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/errors.js';
import type { AppEnv } from '../types/index.js';

export const AUTH_COOKIE = 'token';

// Authenticates the request: reads the JWT from the httpOnly cookie (or a Bearer
// header fallback), verifies it, and attaches the principal to the context.
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cookieToken = getCookie(c, AUTH_COOKIE);
  const authHeader = c.req.header('Authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = cookieToken ?? bearer;

  if (!token) {
    throw new UnauthorizedError('Authentication required');
  }

  try {
    const payload = await verifyToken(token);
    c.set('user', {
      id: payload.sub,
      role: payload.role,
      bankId: payload.bankId ?? null,
    });
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  await next();
};
