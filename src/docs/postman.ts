import { operations, type Operation } from './operations.js';

/** Chemin OpenAPI → chemin Postman : /stations/{id} devient /stations/:id */
const cheminPostman = (chemin: string) => chemin.replace('{id}', ':id');

function requetePostman(op: Operation) {
  const segments = cheminPostman(op.chemin).split('/').filter(Boolean);
  const url: Record<string, unknown> = {
    raw: `{{base_url}}/api/v1${cheminPostman(op.chemin)}`,
    host: ['{{base_url}}'],
    path: ['api', 'v1', ...segments],
  };
  if (op.chemin.includes('{id}')) url.variable = [{ key: 'id', value: '1' }];
  if (op.exempleRequete) {
    url.query = Object.entries(op.exempleRequete).map(([key, value]) => ({ key, value }));
    url.raw += '?' + Object.entries(op.exempleRequete).map(([k, v]) => `${k}=${v}`).join('&');
  }

  const item: Record<string, unknown> = {
    name: `${op.methode.toUpperCase()} ${op.chemin}`,
    request: {
      method: op.methode.toUpperCase(),
      description: op.resume,
      header: op.corps ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      ...(op.corps && op.exempleCorps
        ? {
            body: {
              mode: 'raw',
              raw: JSON.stringify(op.exempleCorps, null, 2),
              options: { raw: { language: 'json' } },
            },
          }
        : {}),
      url,
      ...(op.acces === 'public' ? { auth: { type: 'noauth' } } : {}),
    },
  };

  // La connexion enregistre les jetons : les autres requêtes les utilisent sans rien copier.
  if (op.chemin === '/auth/login' || op.chemin === '/auth/refresh') {
    item.event = [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            'const json = pm.response.json();',
            "if (json.succes && json.donnees) {",
            "  pm.collectionVariables.set('jeton', json.donnees.jeton_acces);",
            "  pm.collectionVariables.set('jeton_rafraichissement', json.donnees.jeton_rafraichissement);",
            '}',
          ],
        },
      },
    ];
  }
  return item;
}

/** Collection Postman v2.1 (importable dans Postman), générée depuis la même liste que Swagger. */
export function construireCollectionPostman(): object {
  const tags = [...new Set(operations.map((o) => o.tag))];
  return {
    info: {
      name: 'Twende API',
      description:
        'Lancez d’abord « POST /auth/login » : le jeton est enregistré et utilisé par toutes les autres requêtes. ' +
        'Comptes de démonstration : admin@twende.test, agent@twende.test, passager@twende.test.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{jeton}}', type: 'string' }] },
    variable: [
      { key: 'base_url', value: 'http://localhost:3000' },
      { key: 'jeton', value: '' },
      { key: 'jeton_rafraichissement', value: '' },
    ],
    item: tags.map((tag) => ({
      name: tag,
      item: operations.filter((o) => o.tag === tag).map(requetePostman),
    })),
  };
}
