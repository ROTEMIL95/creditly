import type { Context } from 'hono';
import { BadRequestError } from './errors.js';

// Reads a required route param, throwing a clear 400 if somehow absent.
export function requireParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (!value) throw new BadRequestError(`Missing route parameter: ${name}`);
  return value;
}
