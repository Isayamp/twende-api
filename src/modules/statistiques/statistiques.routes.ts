import { Router } from 'express';
import type { Config } from '../../config/env.js';
import type { Prisma } from '../../lib/prisma.js';
import { envoyerSucces } from '../../lib/reponses.js';
import { creerAuthentifier } from '../../middleware/authentifier.js';
import { exigerRole } from '../../middleware/roles.js';
import { valider } from '../../middleware/valider.js';
import { schemaRemplissage, type FiltresRemplissage } from './statistiques.schemas.js';
import { creerServiceStatistiques } from './statistiques.service.js';

/** Routes /statistiques : réservées au personnel (admin, agent). */
export function creerRoutesStatistiques(deps: { config: Config; prisma: Prisma }): Router {
  const routes = Router();
  const service = creerServiceStatistiques(deps.prisma);
  routes.use(creerAuthentifier(deps), exigerRole('admin', 'agent'));

  routes.get('/remplissage', valider({ requete: schemaRemplissage }), async (req, res) => {
    const filtres = req.requeteValidee as FiltresRemplissage;
    const { donnees, total } = await service.remplissage(filtres);
    envoyerSucces(res, donnees, 200, { page: filtres.page, limite: filtres.limite, total });
  });

  return routes;
}
