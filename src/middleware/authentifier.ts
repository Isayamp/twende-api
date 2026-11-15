import type { RequestHandler } from 'express';
import type { Config } from '../config/env.js';
import { Interdit, NonAuthentifie } from '../erreurs/ErreurApp.js';
import { verifierJetonAcces } from '../lib/jetons.js';
import type { Prisma } from '../lib/prisma.js';

/**
 * Lit le jeton « Authorization: Bearer ... », le vérifie, puis place l'utilisateur dans req.utilisateur.
 * On relit l'utilisateur en base : un compte désactivé perd son accès tout de suite.
 */
export function creerAuthentifier(deps: { config: Config; prisma: Prisma }): RequestHandler {
  return async (req, _res, next) => {
    const entete = req.header('Authorization') ?? '';
    const [type, jeton] = entete.split(' ');
    if (type !== 'Bearer' || !jeton) throw new NonAuthentifie();

    const identite = verifierJetonAcces(deps.config, jeton);
    const utilisateur = await deps.prisma.utilisateur.findUnique({
      where: { id_utilisateur: identite.id },
      select: { id_utilisateur: true, role: true, actif: true },
    });

    if (!utilisateur) throw new NonAuthentifie('Jeton invalide ou expiré.');
    if (!utilisateur.actif) throw new Interdit('Ce compte est désactivé.');

    // Le rôle vient de la base (pas du jeton) : un changement de rôle est pris en compte tout de suite.
    req.utilisateur = { id: utilisateur.id_utilisateur, role: utilisateur.role };
    next();
  };
}
