import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { creerApp } from '../../src/app.js';
import { chargerConfig } from '../../src/config/env.js';

const config = chargerConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:x@localhost:5432/twende',
  JWT_SECRET: 'une-phrase-secrete-de-plus-de-trente-deux-caracteres',
  CORS_ORIGINES: 'http://front.test',
});

describe('application', () => {
  const app = creerApp(config);

  it('répond sur /api/v1/health', async () => {
    const reponse = await request(app).get('/api/v1/health');

    expect(reponse.status).toBe(200);
    expect(reponse.body).toEqual({ succes: true, donnees: { statut: 'ok' } });
  });

  it('renvoie 404 au format standard pour une route inconnue', async () => {
    const reponse = await request(app).get('/api/v1/nexiste-pas');

    expect(reponse.status).toBe(404);
    expect(reponse.body.succes).toBe(false);
    expect(reponse.body.erreur.code).toBe('ROUTE_INCONNUE');
  });

  it('ajoute les en-têtes de sécurité Helmet', async () => {
    const reponse = await request(app).get('/api/v1/health');

    expect(reponse.headers['x-content-type-options']).toBe('nosniff');
    expect(reponse.headers['x-powered-by']).toBeUndefined();
  });

  it('autorise seulement les origines CORS configurées', async () => {
    const permise = await request(app).get('/api/v1/health').set('Origin', 'http://front.test');
    const refusee = await request(app).get('/api/v1/health').set('Origin', 'http://pirate.test');

    expect(permise.headers['access-control-allow-origin']).toBe('http://front.test');
    expect(refusee.headers['access-control-allow-origin']).toBeUndefined();
  });
});
