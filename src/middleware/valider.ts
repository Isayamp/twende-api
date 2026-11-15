import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationEchouee, type DetailErreur } from '../erreurs/ErreurApp.js';

interface Schemas {
  corps?: ZodType;
  parametres?: ZodType;
  requete?: ZodType;
}

/**
 * Valide le corps, les paramètres d'URL et/ou la query string avec Zod.
 * Si tout est bon, le corps et les paramètres sont remplacés par les données nettoyées.
 * Express 5 interdit de modifier req.query : la version nettoyée va dans req.requeteValidee.
 */
export function valider(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const details: DetailErreur[] = [];

    const verifier = (schema: ZodType | undefined, donnees: unknown, prefixe: string) => {
      if (!schema) return undefined;
      const resultat = schema.safeParse(donnees);
      if (resultat.success) return resultat.data;
      for (const probleme of resultat.error.issues) {
        details.push({ champ: probleme.path.join('.') || prefixe, message: probleme.message });
      }
      return undefined;
    };

    const corps = verifier(schemas.corps, req.body, 'corps');
    const parametres = verifier(schemas.parametres, req.params, 'parametres');
    const requete = verifier(schemas.requete, req.query, 'requete');

    if (details.length > 0) {
      throw new ValidationEchouee(details);
    }

    if (schemas.corps) req.body = corps;
    if (schemas.parametres) Object.assign(req.params, parametres);
    if (schemas.requete) req.requeteValidee = requete;
    next();
  };
}
