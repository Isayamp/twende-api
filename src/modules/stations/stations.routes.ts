import { Router } from 'express';
import type { Config } from '../../config/env.js';
import { schemaId } from '../../lib/identifiants.js';
import type { Prisma } from '../../lib/prisma.js';
import { envoyerSucces } from '../../lib/reponses.js';
import { creerAuthentifier } from '../../middleware/authentifier.js';
import { exigerRole } from '../../middleware/roles.js';
import { valider } from '../../middleware/valider.js';
import {
  schemaCreationStation,
  schemaModificationStation,
  schemaRechercheStations,
  type RechercheStations,
} from './stations.schemas.js';
import { creerServiceStations } from './stations.service.js';

/** Routes /stations : lecture publique, écriture réservée à l'administrateur. */
export function creerRoutesStations(deps: { config: Config; prisma: Prisma }): Router {
  const routes = Router();
  const service = creerServiceStations(deps.prisma);
  const admin = [creerAuthentifier(deps), exigerRole('admin')];

  routes.get('/', valider({ requete: schemaRechercheStations }), async (req, res) => {
    const recherche = req.requeteValidee as RechercheStations;
    const { stations, total } = await service.lister(recherche);
    envoyerSucces(res, stations, 200, { page: recherche.page, limite: recherche.limite, total });
  });

  routes.get('/:id', valider({ parametres: schemaId }), async (req, res) => {
    envoyerSucces(res, await service.lire(Number(req.params.id)));
  });

  routes.post('/', ...admin, valider({ corps: schemaCreationStation }), async (req, res) => {
    envoyerSucces(res, await service.creer(req.body), 201);
  });

  routes.patch(
    '/:id',
    ...admin,
    valider({ parametres: schemaId, corps: schemaModificationStation }),
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
