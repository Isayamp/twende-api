import { Router } from 'express';
import type { Config } from '../config/env.js';
import type { Prisma } from '../lib/prisma.js';
import { envoyerSucces } from '../lib/reponses.js';
import { creerRoutesAuth } from '../modules/auth/auth.routes.js';
import { creerRoutesStations } from '../modules/stations/stations.routes.js';

/** Toutes les routes de l'API (préfixe /api/v1). Les modules s'ajoutent ici. */
export function creerRoutes(deps: { config: Config; prisma: Prisma }): Router {
  const routes = Router();

  routes.get('/health', (_req, res) => {
    envoyerSucces(res, { statut: 'ok' });
  });

  routes.use('/auth', creerRoutesAuth(deps));
  routes.use('/stations', creerRoutesStations(deps));

  return routes;
}
