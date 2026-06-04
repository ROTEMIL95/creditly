import { userRepository } from '../repositories/userRepository.js';
import { verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/errors.js';

async function login(email: string, password: string) {
  const user = await userRepository.findByEmail(email);
  // Same error whether the email is unknown or the password is wrong (no user enumeration).
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const token = await signToken({ sub: user.id, role: user.role, bankId: user.bankId });

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, bankId: user.bankId },
  };
}

export const authService = { login };
