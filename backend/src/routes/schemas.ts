import { z } from 'zod';
import { EventType } from '@prisma/client';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createEventSchema = z.object({
  accountId: z.string().min(1),
  // API uses the UPPERCASE enum values (e.g. "DOCUMENT_UPLOADED"). See README.
  type: z.nativeEnum(EventType),
  payload: z.record(z.unknown()).optional(),
});

export const submitOfferSchema = z.object({
  interestRate: z.number().positive().max(100),
});
