import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ErreurApp } from '../erreurs/ErreurApp.js';

/** Répond 404 pour toute route qui n'existe pas. */
export const routeInconnue: RequestHandler = (req, res) => {
  res.status(404).json({
    succes: false,
    erreur: { code: 'ROUTE_INCONNUE', message: `La route ${req.method} ${req.path} n'existe pas.` },
  });
};

// Erreur lancée par express.json() quand le JSON est mal formé.
function estJsonInvalide(erreur: unknown): boolean {
  return (
    typeof erreur === 'object' &&
    erreur !== null &&
    (erreur as { type?: string }).type === 'entity.parse.failed'
  );
}

/**
 * Dernier maillon : transforme toute erreur en réponse JSON propre.
 * Les erreurs inattendues sont écrites dans le journal, mais le client ne voit
 * qu'un message neutre (aucun détail interne).
 */
export function gestionnaireErreurs(journaliser: (erreur: unknown) => void): ErrorRequestHandler {
  return (erreur, _req, res, _next) => {
    if (erreur instanceof ErreurApp) {
      res.status(erreur.statut).json({
        succes: false,
        erreur: {
          code: erreur.code,
          message: erreur.message,
          ...(erreur.details ? { details: erreur.details } : {}),
        },
      });
      return;
    }

    if (estJsonInvalide(erreur)) {
      res.status(400).json({
        succes: false,
        erreur: {
          code: 'JSON_INVALIDE',
          message: "Le corps de la requête n'est pas du JSON valide.",
        },
      });
      return;
    }

    journaliser(erreur);
    res.status(500).json({
      succes: false,
      erreur: { code: 'ERREUR_SERVEUR', message: 'Une erreur est survenue sur le serveur.' },
    });
  };
}
