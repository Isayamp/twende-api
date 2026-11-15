import { Router } from 'express';
import type { Config } from '../../config/env.js';
import { schemaId } from '../../lib/identifiants.js';
import type { Prisma } from '../../lib/prisma.js';
import { envoyerSucces } from '../../lib/reponses.js';
import { creerAuthentifier } from '../../middleware/authentifier.js';
import { exigerRole } from '../../middleware/roles.js';
import { valider } from '../../middleware/valider.js';
import {
  schemaCreationVehicule,
  schemaModificationVehicule,
  schemaRechercheVehicules,
  type RechercheVehicules,
} from './vehicules.schemas.js';
import { creerServiceVehicules } from './vehicules.service.js';

/** Routes /vehicules : lecture pour le personnel, écriture pour l'administrateur. */
export function creerRoutesVehicules(deps: { config: Config; prisma: Prisma }): Router {
  const routes = Router();
  const service = creerServiceVehicules(deps.prisma);
  const authentifier = creerAuthentifier(deps);
  const personnel = [authentifier, exigerRole('admin', 'agent')];
  const admin = [authentifier, exigerRole('admin')];

  routes.get(
    '/',
    ...personnel,
    valider({ requete: schemaRechercheVehicules }),
    async (req, res) => {
      const recherche = req.requeteValidee as RechercheVehicules;
      const { vehicules, total } = await service.lister(recherche);
      envoyerSucces(res, vehicules, 200, { page: recherche.page, limite: recherche.limite, total });
    },
  );

  routes.get('/:id', ...personnel, valider({ parametres: schemaId }), async (req, res) => {
    envoyerSucces(res, await service.lire(Number(req.params.id)));
  });

  routes.post('/', ...admin, valider({ corps: schemaCreationVehicule }), async (req, res) => {
    envoyerSucces(res, await service.creer(req.body), 201);
  });

  routes.patch(
    '/:id',
    ...admin,
    valider({ parametres: schemaId, corps: schemaModificationVehicule }),
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
