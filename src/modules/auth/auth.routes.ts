import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Config } from '../../config/env.js';
import { ErreurApp, NonAuthentifie } from '../../erreurs/ErreurApp.js';
import type { Prisma } from '../../lib/prisma.js';
import { envoyerSucces } from '../../lib/reponses.js';
import { creerAuthentifier } from '../../middleware/authentifier.js';
import { valider } from '../../middleware/valider.js';
import { schemaConnexion, schemaInscription, schemaJetonRafraichissement } from './auth.schemas.js';
import { creerServiceAuth } from './auth.service.js';

/** Routes /auth : inscription, connexion, rafraîchissement, déconnexion, profil. */
export function creerRoutesAuth(deps: { config: Config; prisma: Prisma }): Router {
  const routes = Router();
  const service = creerServiceAuth(deps);
  const authentifier = creerAuthentifier(deps);

  // Un compteur par route (par adresse IP) : un blocage sur /login ne gêne pas /refresh.
  const creerLimiteur = (max: number) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: deps.config.environnement === 'test' ? 100000 : max,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(
          new ErreurApp(429, 'TROP_DE_REQUETES', "Trop d'essais. Réessayez dans quelques minutes."),
        ),
    });
  const limiteInscription = creerLimiteur(20);
  const limiteConnexion = creerLimiteur(10);
  const limiteRafraichissement = creerLimiteur(60);

  routes.post(
    '/register',
    limiteInscription,
    valider({ corps: schemaInscription }),
    async (req, res) => {
      const utilisateur = await service.inscrire(req.body);
      envoyerSucces(res, utilisateur, 201);
    },
  );

  routes.post('/login', limiteConnexion, valider({ corps: schemaConnexion }), async (req, res) => {
    const session = await service.connecter(req.body.email, req.body.mot_de_passe);
    envoyerSucces(res, session);
  });

  routes.post(
    '/refresh',
    limiteRafraichissement,
    valider({ corps: schemaJetonRafraichissement }),
    async (req, res) => {
      const session = await service.rafraichir(req.body.jeton_rafraichissement);
      envoyerSucces(res, session);
    },
  );

  routes.post(
    '/logout',
    authentifier,
    valider({ corps: schemaJetonRafraichissement }),
    async (req, res) => {
      await service.deconnecter(req.utilisateur!.id, req.body.jeton_rafraichissement);
      envoyerSucces(res, { message: 'Déconnexion réussie.' });
    },
  );

  routes.get('/me', authentifier, async (req, res) => {
    const utilisateur = await service.profil(req.utilisateur!.id);
    if (!utilisateur) throw new NonAuthentifie();
    envoyerSucces(res, utilisateur);
  });

  return routes;
}
