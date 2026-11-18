import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { creerAppTest, jetonPour, prisma, viderBase } from '../helpers/bd.js';
import { creerReseau, creerTrajet, vendrePlaces } from '../helpers/reseau.js';

const app = creerAppTest();
const URL = '/api/v1/statistiques/remplissage';

let reseau: Awaited<ReturnType<typeof creerReseau>>;
let jetonAgent: string;
let jetonPassager: string;
let idAgent: number;

const avec = (jeton: string) => ({ Authorization: `Bearer ${jeton}` });

beforeEach(async () => {
  await viderBase();
  reseau = await creerReseau();
  jetonAgent = await jetonPour(app, 'agent');
  jetonPassager = await jetonPour(app, 'passager');
  idAgent = (await prisma.utilisateur.findUniqueOrThrow({ where: { email: 'agent@twende.test' } }))
    .id_utilisateur;
});

afterAll(async () => {
  await viderBase();
  await prisma.$disconnect();
});

describe('GET /statistiques/remplissage', () => {
  it('donne le taux par trajet (billets annulés exclus) et un résumé', async () => {
    const t1 = await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, '2030-01-01T05:00:00Z');
    const t2 = await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, '2030-01-02T05:00:00Z');
    await vendrePlaces(t1.id_trajet, idAgent, [1, 2, 3, 4, 5]); // 5 / 10
    await vendrePlaces(t1.id_trajet, idAgent, [6], 'annule'); // ne compte pas
    await vendrePlaces(t2.id_trajet, idAgent, [1]); // 1 / 10

    const reponse = await request(app).get(URL).set(avec(jetonAgent));

    expect(reponse.status).toBe(200);
    const { resume, trajets } = reponse.body.donnees;
    expect(trajets).toHaveLength(2);
    expect(trajets[0]).toMatchObject({
      id_trajet: t1.id_trajet,
      capacite: 10,
      places_vendues: 5,
      taux_remplissage: 50,
    });
    expect(trajets[1]).toMatchObject({ places_vendues: 1, taux_remplissage: 10 });
    expect(resume).toEqual({
      nombre_trajets: 2,
      capacite_totale: 20,
      places_vendues: 6,
      taux_remplissage: 30,
    });
    expect(reponse.body.meta).toEqual({ page: 1, limite: 20, total: 2 });
  });

  it('ignore les trajets annulés et filtre par période et par ligne', async () => {
    const t1 = await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, '2030-01-01T05:00:00Z');
    await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, '2030-01-02T05:00:00Z', 'annule');
    await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, '2030-02-01T05:00:00Z');
    const autre = await prisma.ligne.create({ data: { code: 'BJM-NGZ', nom: 'Autre' } });
    await creerTrajet(autre.id_ligne, reseau.bus.id_vehicule, '2030-01-03T05:00:00Z');

    const periode = await request(app).get(`${URL}?du=2030-01-01&au=2030-01-31`).set(avec(jetonAgent));
    const ligne = await request(app)
      .get(`${URL}?ligne_id=${reseau.ligne.id_ligne}&du=2030-01-01&au=2030-01-31`)
      .set(avec(jetonAgent));

    expect(periode.body.meta.total).toBe(2);
    expect(ligne.body.meta.total).toBe(1);
    expect(ligne.body.donnees.trajets[0].id_trajet).toBe(t1.id_trajet);
  });

  it('un résumé à zéro quand rien ne correspond, sans division par zéro', async () => {
    const reponse = await request(app).get(`${URL}?du=2040-01-01`).set(avec(jetonAgent));

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees.trajets).toEqual([]);
    expect(reponse.body.donnees.resume).toEqual({
      nombre_trajets: 0,
      capacite_totale: 0,
      places_vendues: 0,
      taux_remplissage: 0,
    });
  });

  it('pagine les trajets mais calcule le résumé sur tous', async () => {
    for (let i = 1; i <= 3; i++) {
      await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, `2030-01-0${i}T05:00:00Z`);
    }

    const reponse = await request(app).get(`${URL}?limite=1&page=2`).set(avec(jetonAgent));

    expect(reponse.body.donnees.trajets).toHaveLength(1);
    expect(reponse.body.donnees.resume.nombre_trajets).toBe(3);
    expect(reponse.body.meta).toEqual({ page: 2, limite: 1, total: 3 });
  });

  it('refuse sans connexion (401), au passager (403) et un filtre invalide (422)', async () => {
    expect((await request(app).get(URL)).status).toBe(401);
    expect((await request(app).get(URL).set(avec(jetonPassager))).status).toBe(403);
    expect((await request(app).get(`${URL}?du=hier`).set(avec(jetonAgent))).status).toBe(422);
    expect((await request(app).get(`${URL}?du=2030-02-01&au=2030-01-01`).set(avec(jetonAgent))).status).toBe(422);
  });
});

describe('GET /trajets/:id/remplissage', () => {
  it('donne le détail d’un trajet (personnel) ; 404 si inconnu', async () => {
    const t = await creerTrajet(reseau.ligne.id_ligne, reseau.bus.id_vehicule, '2030-01-01T05:00:00Z');
    await vendrePlaces(t.id_trajet, idAgent, [1, 2]);

    const reponse = await request(app)
      .get(`/api/v1/trajets/${t.id_trajet}/remplissage`)
      .set(avec(jetonAgent));
    const interdit = await request(app)
      .get(`/api/v1/trajets/${t.id_trajet}/remplissage`)
      .set(avec(jetonPassager));
    const absent = await request(app).get('/api/v1/trajets/999999/remplissage').set(avec(jetonAgent));

    expect(reponse.status).toBe(200);
    expect(reponse.body.donnees).toMatchObject({
      id_trajet: t.id_trajet,
      capacite: 10,
      places_vendues: 2,
      places_libres: 8,
      taux_remplissage: 20,
    });
    expect(interdit.status).toBe(403);
    expect(absent.status).toBe(404);
  });
});
