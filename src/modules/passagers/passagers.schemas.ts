import { z } from 'zod';
import { champsPagination } from '../../lib/pagination.js';
import { schemaPassager } from '../reservations/reservations.schemas.js';

// Un client du guichet : nom et téléphone (mêmes règles que sur une réservation), e-mail facultatif.
export const schemaCreationPassager = schemaPassager.extend({
  email: z.string().trim().max(160).email('E-mail invalide.').optional(),
});

export const schemaModificationPassager = schemaCreationPassager
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envoyez au moins un champ à modifier.');

export const schemaRecherchePassagers = z.object({
  ...champsPagination,
  q: z.string().trim().min(1).max(100).optional(),
});

export type DonneesPassager = z.infer<typeof schemaCreationPassager>;
export type RecherchePassagers = z.infer<typeof schemaRecherchePassagers>;
