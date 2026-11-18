import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import type { Config } from '../../config/env.js';
import { ErreurApp } from '../../erreurs/ErreurApp.js';
import { schemaId } from '../../lib/identifiants.js';
import type { Prisma } from '../../lib/prisma.js';
import { envoyerSucces } from '../../lib/reponses.js';
import { creerAuthentifier } from '../../middleware/authentifier.js';
import { exigerRole } from '../../middleware/roles.js';
import { valider } from '../../middleware/valider.js';
import {
  schemaCreationReservation,
  schemaListeReservations,
  type ListeReservations,
} from './reservations.schemas.js';
import { creerServiceReservations, type Acteur } from './reservations.service.js';

const acteurDe = (req: Request): Acteur => req.utilisateur as Acteur;

/** Routes /reservations : tout utilisateur connecté réserve ; seul le personnel enregistre un paiement. */
export function creerRoutesReservations(deps: { config: Config; prisma: Prisma }): Router {
  const routes = Router();
  const service = creerServiceReservations(deps.prisma);
  routes.use(creerAuthentifier(deps));

  // Limite par utilisateur (le compte est connu : l'authentification passe avant) : 30 créations par minute.
  const limiteCreation = rateLimit({
    windowMs: 60 * 1000,
    limit: deps.config.environnement === 'test' ? 100000 : 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `utilisateur-${req.utilisateur?.id ?? 'inconnu'}`,
    validate: false,
    handler: (_req, _res, next) =>
      next(new ErreurApp(429, 'TROP_DE_REQUETES', 'Trop de réservations. Réessayez dans une minute.')),
  });

  routes.post('/', limiteCreation, valider({ corps: schemaCreationReservation }), async (req, res) => {
    envoyerSucces(res, await service.creer(acteurDe(req), req.body), 201);
  });

  routes.get('/', valider({ requete: schemaListeReservations }), async (req, res) => {
    const filtres = req.requeteValidee as ListeReservations;
    const { reservations, total } = await service.lister(acteurDe(req), filtres);
    envoyerSucces(res, reservations, 200, { page: filtres.page, limite: filtres.limite, total });
  });

  routes.get('/:id', valider({ parametres: schemaId }), async (req, res) => {
    envoyerSucces(res, await service.lire(acteurDe(req), Number(req.params.id)));
  });

  routes.post('/:id/annuler', valider({ parametres: schemaId }), async (req, res) => {
    envoyerSucces(res, await service.annuler(acteurDe(req), Number(req.params.id)));
  });

  routes.patch(
    '/:id/paiement',
    exigerRole('admin', 'agent'),
    valider({ parametres: schemaId }),
    async (req, res) => {
      envoyerSucces(res, await service.marquerPayee(acteurDe(req), Number(req.params.id)));
    },
  );

  return routes;
}
