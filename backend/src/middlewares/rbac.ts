import type { MiddlewareHandler } from 'hono';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import type { AppEnv } from '../types/index.js';

// Coarse-grained guard: the user's role must be in the allow-list.
// Fine-grained, data-scoped checks (e.g. "manager owns this account") live in services.
export function requireRole(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) throw new UnauthorizedError();
    if (!roles.includes(user.role)) {
      throw new ForbiddenError(`Requires role: ${roles.join(' | ')}`);
    }
    await next();
  };
}

export { Role };
