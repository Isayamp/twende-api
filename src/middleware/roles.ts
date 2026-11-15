import type { RequestHandler } from 'express';
import type { RoleUtilisateur } from '@prisma/client';
import { Interdit, NonAuthentifie } from '../erreurs/ErreurApp.js';

/** Autorise seulement les rôles donnés. À placer après le middleware d'authentification. */
export function exigerRole(...rolesAutorises: RoleUtilisateur[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.utilisateur) throw new NonAuthentifie();
    if (!rolesAutorises.includes(req.utilisateur.role)) throw new Interdit();
    next();
  };
}
