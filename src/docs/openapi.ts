import { z, type ZodType } from 'zod';
import { operations, type Acces, type Operation } from './operations.js';

type SchemaJson = Record<string, unknown>;

const DESCRIPTION_ACCES: Record<Acces, string> = {
  public: 'Accès : public (aucune connexion).',
  connecte: 'Accès : utilisateur connecté (passager, agent ou admin).',
  personnel: 'Accès : personnel (agent ou admin).',
  admin: 'Accès : administrateur seulement.',
};

const MESSAGES_ERREUR: Record<number, string> = {
  401: 'Connexion requise ou jeton invalide.',
  403: 'Droit insuffisant.',
  404: 'Ressource introuvable.',
  409: 'Conflit (doublon, place déjà prise, élément utilisé).',
  422: 'Données invalides.',
  429: 'Trop de requêtes.',
};

/** Schéma JSON d'un schéma Zod (sans la clé $schema, inutile dans OpenAPI). */
function versJson(schema: ZodType, io: 'input' | 'output'): SchemaJson {
  const json = z.toJSONSchema(schema, { io, unrepresentable: 'any' }) as SchemaJson;
  delete json.$schema;
  return json;
}

function aUnParametreDeChemin(chemin: string): boolean {
  return chemin.includes('{id}');
}

function parametres(op: Operation) {
  const liste: object[] = [];
  if (aUnParametreDeChemin(op.chemin)) {
    liste.push({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'integer', minimum: 1 },
      example: 1,
    });
  }
  if (op.requete) {
    const proprietes = (versJson(op.requete, 'output').properties ?? {}) as Record<string, SchemaJson>;
    for (const [nom, schema] of Object.entries(proprietes)) {
      liste.push({
        name: nom,
        in: 'query',
        required: op.obligatoires?.includes(nom) ?? false,
        schema,
        ...(op.exempleRequete?.[nom] ? { example: op.exempleRequete[nom] } : {}),
      });
    }
  }
  return liste;
}

/** Codes d'erreur de la route : ceux déduits de sa forme, plus ceux qu'elle déclare. */
function codesErreur(op: Operation): number[] {
  const codes = new Set<number>(op.erreurs ?? []);
  if (op.acces !== 'public') codes.add(401);
  if (op.acces === 'personnel' || op.acces === 'admin') codes.add(403);
  if (aUnParametreDeChemin(op.chemin)) codes.add(404);
  if (op.corps || op.requete || aUnParametreDeChemin(op.chemin)) codes.add(422);
  return [...codes].sort((a, b) => a - b);
}

function reponses(op: Operation) {
  const statut = op.statut ?? 200;
  const resultat: Record<string, object> = {};
  if (statut === 204) {
    resultat['204'] = { description: 'Supprimé (aucun contenu).' };
  } else {
    resultat[String(statut)] = {
      description: statut === 201 ? 'Créé.' : 'Réussi.',
      content: {
        'application/json': {
          schema: { $ref: op.liste ? '#/components/schemas/SuccesListe' : '#/components/schemas/Succes' },
        },
      },
    };
  }
  for (const code of codesErreur(op)) {
    resultat[String(code)] = {
      description: MESSAGES_ERREUR[code] ?? 'Erreur.',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Erreur' } } },
    };
  }
  return resultat;
}

function operationOpenApi(op: Operation) {
  return {
    tags: [op.tag],
    summary: op.resume,
    description: DESCRIPTION_ACCES[op.acces],
    ...(op.acces === 'public' ? { security: [] } : { security: [{ jeton: [] }] }),
    parameters: parametres(op),
    ...(op.corps
      ? {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: versJson(op.corps, 'input'),
                ...(op.exempleCorps ? { example: op.exempleCorps } : {}),
              },
            },
          },
        }
      : {}),
    responses: reponses(op),
  };
}

/** Spécification OpenAPI 3.1 de l'API, construite à partir des schémas de validation réels. */
export function construireOpenApi(): object {
  const chemins: Record<string, Record<string, object>> = {};
  for (const op of operations) {
    chemins[op.chemin] = { ...chemins[op.chemin], [op.methode]: operationOpenApi(op) };
  }
  const tags = [...new Set(operations.map((o) => o.tag))].map((name) => ({ name }));

  return {
    openapi: '3.1.0',
    info: {
      title: 'Twende API',
      version: '1.0.0',
      description:
        'API de transport et de réservation de bus (Burundi). ' +
        'Les succès ont la forme `{ succes: true, donnees, meta? }`, les erreurs ' +
        '`{ succes: false, erreur: { code, message, details? } }`. ' +
        'Connectez-vous avec POST /auth/login, puis cliquez sur « Authorize » et collez le jeton d’accès.',
    },
    servers: [{ url: '/api/v1' }],
    tags,
    security: [{ jeton: [] }],
    paths: chemins,
    components: {
      securitySchemes: { jeton: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Meta: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limite: { type: 'integer' },
            total: { type: 'integer' },
          },
        },
        Succes: {
          type: 'object',
          properties: { succes: { type: 'boolean', const: true }, donnees: {} },
        },
        SuccesListe: {
          type: 'object',
          properties: {
            succes: { type: 'boolean', const: true },
            donnees: {},
            meta: { $ref: '#/components/schemas/Meta' },
          },
        },
        Erreur: {
          type: 'object',
          properties: {
            succes: { type: 'boolean', const: false },
            erreur: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'PLACE_DEJA_PRISE' },
                message: { type: 'string' },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { champ: { type: 'string' }, message: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
