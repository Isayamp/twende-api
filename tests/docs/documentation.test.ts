import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { construireOpenApi } from '../../src/docs/openapi.js';
import { construireCollectionPostman } from '../../src/docs/postman.js';
import { operations } from '../../src/docs/operations.js';
import { creerAppTest, prisma } from '../helpers/bd.js';

const app = creerAppTest();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('documentation de l’API', () => {
  it('sert la page Swagger sur /api-docs et la spécification sur /api-docs.json', async () => {
    const page = await request(app).get('/api-docs/').redirects(1);
    const json = await request(app).get('/api-docs.json');

    expect(page.status).toBe(200);
    expect(page.text).toContain('swagger-ui');
    expect(json.status).toBe(200);
    expect(json.body.openapi).toBe('3.1.0');
    expect(json.body.info.title).toBe('Twende API');
  });

  it('décrit la sécurité : routes publiques sans jeton, les autres avec jeton', () => {
    const spec = construireOpenApi() as {
      paths: Record<string, Record<string, { security: object[] }>>;
      components: { securitySchemes: Record<string, unknown> };
    };

    expect(spec.components.securitySchemes.jeton).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(spec.paths['/trajets/recherche']?.get?.security).toEqual([]);
    expect(spec.paths['/reservations']?.post?.security).toEqual([{ jeton: [] }]);
  });

  it('documente les codes d’erreur importants de la réservation', () => {
    const spec = construireOpenApi() as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };
    const codes = Object.keys(spec.paths['/reservations']?.post?.responses ?? {});

    expect(codes).toEqual(expect.arrayContaining(['201', '401', '409', '422', '429']));
  });

  it('reprend les vrais schémas de validation (corps de la réservation)', () => {
    const spec = construireOpenApi() as {
      paths: Record<
        string,
        Record<string, { requestBody: { content: { 'application/json': { schema: { properties: object } } } } }>
      >;
    };
    const schema = spec.paths['/reservations']?.post?.requestBody.content['application/json'].schema;

    expect(Object.keys(schema?.properties ?? {})).toEqual(
      expect.arrayContaining(['trajet_id', 'station_depart_id', 'station_arrivee_id', 'places']),
    );
  });

  it('chaque route documentée existe vraiment (aucune ne répond « route inconnue »)', async () => {
    for (const op of operations) {
      const chemin = `/api/v1${op.chemin.replace('{id}', '1')}`;
      const reponse = await request(app)[op.methode](chemin).send({});
      expect(reponse.body?.erreur?.code, `${op.methode} ${op.chemin}`).not.toBe('ROUTE_INCONNUE');
    }
  });

  it('la collection Postman contient toutes les routes et enregistre le jeton à la connexion', () => {
    const collection = construireCollectionPostman() as {
      item: { name: string; item: { name: string; event?: unknown[] }[] }[];
    };
    const requetes = collection.item.flatMap((dossier) => dossier.item);
    const connexion = requetes.find((r) => r.name === 'POST /auth/login');

    expect(requetes).toHaveLength(operations.length);
    expect(connexion?.event).toBeDefined();
  });
});
