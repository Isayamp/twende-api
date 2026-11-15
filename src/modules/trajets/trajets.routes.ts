import { Router } from 'express';
import type { Config } from '../../config/env.js';
import type { Prisma } from '../../lib/prisma.js';
import { envoyerSucces } from '../../lib/reponses.js';
import { valider } from '../../middleware/valider.js';
import { creerServiceRecherche } from './recherche.service.js';
import { schemaRechercheTrajets, type RechercheTrajets } from './trajets.schemas.js';

/** Routes /trajets. */
export function creerRoutesTrajets(deps: { config: Config; prisma: Prisma }): Router {
  const routes = Router();
  const recherche = creerServiceRecherche(deps.prisma);

  // Recherche publique. À déclarer AVANT « /:id » pour que « recherche » ne soit pas pris pour un id.
  routes.get('/recherche', valider({ requete: schemaRechercheTrajets }), async (req, res) => {
    const criteres = req.requeteValidee as RechercheTrajets;
    const { trajets, total } = await recherche.rechercher(criteres);
    envoyerSucces(res, trajets, 200, { page: criteres.page, limite: criteres.limite, total });
  });

  return routes;
}
