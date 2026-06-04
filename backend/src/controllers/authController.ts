import type { Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { authService } from '../services/authService.js';
import { env } from '../config/env.js';
import { AUTH_COOKIE } from '../middlewares/auth.js';
import type { AppEnv } from '../types/index.js';

export const authController = {
  async login(c: Context<AppEnv>) {
    const { email, password } = await c.req.json<{ email: string; password: string }>();
    const result = await authService.login(email, password);

    setCookie(c, AUTH_COOKIE, result.token, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    // Also return the token so non-cookie clients (and tests) can use the Bearer header.
    return c.json({ user: result.user, token: result.token });
  },

  logout(c: Context<AppEnv>) {
    deleteCookie(c, AUTH_COOKIE, { path: '/' });
    return c.json({ ok: true });
  },

  me(c: Context<AppEnv>) {
    return c.json({ user: c.get('user') });
  },
};
