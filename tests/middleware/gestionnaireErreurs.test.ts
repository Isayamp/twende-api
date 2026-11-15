import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ErreurApp, Conflit, NonTrouve } from '../../src/erreurs/ErreurApp.js';
import { gestionnaireErreurs } from '../../src/middleware/gestionnaireErreurs.js';
import { valider } from '../../src/middleware/valider.js';

// Petite application de test : chaque route lance une erreur différente.
function creerAppDeTest() {
  const app = express();
  app.use(express.json());
  app.get('/erreur-metier', () => {
    throw new Conflit('PLACE_DEJA_PRISE', 'La place 12 est déjà prise.');
  });
  app.get('/introuvable', () => {
    throw new NonTrouve('Trajet introuvable.');
  });
  app.get('/inattendue', () => {
    throw new Error('mot de passe de la base : secret');
  });
  app.post(
    '/valide',
    valider({ corps: z.object({ nombre: z.number().int().min(1) }) }),
    (req, res) => {
      res.json({ recu: req.body });
    },
  );
  app.use(gestionnaireErreurs(() => {}));
  return app;
}

describe('gestionnaireErreurs', () => {
  it('convertit une erreur métier en code HTTP et message clair', async () => {
    const reponse = await request(creerAppDeTest()).get('/erreur-metier');

    expect(reponse.status).toBe(409);
    expect(reponse.body).toEqual({
      succes: false,
      erreur: { code: 'PLACE_DEJA_PRISE', message: 'La place 12 est déjà prise.' },
    });
  });

  it('renvoie 404 pour une ressource introuvable', async () => {
    const reponse = await request(creerAppDeTest()).get('/introuvable');

    expect(reponse.status).toBe(404);
    expect(reponse.body.erreur.code).toBe('NON_TROUVE');
  });

  it("cache les détails d'une erreur inattendue (500)", async () => {
    const reponse = await request(creerAppDeTest()).get('/inattendue');

    expect(reponse.status).toBe(500);
    expect(reponse.body.erreur.code).toBe('ERREUR_SERVEUR');
    expect(JSON.stringify(reponse.body)).not.toContain('secret');
  });

  it('renvoie 400 quand le JSON est mal formé', async () => {
    const reponse = await request(creerAppDeTest())
      .post('/valide')
      .set('Content-Type', 'application/json')
      .send('{ pas du json');

    expect(reponse.status).toBe(400);
    expect(reponse.body.erreur.code).toBe('JSON_INVALIDE');
  });

  it('renvoie 422 avec le détail des champs invalides', async () => {
    const reponse = await request(creerAppDeTest()).post('/valide').send({ nombre: 0 });

    expect(reponse.status).toBe(422);
    expect(reponse.body.erreur.code).toBe('VALIDATION');
    expect(reponse.body.erreur.details[0].champ).toBe('nombre');
  });

  it('laisse passer des données valides', async () => {
    const reponse = await request(creerAppDeTest()).post('/valide').send({ nombre: 3 });

    expect(reponse.status).toBe(200);
    expect(reponse.body.recu).toEqual({ nombre: 3 });
  });

  it('ErreurApp garde son code HTTP', () => {
    expect(new ErreurApp(418, 'THE', 'message').statut).toBe(418);
  });
});
