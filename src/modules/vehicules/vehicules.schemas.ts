import { z } from 'zod';
import { champsPagination } from '../../lib/pagination.js';
import { booleenRequete } from '../../lib/requete.js';

export const schemaCreationVehicule = z.object({
  immatriculation: z.string().trim().min(1, 'Champ obligatoire.').max(20),
  modele: z.string().trim().min(1, 'Champ obligatoire.').max(80),
  nombre_places: z.number().int().min(1).max(100),
  active: z.boolean().default(true),
});

export const schemaModificationVehicule = schemaCreationVehicule
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envoyez au moins un champ à modifier.');

export const schemaRechercheVehicules = z.object({
  ...champsPagination,
  q: z.string().trim().min(1).max(100).optional(),
  active: booleenRequete.optional(),
});

export type DonneesVehicule = z.infer<typeof schemaCreationVehicule>;
export type RechercheVehicules = z.infer<typeof schemaRechercheVehicules>;
