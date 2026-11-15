import { Router } from 'express';
import { envoyerSucces } from '../lib/reponses.js';

/** Toutes les routes de l'API (préfixe /api/v1). Les modules s'ajoutent ici. */
export function creerRoutes(): Router {
  const routes = Router();

  routes.get('/health', (_req, res) => {
    envoyerSucces(res, { statut: 'ok' });
  });

  return routes;
}
