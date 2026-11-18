import { Router } from 'express';
import type { Config } from '../config/env.js';
import type { Prisma } from '../lib/prisma.js';
import { envoyerSucces } from '../lib/reponses.js';
import { creerRoutesAuth } from '../modules/auth/auth.routes.js';
import { creerRoutesLignes } from '../modules/lignes/lignes.routes.js';
import { creerRoutesPassagers } from '../modules/passagers/passagers.routes.js';
import { creerRoutesReservations } from '../modules/reservations/reservations.routes.js';
import { creerRoutesStations } from '../modules/stations/stations.routes.js';
import { creerRoutesStatistiques } from '../modules/statistiques/statistiques.routes.js';
import { creerRoutesTrajets } from '../modules/trajets/trajets.routes.js';
import { creerRoutesVehicules } from '../modules/vehicules/vehicules.routes.js';

/** Toutes les routes de l'API (préfixe /api/v1). Les modules s'ajoutent ici. */
export function creerRoutes(deps: { config: Config; prisma: Prisma }): Router {
  const routes = Router();

  routes.get('/health', (_req, res) => {
    envoyerSucces(res, { statut: 'ok' });
  });

  routes.use('/auth', creerRoutesAuth(deps));
  routes.use('/stations', creerRoutesStations(deps));
  routes.use('/vehicules', creerRoutesVehicules(deps));
  routes.use('/lignes', creerRoutesLignes(deps));
  routes.use('/trajets', creerRoutesTrajets(deps));
  routes.use('/reservations', creerRoutesReservations(deps));
  routes.use('/passagers', creerRoutesPassagers(deps));
  routes.use('/statistiques', creerRoutesStatistiques(deps));

  return routes;
}
