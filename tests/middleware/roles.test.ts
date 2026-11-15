import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { gestionnaireErreurs } from '../../src/middleware/gestionnaireErreurs.js';
import { exigerRole } from '../../src/middleware/roles.js';

// Petite application : un faux utilisateur est placé selon l'en-tête X-Role.
function creerAppDeTest() {
  const app = express();
  app.use((req, _res, next) => {
    const role = req.header('X-Role');
    if (role) {
      req.utilisateur = { id: 1, role: role as 'admin' | 'agent' | 'passager' };
    }
    next();
  });
  app.get('/personnel', exigerRole('admin', 'agent'), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(gestionnaireErreurs(() => {}));
  return app;
}

describe('exigerRole', () => {
  it('laisse passer un rôle autorisé', async () => {
    const reponse = await request(creerAppDeTest()).get('/personnel').set('X-Role', 'agent');

    expect(reponse.status).toBe(200);
  });

  it('refuse un rôle non autorisé (403)', async () => {
    const reponse = await request(creerAppDeTest()).get('/personnel').set('X-Role', 'passager');

    expect(reponse.status).toBe(403);
    expect(reponse.body.erreur.code).toBe('INTERDIT');
  });

  it("refuse quand personne n'est connecté (401)", async () => {
    const reponse = await request(creerAppDeTest()).get('/personnel');

    expect(reponse.status).toBe(401);
  });
});
