import { z } from 'zod';

const LIMITE_PAR_DEFAUT = 20;
const LIMITE_MAXIMUM = 100;

/** Champs de pagination communs à toutes les listes : ?page=2&limite=20 */
export const champsPagination = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limite: z.coerce.number().int().min(1).max(LIMITE_MAXIMUM).default(LIMITE_PAR_DEFAUT),
};

/** Nombre de lignes à sauter pour arriver à la page demandée. */
export function decalage(page: number, limite: number): number {
  return (page - 1) * limite;
}
