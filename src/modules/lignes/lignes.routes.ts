import { Router } from 'express';
import type { Config } from '../../config/env.js';
import { schemaId } from '../../lib/identifiants.js';
import type { Prisma } from '../../lib/prisma.js';
import { envoyerSucces } from '../../lib/reponses.js';
import { creerAuthentifier } from '../../middleware/authentifier.js';
import { exigerRole } from '../../middleware/roles.js';
import { valider } from '../../middleware/valider.js';
import {
  schemaArrets,
  schemaCreationLigne,
  schemaModificationLigne,
  schemaRechercheLignes,
  schemaTarifs,
  type RechercheLignes,
} from './lignes.schemas.js';
import { creerServiceLignes } from './lignes.service.js';

/** Routes /lignes : lecture publique, écriture réservée à l'administrateur. */
export function creerRoutesLignes(deps: { config: Config; prisma: Prisma }): Router {
  const routes = Router();
  const service = creerServiceLignes(deps.prisma);
  const admin = [creerAuthentifier(deps), exigerRole('admin')];

  routes.get('/', valider({ requete: schemaRechercheLignes }), async (req, res) => {
    const recherche = req.requeteValidee as RechercheLignes;
    const { lignes, total } = await service.lister(recherche);
    envoyerSucces(res, lignes, 200, { page: recherche.page, limite: recherche.limite, total });
  });

  routes.get('/:id', valider({ parametres: schemaId }), async (req, res) => {
    envoyerSucces(res, await service.lire(Number(req.params.id)));
  });

  routes.post('/', ...admin, valider({ corps: schemaCreationLigne }), async (req, res) => {
    envoyerSucces(res, await service.creer(req.body), 201);
  });

  routes.patch(
    '/:id',
    ...admin,
    valider({ parametres: schemaId, corps: schemaModificationLigne }),
    async (req, res) => {
      envoyerSucces(res, await service.modifier(Number(req.params.id), req.body));
    },
  );

  routes.delete('/:id', ...admin, valider({ parametres: schemaId }), async (req, res) => {
    await service.supprimer(Number(req.params.id));
    res.status(204).end();
  });

  routes.put(
    '/:id/arrets',
    ...admin,
    valider({ parametres: schemaId, corps: schemaArrets }),
    async (req, res) => {
      envoyerSucces(res, await service.remplacerArrets(Number(req.params.id), req.body.arrets));
    },
  );

  routes.put(
    '/:id/tarifs',
    ...admin,
    valider({ parametres: schemaId, corps: schemaTarifs }),
    async (req, res) => {
      envoyerSucces(res, await service.remplacerTarifs(Number(req.params.id), req.body.tarifs));
    },
  );

  return routes;
}
