import { z } from 'zod';
import { champsPagination } from '../../lib/pagination.js';

const texte = (max: number) => z.string().trim().min(1, 'Champ obligatoire.').max(max);

export const schemaCreationStation = z.object({
  nom: texte(100),
  ville: texte(100),
  pays: texte(60),
});

export const schemaModificationStation = schemaCreationStation
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envoyez au moins un champ à modifier.');

export const schemaRechercheStations = z.object({
  ...champsPagination,
  q: z.string().trim().min(1).max(100).optional(),
  ville: z.string().trim().min(1).max(100).optional(),
});

export type DonneesStation = z.infer<typeof schemaCreationStation>;
export type RechercheStations = z.infer<typeof schemaRechercheStations>;
