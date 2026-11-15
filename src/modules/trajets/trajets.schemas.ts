import { z } from 'zod';
import { identifiantJson } from '../../lib/identifiants.js';
import { champsPagination } from '../../lib/pagination.js';

const identifiant = identifiantJson;
const identifiantRequete = z.coerce.number().int().min(1).max(2147483647);

// Date seule « 2030-06-10 » : le format ET le calendrier sont vérifiés (pas de 31 février).
const dateSimple = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : AAAA-MM-JJ.')
  .refine(
    (d) =>
      !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) &&
      new Date(`${d}T00:00:00Z`).toISOString().startsWith(d),
    'Date invalide.',
  );

const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format attendu : HH:MM.');

/** Date et heure complètes avec fuseau, ex. 2030-06-10T07:00:00+02:00 ou ...Z */
const instant = z.iso
  .datetime({ offset: true, message: 'Date et heure invalides (ISO 8601 avec fuseau).' })
  .transform((s) => new Date(s));

// ---------- Recherche publique ----------

export const schemaRechercheTrajets = z
  .object({
    ...champsPagination,
    depart: identifiantRequete,
    arrivee: identifiantRequete,
    date: dateSimple.optional(),
    heure_min: heure.optional(),
    heure_max: heure.optional(),
    prix_max: z.coerce.number().min(0).max(9999999999).optional(),
    places_min: z.coerce.number().int().min(1).max(100).optional(),
    tri: z.enum(['heure', 'prix']).default('heure'),
  })
  .refine((d) => d.depart !== d.arrivee, {
    message: 'Le départ et l’arrivée doivent être différents.',
    path: ['arrivee'],
  })
  .refine((d) => !d.heure_min || !d.heure_max || d.heure_min <= d.heure_max, {
    message: 'heure_min doit être avant heure_max.',
    path: ['heure_min'],
  });

export type RechercheTrajets = z.infer<typeof schemaRechercheTrajets>;

// ---------- Liste du personnel ----------

export const schemaListeTrajets = z.object({
  ...champsPagination,
  ligne_id: identifiantRequete.optional(),
  vehicule_id: identifiantRequete.optional(),
  statut: z.enum(['planifie', 'en_cours', 'termine', 'annule']).optional(),
  du: dateSimple.optional(),
  au: dateSimple.optional(),
});

export type ListeTrajets = z.infer<typeof schemaListeTrajets>;

// ---------- Écriture ----------

export const schemaCreationTrajet = z.object({
  ligne_id: identifiant,
  vehicule_id: identifiant,
  depart_prevu: instant,
  // Facultatif : sinon calculé avec la durée du dernier arrêt de la ligne.
  arrivee_prevue: instant.optional(),
});

export const schemaModificationTrajet = z
  .object({
    vehicule_id: identifiant,
    depart_prevu: instant,
    arrivee_prevue: instant,
    statut: z.enum(['planifie', 'en_cours', 'termine', 'annule']),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Envoyez au moins un champ à modifier.');

export type DonneesCreationTrajet = z.infer<typeof schemaCreationTrajet>;
export type DonneesModificationTrajet = z.infer<typeof schemaModificationTrajet>;
