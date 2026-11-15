import { z } from 'zod';

/** Identifiant numérique dans l'URL (ex. /stations/12). */
export const schemaId = z.object({
  id: z.coerce.number().int().min(1).max(2147483647),
});

/** Identifiant numérique dans un corps JSON (borné pour rester un entier PostgreSQL). */
export const identifiantJson = z.number().int().min(1).max(2147483647);
