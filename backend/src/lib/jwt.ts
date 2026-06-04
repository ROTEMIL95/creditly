import { sign, verify } from 'hono/jwt';
import { env } from '../config/env.js';
import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string; // user id
  role: Role;
  bankId: string | null;
  exp: number; // seconds since epoch
  [key: string]: unknown;
}

// Parse simple duration strings like "1d", "12h", "30m", "60s" into seconds.
function durationToSeconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) return Number(value) || 86_400;
  const n = Number(match[1]);
  const unit = match[2];
  const factor = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86_400;
  return n * factor;
}

export async function signToken(payload: {
  sub: string;
  role: Role;
  bankId: string | null;
}): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = nowSeconds + durationToSeconds(env.JWT_EXPIRES_IN);
  return sign({ ...payload, exp }, env.JWT_SECRET, 'HS256');
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  return (await verify(token, env.JWT_SECRET, 'HS256')) as JwtPayload;
}
