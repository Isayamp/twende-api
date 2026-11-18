import { Router } from 'express';
import type { Config } from '../../config/env.js';
import { schemaId } from '../../lib/identifiants.js';
import type { Prisma } from '../../lib/prisma.js';
import { envoyerSucces } from '../../lib/reponses.js';
import { creerAuthentifier } from '../../middleware/authentifier.js';
import { exigerRole } from '../../middleware/roles.js';
import { valider } from '../../middleware/valider.js';
import { creerServiceStatistiques } from '../statistiques/statistiques.service.js';
import { creerServiceRecherche } from './recherche.service.js';
import {
  schemaCreationTrajet,
  schemaListeTrajets,
  schemaModificationTrajet,
  schemaRechercheTrajets,
  type ListeTrajets,
  type RechercheTrajets,
} from './trajets.schemas.js';
import { creerServiceTrajets } from './trajets.service.js';

/** Routes /trajets : recherche et détail publics, liste pour le personnel, écriture pour l'admin. */
export function creerRoutesTrajets(deps: { config: Config; prisma: Prisma }): Router {
  const routes = Router();
  const recherche = creerServiceRecherche(deps.prisma);
  const service = creerServiceTrajets(deps.prisma);
  const statistiques = creerServiceStatistiques(deps.prisma);
  const authentifier = creerAuthentifier(deps);
  const personnel = [authentifier, exigerRole('admin', 'agent')];
  const admin = [authentifier, exigerRole('admin')];

  // Recherche publique. À déclarer AVANT « /:id » pour que « recherche » ne soit pas pris pour un id.
  routes.get('/recherche', valider({ requete: schemaRechercheTrajets }), async (req, res) => {
    const criteres = req.requeteValidee as RechercheTrajets;
    const { trajets, total } = await recherche.rechercher(criteres);
    envoyerSucces(res, trajets, 200, { page: criteres.page, limite: criteres.limite, total });
  });

  routes.get('/', ...personnel, valider({ requete: schemaListeTrajets }), async (req, res) => {
    const filtres = req.requeteValidee as ListeTrajets;
    const { trajets, total } = await service.lister(filtres);
    envoyerSucces(res, trajets, 200, { page: filtres.page, limite: filtres.limite, total });
  });

  routes.get('/:id', valider({ parametres: schemaId }), async (req, res) => {
    envoyerSucces(res, await service.lire(Number(req.params.id)));
  });

  routes.get('/:id/places', valider({ parametres: schemaId }), async (req, res) => {
    envoyerSucces(res, await service.places(Number(req.params.id)));
  });

  routes.get('/:id/remplissage', ...personnel, valider({ parametres: schemaId }), async (req, res) => {
    envoyerSucces(res, await statistiques.remplissageTrajet(Number(req.params.id)));
  });

  routes.post('/', ...admin, valider({ corps: schemaCreationTrajet }), async (req, res) => {
    envoyerSucces(res, await service.creer(req.body), 201);
  });

  routes.patch(
    '/:id',
    ...admin,
    valider({ parametres: schemaId, corps: schemaModificationTrajet }),
    async (req, res) => {
      envoyerSucces(res, await service.modifier(Number(req.params.id), req.body));
    },
  );

  routes.delete('/:id', ...admin, valider({ parametres: schemaId }), async (req, res) => {
    await service.supprimer(Number(req.params.id));
    res.status(204).end();
  });

  return routes;
}
