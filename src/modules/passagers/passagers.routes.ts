import { Router } from 'express';
import type { Config } from '../../config/env.js';
import { schemaId } from '../../lib/identifiants.js';
import type { Prisma } from '../../lib/prisma.js';
import { envoyerSucces } from '../../lib/reponses.js';
import { creerAuthentifier } from '../../middleware/authentifier.js';
import { exigerRole } from '../../middleware/roles.js';
import { valider } from '../../middleware/valider.js';
import {
  schemaCreationPassager,
  schemaModificationPassager,
  schemaRecherchePassagers,
  type RecherchePassagers,
} from './passagers.schemas.js';
import { creerServicePassagers } from './passagers.service.js';

/** Routes /passagers : clients du guichet. Personnel seulement ; la suppression est réservée à l'admin. */
export function creerRoutesPassagers(deps: { config: Config; prisma: Prisma }): Router {
  const routes = Router();
  const service = creerServicePassagers(deps.prisma);
  routes.use(creerAuthentifier(deps), exigerRole('admin', 'agent'));

  routes.get('/', valider({ requete: schemaRecherchePassagers }), async (req, res) => {
    const recherche = req.requeteValidee as RecherchePassagers;
    const { passagers, total } = await service.lister(recherche);
    envoyerSucces(res, passagers, 200, { page: recherche.page, limite: recherche.limite, total });
  });

  routes.get('/:id', valider({ parametres: schemaId }), async (req, res) => {
    envoyerSucces(res, await service.lire(Number(req.params.id)));
  });

  routes.post('/', valider({ corps: schemaCreationPassager }), async (req, res) => {
    envoyerSucces(res, await service.creer(req.body), 201);
  });

  routes.patch(
    '/:id',
    valider({ parametres: schemaId, corps: schemaModificationPassager }),
    async (req, res) => {
      envoyerSucces(res, await service.modifier(Number(req.params.id), req.body));
    },
  );

  routes.delete('/:id', exigerRole('admin'), valider({ parametres: schemaId }), async (req, res) => {
    await service.supprimer(Number(req.params.id));
    res.status(204).end();
  });

  return routes;
}
