import type { Response } from 'express';

export interface MetaPagination {
  page: number;
  limite: number;
  total: number;
}

/** Envoie une réponse de succès au format standard de l'API. */
export function envoyerSucces<T>(
  res: Response,
  donnees: T,
  statut = 200,
  meta?: MetaPagination,
): void {
  res.status(statut).json(meta ? { succes: true, donnees, meta } : { succes: true, donnees });
}
