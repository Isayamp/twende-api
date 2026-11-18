import { z } from 'zod';
import { champsPagination } from '../../lib/pagination.js';
import { dateSimple } from '../trajets/trajets.schemas.js';

export const schemaRemplissage = z
  .object({
    ...champsPagination,
    ligne_id: z.coerce.number().int().min(1).max(2147483647).optional(),
    du: dateSimple.optional(),
    au: dateSimple.optional(),
  })
  .refine((d) => !d.du || !d.au || d.du <= d.au, {
    message: '« du » doit être avant « au ».',
    path: ['du'],
  });

export type FiltresRemplissage = z.infer<typeof schemaRemplissage>;
