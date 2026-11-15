// Ajoute nos propres champs à l'objet « requête » d'Express.
declare global {
  namespace Express {
    interface Request {
      /** Query string validée et nettoyée par le middleware valider(). */
      requeteValidee?: unknown;
    }
  }
}

export {};
