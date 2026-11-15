import { createHash, randomBytes } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { RoleUtilisateur } from '@prisma/client';
import type { Config } from '../config/env.js';
import { NonAuthentifie } from '../erreurs/ErreurApp.js';

const ROLES: RoleUtilisateur[] = ['admin', 'agent', 'passager'];

export interface IdentiteJeton {
  id: number;
  role: RoleUtilisateur;
}

/** Jeton d'accès : court (15 minutes), signé, contient l'identifiant et le rôle. */
export function signerJetonAcces(
  config: Pick<Config, 'jwtSecret' | 'jwtAccesDuree'>,
  utilisateur: { id_utilisateur: number; role: RoleUtilisateur },
): string {
  return jwt.sign({ role: utilisateur.role }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: String(utilisateur.id_utilisateur),
    expiresIn: config.jwtAccesDuree as SignOptions['expiresIn'],
  });
}

/** Vérifie la signature et la date d'un jeton d'accès. Lance 401 s'il est mauvais. */
export function verifierJetonAcces(
  config: Pick<Config, 'jwtSecret'>,
  jeton: string,
): IdentiteJeton {
  try {
    // On n'accepte que HS256 : cela bloque l'attaque « algorithme none ».
    const charge = jwt.verify(jeton, config.jwtSecret, { algorithms: ['HS256'] });
    if (typeof charge === 'string') throw new Error('charge inattendue');

    const id = Number(charge.sub);
    const role = charge.role as RoleUtilisateur;
    if (!Number.isInteger(id) || !ROLES.includes(role)) throw new Error('charge invalide');
    return { id, role };
  } catch {
    throw new NonAuthentifie('Jeton invalide ou expiré.');
  }
}

/** Jeton de rafraîchissement : une longue valeur aléatoire (pas un JWT). */
export function creerJetonRafraichissement(): string {
  return randomBytes(48).toString('base64url');
}

/** Empreinte SHA-256 : seule l'empreinte est enregistrée en base. */
export function hacherJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}
