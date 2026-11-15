import { pino } from 'pino';
import type { Config } from '../config/env.js';

/** Crée le journal de l'application. Silencieux pendant les tests. */
export function creerLogger(config: Pick<Config, 'environnement'>) {
  return pino({
    level: config.environnement === 'test' ? 'silent' : 'info',
    // Ne jamais écrire les mots de passe ni les jetons dans les journaux.
    redact: ['req.headers.authorization', 'req.headers.cookie', '*.mot_de_passe', '*.motDePasse'],
  });
}

export type Logger = ReturnType<typeof creerLogger>;
