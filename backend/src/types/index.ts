import type { Role } from '@prisma/client';

// The authenticated principal attached to the request context by the auth middleware.
export interface AuthUser {
  id: string;
  role: Role;
  bankId: string | null;
}

// Hono context variable map — gives `c.get('user')` full typing across the app.
export interface AppEnv {
  Variables: {
    user: AuthUser;
  };
}
