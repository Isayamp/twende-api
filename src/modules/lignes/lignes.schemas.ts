import { z } from 'zod';
import { identifiantJson } from '../../lib/identifiants.js';
import { champsPagination } from '../../lib/pagination.js';
import { booleenRequete } from '../../lib/requete.js';

export const schemaCreationLigne = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Champ obligatoire.')
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, 'Lettres, chiffres, tiret et souligné seulement.'),
  nom: z.string().trim().min(1, 'Champ obligatoire.').max(120),
  active: z.boolean().default(true),
});

export const schemaModificationLigne = schemaCreationLigne
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envoyez au moins un champ à modifier.');

export const schemaRechercheLignes = z.object({
  ...champsPagination,
  q: z.string().trim().min(1).max(100).optional(),
  active: booleenRequete.optional(),
});

const identifiant = identifiantJson;

export const schemaArrets = z.object({
  arrets: z
    .array(
      z.object({
        station_id: identifiant,
        distance_km: z.number().min(0).max(99999),
        minutes_depuis_origine: z.number().int().min(0).max(10000),
      }),
    )
    .min(2, 'Une ligne a au moins 2 arrêts.')
    .max(50)
    .refine(
      (arrets) => new Set(arrets.map((a) => a.station_id)).size === arrets.length,
      'Une station ne peut apparaître qu’une fois.',
    ),
});

// Le prix peut être un nombre ou un texte décimal (ex. "7500.50"). Jamais de calcul en flottant.
const prix = z.union([
  z.number().min(0).max(9999999999).multipleOf(0.01),
  z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Prix invalide.'),
]);

export const schemaTarifs = z.object({
  tarifs: z
    .array(
      z.object({
        station_depart_id: identifiant,
        station_arrivee_id: identifiant,
        prix,
      }),
    )
    .max(500)
    .refine(
      (tarifs) =>
        new Set(tarifs.map((t) => `${t.station_depart_id}-${t.station_arrivee_id}`)).size ===
        tarifs.length,
      'Un tronçon ne peut avoir qu’un seul prix.',
    ),
});

export type DonneesLigne = z.infer<typeof schemaCreationLigne>;
export type RechercheLignes = z.infer<typeof schemaRechercheLignes>;
export type DonneesArrets = z.infer<typeof schemaArrets>['arrets'];
export type DonneesTarifs = z.infer<typeof schemaTarifs>['tarifs'];
