import type { RoleUtilisateur } from '@prisma/client';

// Ajoute nos propres champs à l'objet « requête » d'Express.
declare global {
  namespace Express {
    interface Request {
      /** Query string validée et nettoyée par le middleware valider(). */
      requeteValidee?: unknown;
      /** Utilisateur connecté, rempli par le middleware d'authentification. */
      utilisateur?: { id: number; role: RoleUtilisateur };
    }
  }
}

export {};
