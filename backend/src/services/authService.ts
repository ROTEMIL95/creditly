import { AuditAction, AuditEntity } from '@prisma/client';
import { userRepository } from '../repositories/userRepository.js';
import { verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/errors.js';
import { auditService } from './auditService.js';

async function login(email: string, password: string) {
  const user = await userRepository.findByEmail(email);
  // Same error whether the email is unknown or the password is wrong (no user enumeration).
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await auditService.record({
      action: AuditAction.LOGIN_FAILURE,
      actorEmail: email,
      entityType: AuditEntity.SESSION,
      metadata: { reason: 'INVALID_CREDENTIALS' },
    });
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const token = await signToken({ sub: user.id, role: user.role, bankId: user.bankId });

  await auditService.record({
    action: AuditAction.LOGIN_SUCCESS,
    actorId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
    entityType: AuditEntity.SESSION,
  });

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, bankId: user.bankId },
  };
}

export const authService = { login };
