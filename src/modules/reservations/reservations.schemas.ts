import { z } from 'zod';
import { identifiantJson } from '../../lib/identifiants.js';
import { champsPagination } from '../../lib/pagination.js';

export const MAX_PLACES_PAR_RESERVATION = 10;

export const schemaPassager = z.object({
  nom_complet: z
    .string()
    .trim()
    .min(1, 'Champ obligatoire.')
    .max(120)
    .regex(/^[^\u0000-\u001F\u007F]+$/, 'Caractères non autorisés.'),
  telephone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ().-]{5,30}$/, 'Numéro de téléphone invalide.'),
});

const schemaPlace = z.object({
  numero_place: z.number().int().min(1).max(1000),
  passager: schemaPassager.optional(),
});

export const schemaCreationReservation = z
  .object({
    trajet_id: identifiantJson,
    station_depart_id: identifiantJson,
    station_arrivee_id: identifiantJson,
    places: z
      .array(schemaPlace)
      .min(1, 'Choisissez au moins une place.')
      .max(MAX_PLACES_PAR_RESERVATION, `Maximum ${MAX_PLACES_PAR_RESERVATION} places à la fois.`),
  })
  .refine((d) => d.station_depart_id !== d.station_arrivee_id, {
    path: ['station_arrivee_id'],
    message: 'Le départ et l’arrivée doivent être différents.',
  })
  .refine((d) => new Set(d.places.map((p) => p.numero_place)).size === d.places.length, {
    path: ['places'],
    message: 'Une place ne peut être choisie qu’une fois.',
  });

export const schemaListeReservations = z.object({
  ...champsPagination,
  statut: z.enum(['confirmee', 'annulee']).optional(),
  statut_paiement: z.enum(['en_attente', 'paye']).optional(),
  trajet_id: z.coerce.number().int().min(1).max(2147483647).optional(),
});

export type DonneesReservation = z.infer<typeof schemaCreationReservation>;
export type ListeReservations = z.infer<typeof schemaListeReservations>;
